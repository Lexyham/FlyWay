const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'public', 'uploads');
const EMAIL_ASSETS_DIR = path.join(UPLOADS_DIR, 'email-assets');
const EMAIL_REPORTS_PATH = path.join(DATA_DIR, 'emailReports.json');
const TEMPLATE_DIR = path.join(ROOT_DIR, 'templates', 'email');

const VALID_TEMPLATES = ['standard', 'premium'];
let browserInstance = null;

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureEmailReportsFile() {
  ensureDirectory(DATA_DIR);
  if (!fs.existsSync(EMAIL_REPORTS_PATH)) fs.writeFileSync(EMAIL_REPORTS_PATH, JSON.stringify([], null, 2));
}

// server.js plugs its storage (JSON files or MongoDB) in here via setStore().
let externalStore = null;
function setStore(store) { externalStore = store; }

function loadEmailReports() {
  if (externalStore) return externalStore.load() || [];
  ensureEmailReportsFile();
  try {
    return JSON.parse(fs.readFileSync(EMAIL_REPORTS_PATH, 'utf8')) || [];
  } catch (err) {
    return [];
  }
}

function saveEmailReports(reports) {
  if (externalStore) return externalStore.save(reports);
  ensureDirectory(DATA_DIR);
  fs.writeFileSync(EMAIL_REPORTS_PATH, JSON.stringify(reports, null, 2));
}

function normalizeTemplateName(template) {
  return VALID_TEMPLATES.includes(template) ? template : 'standard';
}

function createReportId(reports) {
  const last = reports.length ? reports[reports.length - 1].id : null;
  const start = 1000;
  const next = last && /^MAIL-(\d+)$/.test(last) ? Math.max(parseInt(last.replace('MAIL-', ''), 10) + 1, start + 1) : start + 1;
  return `MAIL-${String(next).padStart(4, '0')}`;
}

function buildAttachmentFilename(bookingRef, type) {
  const cleanType = type === 'receipt' ? 'Receipt' : 'Ticket';
  const safeRef = String(bookingRef || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '_');
  return `FlyWay_${cleanType}_${safeRef}.png`;
}

function getAttachmentPath(bookingRef, type) {
  ensureDirectory(EMAIL_ASSETS_DIR);
  return path.join(EMAIL_ASSETS_DIR, buildAttachmentFilename(bookingRef, type));
}

function templateData(booking, user, type) {
  const outgoing = booking.outboundFlight || {};
  const route = `${outgoing.from || '-'} → ${outgoing.to || '-'}`;
  const passengerNames = (booking.passengers || []).map(p => p.name || 'Passenger').join(', ');
  const purchaseDate = booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : new Date().toLocaleDateString('en-US');
  const departureDate = outgoing.departureDate || booking.departureDate || '-';
  const departureTime = outgoing.depTime || outgoing.dep || '-';
  const arrivalTime = outgoing.arrTime || outgoing.arr || '-';
  const flightNumber = outgoing.flightNumber || outgoing.fn || '-';
  const travelClass = booking.travelClass || '-';
  const amount = booking.totalAmount != null ? `$${Number(booking.totalAmount).toFixed(2)}` : '-';
  const paymentMethod = booking.paymentMethod || '-';
  const ticketLabel = type === 'receipt' ? 'Receipt' : 'Ticket';
  const recipientName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.username || 'FlyWay passenger');

  return {
    userName: recipientName,
    bookingRef: booking.ref || 'FW-UNKNOWN',
    route,
    passengerNames,
    purchaseDate,
    departureDate,
    departureTime,
    arrivalTime,
    flightNumber,
    travelClass,
    amount,
    paymentMethod,
    ticketLabel,
    supportEmail: process.env.SMTP_FROM_EMAIL || 'support@flyway.com',
    companyName: 'FlyWay',
    currentYear: new Date().getFullYear(),
    qrPreview: booking.ref ? booking.ref : '-',
  };
}

