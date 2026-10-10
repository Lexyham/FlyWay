const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

let mongoClient = null;
let mongoDb = null;

// Every collection the app uses (same names as the files in /data).
const COLLECTIONS = [
  'users',
  'bookings',
  'transactions',
  'licenses',
  'promoCodes',
  'messages',
  'accessLog',
  'reviews',
  'notifications',
  'payments',
  'verificationSessions',
  'emailReports',
];

// In-memory copy of each collection. server.js reads/writes synchronously (readDB/writeDB),
// so we keep a cache that is loaded from Atlas at startup and written back in the background.
const cache = {};
const persistedState = {}; // collection -> Map(key -> JSON string last written to Atlas)
const queues = {};         // collection -> promise chain so writes to one collection never overlap

function getMongoUri() {
  return (process.env.MONGODB_URI || '').trim();
}

function isMongoEnabled() {
  const uri = getMongoUri();
  if (!uri) return false;
  const explicit = String(process.env.USE_MONGODB || '').trim().toLowerCase();
  if (explicit === 'false' || explicit === '0' || explicit === 'no') return false;
  return explicit === 'true' || explicit === '1' || process.env.NODE_ENV === 'production';
}

async function connect() {
  if (!isMongoEnabled()) return null;
  if (mongoClient && mongoDb) return { client: mongoClient, db: mongoDb };

  mongoClient = new MongoClient(getMongoUri(), {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true,
  });

  try {
    await mongoClient.connect();
  } catch (err) {
    mongoClient = null;
    throw new Error(explainConnectError(err));
  }
  mongoDb = mongoClient.db(process.env.MONGODB_DB_NAME || 'flyway');
  return { client: mongoClient, db: mongoDb };
}

// Turn the driver's cryptic errors into the actual thing to fix in Atlas.
function explainConnectError(err) {
  const msg = String(err && err.message || err);
  if (/bad auth|authentication failed/i.test(msg)) {
    return `MongoDB login failed (${msg}). Check the database-user name/password in MONGODB_URI. If the password has special characters (@ : / ? # %), URL-encode them.`;
  }
  if (/ENOTFOUND|querySrv|ECONNREFUSED.*_mongodb/i.test(msg)) {
    return `MongoDB host could not be found (${msg}). Check the cluster hostname in MONGODB_URI (copy it again from Atlas > Connect > Drivers).`;
  }
  if (/Server selection timed out|ReplicaSetNoPrimary|ETIMEDOUT|MongoServerSelectionError/i.test(msg)) {
    return `MongoDB Atlas is not reachable (${msg}). Most common cause: Atlas > Network Access does not allow this server. Add 0.0.0.0/0 (Render has no fixed IP on free plans), wait ~1 minute, then restart.`;
  }
  return `MongoDB connection failed: ${msg}`;
}

async function ensureIndexes(db) {
  if (!db) return;
  const wanted = [
    ['users', { email: 1 }, { unique: true, sparse: true }],
    ['users', { username: 1 }, { unique: true, sparse: true }],
    ['licenses', { key: 1 }, { unique: true, sparse: true }],
    ['bookings', { ref: 1 }, { unique: true, sparse: true }],
    ['transactions', { bookingId: 1 }, { sparse: true }],
  ];
  const results = await Promise.allSettled(
    wanted.map(([name, keys, opts]) => db.collection(name).createIndex(keys, opts))
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      // An index failure (e.g. duplicate emails already in the data) must not take the site down.
      console.warn(`[Mongo] Could not create index on ${wanted[i][0]}:`, r.reason && r.reason.message);
    }
  });
}

// Stable identity for a document: `id` for most collections, `key` for licenses.
function docKey(doc, index) {
  if (doc && doc.id !== undefined && doc.id !== null) return String(doc.id);
  if (doc && doc.key !== undefined && doc.key !== null) return String(doc.key);
  return `idx-${index}`;
}

const stripId = (doc) => {
  const { _id, ...rest } = doc;
  return rest;
};

