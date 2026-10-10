const nodemailer = require('nodemailer');

const BREVO_API_URL = 'https://api.brevo.com/v3';

function getEnv(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : fallback;
}

function getConfig() {
  return {
    apiKey: getEnv('BREVO_API_KEY', ''),
    smtpHost: getEnv('SMTP_HOST', 'smtp-relay.brevo.com'),
    smtpPort: Number(getEnv('SMTP_PORT', '587')) || 587,
    smtpUser: getEnv('SMTP_USER', ''),
    smtpPass: getEnv('SMTP_PASS', ''),
    fromEmail: getEnv('SMTP_FROM_EMAIL', getEnv('BREVO_FROM_EMAIL', '')),
    fromName: getEnv('SMTP_FROM_NAME', getEnv('BREVO_FROM_NAME', 'FlyWay')),
  };
}

// Preferred transport: Brevo HTTPS API (port 443). Render's free plan blocks SMTP ports 25/465/587,
// so SMTP only works there on a paid instance. SMTP stays as the fallback for local use.
function getTransport() {
  const cfg = getConfig();
  if (cfg.apiKey && cfg.fromEmail) return 'api';
  if (cfg.smtpHost && cfg.smtpUser && cfg.smtpPass && cfg.fromEmail) return 'smtp';
  return null;
}

function isConfigured() {
  return getTransport() !== null;
}

function missingConfigMessage() {
  return 'Brevo is not configured. Set BREVO_API_KEY (recommended) or SMTP_USER + SMTP_PASS, plus SMTP_FROM_EMAIL (a sender verified in Brevo).';
}

function normaliseRecipients(to) {
  const list = Array.isArray(to) ? to : String(to).split(',');
  return list.map((e) => e.trim()).filter(Boolean).map((email) => ({ email }));
}

async function brevoApi(method, route, body) {
  const cfg = getConfig();
  const res = await fetch(`${BREVO_API_URL}${route}`, {
    method,
    headers: {
      'api-key': cfg.apiKey,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    let hint = '';
    if (res.status === 401) hint = ' (API key rejected. BREVO_API_KEY must be an API key starting "xkeysib-", not the SMTP key "xsmtpsib-". Also check Brevo > Security > Authorised IPs: if IP blocking is on, Render\'s changing IPs will be refused.)';
    throw new Error(`Brevo API ${res.status}: ${data.message || data.raw || res.statusText}${hint}`);
  }
  return data;
}

async function sendViaApi({ to, subject, htmlBody, textBody, attachments = [] }) {
  const cfg = getConfig();
  const payload = {
    sender: { name: cfg.fromName, email: cfg.fromEmail },
    to: normaliseRecipients(to),
    subject: subject || 'FlyWay message',
    htmlContent: htmlBody || `<p>${textBody || ''}</p>`,
    textContent: textBody || 'No text body provided',
  };
  if (attachments && attachments.length) {
    payload.attachment = attachments.map((a) => ({
      name: a.filename || 'attachment',
      content: Buffer.isBuffer(a.data) ? a.data.toString('base64') : Buffer.from(a.data || '').toString('base64'),
    }));
  }
  const data = await brevoApi('POST', '/smtp/email', payload);
  return { ok: true, provider: 'brevo-api', messageId: data.messageId };
}

function createSmtpTransporter() {
  const cfg = getConfig();
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

async function sendViaSmtp({ to, subject, htmlBody, textBody, attachments = [] }) {
  const cfg = getConfig();
  const info = await createSmtpTransporter().sendMail({
    from: `${cfg.fromName} <${cfg.fromEmail}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject || 'FlyWay message',
    text: textBody || 'No text body provided',
    html: htmlBody || textBody || '',
    attachments: (attachments || []).map((a) => ({
      filename: a.filename || 'attachment',
      content: a.data,
      contentType: a.contentType || 'application/octet-stream',
    })),
  });
  return { ok: true, provider: 'brevo-smtp', messageId: info.messageId };
}

async function testConnection() {
  const transport = getTransport();
  if (!transport) throw new Error(missingConfigMessage());

  if (transport === 'api') {
    const account = await brevoApi('GET', '/account');
    return { ok: true, provider: 'brevo-api', account: account.email };
  }
  try {
    await createSmtpTransporter().verify();
  } catch (err) {
    if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|Connection timeout|Greeting never received/i.test(String(err.message))) {
      throw new Error(`Cannot reach ${getConfig().smtpHost}:${getConfig().smtpPort} (${err.message}). Render free web services block SMTP ports 25/465/587. Use BREVO_API_KEY (HTTPS) instead.`);
    }
    throw err;
  }
  return { ok: true, provider: 'brevo-smtp' };
}

async function sendEmail(options = {}) {
  const { to, subject, htmlBody, textBody, attachments = [] } = options;
  if (!to) throw new Error('No recipient email provided');

  const transport = getTransport();
  if (!transport) {
    console.warn('[Brevo] Email not configured. Skipping outbound email.');
    return { ok: false, skipped: true };
  }
  return transport === 'api'
    ? sendViaApi({ to, subject, htmlBody, textBody, attachments })
    : sendViaSmtp({ to, subject, htmlBody, textBody, attachments });
}

module.exports = {
  getConfig,
  getTransport,
  isConfigured,
  missingConfigMessage,
  testConnection,
  sendEmail,
};