function loadTemplate(templateName) {
  const normalized = normalizeTemplateName(templateName);
  const filePath = path.join(TEMPLATE_DIR, `${normalized}.html`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing email template: ${normalized}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function compileTemplate(templateName, booking, user, type) {
  const data = templateData(booking, user, type);
  let template = loadTemplate(templateName);
  Object.keys(data).forEach((key) => {
    const value = data[key] != null ? data[key] : '';
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return template;
}

function buildPlainText(booking, user, type) {
  const data = templateData(booking, user, type);
  return `${data.companyName} ${data.ticketLabel}\n\nBooking Ref: ${data.bookingRef}\nRoute: ${data.route}\nDeparture: ${data.departureDate} ${data.departureTime}\nArrival: ${data.arrivalTime}\nClass: ${data.travelClass}\nPassengers: ${data.passengerNames}\nTotal: ${data.amount}\nPayment: ${data.paymentMethod}\n\nThank you for flying with ${data.companyName}.\nFor support, contact ${data.supportEmail}.`;
}

async function getBrowser() {
  if (browserInstance) return browserInstance;
  browserInstance = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  return browserInstance;
}

function buildAttachmentHtml(booking, type) {
  const data = templateData(booking, { firstName:'', lastName:'', username:'' }, type);
  const isTicket = type === 'ticket';
  const bgColor = isTicket ? '#0b1223' : '#ffffff';
  const textColor = isTicket ? '#ffffff' : '#10243b';
  const cardBg = isTicket ? 'linear-gradient(135deg, rgba(1,108,212,0.95), rgba(12,18,49,0.95))' : '#f6f9ff';
  const accent = isTicket ? '#48c7ff' : '#0f6ec6';
  const matter = isTicket ? 'Ticket details' : 'Receipt details';
  const passengerLine = booking.passengers && booking.passengers.length ? booking.passengers.map((p,i)=>`<div class="info-row"><span>Passenger ${i+1}</span><span>${p.name||'Passenger ' + (i+1)}</span></div>`).join('') : `<div class="info-row"><span>Passengers</span><span>1 Passenger</span></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${data.companyName} ${data.ticketLabel}</title><style>body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${bgColor};color:${textColor}}*{box-sizing:border-box}main{min-height:100vh;padding:40px 40px 60px}section{max-width:1100px;margin:auto;background:${cardBg};border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.20)}.hero{padding:32px 40px;background:${accent};background-image:linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0));color:#fff}.hero h1{margin:0;font-size:32px;letter-spacing:0.6px}.hero p{margin:10px 0 0;font-size:14px;opacity:.88}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:34px 40px}.box{padding:22px;background:${isTicket?'rgba(255,255,255,0.06)':'#fff'};border-radius:18px;border:1px solid ${isTicket?'rgba(255,255,255,0.08)':'#e7eef9'}}.box h2{margin:0 0 12px;font-size:16px;color:${isTicket?'#fff':'#10243b'}}.info-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid ${isTicket?'rgba(255,255,255,0.08)':'#e9eef7'}}.info-row:last-child{border-bottom:none}.info-row span{font-size:13px;line-height:1.6}.emphasis{color:${isTicket?'#48c7ff':'#0b4bb5'};font-weight:700}.footer{padding:30px 40px 36px;font-size:13px;color:${isTicket?'rgba(255,255,255,0.75)':'#66819e'};display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;background:${isTicket?'rgba(255,255,255,0.04)':'#f6f9ff'}}.badge{display:inline-flex;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,0.12);color:#fff;letter-spacing:0.6px}.qr-card{padding:18px;border-radius:18px;background:${isTicket?'rgba(255,255,255,0.08)':'#eef4ff'};text-align:center}.qr-code{width:132px;height:132px;border-radius:24px;background:rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:14px;color:${isTicket?'#fff':'#0f4fb4'};margin:0 auto}</style></head><body><main><section><div class="hero"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div class="badge">${data.companyName} ${data.ticketLabel}</div><h1>${data.route}</h1><p>${matter} for booking ${data.bookingRef}</p></div><div style="text-align:right"><div style="font-size:12px;opacity:.8">Booking ref</div><div style="font-size:22px;font-weight:700;letter-spacing:.4px">${data.bookingRef}</div></div></div></div><div class="grid"><div class="box"><h2>Flight information</h2><div class="info-row"><span>Flight</span><span class="emphasis">${data.flightNumber}</span></div><div class="info-row"><span>Route</span><span>${data.route}</span></div><div class="info-row"><span>Departure</span><span>${data.departureDate} · ${data.departureTime}</span></div><div class="info-row"><span>Arrival</span><span>${data.arrivalTime}</span></div><div class="info-row"><span>Class</span><span>${data.travelClass}</span></div></div><div class="box"><h2>${type==='receipt'?'Payment summary':'Passenger summary'}</h2>${passengerLine}<div class="info-row"><span>${type==='receipt'?'Amount paid':'Total fare'}</span><span class="emphasis">${data.amount}</span></div><div class="info-row"><span>Method</span><span>${data.paymentMethod}</span></div><div class="info-row"><span>Booked by</span><span>${data.userName}</span></div></div><div class="box" style="grid-column:span 2"><h2>${type==='receipt'?'Receipt details':'Travel details'}</h2><div class="info-row"><span>Purchase date</span><span>${data.purchaseDate}</span></div><div class="info-row"><span>Reference</span><span>${data.bookingRef}</span></div><div class="info-row"><span>Support</span><span>${data.supportEmail}</span></div></div></div><div class="footer"><div>Thank you for choosing ${data.companyName}. For support, email ${data.supportEmail}.</div><div class="qr-card"><div style="font-size:12px;margin-bottom:10px;opacity:.78">Booking Code</div><div class="qr-code">${data.qrPreview}</div></div></div></section></main></body></html>`;
}

async function generateAttachmentIfMissing(booking, type) {
  const targetPath = getAttachmentPath(booking.ref, type);
  if (fs.existsSync(targetPath)) return targetPath;
  const browser = await getBrowser();
  const page = await browser.newPage();
  const html = buildAttachmentHtml(booking, type);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 900 });
  await page.screenshot({ path: targetPath, type: 'png', fullPage: true });
  await page.close();
  return targetPath;
}

function getEmailReports(filter = {}) {
  const reports = loadEmailReports();
  return reports.filter((report) => {
    if (filter.userId && report.userId !== filter.userId) return false;
    if (filter.bookingId && report.bookingId !== filter.bookingId) return false;
    if (filter.type && report.type !== filter.type) return false;
    if (filter.template && report.template !== filter.template) return false;
    if (filter.status && report.status !== filter.status) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return [report.id, report.userId, report.bookingId, report.recipient, report.type, report.template, report.status].some(value => String(value).toLowerCase().includes(search));
    }
    return true;
  }).reverse();
}

function getReportSummary() {
  const reports = loadEmailReports();
  const summary = { total: reports.length, sent: 0, failed: 0, receipt: 0, ticket: 0, standard: 0, premium: 0 };
  reports.forEach((report) => {
    if (report.status === 'sent') summary.sent += 1;
    if (report.status === 'failed') summary.failed += 1;
    if (report.type === 'receipt') summary.receipt += 1;
    if (report.type === 'ticket') summary.ticket += 1;
    if (report.template === 'standard') summary.standard += 1;
    if (report.template === 'premium') summary.premium += 1;
  });
  return summary;
}

function appendEmailReport(report) {
  const reports = loadEmailReports();
  reports.push(report);
  saveEmailReports(reports);
}

module.exports = {
  setStore,
  VALID_TEMPLATES,
  normalizeTemplateName,
  buildPlainText,
  compileTemplate,
  getAttachmentPath,
  generateAttachmentIfMissing,
  emailReportsPath: EMAIL_REPORTS_PATH,
  loadEmailReports,
  saveEmailReports,
  getEmailReports,
  getReportSummary,
  createReportId,
  appendEmailReport,
};
