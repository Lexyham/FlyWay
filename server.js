require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const dns = require('dns').promises;
const rateLimit = require('express-rate-limit');
const emailService = require('./services/emailDeliveryService');
const brevoMail = require('./services/brevoMailService');
const mongoStore = require('./services/mongoService');
const { getStorageStatus } = mongoStore;

const brevoConfigured = brevoMail.isConfigured();
if (!brevoConfigured) {
  console.warn('[Brevo] ' + brevoMail.missingConfigMessage() + ' Email sending is disabled until then.');
} else {
  console.log(`[Brevo] Email enabled via ${brevoMail.getTransport() === 'api' ? 'HTTPS API' : 'SMTP'}.`);
}

const sendOtpEmail = async (toEmail, otp, action, recipientName) => {
  if (!brevoConfigured) {
    console.warn('[Brevo] Not configured — OTP not emailed. Set BREVO_API_KEY and SMTP_FROM_EMAIL in the service environment.');
    return false;
  }
  const label    = action === 'reset' ? 'Password Reset' : 'Account Verification';
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const intro    = action === 'reset'
    ? 'We received a request to reset your FlyWay account password. Use the secure code below to proceed. If you did not request a password reset, you can safely ignore this email — your account remains secure.'
    : 'Welcome to FlyWay! To complete your registration and activate your account, please enter the one-time verification code below. This code confirms your email address.';
  const year = new Date().getFullYear();
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>FlyWay — ${label}</title></head>
<body style="margin:0;padding:0;background:#060f1e;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060f1e;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.5);">
      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#021933 0%,#0a2a54 60%,#0e3770 100%);padding:38px 48px 34px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display:inline-block;background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.35);border-radius:999px;padding:6px 16px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#00d4ff;margin-bottom:18px;">✈ FlyWay Security</div>
                <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${label}</h1>
                <p style="margin:10px 0 0;font-size:14px;color:#7ca8cc;line-height:1.6;">Secure verification for your FlyWay account</p>
              </td>
              <td width="72" align="right" valign="top">
                <div style="width:62px;height:62px;border-radius:18px;background:rgba(0,212,255,0.1);border:1.5px solid rgba(0,212,255,0.3);display:flex;align-items:center;justify-content:center;font-size:28px;text-align:center;line-height:62px;">🔐</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- BODY -->
      <tr>
        <td style="background:#071526;padding:40px 48px 36px;">
          <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:#cde8ff;">${greeting}</p>
          <p style="margin:0 0 32px;font-size:14px;color:#7ca8cc;line-height:1.75;">${intro}</p>

          <!-- Keep the code as one text string so it can be selected and copied in email clients. -->
          <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#3d6a99;">Your one-time code</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td>
                <div style="display:inline-block;background:#0b1628;border:2px solid #00d4ff;border-radius:10px;padding:14px 20px;font-family:monospace;font-size:28px;font-weight:700;color:#00d4ff;letter-spacing:0.3em;user-select:all;-webkit-user-select:all;cursor:text;">${otp}</div>
                <p style="margin:10px 0 0;font-size:12px;color:#7ca8cc;">Select and copy this code to paste it.</p>
              </td>
            </tr>
          </table>

          <!-- Expiry notice -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="background:rgba(255,200,0,0.06);border:1px solid rgba(255,200,0,0.2);border-radius:12px;padding:14px 18px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:18px;padding-right:10px;">⏱</td>
                    <td style="font-size:13px;color:#f0c040;line-height:1.6;">This code expires in <strong>1 minute</strong>. Do not share it with anyone, including FlyWay staff. If you didn't request this, your account is safe — simply ignore this email.</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Security tips -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:18px 22px;">
                <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#3d6a99;">Security reminders</p>
                <p style="margin:0 0 6px;font-size:13px;color:#7ca8cc;">🔒 FlyWay will <strong style="color:#a0c4e8;">never</strong> ask for your OTP via phone or chat.</p>
                <p style="margin:0;font-size:13px;color:#7ca8cc;">🛡 Only enter this code on the official FlyWay website.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- FOOTER -->
      <tr>
        <td style="background:#040d1a;padding:24px 48px 30px;border-top:1px solid rgba(255,255,255,0.06);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#3d5a78;line-height:1.7;">
                Need help? Contact <a href="mailto:${process.env.SMTP_FROM_EMAIL||'support@flyway.com'}" style="color:#2d7abe;text-decoration:none;">${process.env.SMTP_FROM_EMAIL||'support@flyway.com'}</a><br>
                © ${year} FlyWay. All rights reserved.
              </td>
              <td align="right" style="font-size:11px;color:#28405c;">✈ FlyWay Global</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  const subject = `FlyWay ${label} Code: ${otp}`;
  const textBody = `Your FlyWay ${label} code is: ${otp}\n\nExpires in 1 minute. Do not share this code.\n\nIf you did not request this, you can safely ignore this email.\n\n— FlyWay Security Team`;
  try {
    await brevoMail.sendEmail({ to: toEmail, subject, htmlBody: html, textBody });
    return true;
  } catch (err) {
    console.error('[Brevo] Failed to send OTP email:', err.message);
    return false;
  }
};


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Missing required environment variable JWT_SECRET');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    socket.emit('session_connected', { sessionId, message: 'Secure gateway channel established.' });
  });
});

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
[dataDir, uploadsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const FILES = {
  users:        path.join(dataDir, 'users.json'),
  bookings:     path.join(dataDir, 'bookings.json'),
  transactions: path.join(dataDir, 'transactions.json'),
  licenses:     path.join(dataDir, 'licenses.json'),
  promoCodes:   path.join(dataDir, 'promoCodes.json'),
  messages:     path.join(dataDir, 'messages.json'),
  accessLog:    path.join(dataDir, 'accessLog.json'),
  reviews:      path.join(dataDir, 'reviews.json'),
  notifications:path.join(dataDir, 'notifications.json'),
  payments:     path.join(dataDir, 'payments.json'),
  verificationSessions: path.join(dataDir, 'verificationSessions.json'),
  emailReports: path.join(dataDir, 'emailReports.json'),
};

// Storage: MongoDB Atlas when enabled (data is loaded into memory by initStorage() at startup and
// every writeDB() is saved back to Atlas); otherwise the local JSON files, as before.
const USE_MONGO = mongoStore.isMongoEnabled();
const collectionName = (file) => path.basename(file, '.json');

const readDB = (file) => {
  if (USE_MONGO) return mongoStore.getCached(collectionName(file));
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
};
const writeDB = (file, data) => {
  if (USE_MONGO) { mongoStore.setCached(collectionName(file), data); return; }
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
if (!USE_MONGO) Object.values(FILES).forEach(f => { if (!fs.existsSync(f)) writeDB(f, []); });

// emailDeliveryService keeps its own copy of the report log; route it through the same storage.
emailService.setStore({ load: () => readDB(FILES.emailReports), save: (reports) => writeDB(FILES.emailReports, reports) });

if (USE_MONGO) {
  console.log('[Storage] MongoDB Atlas mode ON. Connecting at startup...');
} else {
  console.log('[Storage] JSON file storage is active. NOTE: on Render the disk is wiped on every deploy/restart, so set MONGODB_URI (and USE_MONGODB=true) there.');
}

const sanitize = (u) => { const { password, ...s } = u; return s; };

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(403).json({ error: 'Invalid token' }); }
};

const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
};

const logAccess = (userId, action, details = {}, req) => {
  const logs = readDB(FILES.accessLog);
  logs.push({ id: uuidv4(), userId, action, details, ip: req?.ip || 'unknown', userAgent: req?.headers?.['user-agent'] || 'unknown', timestamp: new Date().toISOString() });
  if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  writeDB(FILES.accessLog, logs);
};

const createNotification = (userId, type, title, message, data = {}) => {
  const notes = readDB(FILES.notifications);
  const note = { id: uuidv4(), userId, type, title, message, data, read: false, createdAt: new Date().toISOString() };
  notes.push(note);
  writeDB(FILES.notifications, notes);
  io.emit(`notification_${userId}`, note);
  io.emit('admin_notification', { ...note, userId });
  return note;
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
// Use only user-agent for fingerprint — IP excluded because reverse proxies (Render, nginx)
// can present different IPs for the same client across requests, breaking session verification.
const getRequestFingerprint = (req) => hashValue(req.headers['user-agent'] || 'unknown');
const releaseExpiredLicenseReservations = () => {
  const licenses = readDB(FILES.licenses);
  const sessions = readDB(FILES.verificationSessions);
  const now = new Date();
  const expiredSessionIds = sessions
    .filter(session => new Date(session.expiresAt) <= now || session.status === 'expired')
    .map(session => session.id);
  let changed = false;
  licenses.forEach((license) => {
    if (license.reservedBySession && expiredSessionIds.includes(license.reservedBySession)) {
      delete license.reservedBySession;
      delete license.reservedAt;
      changed = true;
    }
  });
  if (changed) writeDB(FILES.licenses, licenses);
};

const getVerificationSessions = () => {
  releaseExpiredLicenseReservations();
  const sessions = readDB(FILES.verificationSessions);
  const now = new Date();
  // Keep sessions that haven't expired by time, regardless of status
  // 'verified' sessions must survive so password reset can complete after OTP is accepted
  const active = sessions.filter(session => new Date(session.expiresAt) > now && session.status !== 'expired');
  if (active.length !== sessions.length) writeDB(FILES.verificationSessions, active);
  return active;
};
const getVerificationSessionById = (id) => getVerificationSessions().find(session => session.id === id);
const saveVerificationSessions = (sessions) => writeDB(FILES.verificationSessions, sessions);
const createVerificationSession = ({ email, action, userId, fingerprint, payload }) => {
  const sessions = getVerificationSessions();
  const otp = generateOtp();
  const session = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
    action,
    email: email.toLowerCase(),
    userId: userId || null,
    status: 'pending',
    attempts: 0,
    maxAttempts: 2,
    revealStage: 0,
    revealRequests: 0,
    maxRevealRequests: 3,
    cooldownUntil: null,
    otp,
    fingerprint,
    registration: payload || null,
    lastAccessed: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.push(session);
  saveVerificationSessions(sessions);
  return session;
};
const buildRevealPayload = (otp) => {
  const encoded = Buffer.from(String(otp)).toString('base64');
  return Buffer.from(encoded.split('').reverse().join('')).toString('base64');
};

const PAYMENT_DETAILS = {
  bankTransfer: {
    bankName:      process.env.BANK_NAME      || '',
    accountName:   process.env.ACCOUNT_NAME   || '',
    accountNumber: process.env.ACCOUNT_NUMBER || '',
    routingNumber: process.env.ROUTING_NUMBER || '',
    swiftCode:     process.env.SWIFT_CODE     || '',
    iban:          process.env.IBAN           || '',
  },
  crypto: {
    bitcoin:  process.env.BTC_ADDRESS  || '',
    ethereum: process.env.ETH_ADDRESS  || '',
    usdt:     process.env.USDT_ADDRESS || '',
    usdc:     process.env.USDC_ADDRESS || '',
    bnb:      process.env.BNB_ADDRESS  || '',
    twt:      process.env.TWT_ADDRESS  || '',
    sol:      process.env.SOL_ADDRESS  || '',
    xrp:      process.env.XRP_ADDRESS  || '',
    trx:      process.env.TRX_ADDRESS  || '',
    doge:     process.env.DOGE_ADDRESS || '',
  },
  mobileWallet: {
    paystack:    process.env.PAYSTACK_NUM  || '',
    flutterwave: process.env.FLUTTER_NUM  || '',
    cashapp:     process.env.CASHAPP_TAG  || '',
    paypal:      process.env.PAYPAL_EMAIL || '',
  },
  giftCards: ['Amazon','iTunes','Google Play','Steam','eBay','Walmart','Target','Visa Gift Card','Mastercard Gift Card','American Express Gift Card'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `proof-${Date.now()}-${uuidv4().slice(0,8)}${ext}`); }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|pdf|webp/i.test(path.extname(file.originalname));
    ok ? cb(null, true) : cb(new Error('Images and PDFs only'));
  }
});

