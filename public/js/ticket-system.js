/**
 * FlyWay Premium Ticket System v3.0
 * ─────────────────────────────────
 * Unified ticket, receipt, and confirmation engine.
 * Handles: web view · PDF export · image export · modal preview
 */

(function(global) {
  'use strict';

  // ─── STATUS LOGIC ────────────────────────────────────────────────────────────

  const STATUS_CONFIG = {
    confirmed:  { color:'#00e396', bg:'rgba(0,227,150,0.12)', border:'rgba(0,227,150,0.25)', label:'CONFIRMED',  icon:'✓', glow:'0 0 20px rgba(0,227,150,0.3)' },
    pending:    { color:'#f5c842', bg:'rgba(245,200,66,0.12)', border:'rgba(245,200,66,0.25)', label:'AWAITING APPROVAL', icon:'◔', glow:'0 0 20px rgba(245,200,66,0.3)' },
    cancelled:  { color:'#ff5757', bg:'rgba(255,87,87,0.12)',  border:'rgba(255,87,87,0.25)', label:'CANCELLED',  icon:'✕', glow:'0 0 20px rgba(255,87,87,0.3)' },
    refunded:   { color:'#a78bfa', bg:'rgba(167,139,250,0.12)',border:'rgba(167,139,250,0.25)',label:'REFUNDED',  icon:'↩', glow:'0 0 20px rgba(167,139,250,0.3)' },
    completed:  { color:'#00d4ff', bg:'rgba(0,212,255,0.12)', border:'rgba(0,212,255,0.25)', label:'COMPLETED',  icon:'★', glow:'0 0 20px rgba(0,212,255,0.3)' },
    delayed:    { color:'#fb923c', bg:'rgba(251,146,60,0.12)', border:'rgba(251,146,60,0.25)', label:'DELAYED',   icon:'⏱', glow:'0 0 20px rgba(251,146,60,0.3)' },
  };

  const CLASS_CONFIG = {
    economy:  { label:'Economy Class',   icon:'💺', color:'#94a3b8', tier:1 },
    business: { label:'Business Class',  icon:'🛋', color:'#f5c842', tier:2 },
    first:    { label:'First Class',     icon:'👑', color:'#00d4ff', tier:3 },
  };

  const PAYMENT_CONFIG = {
    card:      { label:'Credit / Debit Card', icon:'💳', color:'#00d4ff' },
    crypto:    { label:'Cryptocurrency',      icon:'₿',  color:'#f7931a' },
    giftcard:  { label:'Gift Card',           icon:'🎁', color:'#f5c842' },
    bank:      { label:'Bank Transfer',       icon:'🏦', color:'#00e396' },
    wallet:    { label:'Mobile Wallet',       icon:'📱', color:'#a78bfa' },
    cashapp:   { label:'CashApp',             icon:'💚', color:'#00d632' },
    paypal:    { label:'PayPal',              icon:'🅿',  color:'#0070ba' },
  };

  // ─── UTILITIES ────────────────────────────────────────────────────────────────

  function getStatus(booking) {
    const s = (booking.status || 'pending').toLowerCase();
    return STATUS_CONFIG[s] || STATUS_CONFIG.pending;
  }

  function getClass(booking) {
    const c = (booking.travelClass || 'economy').toLowerCase();
    return CLASS_CONFIG[c] || CLASS_CONFIG.economy;
  }

  function getPayment(booking) {
    const m = (booking.paymentMethod || 'card').toLowerCase();
    return PAYMENT_CONFIG[m] || PAYMENT_CONFIG[m.replace(/[^a-z]/g,'')] || PAYMENT_CONFIG.card;
  }

  function fmtMoney(n, currency) {
    currency = currency || 'USD';
    const num = parseFloat(n) || 0;
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date)) return d;
      return date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    } catch(e) { return d; }
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date)) return d;
      return date.toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' });
    } catch(e) { return d; }
  }

  function genReceiptId(ref) {
    return 'RCP-' + ref + '-' + Date.now().toString(36).toUpperCase().slice(-4);
  }

  function genTxFingerprint() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length:16}, (_, i) => i && i % 4 === 0 ? '-' + chars[Math.floor(Math.random()*chars.length)] : chars[Math.floor(Math.random()*chars.length)]).join('');
  }

  function getAirportCity(airports, code) {
    if (!airports || !code) return { city: code, flag: '🌍', name: code };
    return airports.find(a => a.code === code) || { city: code, flag: '🌍', name: code };
  }

  // ─── PRICING BREAKDOWN ───────────────────────────────────────────────────────

  function buildPricingBreakdown(booking) {
    const total = parseFloat(booking.totalAmount) || 0;
    const paxCount = (booking.passengers || []).length || 1;
    const cls = (booking.travelClass || 'economy').toLowerCase();
    const payMethod = (booking.paymentMethod || 'card').toLowerCase();

    // Realistic breakdown
    const baseFare   = +(total * 0.72).toFixed(2);
    const taxFee     = +(paxCount * 28.50).toFixed(2);
    const svcFee     = +(total * 0.048).toFixed(2);
    const fuelSurcharge = +(total * 0.035).toFixed(2);
    const baggageFee = booking.baggageFees || 0;
    const seatFee    = booking.seatFees || 0;

    let items = [
      { label: `Base Fare (${paxCount} pax × ${CLASS_CONFIG[cls]?.label || 'Economy'})`, amount: baseFare, type:'base' },
      { label: 'Airport & Government Taxes', amount: taxFee, type:'tax' },
      { label: 'Fuel Surcharge', amount: fuelSurcharge, type:'fee' },
      { label: 'Service & Processing Fee', amount: svcFee, type:'fee' },
    ];

    if (baggageFee > 0) items.push({ label: 'Checked Baggage Fee', amount: baggageFee, type:'extra' });
    if (seatFee    > 0) items.push({ label: 'Seat Selection Fee',  amount: seatFee,    type:'extra' });
    if (booking.promoDiscount > 0) items.push({ label: `Promo Discount (${booking.promoCode||''})`, amount: -booking.promoDiscount, type:'discount' });
    if (payMethod === 'crypto') items.push({ label: 'Crypto Processing (0%)', amount: 0, type:'info' });

    // Insurance if class is business/first
    if (cls === 'business' || cls === 'first') {
      items.push({ label: 'Travel Insurance (incl.)', amount: +(total * 0.02).toFixed(2), type:'included' });
    }

    return { items, total };
  }

  // ─── PAYMENT INFO BLOCK ──────────────────────────────────────────────────────

  function buildPaymentInfo(booking) {
    const payMethod = (booking.paymentMethod || 'card').toLowerCase();
    const now = new Date();
    const txId = genTxFingerprint();
    const payConf = getPayment(booking);

    if (payMethod === 'card') {
      const cardData = booking.cardData || {};
      const rawNum = (cardData.number || '').replace(/\s/g,'');
      const masked = rawNum.length >= 4 ? '**** **** **** ' + rawNum.slice(-4) : '**** **** **** ****';
      const holderName = cardData.name || (booking.passengers?.[0]?.name) || '—';
      return {
        method: payConf.label,
        icon: payConf.icon,
        color: payConf.color,
        fields: [
          { label: 'Cardholder', value: holderName.toUpperCase() },
          { label: 'Card Number', value: masked, mono: true },
          { label: 'Expiry', value: cardData.expiry || '—' },
          { label: 'Transaction ID', value: txId, mono: true },
          { label: 'Authorization', value: 'AUTH-' + Math.random().toString(36).slice(2,8).toUpperCase() },
          { label: 'Processed At', value: fmtDateTime(now) },
          { label: 'Status', value: booking.paymentStatus === 'paid' ? 'APPROVED' : 'PENDING VERIFICATION', highlight: true },
        ]
      };
    }

    if (payMethod === 'crypto') {
      const txHash = booking.paymentDetails?.match?.(/TX:\s*([^\s|]+)/)?.[1] || txId;
      return {
        method: payConf.label,
        icon: payConf.icon,
        color: payConf.color,
        fields: [
          { label: 'Network', value: 'Multi-Chain (BTC / ETH / USDT)' },
          { label: 'Transaction Hash', value: txHash.slice(0, 20) + '...', mono: true },
          { label: 'Confirmation Block', value: '#' + (Math.floor(Math.random() * 900000) + 100000) },
          { label: 'Confirmations', value: Math.floor(Math.random() * 8 + 3) + ' / 6 required' },
          { label: 'Broadcast At', value: fmtDateTime(now) },
          { label: 'Status', value: 'PROOF SUBMITTED — VERIFICATION PENDING', highlight: true },
        ]
      };
    }

    if (payMethod === 'giftcard') {
      const gcParts = (booking.paymentDetails || '').split('|');
      const gcType  = gcParts[0]?.replace('Gift Card:', '').trim() || 'Gift Card';
      const gcCode  = gcParts[1]?.replace('Code:', '').trim() || '****-****-****';
      return {
        method: payConf.label,
        icon: payConf.icon,
        color: payConf.color,
        fields: [
          { label: 'Card Brand', value: gcType },
          { label: 'Card Code', value: gcCode.slice(0,4) + '-****-****', mono: true },
          { label: 'Redemption ID', value: 'GC-' + txId.slice(0,12), mono: true },
          { label: 'Submitted At', value: fmtDateTime(now) },
          { label: 'Status', value: 'PENDING ADMIN VERIFICATION', highlight: true },
        ]
      };
    }

    // Fallback for bank / wallet / cashapp / etc.
    return {
      method: payConf.label,
      icon: payConf.icon,
      color: payConf.color,
      fields: [
        { label: 'Reference', value: txId, mono: true },
        { label: 'Method', value: payConf.label },
        { label: 'Processed At', value: fmtDateTime(now) },
        { label: 'Status', value: 'PENDING VERIFICATION', highlight: true },
      ]
    };
  }

  // ─── CODE 128 BARCODE ────────────────────────────────────────────────────────
  // Delegates to FWBarcode engine (barcode-gen.js) for fully scannable output.
  // Falls back to a simple visual representation if FWBarcode is not loaded.

  function generateBarcodeSVG(text, w, h) {
    h = h || 48;
    if (typeof FWBarcode !== 'undefined') {
      return FWBarcode.generate(text, {
        height:    h,
        moduleW:   2,
        color:     'currentColor',
        bgColor:   'transparent',
        showText:  false,
        quietZone: 6,
      });
    }
    // Fallback (visual only — not scannable)
    w = w || 280;
    const chars = (text + '00000000000000').slice(0, 14);
    const bars = [];
    let x = 0;
    for (let i = 0; i < chars.length * 6; i++) {
      const code = chars.charCodeAt(Math.floor(i / 6)) || 48;
      const isBar = (code + i) % 3 !== 0;
      const bw = 1 + (i % 3);
      if (isBar) bars.push(`<rect x="${x}" y="0" width="${bw}" height="${h}" fill="currentColor"/>`);
      x += bw + (i % 2);
    }
    return `<svg viewBox="0 0 ${x} ${h}" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${bars.join('')}</svg>`;
  }

  // Build a scannable payload string from booking data
  function buildScanPayload(booking) {
    if (typeof FWBarcode !== 'undefined') return FWBarcode.buildPayload(booking);
    const f   = booking.outboundFlight || {};
    const ref = (booking.ref || 'FW000000').replace(/[^A-Z0-9]/g, '');
    const fn  = (f.flightNumber || '').replace(/[^A-Z0-9]/g, '');
    const from = (f.from || '').toUpperCase().slice(0, 3);
    const to   = (f.to   || '').toUpperCase().slice(0, 3);
    return [ref, fn, from, to].filter(Boolean).join('-');
  }

  // ─── PREMIUM WEB TICKET HTML ─────────────────────────────────────────────────

  function buildWebTicketHTML(booking, opts) {
    opts = opts || {};
    const airports = (global.FlyWay && global.FlyWay.airports) ? global.FlyWay.airports : [];
    const f   = booking.outboundFlight || {};
    const pax = booking.passengers || [];
    const st  = getStatus(booking);
    const cls = getClass(booking);
    const now = new Date();

    const fromAirport = getAirportCity(airports, f.from);
    const toAirport   = getAirportCity(airports, f.to);
    const qrData      = encodeURIComponent(buildScanPayload(booking) || booking.ref || 'FW-TICKET');
    const receiptId   = genReceiptId(booking.ref || 'FW');
    const barcodeText = buildScanPayload(booking);
    const isRoundTrip = !!booking.returnFlight;
    const isCancelled = (booking.status || '').toLowerCase() === 'cancelled';

    const pricingData = buildPricingBreakdown(booking);
    const paymentInfo = buildPaymentInfo(booking);

    // Passenger rows
    const paxRows = pax.map((p, i) => {
      const ageTag = p.age < 2 ? 'Infant' : p.age < 12 ? 'Child' : p.age >= 60 ? 'Senior' : 'Adult';
      const seat = (booking.selectedSeats || [])[i] || 'Auto-Assigned';
      return `
        <div class="fw-pax-row">
          <div class="fw-pax-avatar">${(p.name || 'P').charAt(0).toUpperCase()}</div>
          <div class="fw-pax-info">
            <div class="fw-pax-name">${p.name || 'Passenger ' + (i+1)}</div>
            <div class="fw-pax-meta">Age ${p.age || '—'} · ${ageTag} · ${p.meal || 'Standard Meal'}</div>
          </div>
          <div class="fw-pax-right">
            <div class="fw-pax-seat">${seat}</div>
            <div class="fw-pax-label">SEAT</div>
          </div>
        </div>`;
    }).join('');

    // Pricing rows
    const priceRows = pricingData.items.map(item => {
      const isDisc = item.type === 'discount';
      const color  = isDisc ? '#00e396' : item.type === 'base' ? '#e0f0ff' : '#94a3b8';
      return `
        <div class="fw-price-row">
          <span style="color:${color}">${item.label}</span>
          <span style="color:${isDisc ? '#00e396' : '#e0f0ff'};font-weight:${item.type==='base'?'700':'500'}">${isDisc ? '−' : ''}${fmtMoney(Math.abs(item.amount))}</span>
        </div>`;
    }).join('');

    // Payment info rows
    const payRows = paymentInfo.fields.map(f => `
      <div class="fw-pay-row">
        <span class="fw-pay-label">${f.label}</span>
        <span class="fw-pay-val${f.mono ? ' fw-mono' : ''}${f.highlight ? ' fw-pay-highlight' : ''}">${f.value}</span>
      </div>`).join('');

    const statusBadge = `<span class="fw-status-badge" style="color:${st.color};background:${st.bg};border-color:${st.border};box-shadow:${st.glow}">${st.icon} ${st.label}</span>`;

    return `
    <div class="fw-ticket-system" id="fw-ticket-${booking.ref || 'main'}">

      <!-- ═══ HERO BOARDING PASS ═══ -->
      <div class="fw-boarding-pass${isCancelled ? ' fw-cancelled-state' : ''}">

        <!-- Top airline bar -->
        <div class="fw-bp-header">
          <div class="fw-bp-logo">
            <div class="fw-bp-logo-icon">✈</div>
            <div>
              <div class="fw-bp-airline-name">FLY<span style="color:#00d4ff">WAY</span> AIRLINES</div>
              <div class="fw-bp-tagline">Premium Aviation Experience</div>
            </div>
          </div>
          <div class="fw-bp-header-right">
            ${statusBadge}
            <div class="fw-bp-ref">${booking.ref || '—'}</div>
            <div class="fw-bp-ref-label">BOOKING REFERENCE</div>
          </div>
        </div>

        <!-- Route hero -->
        <div class="fw-bp-route">
          <div class="fw-bp-endpoint">
            <div class="fw-bp-iata">${f.from || '—'}</div>
            <div class="fw-bp-city">${fromAirport.flag || '🌍'} ${fromAirport.city || f.from || '—'}</div>
            <div class="fw-bp-time">${f.depTime || '—'}</div>
            <div class="fw-bp-time-label">DEPARTURE</div>
          </div>

          <div class="fw-bp-path">
            <div class="fw-bp-path-top">
              <span class="fw-bp-flight-no">${f.flightNumber || '—'}</span>
              <span class="fw-bp-ac">${f.aircraft || '—'}</span>
            </div>
            <div class="fw-bp-path-line">
              <div class="fw-bp-path-dot"></div>
              <div class="fw-bp-path-track"></div>
              <div class="fw-bp-plane-icon">✈</div>
            </div>
            <div class="fw-bp-path-bottom">
              <span class="fw-bp-dur">${f.duration || '—'}</span>
              <span class="fw-bp-type">${f.type || 'Non-stop'}</span>
            </div>
          </div>

          <div class="fw-bp-endpoint fw-bp-endpoint-right">
            <div class="fw-bp-iata">${f.to || '—'}</div>
            <div class="fw-bp-city">${toAirport.flag || '🌍'} ${toAirport.city || f.to || '—'}</div>
            <div class="fw-bp-time">${f.arrTime || '—'}</div>
            <div class="fw-bp-time-label">ARRIVAL</div>
          </div>
        </div>

        <!-- Dashed tear line -->
        <div class="fw-tear-line"><span class="fw-tear-circle fw-tear-left"></span><span class="fw-tear-dash"></span><span class="fw-tear-circle fw-tear-right"></span></div>

        <!-- Detail grid -->
        <div class="fw-bp-details">
          <div class="fw-detail-item">
            <div class="fw-detail-label">DATE</div>
            <div class="fw-detail-val">${fmtDate(f.departureDate)}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">CLASS</div>
            <div class="fw-detail-val" style="color:${cls.color}">${cls.icon} ${cls.label}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">PASSENGERS</div>
            <div class="fw-detail-val">${pax.length || 1} pax</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">AIRLINE</div>
            <div class="fw-detail-val">${f.airline || 'Fly Way Airlines'}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">TERMINAL</div>
            <div class="fw-detail-val">${booking.terminal || 'Main Terminal'}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">GATE</div>
            <div class="fw-detail-val">${booking.gate || 'TBA'}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">DISTANCE</div>
            <div class="fw-detail-val">${f.distance || '—'}</div>
          </div>
          <div class="fw-detail-item">
            <div class="fw-detail-label">TRIP TYPE</div>
            <div class="fw-detail-val">${isRoundTrip ? '↩ Round-Trip' : '→ One-Way'}</div>
          </div>
        </div>

        <!-- QR + Barcode -->
        <div class="fw-bp-bottom">
          <div class="fw-bp-qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&bgcolor=0a1628&color=00d4ff&margin=6"
              class="fw-bp-qr"
              onerror="this.style.display='none'"
              alt="QR Code">
            <div class="fw-bp-qr-label">SCAN TO VERIFY</div>
          </div>
          <div class="fw-bp-barcode-col">
            <div class="fw-barcode-wrap">
              ${generateBarcodeSVG(barcodeText, 260, 46)}
            </div>
            <div class="fw-barcode-text">${booking.ref || '—'} · ${f.flightNumber || '—'} · FlyWay Airlines</div>
            <div class="fw-receipt-id">Receipt ID: ${receiptId}</div>
            <div class="fw-issued-at">Issued: ${fmtDateTime(now)} GMT</div>
          </div>
        </div>

      </div>
      <!-- ═══ END BOARDING PASS ═══ -->

      <!-- ═══ PASSENGER MANIFEST ═══ -->
      ${pax.length > 0 ? `
      <div class="fw-section-card">
        <div class="fw-section-title">
          <span class="fw-section-icon">👤</span>
          <span>Passenger Manifest</span>
          <span class="fw-section-count">${pax.length} traveller${pax.length>1?'s':''}</span>
        </div>
        <div class="fw-pax-list">${paxRows}</div>
      </div>` : ''}

      <!-- ═══ FLIGHT INTELLIGENCE ═══ -->
      <div class="fw-section-row">

        <div class="fw-section-card">
          <div class="fw-section-title">
            <span class="fw-section-icon">✈</span>
            <span>Flight Details</span>
          </div>
          <div class="fw-intel-grid">
            <div class="fw-intel-item">
              <div class="fw-intel-label">Flight Number</div>
              <div class="fw-intel-val fw-mono">${f.flightNumber || '—'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Airline</div>
              <div class="fw-intel-val">${f.airline || 'Fly Way Airlines'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Aircraft</div>
              <div class="fw-intel-val">${f.aircraft || '—'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Duration</div>
              <div class="fw-intel-val">${f.duration || '—'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Distance</div>
              <div class="fw-intel-val">${f.distance || '—'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Flight Type</div>
              <div class="fw-intel-val">${f.type || 'Non-stop'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Departure</div>
              <div class="fw-intel-val fw-time-val">${f.depTime || '—'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Arrival</div>
              <div class="fw-intel-val fw-time-val">${f.arrTime || '—'}</div>
            </div>
            <div class="fw-intel-item fw-intel-wide">
              <div class="fw-intel-label">Booking Status</div>
              <div class="fw-intel-val" style="color:${st.color}">${st.icon} ${st.label}</div>
            </div>
          </div>
        </div>

        <div class="fw-section-card">
          <div class="fw-section-title">
            <span class="fw-section-icon">🎒</span>
            <span>Passenger Details</span>
          </div>
          <div class="fw-intel-grid">
            <div class="fw-intel-item">
              <div class="fw-intel-label">Seat(s)</div>
              <div class="fw-intel-val">${(booking.selectedSeats || []).filter(Boolean).join(', ') || 'Auto-Assigned'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Travel Class</div>
              <div class="fw-intel-val" style="color:${cls.color}">${cls.icon} ${cls.label}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Baggage</div>
              <div class="fw-intel-val">${booking.baggage ? (booking.baggage.carryOn||1)+'× Carry-on, '+(booking.baggage.checked||0)+'× Checked' : '1× Carry-on'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Check-in</div>
              <div class="fw-intel-val">${booking.status === 'confirmed' ? 'Online Available' : 'Pending'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Terminal</div>
              <div class="fw-intel-val">${booking.terminal || 'Main Terminal'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Gate</div>
              <div class="fw-intel-val">${booking.gate || 'TBA'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Boarding Group</div>
              <div class="fw-intel-val">${cls.tier === 3 ? 'Priority 1' : cls.tier === 2 ? 'Priority 2' : 'Group B'}</div>
            </div>
            <div class="fw-intel-item">
              <div class="fw-intel-label">Loyalty Points</div>
              <div class="fw-intel-val" style="color:#f5c842">${booking.loyaltyEarned > 0 ? '+' + booking.loyaltyEarned + ' pts earned' : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ PAYMENT DETAILS ═══ -->
      <div class="fw-section-card">
        <div class="fw-section-title">
          <span class="fw-section-icon">${paymentInfo.icon}</span>
          <span>Payment Details</span>
          <span class="fw-section-badge" style="color:${paymentInfo.color};background:${paymentInfo.color}18;border-color:${paymentInfo.color}30">${paymentInfo.method}</span>
        </div>
        <div class="fw-pay-section">
          <div class="fw-pay-breakdown">
            <div class="fw-pay-breakdown-title">Fare Breakdown</div>
            ${priceRows}
            <div class="fw-price-divider"></div>
            <div class="fw-price-total-row">
              <span>Total Charged</span>
              <span class="fw-price-total">${fmtMoney(pricingData.total)}</span>
            </div>
          </div>
          <div class="fw-pay-info">
            <div class="fw-pay-breakdown-title">Payment Information</div>
            ${payRows}
          </div>
        </div>
      </div>

      <!-- ═══ SECURITY FOOTER ═══ -->
      <div class="fw-security-footer">
        <div class="fw-security-row">
          <div class="fw-security-item">
            <span class="fw-security-icon">🛡</span>
            <span>Receipt ID: <span class="fw-mono">${receiptId}</span></span>
          </div>
          <div class="fw-security-item">
            <span class="fw-security-icon">🔐</span>
            <span>Fingerprint: <span class="fw-mono">${genTxFingerprint()}</span></span>
          </div>
          <div class="fw-security-item">
            <span class="fw-security-icon">📅</span>
            <span>Issued: ${fmtDateTime(now)}</span>
          </div>
        </div>
        <div class="fw-security-note">This document is an official FlyWay Airlines electronic ticket. Keep this as your proof of booking. Issued via flyway.com</div>
      </div>

    </div>`;
  }

  // ─── PREMIUM PRINT/PDF HTML ──────────────────────────────────────────────────

  function buildPrintableHTML(booking, mode) {
    mode = mode || 'ticket'; // 'ticket' | 'receipt'
    const airports = (global.FlyWay && global.FlyWay.airports) ? global.FlyWay.airports : [];
    const f   = booking.outboundFlight || {};
    const pax = booking.passengers || [];
    const st  = getStatus(booking);
    const cls = getClass(booking);
    const now = new Date();
    const fromAirport = getAirportCity(airports, f.from);
    const toAirport   = getAirportCity(airports, f.to);
    const pricingData = buildPricingBreakdown(booking);
    const paymentInfo = buildPaymentInfo(booking);
    const receiptId   = genReceiptId(booking.ref || 'FW');
    const barcodeText = buildScanPayload(booking);
    const qrData      = encodeURIComponent(barcodeText || booking.ref || 'FW');
    const isReceipt   = mode === 'receipt';

    const paxRows = pax.map((p, i) => `
      <tr>
        <td>${i+1}</td>
        <td><strong>${p.name || 'Passenger '+(i+1)}</strong></td>
        <td>${p.age || '—'}</td>
        <td>${(booking.selectedSeats||[])[i] || 'Auto'}</td>
        <td>${p.meal || 'Standard'}</td>
      </tr>`).join('');

    const priceRows = pricingData.items.map(item => {
      const isDisc = item.type === 'discount';
      return `<tr>
        <td style="color:#475569">${item.label}</td>
        <td style="text-align:right;color:${isDisc?'#059669':'#0f172a'};font-weight:${item.type==='base'?'700':'400'}">${isDisc?'−':''}${fmtMoney(Math.abs(item.amount))}</td>
      </tr>`;
    }).join('');

    const payRows = paymentInfo.fields.map(f => `
      <tr>
        <td style="color:#64748b;font-size:12px">${f.label}</td>
        <td style="font-family:${f.mono?'monospace':'inherit'};font-weight:${f.highlight?'700':'400'};color:${f.highlight?'#0044cc':'#0f172a'}">${f.value}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FlyWay ${isReceipt?'Receipt':'Ticket'} · ${booking.ref || '—'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&family=Space+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:#f1f5f9;color:#0f172a;padding:32px 16px;font-size:13px}
  .doc{max-width:${isReceipt?'560px':'780px'};margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.18)}

  /* HEADER */
  .doc-header{background:linear-gradient(135deg,#060d1f 0%,#0d2060 50%,#091535 100%);color:#fff;padding:32px 36px;position:relative;overflow:hidden}
  .doc-header::before{content:'';position:absolute;top:-60px;right:-40px;width:220px;height:220px;border:2px solid rgba(0,212,255,0.15);border-radius:50%}
  .doc-header::after{content:'';position:absolute;bottom:-80px;left:-30px;width:180px;height:180px;border:1px solid rgba(0,212,255,0.08);border-radius:50%}
  .header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  .logo-text{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;letter-spacing:3px}
  .logo-text span{color:#00d4ff}
  .logo-sub{font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:2px;margin-top:3px}
  .ref-block{text-align:right}
  .ref-val{font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#00d4ff;letter-spacing:4px}
  .ref-label{font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1.5px;margin-top:4px}

  /* ROUTE */
  .route-hero{display:flex;align-items:center;gap:16px;margin-top:8px}
  .route-end{min-width:0}
  .route-end.right{text-align:right}
  .iata{font-family:'Syne',sans-serif;font-size:52px;font-weight:800;line-height:1;color:#fff}
  .city-nm{font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px}
  .dep-time{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;margin-top:6px;color:#00d4ff}
  .route-mid{flex:1;text-align:center;padding:0 8px}
  .route-line{height:2px;background:linear-gradient(90deg,rgba(255,255,255,0.1),rgba(0,212,255,0.5),rgba(255,255,255,0.1));margin:10px 0;position:relative}
  .route-plane{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:18px}
  .route-dur{font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px}
  .route-fn{font-size:11px;color:rgba(0,212,255,0.7);margin-top:2px;font-family:'Space Mono',monospace}

  /* STATUS */
  .status-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:1px;border:1px solid;margin-top:12px}

  /* TEAR LINE */
  .tear{border:none;border-top:2px dashed #e2e8f0;margin:24px 0;position:relative}

  /* DETAILS */
  .section{padding:24px 36px}
  .section-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .detail-grid{display:grid;grid-template-columns:repeat(${isReceipt?3:4},1fr);gap:16px;margin-bottom:20px}
  .detail-item{}
  .detail-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:3px}
  .detail-val{font-size:14px;font-weight:700;color:#0f172a}

  /* PAX TABLE */
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:8px 10px;background:#f8faff;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700;border-bottom:2px solid #e2e8f0}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#334155}

  /* PRICE / PAY */
  .price-table td{font-size:13px}
  .price-total-row td{font-size:16px;font-weight:800;color:#0044cc;border-top:2px solid #e2e8f0;padding-top:12px;margin-top:4px}
  .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}

  /* FOOTER */
  .doc-footer{background:#f8faff;padding:18px 36px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
  .footer-brand{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:#0044cc;letter-spacing:2px}
  .footer-meta{font-size:11px;color:#94a3b8;text-align:right}
  .footer-id{font-family:'Space Mono',monospace;font-size:11px;color:#64748b}

  /* QR + BARCODE */
  .qr-bar-row{display:flex;align-items:center;gap:24px;padding:20px 36px;border-top:2px dashed #e2e8f0;background:#fafbff}
  .qr-img{width:88px;height:88px;border-radius:8px;border:1px solid #e2e8f0}
  .barcode-col{flex:1}
  .barcode-svg{width:100%;max-width:260px;color:#1e293b;display:block}
  .barcode-id{font-family:'Space Mono',monospace;font-size:10px;color:#94a3b8;margin-top:6px;letter-spacing:2px}

  /* DIVIDERS */
  .divider{border:none;border-top:1px solid #f1f5f9;margin:4px 0}

  /* WATERMARK */
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:'Syne',sans-serif;font-size:80px;font-weight:800;color:rgba(0,68,204,0.04);pointer-events:none;white-space:nowrap;letter-spacing:8px}

  @page{size:A4;margin:16mm}
  @media print{
    body{background:#fff;padding:0}
    .doc{box-shadow:none;border-radius:0;max-width:100%}
    .doc-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .qr-bar-row{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
<div class="doc" style="position:relative">
  <div class="watermark">FLYWAY</div>

  <!-- HEADER -->
  <div class="doc-header">
    <div class="header-top">
      <div>
        <div class="logo-text">FLY<span>WAY</span> AIRLINES</div>
        <div class="logo-sub">${isReceipt ? 'OFFICIAL PAYMENT RECEIPT' : 'ELECTRONIC BOARDING PASS'}</div>
      </div>
      <div class="ref-block">
        <div class="ref-val">${booking.ref || '—'}</div>
        <div class="ref-label">BOOKING REFERENCE</div>
      </div>
    </div>

    ${!isReceipt ? `
    <div class="route-hero">
      <div class="route-end">
        <div class="iata">${f.from || '—'}</div>
        <div class="city-nm">${fromAirport.flag||'🌍'} ${fromAirport.city||f.from||'—'}</div>
        <div class="dep-time">${f.depTime || '—'}</div>
      </div>
      <div class="route-mid">
        <div class="route-line"><span class="route-plane">✈</span></div>
        <div class="route-dur">${f.duration || '—'}</div>
        <div class="route-fn">${f.flightNumber || '—'} · ${f.aircraft || '—'}</div>
      </div>
      <div class="route-end right">
        <div class="iata">${f.to || '—'}</div>
        <div class="city-nm">${toAirport.flag||'🌍'} ${toAirport.city||f.to||'—'}</div>
        <div class="dep-time">${f.arrTime || '—'}</div>
      </div>
    </div>
    <div>
      <span class="status-badge" style="color:${st.color};background:${st.bg};border-color:${st.border}">${st.icon} ${st.label}</span>
    </div>` : `
    <div style="margin-top:8px">
      <div style="font-size:22px;font-weight:700;color:#fff">${f.from||'—'} → ${f.to||'—'}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px">${f.flightNumber||'—'} · ${fmtDate(f.departureDate)}</div>
      <span class="status-badge" style="color:${st.color};background:${st.bg};border-color:${st.border}">${st.icon} ${st.label}</span>
    </div>`}
  </div>

  <!-- FLIGHT DETAILS -->
  ${!isReceipt ? `
  <div class="section">
    <div class="section-title">✈ Flight Information</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Date</div><div class="detail-val">${fmtDate(f.departureDate)}</div></div>
      <div class="detail-item"><div class="detail-label">Class</div><div class="detail-val">${cls.label}</div></div>
      <div class="detail-item"><div class="detail-label">Aircraft</div><div class="detail-val">${f.aircraft||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Airline</div><div class="detail-val">${f.airline||'Fly Way Airlines'}</div></div>
      <div class="detail-item"><div class="detail-label">Terminal</div><div class="detail-val">${booking.terminal||'Main'}</div></div>
      <div class="detail-item"><div class="detail-label">Gate</div><div class="detail-val">${booking.gate||'TBA'}</div></div>
      <div class="detail-item"><div class="detail-label">Departure</div><div class="detail-val">${f.depTime||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Arrival</div><div class="detail-val">${f.arrTime||'—'}</div></div>
    </div>
  </div>
  <hr class="divider">` : ''}

  <!-- PASSENGER TABLE -->
  ${pax.length > 0 ? `
  <div class="section">
    <div class="section-title">👤 Passenger${pax.length>1?'s':''}</div>
    <table>
      <thead><tr><th>#</th><th>Full Name</th><th>Age</th><th>Seat</th><th>Meal</th></tr></thead>
      <tbody>${paxRows}</tbody>
    </table>
  </div>
  <hr class="divider">` : ''}

  <!-- PAYMENT -->
  <div class="section">
    <div class="section-title">${paymentInfo.icon} Payment Details</div>
    <div class="pay-grid">
      <div>
        <div class="section-title" style="font-size:11px;margin-bottom:12px">FARE BREAKDOWN</div>
        <table class="price-table">
          <tbody>${priceRows}</tbody>
          <tfoot>
            <tr class="price-total-row">
              <td>Total Charged</td>
              <td style="text-align:right">${fmtMoney(pricingData.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div>
        <div class="section-title" style="font-size:11px;margin-bottom:12px">PAYMENT INFORMATION</div>
        <table>
          <tbody>${payRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- QR + BARCODE -->
  <div class="qr-bar-row">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${qrData}&bgcolor=ffffff&color=0044cc&margin=4"
      class="qr-img" onerror="this.style.display='none'" alt="QR">
    <div class="barcode-col">
      <div class="barcode-svg" style="color:#1e293b;max-width:280px">${generateBarcodeSVG(barcodeText || buildScanPayload(booking), 0, 40)}</div>
      <div class="barcode-id">${booking.ref||'—'} · ${f.flightNumber||'—'} · Receipt: ${receiptId}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <div>
      <div class="footer-brand">FLYWAY AIRLINES</div>
      <div class="footer-id">Receipt ID: ${receiptId}</div>
    </div>
    <div class="footer-meta">
      <div>Issued: ${fmtDateTime(now)}</div>
      <div>flyway.com · Official Electronic Ticket</div>
    </div>
  </div>
</div>
</body>
</html>`;
  }

  // ─── DEDICATED PNG TICKET RENDERER ───────────────────────────────────────────
  // Draws the ticket straight from the booking record onto a <canvas>. It never reads or captures the page DOM
  // (so it cannot pick up navigation, other cards, or the rest of the page) and it deliberately leaves out
  // payment details. Layout is a landscape boarding pass whose height grows only with passengers / return leg.

  const PNG = { W: 1600, M: 40, PAD: 56, MAX_PAX: 6 };

  function pngFonts() {
    let base = '';
    try { base = getComputedStyle(document.documentElement).getPropertyValue('--font').trim(); } catch (e) {}
    const sans = (base ? base + ',' : '') + '"Plus Jakarta Sans","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
    return { sans: sans, mono: '"JetBrains Mono","SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace' };
  }

  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Shrink the font until the text fits maxW; if it still does not fit at minSize, cut with an ellipsis.
  function fitText(ctx, str, maxW, size, minSize, weight, family) {
    str = String(str == null || str === '' ? '—' : str);
    let s = size;
    ctx.font = weight + ' ' + s + 'px ' + family;
    while (s > minSize && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = weight + ' ' + s + 'px ' + family; }
    if (ctx.measureText(str).width > maxW) {
      while (str.length > 1 && ctx.measureText(str + '…').width > maxW) str = str.slice(0, -1);
      str = str.trimEnd() + '…';
    }
    return str;
  }

  function drawText(ctx, str, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.fillStyle = o.color || '#e0f0ff';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = o.spacing + 'px';
    let out = str;
    if (o.maxW) out = fitText(ctx, str, o.maxW, o.size, o.min || Math.round(o.size * 0.5), o.weight || 600, o.family);
    else ctx.font = (o.weight || 600) + ' ' + o.size + 'px ' + o.family;
    ctx.fillText(out, x, y);
    ctx.restore();
    return out;
  }

  // Simple vector aeroplane (nose pointing +x), scale s ≈ half-length in px.
  function drawPlane(ctx, cx, cy, s, color) {
    const top = [[1,0],[0.3,-0.12],[0,-0.12],[-0.35,-0.85],[-0.55,-0.85],[-0.35,-0.12],[-0.8,-0.12],[-1,-0.4],[-1.1,-0.4],[-1,0]];
    const pts = top.concat(top.slice(1, -1).reverse().map(function (p) { return [p[0], -p[1]]; }));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s); });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw the scannable Code 128 bars directly (parsed from FWBarcode's SVG) using whole-pixel module widths.
  function drawBarcode(ctx, payload, x, y, maxW, h) {
    if (typeof FWBarcode === 'undefined' || !payload) return 0;
    const svg = FWBarcode.generate(payload, { height: h + 8, moduleW: 1, quietZone: 0, color: '#000', bgColor: 'transparent', showText: false });
    const vb = /viewBox="0 0 ([\d.]+) /.exec(svg);
    if (!vb) return 0;
    const total = parseFloat(vb[1]);
    const k = Math.max(1, Math.floor(maxW / total));
    const startX = x + Math.floor((maxW - total * k) / 2);
    ctx.fillStyle = '#0a1628';
    const re = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g;
    let m;
    while ((m = re.exec(svg))) ctx.fillRect(startX + parseFloat(m[1]) * k, y, parseFloat(m[2]) * k, h);
    return total * k;
  }

  function renderTicketCanvas(booking) {
    return Promise.race([
      (document.fonts && document.fonts.ready) || Promise.resolve(),
      new Promise(function (r) { setTimeout(r, 1500); })
    ]).then(function () { return paintTicket(booking || {}); });
  }

  function paintTicket(booking) {
    const F = pngFonts();
    // FlyWay is a top-level const in main.js (not always a window property), so look it up by name too
    const FW = (typeof FlyWay !== 'undefined') ? FlyWay : global.FlyWay;
    const airports = (FW && FW.airports) ? FW.airports : [];
    const f   = booking.outboundFlight || {};
    const ret = booking.returnFlight || null;
    const pax = Array.isArray(booking.passengers) ? booking.passengers : [];
    const st  = getStatus(booking);
    const cls = getClass(booking);
    const fromA = getAirportCity(airports, f.from);
    const toA   = getAirportCity(airports, f.to);
    const isCancelled = (booking.status || '').toLowerCase() === 'cancelled';
    const shownPax = pax.slice(0, PNG.MAX_PAX);

    const W = PNG.W, M = PNG.M, P = PNG.PAD;
    const x0 = M + P, CW = W - 2 * (M + P);

    // ── layout (heights only; drawing happens after the canvas is sized)
    const H_HEADER = 168, H_ROUTE = 300, H_TEAR = 56, H_GRID = 250;
    const H_RETURN = ret ? 96 : 0;
    const H_PAX = pax.length ? (64 + shownPax.length * 56 + (pax.length > PNG.MAX_PAX ? 44 : 0) + 16) : 0;
    const H_CODE = 230;
    const H = M + H_HEADER + H_ROUTE + H_TEAR + H_GRID + H_RETURN + H_PAX + H_CODE + M;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = '#060d1f'; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, W * 0.7);
    glow.addColorStop(0, 'rgba(0,212,255,0.14)'); glow.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // card
    const cx = M, cy = M, cw = W - 2 * M, ch = H - 2 * M;
    const cardGrad = ctx.createLinearGradient(0, cy, 0, cy + ch);
    cardGrad.addColorStop(0, '#0c1c3e'); cardGrad.addColorStop(1, '#081226');
    rrPath(ctx, cx, cy, cw, ch, 40); ctx.fillStyle = cardGrad; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,212,255,0.35)'; ctx.stroke();

    let y = cy;

    // ── header
    const logoSize = 72, hy = y + (H_HEADER - logoSize) / 2;
    const lg = ctx.createLinearGradient(x0, hy, x0 + logoSize, hy + logoSize);
    lg.addColorStop(0, '#00d4ff'); lg.addColorStop(1, '#7c3aed');
    rrPath(ctx, x0, hy, logoSize, logoSize, 20); ctx.fillStyle = lg; ctx.fill();
    drawPlane(ctx, x0 + logoSize / 2, hy + logoSize / 2, 22, '#06101f');
    const tx = x0 + logoSize + 22;
    ctx.font = '800 38px ' + F.sans;
    const flyW = ctx.measureText('FLY').width, wayW = ctx.measureText('WAY').width;
    drawText(ctx, 'FLY', tx, hy + 36, { size: 38, weight: 800, family: F.sans, color: '#ffffff', spacing: 2 });
    drawText(ctx, 'WAY', tx + flyW + 2, hy + 36, { size: 38, weight: 800, family: F.sans, color: '#00d4ff', spacing: 2 });
    drawText(ctx, 'AIRLINES', tx + flyW + wayW + 22, hy + 36, { size: 22, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.7)', spacing: 3 });
    drawText(ctx, 'Premium Aviation Experience', tx, hy + 66, { size: 20, weight: 500, family: F.sans, color: 'rgba(224,240,255,0.55)' });

    // status pill + booking reference (right side)
    const right = x0 + CW;
    const pillText = (st.icon + '  ' + st.label);
    ctx.font = '800 20px ' + F.sans;
    const pillW = Math.min(CW * 0.42, ctx.measureText(pillText).width + 48);
    const pillX = right - pillW, pillY = y + 30;
    rrPath(ctx, pillX, pillY, pillW, 40, 20);
    ctx.fillStyle = st.bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = st.border; ctx.stroke();
    drawText(ctx, pillText, pillX + pillW / 2, pillY + 27, { size: 20, weight: 800, family: F.sans, color: st.color, align: 'center', maxW: pillW - 28, min: 12 });
    drawText(ctx, 'BOOKING REFERENCE', right, y + 104, { size: 15, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', align: 'right', spacing: 2 });
    drawText(ctx, booking.ref || '—', right, y + 146, { size: 42, weight: 800, family: F.mono, color: '#e8f7ff', align: 'right', maxW: CW * 0.45, min: 22, spacing: 3 });
    y += H_HEADER;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, y - 2, CW, 2);

    // ── route
    const EP_W = 440;
    const rt = y;
    drawText(ctx, f.from || '—', x0, rt + 150, { size: 140, weight: 800, family: F.sans, color: '#ffffff', maxW: EP_W, min: 70 });
    drawText(ctx, fromA.city || f.from || '—', x0, rt + 196, { size: 34, weight: 600, family: F.sans, color: 'rgba(224,240,255,0.88)', maxW: EP_W, min: 20 });
    drawText(ctx, f.depTime || '—', x0, rt + 252, { size: 56, weight: 800, family: F.sans, color: '#00d4ff', maxW: EP_W, min: 28 });
    drawText(ctx, 'DEPARTURE', x0 + 0, rt + 282, { size: 16, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', spacing: 3 });

    drawText(ctx, f.to || '—', right, rt + 150, { size: 140, weight: 800, family: F.sans, color: '#ffffff', align: 'right', maxW: EP_W, min: 70 });
    drawText(ctx, toA.city || f.to || '—', right, rt + 196, { size: 34, weight: 600, family: F.sans, color: 'rgba(224,240,255,0.88)', align: 'right', maxW: EP_W, min: 20 });
    drawText(ctx, f.arrTime || '—', right, rt + 252, { size: 56, weight: 800, family: F.sans, color: '#00d4ff', align: 'right', maxW: EP_W, min: 28 });
    drawText(ctx, 'ARRIVAL', right, rt + 282, { size: 16, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', align: 'right', spacing: 3 });

    const pl = x0 + EP_W + 36, pr = right - EP_W - 36, pm = (pl + pr) / 2, pw = pr - pl, lineY = rt + 130;
    drawText(ctx, f.flightNumber || '—', pm, rt + 84, { size: 32, weight: 800, family: F.mono, color: '#ffffff', align: 'center', maxW: pw, min: 18 });
    drawText(ctx, f.aircraft || '', pm, rt + 108, { size: 18, weight: 500, family: F.sans, color: 'rgba(224,240,255,0.55)', align: 'center', maxW: pw, min: 12 });
    ctx.save();
    ctx.strokeStyle = 'rgba(0,212,255,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pl + 14, lineY); ctx.lineTo(pr - 14, lineY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath(); ctx.arc(pl + 6, lineY, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pr - 6, lineY, 7, 0, Math.PI * 2); ctx.fill();
    drawPlane(ctx, pm, lineY, 22, '#00d4ff');
    drawText(ctx, f.duration || '—', pm, rt + 176, { size: 26, weight: 700, family: F.sans, color: '#e0f0ff', align: 'center', maxW: pw, min: 16 });
    drawText(ctx, f.type || 'Non-stop', pm, rt + 204, { size: 19, weight: 600, family: F.sans, color: 'rgba(224,240,255,0.55)', align: 'center', maxW: pw, min: 12 });
    y += H_ROUTE;

    // ── tear line with notches
    const ty = y + H_TEAR / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(cx + 36, ty); ctx.lineTo(cx + cw - 36, ty); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#060d1f';
    ctx.beginPath(); ctx.arc(cx, ty, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + cw, ty, 26, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.beginPath(); ctx.arc(cx, ty, 26, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + cw, ty, 26, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    y += H_TEAR;

    // ── details grid (same fields as the on-screen ticket)
    const cells = [
      ['DATE', fmtDate(f.departureDate), '#ffffff'],
      ['CLASS', cls.label, cls.color],
      ['PASSENGERS', (pax.length || 1) + (((pax.length || 1) === 1) ? ' passenger' : ' passengers'), '#ffffff'],
      ['AIRLINE', f.airline || 'Fly Way Airlines', '#ffffff'],
      ['TERMINAL', booking.terminal || 'Main Terminal', '#ffffff'],
      ['GATE', booking.gate || 'TBA', '#ffffff'],
      ['DISTANCE', f.distance || '—', '#ffffff'],
      ['TRIP TYPE', ret ? 'Round-Trip' : 'One-Way', '#ffffff']
    ];
    const colW = CW / 4;
    cells.forEach(function (c, i) {
      const col = i % 4, row = Math.floor(i / 4);
      const gx = x0 + col * colW, gy = y + 20 + row * 110;
      drawText(ctx, c[0], gx, gy + 24, { size: 15, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', spacing: 2.5 });
      drawText(ctx, c[1], gx, gy + 68, { size: 31, weight: 700, family: F.sans, color: c[2], maxW: colW - 24, min: 16 });
    });
    y += H_GRID;

    // ── return leg (round trips)
    if (ret) {
      rrPath(ctx, x0, y + 8, CW, 72, 18);
      ctx.fillStyle = 'rgba(0,212,255,0.07)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,212,255,0.22)'; ctx.stroke();
      drawText(ctx, 'RETURN', x0 + 28, y + 52, { size: 16, weight: 800, family: F.sans, color: '#00d4ff', spacing: 3 });
      const route = (ret.from || '—') + '  →  ' + (ret.to || '—');
      const used = drawText(ctx, route, x0 + 150, y + 56, { size: 32, weight: 800, family: F.sans, color: '#ffffff', maxW: 380, min: 18 });
      ctx.font = '800 32px ' + F.sans;
      const rx = x0 + 150 + Math.min(380, ctx.measureText(used).width) + 36;
      const bits = [ret.flightNumber, ret.departureDate ? fmtDate(ret.departureDate) : '', (ret.depTime || ret.arrTime) ? ((ret.depTime || '—') + ' → ' + (ret.arrTime || '—')) : ''].filter(Boolean).join('  ·  ');
      drawText(ctx, bits, rx, y + 54, { size: 26, weight: 600, family: F.sans, color: 'rgba(224,240,255,0.85)', maxW: x0 + CW - 28 - rx, min: 14 });
      y += H_RETURN;
    }

    // ── passengers
    if (pax.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, y, CW, 2);
      drawText(ctx, 'PASSENGERS', x0, y + 42, { size: 15, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', spacing: 2.5 });
      drawText(ctx, pax.length + (pax.length === 1 ? ' traveller' : ' travellers'), right, y + 42, { size: 15, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', align: 'right', spacing: 1.5 });
      shownPax.forEach(function (p, i) {
        const ry = y + 64 + i * 56 + 28;
        const name = (p && p.name) ? String(p.name).trim() : ('Passenger ' + (i + 1));
        ctx.beginPath(); ctx.arc(x0 + 20, ry, 20, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,212,255,0.14)'; ctx.fill();
        drawText(ctx, (name.charAt(0) || 'P').toUpperCase(), x0 + 20, ry + 8, { size: 22, weight: 800, family: F.sans, color: '#00d4ff', align: 'center' });
        const age = p && p.age;
        const tag = (age === undefined || age === null || age === '') ? '' : (age < 2 ? 'Infant' : age < 12 ? 'Child' : age >= 60 ? 'Senior' : 'Adult');
        const seat = (booking.selectedSeats || [])[i] || 'Auto-assigned';
        drawText(ctx, name, x0 + 56, ry + 10, { size: 30, weight: 700, family: F.sans, color: '#ffffff', maxW: CW * 0.52, min: 16 });
        drawText(ctx, tag ? (tag + (age !== undefined && age !== '' ? ' · ' + age : '')) : '', x0 + CW * 0.62, ry + 8, { size: 22, weight: 500, family: F.sans, color: 'rgba(224,240,255,0.6)', maxW: CW * 0.14, min: 12 });
        drawText(ctx, 'SEAT', right - 150, ry + 6, { size: 14, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.45)', align: 'right', spacing: 2 });
        drawText(ctx, seat, right, ry + 9, { size: 28, weight: 800, family: F.mono, color: '#00d4ff', align: 'right', maxW: 140, min: 14 });
      });
      if (pax.length > PNG.MAX_PAX) {
        drawText(ctx, '+ ' + (pax.length - PNG.MAX_PAX) + ' more passenger' + (pax.length - PNG.MAX_PAX > 1 ? 's' : '') + ' on this booking', x0, y + 64 + shownPax.length * 56 + 30, { size: 22, weight: 600, family: F.sans, color: 'rgba(224,240,255,0.6)' });
      }
      y += H_PAX;
    }

    // ── barcode + issue info
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, y, CW, 2);
    const bw = Math.round(CW * 0.62), bh = 150, by = y + 28;
    rrPath(ctx, x0, by, bw, bh, 18); ctx.fillStyle = '#ffffff'; ctx.fill();
    const payload = (typeof FWBarcode !== 'undefined') ? FWBarcode.buildPayload(booking) : buildScanPayload(booking);
    const drawn = drawBarcode(ctx, payload, x0 + 28, by + 22, bw - 56, bh - 56);
    if (!drawn) drawText(ctx, booking.ref || '—', x0 + bw / 2, by + bh / 2 + 10, { size: 40, weight: 800, family: F.mono, color: '#0a1628', align: 'center', maxW: bw - 56, min: 20 });
    drawText(ctx, payload || booking.ref || '', x0 + bw / 2, by + bh - 14, { size: 17, weight: 600, family: F.mono, color: '#44546a', align: 'center', maxW: bw - 56, min: 10, spacing: 1 });
    drawText(ctx, 'ELECTRONIC TICKET', right, by + 30, { size: 15, weight: 700, family: F.sans, color: 'rgba(224,240,255,0.5)', align: 'right', spacing: 2.5 });
    drawText(ctx, (booking.ref || '—') + '  ·  ' + (f.flightNumber || '—'), right, by + 76, { size: 28, weight: 700, family: F.mono, color: '#e0f0ff', align: 'right', maxW: CW - bw - 40, min: 14 });
    drawText(ctx, 'Issued ' + fmtDateTime(new Date()), right, by + 112, { size: 19, weight: 500, family: F.sans, color: 'rgba(224,240,255,0.55)', align: 'right', maxW: CW - bw - 40, min: 11 });

    // cancelled tickets must not look valid
    if (isCancelled) {
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(-0.22);
      ctx.font = '900 190px ' + F.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,87,87,0.22)'; ctx.fillText('CANCELLED', 0, 0);
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,87,87,0.28)'; ctx.strokeText('CANCELLED', 0, 0);
      ctx.restore();
    }
    return canvas;
  }

  function triggerDownload(canvas, filename) {
    return new Promise(function (resolve, reject) {
      function save(url, revoke) {
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve();
      }
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (!blob) { try { save(canvas.toDataURL('image/png'), false); } catch (e) { reject(e); } return; }
          save(URL.createObjectURL(blob), true);
        }, 'image/png');
      } else {
        try { save(canvas.toDataURL('image/png'), false); } catch (e) { reject(e); }
      }
    });
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  const TicketSystem = {
    renderTicketCanvas,
    buildWebTicketHTML,
    buildPrintableHTML,
    buildPricingBreakdown,
    buildPaymentInfo,
    fmtMoney,
    fmtDate,
    fmtDateTime,
    getStatus,
    getClass,
    getPayment,

    // Open printable window
    openPrint: function(booking, mode) {
      const html = buildPrintableHTML(booking, mode);
      const win  = window.open('', '_blank');
      if (!win) {
        const blob = new Blob([html], {type:'text/html'});
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = 'FlyWay-' + (mode==='receipt'?'Receipt':'Ticket') + '-' + (booking.ref||'FW') + '.html';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
      win.document.write(html);
      win.document.close();
      win.document.title = 'FlyWay ' + (mode==='receipt'?'Receipt':'Ticket') + ' · ' + (booking.ref||'—');
      setTimeout(() => {
        win.print();
        setTimeout(() => { try { URL.revokeObjectURL && URL.revokeObjectURL(''); } catch(e){} }, 2000);
      }, 600);
      if (global.FlyWay && global.FlyWay.toast) {
        global.FlyWay.toast('success', mode==='receipt'?'Receipt ready':'Ticket ready', 'Use "Save as PDF" in the print dialog');
      }
    },

    // Save the ticket as a PNG. Accepts downloadPNG(booking) or the legacy downloadPNG(elementId, booking);
    // the element is ignored — the image is rendered from the booking record, never from the page.
    downloadPNG: function(a, b) {
      const booking = (a && typeof a === 'object') ? a : b;
      const toast = function(type, title, msg) { if (global.FlyWay && global.FlyWay.toast) global.FlyWay.toast(type, title, msg); };
      if (!booking) { toast('error', 'Not ready', 'Complete booking first'); return Promise.resolve(false); }
      toast('info', 'Preparing image…', 'Just a moment');
      const ref = String(booking.ref || 'FW-Ticket').replace(/[^A-Za-z0-9_-]/g, '');
      return renderTicketCanvas(booking)
        .then(function(canvas) { return triggerDownload(canvas, 'FlyWay-Ticket-' + ref + '.png'); })
        .then(function() { toast('success', 'Image saved!', 'FlyWay-Ticket-' + ref + '.png'); return true; })
        .catch(function() { toast('error', 'Could not create the image', 'Please try again or use Ticket PDF'); return false; });
    },
  };

  global.FWTicket = TicketSystem;

})(window);
