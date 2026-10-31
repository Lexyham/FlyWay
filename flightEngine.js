
const KEY = 'flights_db_v2';

const memoryStore = (() => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
})();

const getStorage = () => {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.localStorage &&
    typeof globalThis.localStorage.getItem === 'function' &&
    typeof globalThis.localStorage.setItem === 'function'
  ) {
    return globalThis.localStorage;
  }
  return memoryStore;
};

const randomUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  if (typeof require === 'function') {
    try {
      const { randomUUID } = require('crypto');
      if (typeof randomUUID === 'function') return randomUUID();
    } catch (err) {
      // ignore and use fallback
    }
  }
  return 'flight-' + Math.random().toString(16).slice(2) + '-' + Date.now();
};

function loadFlights() {
  const raw = getStorage().getItem(KEY) || '[]';
  try {
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveFlights(flights) {
  getStorage().setItem(KEY, JSON.stringify(Array.isArray(flights) ? flights : []));
}

function createFlight({ from, to, duration = 3600000 } = {}) {
  const flight = {
    id: randomUUID(),
    code: 'FL' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    from,
    to,
    startTime: Date.now(),
    duration,
    speedMultiplier: 1,
  };
  const all = loadFlights();
  all.push(flight);
  saveFlights(all);
  return flight;
}

function getFlight(code) {
  return loadFlights().find((f) => f.code === code);
}

function computeProgress(f) {
  if (!f || !Number.isFinite(f.startTime) || !Number.isFinite(f.duration) || f.duration <= 0) return 0;
  return Math.min(1, ((Date.now() - f.startTime) / f.duration) * (f.speedMultiplier || 1));
}

function route(p) {
  return { x: p * 1000 - 500, y: Math.sin(p * Math.PI) * -300 };
}

function computeState(f) {
  const p = computeProgress(f);
  const pos = route(p);
  return { ...f, progress: p, position: pos, altitude: 2000 + Math.sin(p * Math.PI) * 12000, speed: 250 + 200 * p, heading: p * Math.PI, eta: Math.max(0, f.duration - (Date.now() - f.startTime)) };
}

let ai = [];
function initAI(n = 10) {
  ai = [];
  for (let i = 0; i < n; i++) {
    ai.push({ t: Date.now() - Math.random() * 1000000, d: 3000000, o: Math.random() });
  }
}

function getAI() {
  return ai.map((a) => {
    const p = ((Date.now() - a.t) / a.d) % 1;
    return { position: route(p + a.o) };
  });
}

const api = { loadFlights, saveFlights, createFlight, getFlight, computeProgress, route, computeState, initAI, getAI };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FlyWayFlightEngine = api;
}