function seed() {
  const existingLicenses = readDB(FILES.licenses);
  const allRequiredKeys = ['FLY-7B2N-9F4R-8T3Y','FLY-FAMILY-2024','FLY-BUSINESS-PRO','FLY-ADMIN-MASTER','FLY-SOLO-TRAVEL','FLY-HOLIDAY-FUN','FLY-ADVENTURE-2024','FLY-STUDENT-PASS','FLY-SENIOR-GOLD','FLY-COUPLE-GETAWAY','FLY-GROUP-TRIP','FLY-HONEYMOON','FLY-CARGO-EXPRESS'];
  const missingKeys = allRequiredKeys.filter(k => !existingLicenses.find(l => l.key === k));
  if (missingKeys.length > 0 || existingLicenses.length === 0) {
    const baseLicenses = existingLicenses.filter(l => !missingKeys.includes(l.key));
    const newLicenses = [
      { key:'FLY-7B2N-9F4R-8T3Y', status:'active', type:'standard',  usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-FAMILY-2024',     status:'active', type:'family',    usedBy:null, expiresAt:'2027-12-31', maxUsers:5,  createdAt:new Date().toISOString() },
      { key:'FLY-BUSINESS-PRO',    status:'active', type:'business',  usedBy:null, expiresAt:'2027-12-31', maxUsers:10, createdAt:new Date().toISOString() },
      { key:'FLY-ADMIN-MASTER',    status:'active', type:'admin',     usedBy:null, expiresAt:'2030-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-SOLO-TRAVEL',     status:'active', type:'solo',      usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-HOLIDAY-FUN',     status:'active', type:'holiday',   usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-ADVENTURE-2024',  status:'active', type:'adventure', usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-STUDENT-PASS',    status:'active', type:'student',   usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-SENIOR-GOLD',     status:'active', type:'senior',    usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
      { key:'FLY-COUPLE-GETAWAY',  status:'active', type:'couple',    usedBy:null, expiresAt:'2027-12-31', maxUsers:2,  createdAt:new Date().toISOString() },
      { key:'FLY-GROUP-TRIP',      status:'active', type:'group',     usedBy:null, expiresAt:'2027-12-31', maxUsers:8,  createdAt:new Date().toISOString() },
      { key:'FLY-HONEYMOON',       status:'active', type:'honeymoon', usedBy:null, expiresAt:'2027-12-31', maxUsers:2,  createdAt:new Date().toISOString() },
      { key:'FLY-CARGO-EXPRESS',   status:'active', type:'cargo',     usedBy:null, expiresAt:'2027-12-31', maxUsers:1,  createdAt:new Date().toISOString() },
    ];
    writeDB(FILES.licenses, [...baseLicenses, ...newLicenses.filter(l => missingKeys.includes(l.key))]);
  }

  const existingUsers = readDB(FILES.users);
  const adminIndex = existingUsers.findIndex(u => u.username === 'Lexy');
  const bootstrapAdminPassword = process.env.ADMIN_PASSWORD;
  const expectedAdmin = {
    id:'admin-001', username:'Lexy', email:'admin@flyway.com',
    firstName:'Lexy', lastName:'Admin', phone:'+1-555-0000',
    role:'admin', licenseKey:'FLY-ADMIN-MASTER', loyaltyPoints:0,
    isActive:true, emailVerified:true, avatar:null,
    preferences:{ meal:'Standard', seat:'aisle', currency:'USD' },
    createdAt:new Date().toISOString(), lastLogin:null
  };

  if (adminIndex === -1) {
    if (!bootstrapAdminPassword) {
      throw new Error('Missing required environment variable ADMIN_PASSWORD to create the initial admin account');
    }
    existingUsers.push({
      ...expectedAdmin,
      password: bcrypt.hashSync(bootstrapAdminPassword, 10),
    });
    writeDB(FILES.users, existingUsers);
  } else {
    const adminUser = existingUsers[adminIndex];
    if (!adminUser.password) {
      if (!bootstrapAdminPassword) {
        throw new Error('Missing required environment variable ADMIN_PASSWORD to set the initial admin password');
      }
      adminUser.password = bcrypt.hashSync(bootstrapAdminPassword, 10);
    }
    existingUsers[adminIndex] = {
      ...adminUser,
      ...expectedAdmin,
      id: adminUser.id || expectedAdmin.id,
      username: 'Lexy',
      email: adminUser.email || expectedAdmin.email,
      role: 'admin',
      isActive: true,
      emailVerified: true,
      licenseKey: adminUser.licenseKey || expectedAdmin.licenseKey,
      firstName: adminUser.firstName || 'Lexy',
      lastName: adminUser.lastName || 'Admin',
      preferences: adminUser.preferences || expectedAdmin.preferences,
      createdAt: adminUser.createdAt || expectedAdmin.createdAt,
      lastLogin: adminUser.lastLogin || null,
    };
    writeDB(FILES.users, existingUsers);
  }

  if (readDB(FILES.promoCodes).length === 0) {
    writeDB(FILES.promoCodes, [
      { id:uuidv4(), code:'L1E2X3Y4',  type:'auto_payment', description:'Auto-payment — 100% off', discountType:'percentage', discountValue:100, maxDiscount:99999, isActive:true, adminOnly:true, usageLimit:100, usedCount:0, validUntil:'2027-12-31', createdAt:new Date().toISOString() },
      { id:uuidv4(), code:'FLYWAY25',  type:'discount', description:'25% off all bookings', discountType:'percentage', discountValue:25, maxDiscount:500, isActive:true, adminOnly:true, usageLimit:200, usedCount:0, validUntil:'2027-12-31', createdAt:new Date().toISOString() },
      { id:uuidv4(), code:'WELCOME50', type:'discount', description:'50% off new users', discountType:'percentage', discountValue:50, maxDiscount:300, isActive:true, adminOnly:true, usageLimit:100, usedCount:0, validUntil:'2027-12-31', createdAt:new Date().toISOString() },
      { id:uuidv4(), code:'FAMILY10',  type:'family', description:'10% off 3+ passengers', discountType:'percentage', discountValue:10, maxDiscount:200, isActive:true, adminOnly:true, minPassengers:3, usageLimit:500, usedCount:0, validUntil:'2027-12-31', createdAt:new Date().toISOString() },
    ]);
  }

  
  const existingPromos = readDB(FILES.promoCodes);
  const lexyPromoIdx = existingPromos.findIndex(p => p.code === 'L1E2X3Y4');
  if (lexyPromoIdx >= 0 && !existingPromos[lexyPromoIdx].isActive) {
    existingPromos[lexyPromoIdx].isActive = true;
    writeDB(FILES.promoCodes, existingPromos);
  }

  if (readDB(FILES.reviews).length === 0) {
    writeDB(FILES.reviews, [
      { id:uuidv4(), name:'Sarah K.',   avatar:'S', rating:5, text:'Absolutely seamless booking experience! Got my business class upgrade instantly. FlyWay is my go-to for all travel.', route:'JFK → LHR', date:'2024-11-12', source:'Trustpilot' },
      { id:uuidv4(), name:'Michael O.', avatar:'M', rating:5, text:'Used the promo code and saved $400 on a round trip to Dubai. Customer service was incredibly responsive.', route:'LAX → DXB', date:'2024-12-01', source:'TripAdvisor' },
      { id:uuidv4(), name:'Emma L.',    avatar:'E', rating:5, text:'Booked family flights for 6 people, the group discount was amazing. Everyone had their seats together!', route:'ORD → CDG', date:'2025-01-08', source:'Trustpilot' },
      { id:uuidv4(), name:'James A.',   avatar:'J', rating:5, text:'The flight tracker gave real-time updates. My family knew exactly when to pick me up from the airport.', route:'SIN → LHR', date:'2025-01-15', source:'TripAdvisor' },
      { id:uuidv4(), name:'Fatima H.',  avatar:'F', rating:4, text:'Very professional. The boarding pass PDF was beautifully designed and worked perfectly at the airport gate.', route:'DXB → JFK', date:'2025-01-20', source:'TrustScore' },
      { id:uuidv4(), name:'David C.',   avatar:'D', rating:5, text:'First class experience at economy price with the discount code! Will definitely book again for my next trip.', route:'SFO → NRT', date:'2025-02-01', source:'Trustpilot' },
    ]);
  }
}
// seed() is called from start() (bottom of file) once storage has finished loading.

// License Management Utilities
const LICENSE_STATUSES = ['active', 'expired', 'suspended', 'revoked', 'paused', 'disabled'];
const LICENSE_TYPES = ['standard', 'family', 'business', 'admin', 'solo', 'holiday', 'adventure', 'student', 'senior', 'couple', 'group', 'honeymoon', 'cargo', 'temporary', 'renewable', 'lifetime'];

function getLicenseStatus(license) {
  if (!license) return 'invalid';
  if (license.status === 'revoked') return 'revoked';
  if (license.status === 'suspended') return 'suspended';
  if (license.status === 'paused') return 'paused';
  if (license.status === 'disabled') return 'disabled';
  if (new Date(license.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function getLicenseExpiryInfo(license) {
  if (!license || !license.expiresAt) return { isExpired: true, daysLeft: 0, hoursLeft: 0, text: 'Invalid' };
  
  const now = new Date();
  const expDate = new Date(license.expiresAt);
  const diffMs = expDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  
  if (diffMs < 0) {
    const agoDays = Math.abs(diffDays);
    const agoHours = Math.abs(diffHours);
    if (agoDays === 0) return { isExpired: true, daysLeft: agoDays, hoursLeft: agoHours, text: `Expired ${agoHours} hour${agoHours !== 1 ? 's' : ''} ago` };
    return { isExpired: true, daysLeft: agoDays, hoursLeft: agoHours, text: `Expired ${agoDays} day${agoDays !== 1 ? 's' : ''} ago` };
  }
  
  if (license.type === 'lifetime' || expDate.getFullYear() >= 2030) {
    return { isExpired: false, daysLeft: Infinity, hoursLeft: Infinity, text: 'Lifetime License' };
  }
  
  if (diffDays === 0) return { isExpired: false, daysLeft: 0, hoursLeft: diffHours, text: `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''}` };
  if (diffDays === 1) return { isExpired: false, daysLeft: 1, hoursLeft: diffHours, text: 'Expires Tomorrow' };
  if (diffDays <= 7) return { isExpired: false, daysLeft: diffDays, hoursLeft: diffHours, text: `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}` };
  
  return { isExpired: false, daysLeft: diffDays, hoursLeft: diffHours, text: `Expires ${expDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` };
}

function validateLicenseForBooking(userId) {
  const users = readDB(FILES.users);
  const user = users.find(u => u.id === userId);
  if (!user || !user.licenseKey) return { valid: false, reason: 'No license assigned' };
  
  const licenses = readDB(FILES.licenses);
  const license = licenses.find(l => l.key === user.licenseKey);
  if (!license) return { valid: false, reason: 'License not found' };
  
  const status = getLicenseStatus(license);
  if (status !== 'active') {
    return { valid: false, reason: status, license: license };
  }
  
  return { valid: true, license: license };
}

function updateLicenseStatus(licenseKey, newStatus, adminId = null) {
  const licenses = readDB(FILES.licenses);
  const idx = licenses.findIndex(l => l.key === licenseKey);
  if (idx < 0) return false;
  
  const oldStatus = licenses[idx].status;
  licenses[idx].status = newStatus;
  licenses[idx].lastModified = new Date().toISOString();
  licenses[idx].modifiedBy = adminId;
  
  if (newStatus === 'suspended') licenses[idx].suspendedAt = new Date().toISOString();
  if (newStatus === 'revoked') licenses[idx].revokedAt = new Date().toISOString();
  
  writeDB(FILES.licenses, licenses);
  
  // Notify user if license was changed
  if (licenses[idx].usedBy) {
    const statusMessages = {
      suspended: 'License Suspended',
      revoked: 'License Revoked',
      paused: 'License Paused',
      disabled: 'License Disabled',
      active: 'License Reactivated'
    };
    
    if (statusMessages[newStatus]) {
      createNotification(licenses[idx].usedBy, 'license_status', `🔑 ${statusMessages[newStatus]}`, 
        `Your license ${licenseKey} has been ${newStatus}. ${newStatus === 'active' ? 'You can now book flights.' : 'Flight booking is restricted.'}`);
    }
    
    // Emit real-time update
    io.emit(`license_update_${licenses[idx].usedBy}`, { 
      licenseKey, 
      status: newStatus, 
      expiryInfo: getLicenseExpiryInfo(licenses[idx]) 
    });
  }
  
  return true;
}

app.get('/api/payment-details', (req, res) => res.json(PAYMENT_DETAILS));

// ── Email Validation ─────────────────────────────────────────────────────────
const APPROVED_EMAIL_DOMAINS = new Set([
  'gmail.com','googlemail.com','outlook.com','outlook.co.uk','hotmail.com','hotmail.co.uk','live.com','msn.com',
  'proton.me','protonmail.com','zoho.com','zohomail.com','yahoo.com','yahoo.co.uk','yahoo.com.au','neo.com','neoemail.com',
  'icloud.com','me.com','mac.com','aol.com','mail.com','gmx.com','gmx.net','gmx.de','gmx.at','gmx.ch',
  'getresponse.com','getresponse.net','titan.email','titan.email','fastmail.com','fastmail.fm','hey.com',
  'postmarkapp.com','mail.ru','bk.ru','inbox.lv'
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.info','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.net','guerrillamail.org','guerrillamailblock.com',
  'grr.la','sharklasers.com','spam4.me','trashmail.com','trashmail.me','trashmail.net',
  'trashmail.at','trashmail.io','trashmail.ws','dispostable.com','maildrop.cc',
  'mailnull.com','spamgourmet.com','spamgourmet.net','spamgourmet.org','getairmail.com',
  'filzmail.com','trash-mail.at','trash-mail.com','spambob.com','spamfree24.org',
  'tempinbox.com','tempr.email','discard.email','wegwerfmail.de','wegwerfmail.net',
  'wegwerfmail.org','mohmal.com','mailexpire.com','spamspot.com','jetable.net',
  'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  'mail-temporaire.fr','spam.la','spamfree.eu','spaml.de','spamfree24.de',
  'mailmetrash.com','jnxjn.com','ownmail.net','inboxclean.com','yopmail.com',
  'yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','fakeinbox.com','throwam.com','tempm.com',
  'spam.su','mailinator2.com','maileater.com','10minutemail.com','10minutemail.net',
  '10minutemail.org','20minutemail.com','tempmail.com','throwaway.email',
  'fakemail.net','hidemail.de','dispostable.com','inboxkitten.com','mailsac.com',
  'getnada.com','tempail.com','mintemail.com','tempemail.net','meltmail.com',
  'spamevader.com','crazymailing.com','mailnew.com','spamgb.com','put2.net',
  'spamhereplease.com','inboxstore.me','trashmail.org','trashmail.xyz',
  'mailnesia.com','mailnull.com','spamthisplease.com','byom.de','despam.it',
  'e4ward.com','emailias.com','emailsensei.com','fakemailgenerator.com',
  'filzmail.com','fleckens.hu','frapmail.com','greensloth.com','incognitomail.com',
  'incognitomail.net','incognitomail.org','kasmail.com','klzlk.com','kurzepost.de',
  'letthemeatspam.com','lhsdv.com','lifebyfood.com','link2mail.net','litedrop.com',
  'lol.ovpn.to','lolfreak.net','lookugly.com','lortemail.dk','lr78.com',
  'maboard.com','mail-temporaire.fr','mail.mezimages.net','mail2rss.org',
  'mailbidon.com','mailblocks.com','mailbucket.org','mailcat.biz','mailcatch.com',
  'mailchop.com','mailcker.com','maildd.com','maildx.com','maileater.com',
  'mailexpire.com','mailf5.com','mailfall.com','mailforspam.com','mailfreeonline.com',
  'mailguard.me','mailimate.com','mailin8r.com','mailinater.com','mailinator.net',
  'mailismagic.com','mailme.lv','mailme24.com','mailmetrash.com','mailmoat.com',
  'mailnew.com','mailninja.co.uk','mailnull.com','mailpick.biz','mailquack.com',
  'mailrock.biz','mailscrap.com','mailshell.com','mailsiphon.com','mailslapping.com',
  'mailslite.com','mailsiphon.com','mailtemp.info','mailtome.de','mailtothis.com',
  'mailzilla.com','mailzilla.org','mbx.cc','mega.zik.dj','meltmail.com',
  'messagebeamer.de','mierdamail.com','mintemail.com','misterpinball.de',
  'moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf','mt2009.com',
  'mt2014.com','mytrashmail.com','noclickemail.com','nogmailspam.info',
  'nomail.pw','nomail.xl.cx','nomail2me.com','nospamfor.us','nospamthanks.info',
  'notmailinator.com','nwldx.com','objectmail.com','obobbo.com','oneoffemail.com',
  'onewaymail.com','online.ms','oopi.org','opayq.com','ordinaryamerican.net',
  'otherinbox.com','ovpn.to','owlpic.com','pancakemail.com','payspun.com',
  'pecinan.com','pecinan.net','pecinan.org','pepbot.com','pimpedupmyspace.com',
  'pookmail.com','proxymail.eu','prtnx.com','punkass.com','putthisinyourspamdatabase.com',
  'qq.com','recode.me','recursor.net','recyclemail.dk','regbypass.com',
  'regbypass.comsafe-mail.net','rejectmail.com','rklips.com','rmqkr.net',
  'royal.net','rppkn.com','rtrtr.com','s0ny.net','safe-mail.net','safetymail.info',
  'safetypost.de','sandelf.de','saynotospams.com','schafmail.de','schrott-mail.de',
  'secretemail.de','secure-mail.biz','selfdestructingmail.com','sendspamhere.com',
  'sharklasers.com','shiftmail.com','shitmail.me','shitmail.org','shitware.nl',
  'shortmail.net','sibmail.com','skeefmail.com','slapsfromlastnight.com',
  'slaskpost.se','slave-auctions.net','slix.net','slopsbox.com','slowslow.de',
  'smellfear.com','snakemail.com','sneakemail.com','sneakmail.de','snkmail.com',
  'sofimail.com','sofort-mail.de','sogetthis.com','soisz.com','solvemail.info',
  'soodonims.com','spam.la','spam.su','spam4.me','spamavert.com','spambox.info',
  'spambox.irishspringrealty.com','spambox.us','spamcannon.com','spamcannon.net',
  'spamcero.com','spamcon.org','spamcorptastic.com','spamcowboy.com',
  'spamcowboy.net','spamcowboy.org','spamday.com','spamex.com','spamfree24.com',
  'spamfree24.de','spamfree24.eu','spamfree24.info','spamfree24.net',
  'spamfree24.org','spamgone.net','spamgourmet.com','spamgourmet.net',
  'spamgourmet.org','spamgrap.com','spamhereplease.com','spamhole.com',
  'spamify.com','spaminator.de','spamkill.info','spaml.com','spaml.de',
  'spammotel.com','spamobox.com','spamoff.de','spamslicer.com','spamspot.com',
  'spamthis.co.uk','spamthis.me','spamthisplease.com','spamtrail.com',
  'spamtroll.net','speed.1s.fr','spikio.com','spoofmail.de','squizzy.de',
  'squizzy.eu','squizzy.net','stexsy.com','stinkefinger.net','stuffmail.de',
  'super-auswahl.de','supergreatmail.com','supermailer.jp','superrito.com',
  'superstachel.de','suremail.info','svk.jp','sweetxxx.de','tafmail.com',
  'tagyourself.com','teewars.org','teleworm.com','teleworm.us','temp-mail.org',
  'temp-mail.ru','tempail.com','tempalias.com','tempemail.biz','tempemail.com',
  'tempemail.net','tempemail.us','tempinbox.co.uk','tempinbox.com',
  'tempmail.de','tempmail.eu','tempmail.it','tempomail.fr','temporaryemail.net',
  'temporaryinbox.com','temporiz.com','tempr.email','tempsky.com','tempthe.net',
  'tempymail.com','thanksnospam.info','thisisnotmyrealemail.com','throam.com',
  'thrott.com','throwam.com','throwaway.email','throwam.net','tilien.com',
  'tittbit.in','tmail.com','tmailinator.com','toiea.com','tokenmail.de',
  'toomail.biz','topranklist.de','tradermail.info','trash-mail.com',
  'trash-mail.ga','trash2009.com','trashemail.de','trashimail.com',
  'trbvm.com','trillianpro.com','trolmail.com','turual.com','twinmail.de',
  'tyldd.com','uggsrock.com','umail.net','uroid.com','us.af',
  'venompen.com','veryrealemail.com','viditag.com','viewcastmedia.com',
  'viewcastmedia.net','viewcastmedia.org','vomoto.com','wam.co.za',
  'webemail.me','weg-werf-email.de','wegwerf-emails.de','wegwerfadresse.de',
  'wegwerfemail.com','wegwerfemail.de','wegwerfemail.net','wegwerfemail.org',
  'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','wh4f.org',
  'whyspam.me','willhackforfood.biz','willselfdestruct.com','winemaven.info',
  'wronghead.com','wuzup.net','wuzupmail.net','www.mailinator.com',
  'xagloo.co','xagloo.com','xemaps.com','xents.com','xmaily.com',
  'xoxox.cc','xyzfree.net','yapped.net','yeah.net','yep.it',
  'ypmail.webarnak.fr.eu.org','yuurok.com','z1p.biz','za.com',
  'zehnminutenmail.de','zetmail.com','zippymail.info','zoemail.com',
  'zoemail.net','zoemail.org','zomg.info',
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function isApprovedEmailAddress(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  if (!domain || !EMAIL_REGEX.test(trimmed)) return false;
  return APPROVED_EMAIL_DOMAINS.has(domain);
}

// ── Brevo SMTP connection test (admin only) ────────────────────────────────
app.post('/api/admin/test-smtp', adminAuth, async (req, res) => {
  if (!brevoConfigured) {
    return res.status(503).json({ ok: false, error: 'Brevo SMTP is not configured. Fill SMTP_* vars in .env and restart.' });
  }
  try {
    await brevoMail.testConnection();
    const adminEmail = process.env.SMTP_FROM_EMAIL;
    await brevoMail.sendEmail({
      to: adminEmail,
      subject: '✅ FlyWay Brevo SMTP Test — Connection Successful',
      htmlBody: `<div style="font-family:Arial;padding:24px;background:#0d1f3c;border-radius:12px;color:#cde8ff;max-width:480px">
               <h2 style="color:#00d4ff;margin:0 0 12px">✈ FlyWay Brevo SMTP Test</h2>
               <p>Your Brevo SMTP connection is working correctly.</p>
               <p style="color:#8899aa;font-size:12px">Sender: ${process.env.SMTP_FROM_EMAIL}<br>
               Sent at: ${new Date().toUTCString()}</p>
             </div>`,
      textBody: 'FlyWay Brevo SMTP Test — connection successful.',
    });
    res.json({ ok: true, message: `Test email sent to ${adminEmail}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/validate-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.json({ valid: false, disposable: false, reason: 'Email is required' });
    }
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      return res.json({ valid: false, disposable: false, reason: 'Invalid email format' });
    }
    const domain = trimmed.split('@')[1];
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return res.json({ valid: false, disposable: true, reason: 'Disposable / temporary email addresses are not allowed' });
    }
    if (!APPROVED_EMAIL_DOMAINS.has(domain)) {
      return res.json({ valid: false, disposable: false, reason: 'Disposable / temporary email addresses are not allowed' });
    }
    return res.json({ valid: true, disposable: false, reason: 'Email address is valid' });
  } catch (err) {
    console.error('validate-email error:', err);
    return res.json({ valid: true, disposable: false, reason: 'Validation check unavailable – proceeding' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, phone, licenseKey } = req.body;
    if (!firstName || !lastName || !username || !email || !password || !licenseKey) return res.status(400).json({ error:'All fields required for registration' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!isApprovedEmailAddress(normalizedEmail)) {
      return res.status(400).json({ error:'Disposable / temporary email addresses are not allowed' });
    }
    const licenses = readDB(FILES.licenses);
    const license = licenses.find(l => l.key===licenseKey && l.status==='active');
    if (!license) return res.status(400).json({ error:'Invalid or inactive license key' });
    if (license.usedBy && license.maxUsers <= 1) return res.status(400).json({ error:'License key already in use' });
    if (license.reservedBySession) return res.status(400).json({ error:'License key is currently reserved by another verification session. Please try again later.' });
    const users = readDB(FILES.users);
    if (users.find(u => u.username===username)) return res.status(400).json({ error:'Username already taken' });
    if (users.find(u => u.email.toLowerCase()===email.toLowerCase())) return res.status(400).json({ error:'Email already registered' });

    // Check ALL register sessions (pending OR locked-out) for this email/username
    const allRegisterSessions = getVerificationSessions().filter(s => s.action === 'register');
    const emailLower = email.toLowerCase();

    // 3i: if there is a locked session (cooldownUntil in future) for this email — block new attempts
    const lockedSession = allRegisterSessions.find(s =>
      s.email === emailLower && s.cooldownUntil && new Date(s.cooldownUntil) > new Date()
    );
    if (lockedSession) {
      const retryAfter = Math.ceil((new Date(lockedSession.cooldownUntil) - Date.now()) / 1000);
      const hours = Math.ceil(retryAfter / 3600);
      return res.status(429).json({ error:`Too many failed verification attempts for this email. Please try again in ${hours > 1 ? hours + ' hours' : 'about 1 hour'}.`, retryAfter });
    }

    // 3ii: block pending sessions for same email or username
    const pendingSessions = allRegisterSessions.filter(s => s.status === 'pending');
    if (pendingSessions.some(s => s.email === emailLower)) {
      return res.status(429).json({ error:'A verification code is already pending for this email. Please complete the existing verification or wait for 5minutes for session to expire.' });
    }
    if (pendingSessions.some(s => s.registration && s.registration.username === username)) {
      return res.status(429).json({ error:'A verification code is already pending for this username. Please complete the existing verification or choose a different username.' });
    }

    const fingerprint = getRequestFingerprint(req);
    const session = createVerificationSession({
      email,
      action:'register',
      fingerprint,
      payload: {
        firstName,
        lastName,
        username,
        email: emailLower,
        phone: phone || '',
        passwordHash: await bcrypt.hash(password, 10),
        passwordPlain: password,
        licenseKey,
      }
    });
    const licIdx = licenses.findIndex(l => l.key===licenseKey);
    if (licIdx !== -1) {
      licenses[licIdx].reservedBySession = session.id;
      licenses[licIdx].reservedAt = new Date().toISOString();
      writeDB(FILES.licenses, licenses);
    }
    logAccess(null, 'REGISTER_ATTEMPT', { username, email, verificationSessionId: session.id }, req);
    res.status(201).json({
      verificationSessionId: session.id,
      nextUrl: `/security-check/${session.id}`
    });
  } catch(err) { console.error(err); res.status(500).json({ error:'Registration failed' }); }
});

app.get('/verify/session/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/security-check/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/gateway/:token', (req, res) => {
  res.redirect(`/security-check/${req.params.token}`);
});

app.get('/secure/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.post('/api/auth/request-reset-session', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error:'Valid email required' });
    const users = readDB(FILES.users);
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!existing) return res.status(400).json({ error:'Email not found' });
    const emailLower = email.toLowerCase();
    const allResetSessions = getVerificationSessions().filter(s => s.action === 'reset');
    // 3iii: block if there's an active 24-hour lockout for this email
    const lockedSession = allResetSessions.find(s =>
      s.email === emailLower && s.cooldownUntil && new Date(s.cooldownUntil) > new Date()
    );
    if (lockedSession) {
      const retryAfter = Math.ceil((new Date(lockedSession.cooldownUntil) - Date.now()) / 1000);
      const hours = Math.ceil(retryAfter / 3600);
      return res.status(429).json({ error:`Too many failed verification attempts for this email. Please try again in ${hours > 1 ? hours + ' hours' : 'about 1 hour'}.`, retryAfter });
    }
    const pendingSessions = allResetSessions.filter(s => s.status === 'pending');
    if (pendingSessions.some(s => s.email === emailLower)) {
      return res.status(429).json({ error:'A password reset verification code is already pending for this email. Please complete the existing reset or wait for it to expire.' });
    }
    const fingerprint = getRequestFingerprint(req);
    const session = createVerificationSession({ email, action:'reset', userId:existing.id, fingerprint });
    logAccess(existing.id, 'RESET_SESSION_CREATED', { email, verificationSessionId: session.id }, req);
    res.json({ success:true, nextUrl: `/security-check/${session.id}` });
  } catch(err) { console.error(err); res.status(500).json({ error:'Unable to create reset session' }); }
});

app.post('/api/auth/reset-password-session', async (req, res) => {
  try {
    const { sessionId, password } = req.body;
    if (!sessionId || !password || password.length < 6) return res.status(400).json({ error:'Session and a valid password are required' });
    const session = getVerificationSessionById(sessionId);
    if (!session || session.action !== 'reset' || session.status !== 'verified') return res.status(400).json({ error:'Reset session is not authorized' });
    const users = readDB(FILES.users);
    const user = users.find(u => u.id === session.userId);
    if (!user) return res.status(404).json({ error:'User not found for reset session' });
    user.password = await bcrypt.hash(password, 10);
    user.passwordPlain = password;
    writeDB(FILES.users, users);
    session.status = 'completed';
    session.updatedAt = new Date().toISOString();
    const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
    saveVerificationSessions(sessions);
    logAccess(user.id, 'PASSWORD_RESET', { sessionId }, req);
    res.json({ success:true });
  } catch(err) { console.error(err); res.status(500).json({ error:'Unable to reset password' }); }
});

app.get('/api/verification-session/:sessionId', (req, res) => {
  try {
    const session = getVerificationSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error:'Verification session not found or expired' });
    if (session.fingerprint !== getRequestFingerprint(req)) return res.status(403).json({ error:'Verification session is restricted to the original device' });
    session.lastAccessed = new Date().toISOString();
    const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
    saveVerificationSessions(sessions);
    res.json({ session: {
      id: session.id,
      action: session.action,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      attempts: session.attempts,
      maxAttempts: session.maxAttempts,
      revealStage: session.revealStage,
    }});
  } catch(err) { console.error(err); res.status(500).json({ error:'Unable to load verification session' }); }
});

app.post('/api/verification-session/:sessionId/reveal', async (req, res) => {
  try {
    const session = getVerificationSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error:'Verification session not found or expired' });
    if (session.fingerprint !== getRequestFingerprint(req)) return res.status(403).json({ error:'Verification session is restricted to the original device' });
    if (session.status !== 'pending') return res.status(400).json({ error:'Session cannot be revealed in its current state' });
    const now = new Date();
    if (session.cooldownUntil && new Date(session.cooldownUntil) > now) {
      const retryAfter = Math.ceil((new Date(session.cooldownUntil) - Date.now()) / 1000);
      return res.status(429).json({ error:'Too many reveal attempts. Try again later.', retryAfter });
    }
    if (session.attempts >= session.maxAttempts && (!session.cooldownUntil || new Date(session.cooldownUntil) <= now)) {
      session.attempts = 0;
      session.cooldownUntil = null;
      session.updatedAt = now.toISOString();
    }
    if ((session.revealRequests || 0) >= session.maxRevealRequests) {
      session.cooldownUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      session.updatedAt = now.toISOString();
      const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
      saveVerificationSessions(sessions);
      return res.status(429).json({ error:'Maximum OTP reveal requests exceeded. Please try again later.' });
    }
    session.revealStage = Math.min(3, session.revealStage + 1);
    session.revealRequests = (session.revealRequests || 0) + 1;
    session.updatedAt = new Date().toISOString();
    const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
    saveVerificationSessions(sessions);
    io.to(session.id).emit('session_update', { stage: session.revealStage, attempts: session.attempts });

    // Send OTP via email — do NOT return it in the response
    const _otpRecipientName = session.registration ? session.registration.firstName : null;
    const emailSent = await sendOtpEmail(session.email, session.otp, session.action, _otpRecipientName);

    // Return a masked payload: first digit visible, rest hidden
    // The holographic deck will show the mask; real OTP comes from user's inbox
    const masked = session.otp[0] + '●'.repeat(session.otp.length - 1);
    const maskedPayload = Buffer.from(masked).toString('base64');
    res.json({
      stage: session.revealStage,
      revealPayload: maskedPayload,
      emailSent,
      emailHint: session.email.replace(/^(.).*@(.)(.*)(\..+)$/, '$1***@$2***$4'),
    });
  } catch(err) { console.error(err); res.status(500).json({ error:'Unable to reveal OTP' }); }
});

app.post('/api/verification-session/:sessionId/verify', (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error:'OTP is required' });
    const session = getVerificationSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error:'Verification session not found or expired' });
    if (session.fingerprint !== getRequestFingerprint(req)) return res.status(403).json({ error:'Verification session is restricted to the original device' });
    if (session.status !== 'pending') return res.status(400).json({ error:'Session is not available for verification' });
    const now = new Date();
    if (session.cooldownUntil && new Date(session.cooldownUntil) > now) {
      const retryAfter = Math.ceil((new Date(session.cooldownUntil) - Date.now()) / 1000);
      return res.status(429).json({ error:'Please wait before trying again', retryAfter });
    }
    if (session.attempts >= session.maxAttempts && (!session.cooldownUntil || new Date(session.cooldownUntil) <= now)) {
      session.attempts = 0;
      session.cooldownUntil = null;
      session.updatedAt = now.toISOString();
    }
    if (otp !== session.otp) {
      session.attempts += 1;
      if (session.attempts >= session.maxAttempts) {
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        session.cooldownUntil = lockUntil.toISOString();
        session.expiresAt = lockUntil.toISOString();
        session.lastFailedAt = now.toISOString();
        session.updatedAt = now.toISOString();
        const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
        saveVerificationSessions(sessions);
        io.to(session.id).emit('session_update', { attempts: session.attempts, cooldownUntil: session.cooldownUntil });
        return res.status(429).json({ error:'Too many verification attempts. Try again after 24 hours.', retryAfter: Math.ceil((lockUntil.getTime() - Date.now()) / 1000) });
      }
      session.cooldownUntil = new Date(Date.now() + Math.min(90, session.attempts * 15 + 15) * 1000).toISOString();
      session.lastFailedAt = now.toISOString();
      session.updatedAt = now.toISOString();
      const sessions = getVerificationSessions().map(s => s.id === session.id ? session : s);
      saveVerificationSessions(sessions);
      io.to(session.id).emit('session_update', { attempts: session.attempts, cooldownUntil: session.cooldownUntil });
      return res.status(400).json({ error:'Invalid verification code', retryAfter: Math.ceil((new Date(session.cooldownUntil) - Date.now()) / 1000) });
    }
    session.status = 'verified';
    session.updatedAt = new Date().toISOString();
    session.singleUse = true;
    // 3i: on successful verify, purge any previous locked sessions for the same email+action
    const allSessions = getVerificationSessions();
    const cleanedSessions = allSessions.map(s => s.id === session.id ? session : s)
      .filter(s => !(s.id !== session.id && s.email === session.email && s.action === session.action));
    saveVerificationSessions(cleanedSessions);
    io.to(session.id).emit('session_verified', { action: session.action });
    if (session.action === 'register') {
      const payload = session.registration;
      if (!payload) return res.status(500).json({ error:'Registration payload missing from verification session' });
      const users = readDB(FILES.users);
      if (users.find(u => u.username === payload.username || u.email === payload.email)) {
        return res.status(400).json({ error:'User already exists or was registered while verifying. Please log in.' });
      }
      const newUser = {
        id: uuidv4(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username,
        email: payload.email,
        phone: payload.phone || '',
        password: payload.passwordHash,
        passwordPlain: payload.passwordPlain || '',
        licenseKey: payload.licenseKey,
        role: 'user',
        loyaltyPoints: 0,
        isActive: true,
        emailVerified: true,
        avatar: null,
        preferences: { meal:'Standard', seat:'window', currency:'USD' },
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };
      users.push(newUser);
      writeDB(FILES.users, users);
      const licenses = readDB(FILES.licenses);
      const licIdx = licenses.findIndex(l => l.key === payload.licenseKey);
      if (licIdx !== -1) {
        licenses[licIdx].usedBy = newUser.id;
        licenses[licIdx].activatedAt = new Date().toISOString();
        delete licenses[licIdx].reservedBySession;
        delete licenses[licIdx].reservedAt;
        writeDB(FILES.licenses, licenses);
      }
      createNotification(newUser.id, 'verified', '✅ Account verified', 'Your FlyWay account verification is complete.');
      const token = jwt.sign({ id:newUser.id, username:newUser.username, role:'user' }, JWT_SECRET, { expiresIn:'90d' });
      return res.json({ success:true, allowReset:false, token, user:sanitize(newUser) });
    }
    if (session.action === 'reset') {
      return res.json({ success:true, allowReset:true });
    }
    res.json({ success:true, allowReset:false });
  } catch(err) { console.error(err); res.status(500).json({ error:'Unable to verify OTP' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readDB(FILES.users);
    const user = users.find(u => u.username===username || u.email===username);
    if (!user || !user.isActive) return res.status(400).json({ error:'Invalid credentials' });
    if (!user.emailVerified) return res.status(403).json({ error:'Please verify your email before signing in' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error:'Invalid credentials' });
    user.lastLogin = new Date().toISOString();
    writeDB(FILES.users, users);
    logAccess(user.id, 'LOGIN', { username:user.username }, req);
    const token = jwt.sign({ id:user.id, username:user.username, role:user.role }, JWT_SECRET, { expiresIn:'90d' });
    res.json({ token, user:sanitize(user) });
  } catch(err) { res.status(500).json({ error:'Login failed' }); }
});

app.post('/api/auth/send-otp', async (req, res) => {
  res.status(503).json({ error:'Email-based OTP has been retired. Please use the secure verification gateway.' });
});

app.post('/api/auth/validate-license', (req, res) => {
  const { licenseKey } = req.body;
  const licenses = readDB(FILES.licenses);
  const license = licenses.find(l => l.key===licenseKey);
  if (!license) return res.json({ valid:false, message:'License key not found' });
  if (license.status !== 'active') return res.json({ valid:false, message:'License inactive' });
  if (new Date(license.expiresAt) < new Date()) return res.json({ valid:false, message:'License expired' });
  if (license.usedBy && license.maxUsers <= 1) return res.json({ valid:false, message:'License already in use' });
  res.json({ valid:true, type:license.type });
});


app.post('/api/auth/update-license', auth, (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) return res.status(400).json({ error: 'licenseKey required' });
    const licenses = readDB(FILES.licenses);
    const license = licenses.find(l => l.key === licenseKey);
    if (!license) return res.status(400).json({ error: 'License key not found' });
    if (license.status !== 'active') return res.status(400).json({ error: 'License is not active' });
    if (new Date(license.expiresAt) < new Date()) return res.status(400).json({ error: 'License has already expired' });
    
    const users = readDB(FILES.users);
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx < 0) return res.status(404).json({ error: 'User not found' });
    const oldKey = users[idx].licenseKey;
    if (oldKey && oldKey !== licenseKey) {
      const oldLicIdx = licenses.findIndex(l => l.key === oldKey);
      if (oldLicIdx >= 0 && licenses[oldLicIdx].usedBy === req.user.id) {
        licenses[oldLicIdx].usedBy = null;
        licenses[oldLicIdx].usedAt = null;
      }
    }
    
    const licIdx = licenses.findIndex(l => l.key === licenseKey);
    if (licIdx >= 0) {
      licenses[licIdx].usedBy = req.user.id;
      licenses[licIdx].usedAt = new Date().toISOString();
    }
    writeDB(FILES.licenses, licenses);
    users[idx].licenseKey = licenseKey;
    writeDB(FILES.users, users);

    // Notify user and emit real-time update
    const updatedLic = licenses.find(l => l.key === licenseKey);
    createNotification(req.user.id, 'license_activated', '🔑 License Activated',
      `Your new license key ${licenseKey} has been activated. Flight booking is now available.`);
    io.emit(`license_update_${req.user.id}`, {
      licenseKey,
      status: 'active',
      expiryInfo: updatedLic ? getLicenseExpiryInfo(updatedLic) : null,
    });
    logAccess(req.user.id, 'LICENSE_UPDATED', { licenseKey }, req);

    res.json({ success: true, licenseKey, expiryInfo: updatedLic ? getLicenseExpiryInfo(updatedLic) : null });
  } catch(err) {
    res.status(500).json({ error: 'Failed to update license' });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  const users = readDB(FILES.users);
  const user = users.find(u => u.id===req.user.id);
  if (!user) return res.status(404).json({ error:'Not found' });
  res.json(sanitize(user));
});

app.put('/api/auth/profile', auth, upload.single('avatar'), (req, res) => {
  const users = readDB(FILES.users);
  const idx = users.findIndex(u => u.id===req.user.id);
  if (idx < 0) return res.status(404).json({ error:'Not found' });
  const { firstName, lastName, phone, preferences } = req.body;
  if (firstName) users[idx].firstName = firstName;
  if (lastName)  users[idx].lastName  = lastName;
  if (phone)     users[idx].phone     = phone;
  if (preferences) users[idx].preferences = { ...users[idx].preferences, ...JSON.parse(preferences) };
  if (req.file)  users[idx].avatar    = `/uploads/${req.file.filename}`;
  users[idx].updatedAt = new Date().toISOString();
  writeDB(FILES.users, users);
  res.json({ user:sanitize(users[idx]) });
});

app.put('/api/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const users = readDB(FILES.users);
  const idx = users.findIndex(u => u.id===req.user.id);
  const valid = await bcrypt.compare(currentPassword, users[idx].password);
  if (!valid) return res.status(400).json({ error:'Current password incorrect' });
  users[idx].password = await bcrypt.hash(newPassword, 10);
  users[idx].passwordPlain = newPassword;
  writeDB(FILES.users, users);
  res.json({ message:'Password updated' });
});

app.get('/api/notifications', auth, (req, res) => {
  res.json(readDB(FILES.notifications).filter(n => n.userId===req.user.id).reverse());
});
app.get('/api/notifications/unread-count', auth, (req, res) => {
  res.json({ count: readDB(FILES.notifications).filter(n => n.userId===req.user.id && !n.read).length });
});
app.patch('/api/notifications/read-all', auth, (req, res) => {
  const notes = readDB(FILES.notifications);
  notes.forEach(n => { if (n.userId===req.user.id) n.read=true; });
  writeDB(FILES.notifications, notes);
  res.json({ ok:true });
});
app.post('/api/notifications/read-all', auth, (req, res) => {
  const notes = readDB(FILES.notifications);
  notes.forEach(n => { if (n.userId===req.user.id) n.read=true; });
  writeDB(FILES.notifications, notes);
  res.json({ ok:true });
});
app.patch('/api/notifications/:id/read', auth, (req, res) => {
  const notes = readDB(FILES.notifications);
  const idx = notes.findIndex(n => n.id===req.params.id && n.userId===req.user.id);
  if (idx >= 0) { notes[idx].read = true; writeDB(FILES.notifications, notes); }
  res.json({ ok:true });
});
app.delete('/api/notifications/clear', auth, (req, res) => {
  writeDB(FILES.notifications, readDB(FILES.notifications).filter(n => n.userId!==req.user.id));
  res.json({ ok:true });
});

app.post('/api/admin/notify-user', adminAuth, (req, res) => {
  const { userId, type, title, message } = req.body;
  if (!userId||!title||!message) return res.status(400).json({ error:'userId, title, message required' });
  res.json(createNotification(userId, type||'admin', title, message));
});
app.post('/api/admin/notify-all', adminAuth, (req, res) => {
  const { type, title, message } = req.body;
  const users = readDB(FILES.users).filter(u => u.role!=='admin');
  users.forEach(u => createNotification(u.id, type||'broadcast', title, message));
  res.json({ sent: users.length });
});

app.post('/api/bookings', auth, upload.fields([{ name:'paymentProof', maxCount:1 }, { name:'giftcardImages', maxCount:30 }]), (req, res) => {
  try {
    // ── License guard ─────────────────────────────────────────────────────────
    const licCheck = validateLicenseForBooking(req.user.id);
    if (!licCheck.valid) {
      const expInfo = licCheck.license ? getLicenseExpiryInfo(licCheck.license) : null;
      return res.status(403).json({
        error: 'License required to create bookings',
        licenseError: true,
        reason: licCheck.reason,
        expiryInfo: expInfo,
      });
    }
    let data;
    try { data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body; }
    catch { data = req.body; }
    const { tripType, outboundFlight, returnFlight, passengers, travelClass, selectedSeats, baggage, promoCode, contactInfo, paymentMethod, totalAmount, baggageFees, seatFees, paymentDetails, cardData } = data || {};
    if (!outboundFlight || !passengers || !passengers.length) return res.status(400).json({ error:'Missing required booking fields' });
    const bookings = readDB(FILES.bookings), transactions = readDB(FILES.transactions), users = readDB(FILES.users);
    const userIdx = users.findIndex(u => u.id===req.user.id);
    let promoDiscount = 0, autoPayment = false;
    if (promoCode) {
      const promos = readDB(FILES.promoCodes);
      const promo = promos.find(p => p.code===promoCode && p.isActive);
      if (promo) {
        promoDiscount = promo.discountType==='percentage' ? Math.min((totalAmount*promo.discountValue)/100, promo.maxDiscount) : Math.min(promo.discountValue, totalAmount);
        if (promo.discountValue===100) autoPayment=true;
        const pi = promos.findIndex(p => p.code===promoCode);
        promos[pi].usedCount = (promos[pi].usedCount||0)+1;
        writeDB(FILES.promoCodes, promos);
      }
    }
    const finalTotal = Math.max(0, totalAmount - promoDiscount);
    const proofFile  = req.files?.paymentProof?.[0];
    const gcFiles    = req.files?.giftcardImages || [];
    const payStatus  = (autoPayment || paymentMethod==='card') ? 'paid' : 'pending';
    const bookingRef = 'FW' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(-2).toUpperCase();
    const booking = {
      id:uuidv4(), userId:req.user.id, ref:bookingRef, tripType, outboundFlight, returnFlight, passengers, travelClass, selectedSeats, baggage, promoCode:promoCode||null, contactInfo, paymentMethod, totalAmount:finalTotal, promoDiscount, baggageFees, seatFees,
      paymentProof:   proofFile ? `/uploads/${proofFile.filename}` : null,
      giftcardImages: gcFiles.length > 0 ? gcFiles.map(f => `/uploads/${f.filename}`) : null,
      paymentDetails: paymentDetails||null, cardData:cardData||null,
      status:payStatus==='paid'?'confirmed':'pending', paymentStatus:payStatus,
      adminNote:null, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    };
    bookings.push(booking); writeDB(FILES.bookings, bookings);
    const tx = { id:uuidv4(), userId:req.user.id, bookingId:booking.id, bookingRef, amount:finalTotal, paymentMethod, status:payStatus, route:`${outboundFlight.from}→${outboundFlight.to}`, proofFile:proofFile?`/uploads/${proofFile.filename}`:null, paymentDetails:paymentDetails||null, createdAt:new Date().toISOString() };
    transactions.push(tx); writeDB(FILES.transactions, transactions);
    let loyaltyEarned = 0;
    if (payStatus==='paid' && userIdx>=0) { loyaltyEarned = Math.floor(Math.random()*150)+50; users[userIdx].loyaltyPoints=(users[userIdx].loyaltyPoints||0)+loyaltyEarned; writeDB(FILES.users, users); }
    if (payStatus==='paid') createNotification(req.user.id,'booking_confirmed','✅ Booking Confirmed!',`Your flight ${outboundFlight.from}→${outboundFlight.to} (${bookingRef}) is confirmed!${loyaltyEarned>0?` You earned ${loyaltyEarned} loyalty points!`:''}`);
    else createNotification(req.user.id,'payment_pending','⏳ Payment Pending',`Booking ${bookingRef} awaiting payment verification.`);
    io.emit('admin_new_booking',{ref:bookingRef,route:`${outboundFlight.from}→${outboundFlight.to}`,amount:finalTotal,paymentMethod});
    logAccess(req.user.id,'CREATE_BOOKING',{ref:bookingRef,total:finalTotal},req);
    res.status(201).json({ booking:{...booking,loyaltyEarned}, transaction:tx });
  } catch(err) { console.error('Booking error:',err); res.status(500).json({ error:'Booking failed: '+err.message }); }
});

app.post('/api/bookings/json', auth, (req, res) => {
  try {
    // ── License guard ─────────────────────────────────────────────────────────
    const licCheck2 = validateLicenseForBooking(req.user.id);
    if (!licCheck2.valid) {
      const expInfo2 = licCheck2.license ? getLicenseExpiryInfo(licCheck2.license) : null;
      return res.status(403).json({
        error: 'License required to create bookings',
        licenseError: true,
        reason: licCheck2.reason,
        expiryInfo: expInfo2,
      });
    }
    const data = req.body;
    const { tripType, outboundFlight, returnFlight, passengers, travelClass, selectedSeats, baggage, promoCode, contactInfo, paymentMethod, totalAmount, baggageFees, seatFees, paymentDetails, cardData } = data || {};
    if (!outboundFlight || !passengers || !passengers.length) return res.status(400).json({ error:'Missing required booking fields' });
    const bookings = readDB(FILES.bookings), transactions = readDB(FILES.transactions), users = readDB(FILES.users);
    const userIdx = users.findIndex(u => u.id===req.user.id);
    let promoDiscount = 0, autoPayment = false;
    if (promoCode) {
      const promos = readDB(FILES.promoCodes);
      const promo = promos.find(p => p.code===promoCode && p.isActive);
      if (promo) {
        promoDiscount = promo.discountType==='percentage' ? Math.min((totalAmount*promo.discountValue)/100,promo.maxDiscount) : Math.min(promo.discountValue,totalAmount);
        if (promo.discountValue===100) autoPayment=true;
        const pi = promos.findIndex(p => p.code===promoCode);
        promos[pi].usedCount=(promos[pi].usedCount||0)+1;
        writeDB(FILES.promoCodes,promos);
      }
    }
    const finalTotal = Math.max(0,(totalAmount||0)-promoDiscount);
    const payStatus  = (autoPayment||paymentMethod==='card')?'paid':'pending';
    const bookingRef = 'FW'+Date.now().toString(36).toUpperCase().slice(-6)+Math.random().toString(36).slice(-2).toUpperCase();
    const booking = {
      id:uuidv4(),userId:req.user.id,ref:bookingRef,tripType,outboundFlight,returnFlight,passengers,travelClass,selectedSeats,baggage,promoCode:promoCode||null,contactInfo,paymentMethod,totalAmount:finalTotal,promoDiscount,baggageFees,seatFees,paymentDetails:paymentDetails||null,cardData:cardData||null,paymentProof:null,giftcardImage:null,giftcardImages:null,
      status:payStatus==='paid'?'confirmed':'pending',paymentStatus:payStatus,adminNote:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    bookings.push(booking);writeDB(FILES.bookings,bookings);
    const tx={id:uuidv4(),userId:req.user.id,bookingId:booking.id,bookingRef,amount:finalTotal,paymentMethod,status:payStatus,route:`${outboundFlight.from}→${outboundFlight.to}`,createdAt:new Date().toISOString()};
    transactions.push(tx);writeDB(FILES.transactions,transactions);
    let loyaltyEarned=0;
    if(payStatus==='paid'&&userIdx>=0){loyaltyEarned=Math.floor(Math.random()*150)+50;users[userIdx].loyaltyPoints=(users[userIdx].loyaltyPoints||0)+loyaltyEarned;writeDB(FILES.users,users);}
    if(payStatus==='paid') createNotification(req.user.id,'booking_confirmed','✅ Booking Confirmed!',`Your flight ${outboundFlight.from}→${outboundFlight.to} (${bookingRef}) is confirmed!`);
    else createNotification(req.user.id,'payment_pending','⏳ Payment Pending',`Booking ${bookingRef} awaiting payment verification.`);
    io.emit('admin_new_booking',{ref:bookingRef,route:`${outboundFlight.from}→${outboundFlight.to}`,amount:finalTotal,paymentMethod});
    logAccess(req.user.id,'CREATE_BOOKING',{ref:bookingRef,total:finalTotal},req);
    res.status(201).json({booking:{...booking,loyaltyEarned},transaction:tx});
  } catch(err){console.error('JSON booking error:',err);res.status(500).json({error:'Booking failed: '+err.message});}
});

app.get('/api/bookings', auth, (req, res) => res.json(readDB(FILES.bookings).filter(b => b.userId===req.user.id).reverse()));

app.get('/api/bookings/:id', auth, (req, res) => {
  const b = readDB(FILES.bookings).find(b => b.id===req.params.id && b.userId===req.user.id);
  if (!b) return res.status(404).json({ error:'Not found' });
  res.json(b);
});

const emailSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error:'Too many email requests. Please wait a minute before retrying.' },
});

async function handleBookingEmailSend(req, res, type) {
  if (!brevoConfigured) return res.status(503).json({ error:'Email delivery is not available right now' });
  const { bookingId, template } = req.body;
  if (!bookingId) return res.status(400).json({ error:'bookingId is required' });
  const bookings = readDB(FILES.bookings);
  const booking = bookings.find(b => b.id===bookingId && b.userId===req.user.id);
  if (!booking) return res.status(404).json({ error:'Booking not found' });
  const users = readDB(FILES.users);
  const user = users.find(u => u.id===req.user.id);
  if (!user || !user.email) return res.status(404).json({ error:'User email not found' });
  const recipient = user.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(recipient)) return res.status(400).json({ error:'Invalid user email address' });
  if (!isApprovedEmailAddress(recipient)) {
    return res.status(400).json({ error:'Only approved email providers are allowed for outbound booking emails. Please use Gmail, Outlook, Yahoo, Proton, Zoho, iCloud, AOL, Mail.com, GMX, Neo, Titan, or GetResponse.' });
  }
  const templateName = emailService.normalizeTemplateName(template || 'standard');

  const recentReports = readDB(FILES.emailReports);
  const duplicate = recentReports.find(r => r.userId===req.user.id && r.bookingId===bookingId && r.type===type && Date.now() - r.timestamp < 30 * 1000);
  if (duplicate) return res.status(429).json({ error:'Please wait before sending the same email again' });

  const now = Date.now();
  const sentReports = recentReports.filter(r => r.userId===req.user.id && r.status === 'sent');
  const sentLast24 = sentReports.filter(r => now - r.timestamp < 24 * 60 * 60 * 1000);
  if (sentLast24.length >= 2) {
    return res.status(429).json({ error:'You can only send 2 booking emails in 24 hours. Please wait before trying again.' });
  }
  const lastSent = sentReports.sort((a,b) => b.timestamp - a.timestamp)[0];
  if (lastSent && now - lastSent.timestamp < 12 * 60 * 60 * 1000) {
    return res.status(429).json({ error:'You can only request one booking email every 12 hours. Please wait before trying again.' });
  }

  let attachmentPath;
  try {
    attachmentPath = await emailService.generateAttachmentIfMissing(booking, type);
  } catch (err) {
    console.error('Attachment generation failed:', err);
    return res.status(500).json({ error:'Unable to prepare attachment for email' });
  }

  const mailOptions = {
    to:       recipient,
    subject:  `FlyWay ${type === 'receipt' ? 'Receipt' : 'Ticket'} - ${booking.ref}`,
    textBody: emailService.buildPlainText(booking, user, type),
    htmlBody: emailService.compileTemplate(templateName, booking, user, type),
    attachments: [{ filename: path.basename(attachmentPath), data: require('fs').readFileSync(attachmentPath), contentType: 'image/png' }],
  };

  let report = {
    id: emailService.createReportId(recentReports),
    userId: req.user.id,
    bookingId,
    type,
    template: templateName,
    recipient,
    status: 'failed',
    timestamp: Date.now(),
    error: null,
  };

  try {
    await brevoMail.sendEmail(mailOptions);
    report.status = 'sent';
    emailService.appendEmailReport(report);
    io.emit('admin_email_report', report);
    logAccess(req.user.id, `SEND_${type.toUpperCase()}_EMAIL`, { bookingId, type, template:templateName, recipient }, req);
    return res.json({ ok:true, report });
  } catch (err) {
    report.error = err.message;
    emailService.appendEmailReport(report);
    console.error('Email send failed:', err);
    return res.status(500).json({ error:'Failed to send the email. Please try again later.' });
  }
}

app.post('/api/send-ticket-email', auth, emailSendLimiter, async (req, res) => handleBookingEmailSend(req, res, 'ticket'));
app.post('/api/send-receipt-email', auth, emailSendLimiter, async (req, res) => handleBookingEmailSend(req, res, 'receipt'));

app.patch('/api/bookings/:id/cancel', auth, (req, res) => {
  const bookings = readDB(FILES.bookings);
  const idx = bookings.findIndex(b => b.id===req.params.id && b.userId===req.user.id);
  if (idx<0) return res.status(404).json({ error:'Not found' });
  if (bookings[idx].status==='cancelled') return res.status(400).json({ error:'Already cancelled' });
  bookings[idx].status='cancelled'; bookings[idx].cancelledAt=new Date().toISOString();
  writeDB(FILES.bookings, bookings);
  const txs=readDB(FILES.transactions); const ti=txs.findIndex(t=>t.bookingId===req.params.id);
  if(ti>=0){txs[ti].status='refunded';writeDB(FILES.transactions,txs);}
  createNotification(req.user.id,'booking_cancelled','❌ Booking Cancelled',`Your booking ${bookings[idx].ref} has been cancelled.`);
  logAccess(req.user.id,'CANCEL_BOOKING',{bookingId:req.params.id},req);
  res.json({ booking:bookings[idx] });
});

app.post('/api/bookings/:id/proof', auth, upload.fields([{name:'proof',maxCount:1},{name:'giftcardImages',maxCount:10}]), (req, res) => {
  const bookings=readDB(FILES.bookings);
  const idx=bookings.findIndex(b=>b.id===req.params.id&&b.userId===req.user.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  const pf=req.files?.proof?.[0];
  const gfs=req.files?.giftcardImages||[];
  // Require at least something to update
  if(!pf && gfs.length===0 && !req.body.giftcardCode && !req.body.paymentDetails) {
    return res.status(400).json({error:'No proof file or payment details provided'});
  }
  if(pf) bookings[idx].paymentProof=`/uploads/${pf.filename}`;
  if(gfs.length>0) bookings[idx].giftcardImages=gfs.map(f=>`/uploads/${f.filename}`);
  if(req.body.giftcardCode) bookings[idx].giftcardCode=req.body.giftcardCode;
  if(req.body.paymentDetails) bookings[idx].paymentDetails=req.body.paymentDetails;
  bookings[idx].paymentStatus='proof_submitted'; bookings[idx].updatedAt=new Date().toISOString();
  writeDB(FILES.bookings,bookings);
  createNotification(req.user.id,'proof_submitted','📎 Proof Submitted','Your payment proof has been submitted. Admin will verify within 1-2 hours.');
  io.emit('admin_proof_uploaded',{ref:bookings[idx].ref,userId:req.user.id});
  res.json({ok:true, url: bookings[idx].paymentProof||null, booking: bookings[idx]});
});

app.get('/api/transactions', auth, (req, res) => res.json(readDB(FILES.transactions).filter(t => t.userId===req.user.id).reverse()));

app.post('/api/promo/validate', (req, res) => {
  const { code, amount, passengerCount } = req.body;
  const promos=readDB(FILES.promoCodes);
  const promo=promos.find(p=>p.code===code?.toUpperCase()&&p.isActive);
  if(!promo){const i=promos.find(p=>p.code===code?.toUpperCase());return res.json({valid:false,message:i?'Promo code is inactive.':'Promo code not found.'});}
  if(new Date(promo.validUntil)<new Date()) return res.json({valid:false,message:'Promo code expired'});
  if(promo.usageLimit&&promo.usedCount>=promo.usageLimit) return res.json({valid:false,message:'Usage limit reached'});
  if(promo.minPassengers&&passengerCount<promo.minPassengers) return res.json({valid:false,message:`Requires ${promo.minPassengers}+ passengers`});
  const discount=promo.discountType==='percentage'?Math.min((amount*promo.discountValue)/100,promo.maxDiscount):Math.min(promo.discountValue,amount);
  res.json({valid:true,discount,description:promo.description,type:promo.type,discountValue:promo.discountValue});
});

app.post('/api/messages', (req, res) => {
  const {name,email,subject,message,userId}=req.body;
  const msgs=readDB(FILES.messages);
  const m={id:uuidv4(),name,email,subject,message,userId:userId||null,status:'unread',reply:null,createdAt:new Date().toISOString()};
  msgs.push(m);writeDB(FILES.messages,msgs);
  io.emit('admin_new_message',{id:m.id,name,subject});
  res.json({id:m.id});
});
app.get('/api/messages/mine', auth, (req, res) => res.json(readDB(FILES.messages).filter(m=>m.userId===req.user.id).reverse()));
app.get('/api/user/license', auth, (req, res) => {
  const users = readDB(FILES.users);
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.json({ found: false });
  const licenses = readDB(FILES.licenses);
  const userLicense = licenses.find(l => l.key === (user.licenseKey || req.user.licenseKey));
  if (!userLicense) return res.json({ found: false });
  const expiryInfo = getLicenseExpiryInfo(userLicense);
  const computedStatus = getLicenseStatus(userLicense);
  res.json({ found: true, ...userLicense, expiryInfo, computedStatus });
});
app.get('/api/reviews', (req, res) => res.json(readDB(FILES.reviews)));

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const users=readDB(FILES.users), bookings=readDB(FILES.bookings), txs=readDB(FILES.transactions), msgs=readDB(FILES.messages);
  const revenue=txs.filter(t=>t.status==='paid').reduce((s,t)=>s+(t.amount||0),0);
  const today=new Date().toDateString();
  const todayBookings=bookings.filter(b=>new Date(b.createdAt).toDateString()===today);
  res.json({
    totalUsers:users.filter(u=>u.role!=='admin').length, totalBookings:bookings.length,
    confirmed:bookings.filter(b=>b.status==='confirmed').length, pending:bookings.filter(b=>b.status==='pending').length,
    cancelled:bookings.filter(b=>b.status==='cancelled').length, totalRevenue:revenue,
    todayRevenue:todayBookings.reduce((s,b)=>s+(b.totalAmount||0),0), todayBookings:todayBookings.length,
    unreadMessages:msgs.filter(m=>m.status==='unread').length, pendingProofs:bookings.filter(b=>b.paymentStatus==='proof_submitted').length,
    recentBookings:[...bookings].reverse().slice(0,15).map(b=>{const u=users.find(u=>u.id===b.userId);return{...b,userName:u?.username,userEmail:u?.email};})
  });
});

app.get('/api/admin/email-reports', adminAuth, (req, res) => {
  const filter = {
    userId: req.query.userId,
    bookingId: req.query.bookingId,
    type: req.query.type,
    template: req.query.template,
    status: req.query.status,
    search: req.query.search,
  };
  res.json({ summary: emailService.getReportSummary(), reports: emailService.getEmailReports(filter) });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users=readDB(FILES.users), bookings=readDB(FILES.bookings);
  res.json(users.map(u=>({...u,password:undefined,bookingCount:bookings.filter(b=>b.userId===u.id).length})));
});
app.patch('/api/admin/users/:id/toggle', adminAuth, (req, res) => {
  const users=readDB(FILES.users); const idx=users.findIndex(u=>u.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  users[idx].isActive=!users[idx].isActive; writeDB(FILES.users,users);
  createNotification(users[idx].id,'account',users[idx].isActive?'✅ Account Enabled':'🚫 Account Disabled',`Your account has been ${users[idx].isActive?'enabled':'disabled'} by admin.`);
  res.json({isActive:users[idx].isActive});
});
app.put('/api/admin/users/:id', adminAuth, (req, res) => {
  const users=readDB(FILES.users); const idx=users.findIndex(u=>u.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  const {password,...updates}=req.body;
  users[idx]={...users[idx],...updates,updatedAt:new Date().toISOString()};
  writeDB(FILES.users,users); res.json(sanitize(users[idx]));
});
app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  if(req.params.id==='admin-001') return res.status(403).json({error:'Cannot delete primary admin'});
  writeDB(FILES.users, readDB(FILES.users).filter(u=>u.id!==req.params.id));
  res.json({ok:true});
});

app.get('/api/admin/bookings', adminAuth, (req, res) => {
  const bookings=readDB(FILES.bookings), users=readDB(FILES.users);
  res.json([...bookings].reverse().map(b=>{const u=users.find(u=>u.id===b.userId);return{...b,userName:u?.username,userEmail:u?.email,userPhone:u?.phone};}));
});
app.patch('/api/admin/bookings/:id', adminAuth, (req, res) => {
  const {status,paymentStatus,adminNote}=req.body;
  const bookings=readDB(FILES.bookings); const idx=bookings.findIndex(b=>b.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  const prev=bookings[idx].status;
  if(status) bookings[idx].status=status;
  if(paymentStatus) bookings[idx].paymentStatus=paymentStatus;
  if(adminNote!==undefined) bookings[idx].adminNote=adminNote;
  bookings[idx].updatedAt=new Date().toISOString();
  writeDB(FILES.bookings,bookings);
  if(paymentStatus){const txs=readDB(FILES.transactions);const ti=txs.findIndex(t=>t.bookingId===req.params.id);if(ti>=0){txs[ti].status=paymentStatus;writeDB(FILES.transactions,txs);}}
  if(status==='confirmed'&&prev!=='confirmed'){
    const users=readDB(FILES.users);const ui=users.findIndex(u=>u.id===bookings[idx].userId);
    if(ui>=0){const earned=Math.floor(Math.random()*150)+50;users[ui].loyaltyPoints=(users[ui].loyaltyPoints||0)+earned;writeDB(FILES.users,users);
      createNotification(bookings[idx].userId,'booking_confirmed','✅ Booking Approved!',`Booking ${bookings[idx].ref} confirmed!${adminNote?` Admin: "${adminNote}"`:''}`);}
  } else if(status==='cancelled'){createNotification(bookings[idx].userId,'booking_cancelled','❌ Booking Cancelled',`Booking ${bookings[idx].ref} cancelled.${adminNote?` Reason: "${adminNote}"`:''}`);
  } else if(paymentStatus==='paid'){createNotification(bookings[idx].userId,'payment_confirmed','💳 Payment Confirmed',`Payment for ${bookings[idx].ref} verified!${adminNote?` Note: "${adminNote}"`:''}`);}
  io.emit(`booking_updated_${bookings[idx].userId}`,{bookingId:req.params.id,status,paymentStatus});
  res.json(bookings[idx]);
});
app.delete('/api/admin/bookings/:id', adminAuth, (req, res) => {
  writeDB(FILES.bookings, readDB(FILES.bookings).filter(b=>b.id!==req.params.id));
  res.json({ok:true});
});

app.delete('/api/admin/bookings', adminAuth, (req, res) => {
  writeDB(FILES.bookings, []); res.json({ok:true});
});

app.get('/api/admin/transactions', adminAuth, (req, res) => {
  const txs=readDB(FILES.transactions), users=readDB(FILES.users);
  res.json([...txs].reverse().map(t=>{const u=users.find(u=>u.id===t.userId);return{...t,userName:u?.username};}));
});

app.get('/api/admin/access-logs', adminAuth, (req, res) => {
  const logs=[...readDB(FILES.accessLog)].reverse().slice(0,200);
  const users=readDB(FILES.users);
  res.json(logs.map(l=>{const u=users.find(u=>u.id===l.userId);return{...l,userName:u?.username};}));
});

app.get('/api/admin/uploads', adminAuth, (req, res) => {
  try {
    const bookings=readDB(FILES.bookings), users=readDB(FILES.users);
    const files=fs.readdirSync(uploadsDir).map(f=>{
      const b=bookings.find(bk=>bk.paymentProof?.includes(f)||bk.giftcardImage?.includes(f)||bk.giftcardImages?.some(img=>img?.includes(f)));
      const u=b?users.find(u=>u.id===b?.userId):null;
      return{filename:f,url:`/uploads/${f}`,size:fs.statSync(path.join(uploadsDir,f)).size,booking:b?{ref:b.ref,userId:b.userId,userName:u?.username,status:b.status,paymentStatus:b.paymentStatus}:null};
    });
    res.json(files);
  } catch{res.json([]);}
});

app.get('/api/admin/promos', adminAuth, (req, res) => res.json(readDB(FILES.promoCodes)));
app.post('/api/admin/promos', adminAuth, (req, res) => {
  const promos=readDB(FILES.promoCodes);
  const p={id:uuidv4(),...req.body,usedCount:req.body.usedCount||0,isActive:req.body.isActive!==undefined?req.body.isActive:true,createdAt:new Date().toISOString()};
  promos.push(p);writeDB(FILES.promoCodes,promos);res.json(p);
});
app.patch('/api/admin/promos/:id', adminAuth, (req, res) => {
  const promos=readDB(FILES.promoCodes); const idx=promos.findIndex(p=>p.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  promos[idx]={...promos[idx],...req.body};writeDB(FILES.promoCodes,promos);res.json(promos[idx]);
});
app.delete('/api/admin/promos/:id', adminAuth, (req, res) => {
  writeDB(FILES.promoCodes, readDB(FILES.promoCodes).filter(p=>p.id!==req.params.id));
  res.json({ok:true});
});

app.get('/api/admin/messages', adminAuth, (req, res) => res.json([...readDB(FILES.messages)].reverse()));
app.patch('/api/admin/messages/:id', adminAuth, (req, res) => {
  const msgs=readDB(FILES.messages); const idx=msgs.findIndex(m=>m.id===req.params.id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  msgs[idx]={...msgs[idx],...req.body,updatedAt:new Date().toISOString()};
  writeDB(FILES.messages,msgs);
  if(req.body.reply&&msgs[idx].userId) createNotification(msgs[idx].userId,'message_reply','💬 Support Reply',`Admin replied: "${req.body.reply}"`);
  res.json(msgs[idx]);
});
app.delete('/api/admin/messages/:id', adminAuth, (req, res) => {
  writeDB(FILES.messages, readDB(FILES.messages).filter(m=>m.id!==req.params.id));
  res.json({ok:true});
});
app.delete('/api/admin/messages', adminAuth, (req, res) => {
  writeDB(FILES.messages,[]);res.json({ok:true});
});

app.delete('/api/admin/access-logs', adminAuth, (req, res) => {
  writeDB(FILES.accessLog, []); res.json({ok:true});
});

app.delete('/api/admin/payments', adminAuth, (req, res) => {
  const bookings = readDB(FILES.bookings);
  const updated = bookings.filter(b => !['pending', 'proof_submitted'].includes(b.paymentStatus));
  writeDB(FILES.bookings, updated);
  res.json({ok:true});
});

app.delete('/api/admin/transactions', adminAuth, (req, res) => {
  writeDB(FILES.transactions, []); res.json({ok:true});
});

app.delete('/api/admin/uploads', adminAuth, (req, res) => {
  try {
    fs.readdirSync(uploadsDir).forEach(f => {
      try { fs.unlinkSync(path.join(uploadsDir, f)); } catch {}
    });
    res.json({ok:true});
  } catch { res.json({ok:false}); }
});

app.post('/api/admin/reviews', adminAuth, (req, res) => {
  try {
    const bookings=readDB(FILES.bookings), users=readDB(FILES.users);
    const files=fs.readdirSync(uploadsDir).map(f=>{
      const b=bookings.find(bk=>bk.paymentProof?.includes(f)||bk.giftcardImage?.includes(f)||bk.giftcardImages?.some(img=>img?.includes(f)));
      const u=b?users.find(u=>u.id===b?.userId):null;
      return{filename:f,url:`/uploads/${f}`,size:fs.statSync(path.join(uploadsDir,f)).size,booking:b?{ref:b.ref,userId:b.userId,userName:u?.username,status:b.status,paymentStatus:b.paymentStatus}:null};
    });
    res.json(files);
  } catch{res.json([]);}
});

app.get('/api/admin/licenses', adminAuth, (req, res) => {
  const licenses=readDB(FILES.licenses), users=readDB(FILES.users);
  res.json(licenses.map(l=>{const u=users.find(u=>u.id===l.usedBy);return{...l,usedByUser:u?u.username:null};}));
});
app.post('/api/admin/licenses', adminAuth, (req, res) => {
  const licenses=readDB(FILES.licenses);
  const l={...req.body,usedBy:null,createdAt:new Date().toISOString()};
  licenses.push(l);writeDB(FILES.licenses,licenses);res.json(l);
});
app.patch('/api/admin/licenses/:key', adminAuth, (req, res) => {
  const lics = readDB(FILES.licenses);
  const idx  = lics.findIndex(x => x.key === decodeURIComponent(req.params.key));
  if (idx < 0) return res.status(404).json({ error:'Not found' });
  const oldStatus = lics[idx].status;
  Object.assign(lics[idx], req.body);
  lics[idx].lastModified = new Date().toISOString();
  lics[idx].modifiedBy   = req.user.id;
  writeDB(FILES.licenses, lics);
  const l = lics[idx];

  // Emit real-time update to user if license is assigned
  if (l.usedBy) {
    const expiryInfo = getLicenseExpiryInfo(l);
    const newStatus  = getLicenseStatus(l);
    io.emit(`license_update_${l.usedBy}`, { licenseKey: l.key, status: newStatus, expiresAt: l.expiresAt, expiryInfo });

    // Notify user of admin changes
    const statusMessages = {
      active:    ['🔑 License Reactivated',   'Your license has been reactivated. Flight booking is now available.'],
      suspended: ['⏸ License Suspended',     'Your license has been suspended. Flight booking is restricted.'],
      revoked:   ['🚫 License Revoked',       'Your license has been revoked. Contact admin for assistance.'],
      paused:    ['⏸ License Paused',         'Your license has been paused. Contact admin.'],
      disabled:  ['🔴 License Disabled',      'Your license has been disabled. Contact admin.'],
    };
    const msgKey = req.body.status || newStatus;
    const msgArr = statusMessages[msgKey];
    if (msgArr) createNotification(l.usedBy, 'license_update', msgArr[0], msgArr[1]);

    // If expiry date was changed, send notification
    if (req.body.expiresAt) {
      const expInfo = getLicenseExpiryInfo(l);
      const expDate = new Date(l.expiresAt);
      const formattedExp = expDate.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      createNotification(l.usedBy, 'license_expiry', '📅 License Expiry Updated',
        `Your license expiry has been updated. Expires ${formattedExp}.`);
    }
  }

  res.json({ ...l, expiryInfo: getLicenseExpiryInfo(l), computedStatus: getLicenseStatus(l) });
});
app.delete('/api/admin/licenses/:key', adminAuth, (req, res) => {
  writeDB(FILES.licenses, readDB(FILES.licenses).filter(x=>x.key!==decodeURIComponent(req.params.key)));
  res.json({ok:true});
});

app.post('/api/admin/reviews', adminAuth, (req, res) => {
  const reviews=readDB(FILES.reviews);
  const r={id:uuidv4(),...req.body,date:new Date().toISOString().split('T')[0]};
  reviews.push(r);writeDB(FILES.reviews,reviews);res.json(r);
});

app.get('/api/fix-admin', (req, res) => {
  const users=readDB(FILES.users); const idx=users.findIndex(u=>u.username==='Lexy');
  if(idx>=0){users[idx].role='admin';users[idx].isActive=true;writeDB(FILES.users,users);res.json({ok:true,user:{username:users[idx].username,role:users[idx].role}});}
  else res.json({ok:false,message:'Admin not found'});
});
app.get('/api/fix-promos', (req, res) => {
  const promos=readDB(FILES.promoCodes);
  promos.forEach(p=>{if(p.code!=='L1E2X3Y4')p.isActive=true;});
  writeDB(FILES.promoCodes,promos);res.json({ok:true,activated:promos.filter(p=>p.isActive).length});
});



app.post('/api/game/xp', auth, (req, res) => {
  try {
    const { xp, score, level } = req.body;
    const points = Math.min(Math.floor(xp || 0), 500); 
    if (points <= 0) return res.json({ ok: true, pointsAwarded: 0 });
    const users = readDB(FILES.users);
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx < 0) return res.status(404).json({ error: 'User not found' });
    users[idx].loyaltyPoints = (users[idx].loyaltyPoints || 0) + points;
    writeDB(FILES.users, users);
    createNotification(req.user.id, 'game', '🎮 Sky Ace XP Earned!',
      `You scored ${(score||0).toLocaleString()} pts (Level ${level||1}) and earned ${points} loyalty points!`);
    logAccess(req.user.id, 'GAME_XP', { score, level, pointsAwarded: points }, req);
    res.json({ ok: true, pointsAwarded: points, totalPoints: users[idx].loyaltyPoints });
  } catch(err) { res.status(500).json({ error: 'XP update failed' }); }
});

function normalizeTrackCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

app.get('/api/track/:code', (req, res) => {
  const code = normalizeTrackCode(req.params.code);
  const bookings = readDB(FILES.bookings);
  const booking = bookings.find(b =>
    normalizeTrackCode(b.ref) === code ||
    (b.outboundFlight && normalizeTrackCode(b.outboundFlight.flightNumber) === code)
  );
  if (booking) {
    const flight = booking.outboundFlight || {};
    res.json({found:true,type:'booking',flightNumber:flight.flightNumber||'FW-'+(Math.floor(Math.random()*900)+100),airline:flight.airline||'Fly Way Airlines',aircraft:flight.aircraft||'Boeing 737-800',from:flight.from,to:flight.to,dep:flight.depTime||'08:00',arr:flight.arrTime||'12:00',dur:flight.duration||'4h 00m',departureDate:flight.departureDate||booking.createdAt?.split('T')[0],passengers:(booking.passengers||[]).length,travelClass:booking.travelClass,bookingRef:booking.ref,status:booking.status,paymentStatus:booking.paymentStatus});
    return;
  }
  res.json({found:false,code});
});



function parseDurMs(durStr) {
  if (!durStr) return null;
  const m = String(durStr).match(/(\d+)h\s*(\d+)?m?/);
  if (!m) return null;
  return ((parseInt(m[1]||0)*60) + parseInt(m[2]||0)) * 60000;
}

app.get('/api/flightmap/:code', (req, res) => {
  const code = normalizeTrackCode(req.params.code);
  const bookings = readDB(FILES.bookings);

  const booking = bookings.find(b =>
    normalizeTrackCode(b.ref) === code ||
    (b.outboundFlight && normalizeTrackCode(b.outboundFlight.flightNumber) === code)
  );

  if (booking) {
    const flight = booking.outboundFlight || {};
    const durMs = parseDurMs(flight.duration) || 5*60*60000; 

    
    let progress = 0.001;
    let startTime = null;
    if (flight.departureDate && flight.depTime) {
      try {
        const dep = new Date(`${flight.departureDate}T${flight.depTime}`);
        if (!isNaN(dep.getTime())) {
          startTime = dep.getTime();
          const elapsed = Date.now() - startTime;
          progress = Math.min(0.999, Math.max(0.001, elapsed / durMs));
        }
      } catch(e) {}
    }
    if (!startTime) startTime = Date.now() - durMs * 0.001;

    return res.json({
      found: true,
      source: 'booking',
      flightCode: booking.ref,
      flightNumber: flight.flightNumber || ('FW-' + booking.ref.slice(-4)),
      from: flight.from,
      to: flight.to,
      airline: flight.airline || 'Fly Way Airlines',
      aircraft: flight.aircraft || 'Boeing 737-800',
      depTime: flight.depTime || '08:00',
      arrTime: flight.arrTime || '12:00',
      departureDate: flight.departureDate,
      durMs,
      progress,
      startTime,
      travelClass: booking.travelClass,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      passengers: (booking.passengers||[]).length,
      bookingRef: booking.ref,
    });
  }

  res.json({ found: false, code });
});

// ── License Activation Request (user requests key from admin) ────────────────
app.post('/api/license/request-activation', auth, (req, res) => {
  try {
    const { message } = req.body;
    const users = readDB(FILES.users);
    const user  = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const msgs = readDB(FILES.messages);
    const m = {
      id: uuidv4(),
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      email: user.email,
      subject: 'License Activation Request',
      message: message || `User ${user.username} is requesting a new license key activation. Current key: ${user.licenseKey || 'None'}.`,
      userId: user.id,
      type: 'license_request',
      status: 'unread',
      reply: null,
      createdAt: new Date().toISOString(),
    };
    msgs.push(m);
    writeDB(FILES.messages, msgs);
    createNotification(user.id, 'license_request', '📧 Activation Request Sent',
      'Your license activation request has been sent to admin. You will be notified once processed.');
    io.emit('admin_new_message', { id: m.id, name: m.name, subject: m.subject, type: 'license_request' });
    logAccess(user.id, 'LICENSE_REQUEST', { message }, req);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: 'Failed to send request' }); }
});

// ── License expiry check (lightweight poll endpoint) ──────────────────────────
app.get('/api/license/check', auth, (req, res) => {
  try {
    const users = readDB(FILES.users);
    const user  = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const licenses = readDB(FILES.licenses);
    const lic = licenses.find(l => l.key === user.licenseKey);
    if (!lic) return res.json({ found: false, bookingAllowed: false });
    const expiryInfo    = getLicenseExpiryInfo(lic);
    const computedStatus = getLicenseStatus(lic);
    const bookingAllowed = computedStatus === 'active';
    // Auto-send expiry notifications
    if (!bookingAllowed && lic.usedBy && !lic._expiredNotified) {
      createNotification(lic.usedBy, 'license_expired', '🔐 License Expired',
        `Your license ${lic.key} has expired. Flight booking is now restricted.`);
      const idx = licenses.findIndex(l => l.key === lic.key);
      if (idx >= 0) { licenses[idx]._expiredNotified = true; writeDB(FILES.licenses, licenses); }
    }
    res.json({ found: true, key: lic.key, type: lic.type, status: computedStatus, expiryInfo, bookingAllowed });
  } catch(err) { res.status(500).json({ error: 'Check failed' }); }
});

// ── Admin: generate activation code for user ──────────────────────────────────
app.post('/api/admin/licenses/assign-user', adminAuth, (req, res) => {
  const { userId, licenseKey } = req.body;
  if (!userId || !licenseKey) return res.status(400).json({ error: 'userId and licenseKey required' });
  const users    = readDB(FILES.users);
  const licenses = readDB(FILES.licenses);
  const uIdx = users.findIndex(u => u.id === userId);
  const lIdx = licenses.findIndex(l => l.key === licenseKey);
  if (uIdx < 0) return res.status(404).json({ error: 'User not found' });
  if (lIdx < 0) return res.status(404).json({ error: 'License not found' });
  // Release old license
  const oldKey = users[uIdx].licenseKey;
  if (oldKey) {
    const oldIdx = licenses.findIndex(l => l.key === oldKey);
    if (oldIdx >= 0 && licenses[oldIdx].usedBy === userId) { licenses[oldIdx].usedBy = null; licenses[oldIdx].usedAt = null; }
  }
  licenses[lIdx].usedBy = userId;
  licenses[lIdx].usedAt  = new Date().toISOString();
  users[uIdx].licenseKey  = licenseKey;
  writeDB(FILES.licenses, licenses);
  writeDB(FILES.users, users);
  const expiryInfo = getLicenseExpiryInfo(licenses[lIdx]);
  createNotification(userId, 'license_assigned', '🔑 License Assigned', `Admin assigned license ${licenseKey} to your account. ${expiryInfo.text}.`);
  io.emit(`license_update_${userId}`, { licenseKey, status: 'active', expiryInfo });
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  const status = getStorageStatus();
  const smtpConfigured = brevoMail.isConfigured();
  res.json({
    ok: true,
    service: 'flyway',
    nodeEnv: process.env.NODE_ENV || 'development',
    storage: status,
    smtp: {
      configured: smtpConfigured,
      provider: smtpConfigured ? 'brevo' : 'unconfigured',
      transport: brevoMail.getTransport()
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/',              (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/login',         (req,res) => res.sendFile(path.join(__dirname,'public','login.html')));
app.get('/register',      (req,res) => res.sendFile(path.join(__dirname,'public','register.html')));
app.get('/forgot-password',(req,res) => res.sendFile(path.join(__dirname,'public','forgot-password.html')));
app.get('/dashboard',     (req,res) => res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get('/booking',       (req,res) => res.sendFile(path.join(__dirname,'public','booking.html')));
app.get('/bookings',      (req,res) => res.sendFile(path.join(__dirname,'public','bookings.html')));
app.get('/transactions',  (req,res) => res.sendFile(path.join(__dirname,'public','transactions.html')));
app.get('/track',         (req,res) => res.sendFile(path.join(__dirname,'public','track.html')));
app.get('/track/:code',   (req,res) => res.sendFile(path.join(__dirname,'public','track-public.html')));
app.get('/flightmap',     (req,res) => res.sendFile(path.join(__dirname,'public','flightmap.html')));
app.get('/flightgame',    (req,res) => res.sendFile(path.join(__dirname,'public','flightgame.html')));
app.get('/flightsim',     (req,res) => { const p=path.join(__dirname,'public','flightsim.html'); if(fs.existsSync(p))res.sendFile(p);else res.redirect('/flightgame'); });
app.get('/profile',       (req,res) => res.sendFile(path.join(__dirname,'public','profile.html')));
app.get('/contact',       (req,res) => res.sendFile(path.join(__dirname,'public','contact.html')));
app.get('/notifications', (req,res) => res.sendFile(path.join(__dirname,'public','notifications.html')));
app.get('/legal',         (req,res) => res.sendFile(path.join(__dirname,'public','legal.html')));
app.get('/privacy',       (req,res) => res.redirect('/legalprivacy'));
app.get('/terms',         (req,res) => res.redirect('/legalterms'));
app.get('/cookies',       (req,res) => res.redirect('/legalcookies'));

app.get('/backdoor',           (req,res) => res.sendFile(path.join(__dirname,'public','backdoor','index.html')));
app.get('/backdoor/login',     (req,res) => res.sendFile(path.join(__dirname,'public','backdoor','login.html')));
app.get('/backdoor/dashboard', (req,res) => res.sendFile(path.join(__dirname,'public','backdoor','dashboard.html')));

app.get('/admin',           (req,res) => res.redirect(301,'/backdoor'));
app.get('/admin/login',     (req,res) => res.redirect(301,'/backdoor/login'));
app.get('/admin/dashboard', (req,res) => res.redirect(301,'/backdoor/dashboard'));

io.on('connection', socket => {
  socket.on('join_user', uid => socket.join(`user_${uid}`));
  socket.on('join_admin', () => socket.join('admin_room'));
  socket.on('chat_message', data => {
    const m=data.message.toLowerCase();
    let reply;
    if(m.match(/book|flight|ticket/)) reply='Head to **Book a Flight** to search routes and book! I\'m Zephyr, happy to walk you through it.';
    else if(m.match(/pay|payment/))   reply='We accept Bank Transfer, Crypto (BTC/ETH/USDT), Mobile Wallets, and Gift Cards.';
    else if(m.match(/cancel|refund/)) reply='Cancel from **My Bookings**. Refunds take 5-7 business days once approved by admin.';
    else if(m.match(/track|status/))  reply='Use **Track Flight** with your flight number (e.g. FW-XXX) for live status, gate, and weather!';
    else reply='Great question — let me connect you with our support team for a personal response.';
    socket.emit('chat_reply',{message:reply,timestamp:new Date().toISOString()});
  });
});

async function start() {
  if (USE_MONGO) {
    try {
      const { summary } = await mongoStore.initStorage(dataDir);
      console.log('[Storage] MongoDB connected. Documents loaded:', JSON.stringify(summary));
    } catch (err) {
      // Do NOT silently fall back to JSON: on Render that would hide the problem and lose data on restart.
      console.error('[Storage] FATAL —', err.message);
      process.exit(1);
    }
  }
  seed();
  server.listen(PORT, () => console.log(`\n✈  FlyWay v6 running at http://localhost:${PORT}\n   Admin panel: /backdoor\n   Environment: ${process.env.NODE_ENV || 'development'}\n   Storage: ${USE_MONGO ? 'MongoDB Atlas' : 'JSON files'}\n`));
}

// Render sends SIGTERM on every deploy/restart: finish pending Atlas writes first.
const shutdown = async () => {
  try { await mongoStore.close(); } catch (e) { console.error('[Storage] flush on shutdown failed:', e.message); }
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
module.exports = { app, io };
