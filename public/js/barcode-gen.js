/**
 * FlyWay Code128 Barcode Generator v1.0
 * ──────────────────────────────────────
 * Generates fully scannable Code 128B barcodes as SVG.
 * Readable by: mobile scanners, POS devices, barcode apps, after PDF/print export.
 * Format: Code 128B (full ASCII printable chars)
 */

(function(global) {
  'use strict';

  // ─── CODE 128B CHARACTER TABLE ────────────────────────────────────────────
  // Each entry: [bar1, space1, bar2, space2, bar3, space3] widths (1–4 units)
  // Standard Code 128B encoding table (patterns as bit strings, 11 modules each)

  const C128_PATTERNS = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100',
    '11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000',
    '10001000110','10110001000','10001101000','10001100010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110',
    '10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000',
    '11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100',
    '10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010',
    '11000010010','11001010000','11110111010','11000010100','10001111010',
    '10100111100','10010111100','10010011110','10111100100','10011110100',
    '10011110010','11110100100','11110010100','11110010010','11011011110',
    '11011110110','11110110110','10101111000','10100011110','10001011110',
    '10111101000','10111100010','11110101000','11110100010','10111011110',
    '10111101110','11101011110','11110101110','11010000100','11010010000',
    '11010011100','11000111010',
  ];

  const C128_START_B  = 104;
  const C128_STOP     = 106;
  const C128_STOP_PAT = '1100011101011';

  function _charVal(ch) {
    const code = ch.charCodeAt(0);
    // Code 128B: space(32) = val 0, '!'(33)=1, ... '~'(126)=94
    if (code >= 32 && code <= 126) return code - 32;
    return -1; // unsupported char
  }

  function _encodeData(text) {
    // Sanitize: keep only printable ASCII, uppercase
    const clean = String(text).toUpperCase().replace(/[^\x20-\x7E]/g, '').slice(0, 48);

    const vals = [C128_START_B];
    let checksum = C128_START_B;

    for (let i = 0; i < clean.length; i++) {
      const v = _charVal(clean[i]);
      if (v < 0) continue;
      vals.push(v);
      checksum += (i + 1) * v;
    }

    checksum = checksum % 103;
    vals.push(checksum);
    // Stop pattern is handled separately

    return { vals, clean };
  }

  /**
   * Generate a Code 128B barcode as SVG string.
   * @param {string} text  - Data to encode (booking ref, etc.)
   * @param {object} opts  - { width, height, color, bgColor, quietZone, fontSize }
   * @returns {string}     - SVG markup string
   */
  function generateCode128SVG(text, opts) {
    opts = opts || {};
    const height    = opts.height    || 56;
    const color     = opts.color     || 'currentColor';
    const bgColor   = opts.bgColor   || 'transparent';
    const quietZone = opts.quietZone !== undefined ? opts.quietZone : 10;
    const moduleW   = opts.moduleW   || 2;  // pixels per module unit
    const showText  = opts.showText  !== false;
    const fontSize  = opts.fontSize  || 9;
    const textH     = showText ? fontSize + 6 : 0;

    const { vals, clean } = _encodeData(text);

    // Build bar/space sequence
    let modules = '';

    for (let i = 0; i < vals.length; i++) {
      const pat = C128_PATTERNS[vals[i]];
      if (!pat) continue;
      modules += pat;
    }
    // Add stop bar
    modules += C128_STOP_PAT;

    // Convert module string to rects
    const bars = [];
    let x = quietZone;
    const barH = height - textH - 4;

    for (let i = 0; i < modules.length; i++) {
      if (modules[i] === '1') {
        // Count consecutive 1s for bar width
        let w = 0;
        while (i + w < modules.length && modules[i + w] === '1') w++;
        bars.push({ x: x, w: w * moduleW });
        x += w * moduleW;
        i += w - 1;
      } else {
        x += moduleW;
      }
    }

    const totalW = x + quietZone;
    const svgW   = opts.width || totalW;

    let svgBars = bars.map(b =>
      '<rect x="' + b.x + '" y="4" width="' + b.w + '" height="' + barH + '" fill="' + color + '"/>'
    ).join('');

    let svgText = '';
    if (showText && clean) {
      svgText = '<text x="' + (svgW / 2) + '" y="' + (height - 2) + '" ' +
        'text-anchor="middle" font-family="monospace" font-size="' + fontSize + '" ' +
        'fill="' + color + '" opacity="0.55" letter-spacing="1.5">' + clean + '</text>';
    }

    let bgRect = '';
    if (bgColor !== 'transparent') {
      bgRect = '<rect width="' + svgW + '" height="' + height + '" fill="' + bgColor + '"/>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'viewBox="0 0 ' + totalW + ' ' + height + '" ' +
      'width="' + svgW + '" height="' + height + '" ' +
      'role="img" aria-label="Barcode: ' + clean + '">' +
      bgRect + svgBars + svgText +
      '</svg>';
  }

  /**
   * Build a verification payload string for a booking.
   * This is what gets encoded into both barcode and QR.
   */
  function buildBarcodePayload(booking) {
    const f   = booking.outboundFlight || {};
    const ref = (booking.ref || 'FW000000').replace(/[^A-Z0-9]/g, '');
    const fn  = (f.flightNumber || '').replace(/[^A-Z0-9]/g, '');
    const from = (f.from || '').toUpperCase().slice(0, 3);
    const to   = (f.to   || '').toUpperCase().slice(0, 3);
    const uid  = (booking.userId || '').replace(/[^A-Z0-9]/g, '').slice(0, 8).toUpperCase();
    // Format: FW·REF·FN·FROM·TO·UID  (max ~40 chars for clean scan)
    const parts = [ref];
    if (fn)   parts.push(fn);
    if (from) parts.push(from);
    if (to)   parts.push(to);
    if (uid)  parts.push(uid);
    return parts.join('-');
  }

  /**
   * Build a receipt/transaction payload string.
   */
  function buildReceiptPayload(booking, receiptId) {
    const ref = (booking.ref || 'FW000000').replace(/[^A-Z0-9]/g, '');
    const rid = (receiptId || '').replace(/[^A-Z0-9\-]/g, '').slice(0, 16);
    return ref + (rid ? '-' + rid : '');
  }

  /**
   * Render a barcode into a DOM element.
   * @param {string|HTMLElement} target - selector or element
   * @param {string} data              - text to encode
   * @param {object} opts              - same as generateCode128SVG
   */
  function renderBarcode(target, data, opts) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.innerHTML = generateCode128SVG(data, opts);
    el.className = (el.className || '') + ' fw-barcode-svg-wrap';
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  global.FWBarcode = {
    generate:    generateCode128SVG,
    buildPayload: buildBarcodePayload,
    buildReceiptPayload: buildReceiptPayload,
    render:      renderBarcode,
  };

})(window);