function readLocalJson(dataDir, name) {
  try {
    const file = path.join(dataDir, `${name}.json`);
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberPersisted(name, docs) {
  const map = new Map();
  docs.forEach((d, i) => map.set(docKey(d, i), JSON.stringify(d)));
  persistedState[name] = map;
}

/**
 * Connect, create indexes, and load every collection into memory.
 * First run only: if Atlas has no data yet, the local /data/*.json files are copied in once.
 */
async function initStorage(dataDir = path.join(__dirname, '..', 'data')) {
  const conn = await connect();
  if (!conn) return { enabled: false };

  await ensureIndexes(conn.db);
  const meta = conn.db.collection('_meta');
  const summary = {};

  for (const name of COLLECTIONS) {
    const col = conn.db.collection(name);
    let docs = (await col.find({}).toArray()).map(stripId);

    const seedFlag = await meta.findOne({ _id: `seeded:${name}` });
    if (!docs.length && !seedFlag) {
      const local = readLocalJson(dataDir, name);
      if (local.length) {
        const ops = local.map((d, i) => ({
          replaceOne: { filter: { _id: docKey(d, i) }, replacement: stripId(d), upsert: true },
        }));
        await col.bulkWrite(ops, { ordered: false });
        docs = local.map(stripId);
        console.log(`[Mongo] Seeded "${name}" from local JSON (${local.length} docs).`);
      }
      await meta.updateOne({ _id: `seeded:${name}` }, { $set: { at: new Date() } }, { upsert: true });
    }

    cache[name] = docs;
    rememberPersisted(name, docs);
    summary[name] = docs.length;
  }

  return { enabled: true, summary };
}

function getCached(name) {
  return JSON.parse(JSON.stringify(cache[name] || []));
}

// Update memory immediately (so the next request sees it) and write to Atlas in the background.
function setCached(name, docs) {
  const data = Array.isArray(docs) ? JSON.parse(JSON.stringify(docs)) : [];
  cache[name] = data;
  queues[name] = (queues[name] || Promise.resolve())
    .then(() => syncCollection(name, data))
    .catch((err) => console.error(`[Mongo] Failed to save "${name}":`, err.message));
  return queues[name];
}

// Only writes what actually changed since the last successful save.
async function syncCollection(name, docs) {
  if (!mongoDb) return;
  const col = mongoDb.collection(name);
  const previous = persistedState[name] || new Map();
  const next = new Map();
  const ops = [];

  docs.forEach((doc, i) => {
    const key = docKey(doc, i);
    const body = stripId(doc);
    const serialised = JSON.stringify(body);
    next.set(key, serialised);
    if (previous.get(key) !== serialised) {
      ops.push({ replaceOne: { filter: { _id: key }, replacement: body, upsert: true } });
    }
  });

  const removed = [...previous.keys()].filter((k) => !next.has(k));
  if (removed.length) ops.push({ deleteMany: { filter: { _id: { $in: removed } } } });

  if (ops.length) await col.bulkWrite(ops, { ordered: false });
  persistedState[name] = next;
}

// Wait for pending writes (call before the process exits).
async function flush() {
  await Promise.all(Object.values(queues));
}

async function close() {
  await flush();
  if (mongoClient) await mongoClient.close();
  mongoClient = null;
  mongoDb = null;
}

// Kept for scripts/migrate-json-to-mongodb.js (manual full re-import; overwrites Atlas data).
async function migrateJsonToMongo(dataDir = path.join(__dirname, '..', 'data')) {
  const conn = await connect();
  if (!conn) {
    throw new Error('MongoDB is not enabled. Set MONGODB_URI and USE_MONGODB=true before migrating.');
  }
  await ensureIndexes(conn.db);

  const summary = {};
  for (const name of COLLECTIONS) {
    const filePath = path.join(dataDir, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;
    const payload = readLocalJson(dataDir, name);
    const collection = conn.db.collection(name);
    await collection.deleteMany({});
    if (payload.length) {
      await collection.insertMany(payload.map((d, i) => ({ _id: docKey(d, i), ...stripId(d) })));
    }
    await conn.db.collection('_meta').updateOne({ _id: `seeded:${name}` }, { $set: { at: new Date() } }, { upsert: true });
    summary[name] = payload.length;
  }
  return summary;
}

function getStorageStatus() {
  const configured = Boolean(getMongoUri());
  const enabled = isMongoEnabled();
  return {
    configured,
    enabled,
    connected: Boolean(mongoDb),
    mode: enabled ? 'mongodb' : 'json',
  };
}

module.exports = {
  COLLECTIONS,
  getMongoUri,
  isMongoEnabled,
  connect,
  ensureIndexes,
  initStorage,
  getCached,
  setCached,
  flush,
  close,
  migrateJsonToMongo,
  getStorageStatus,
};
