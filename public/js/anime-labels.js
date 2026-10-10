/* ── FlyWay Anime.js Label Hover Effect – FULL EDITION ───────────────────────
   Three element categories:
   1. .fw-hero-word    → Hero h1 words (Fly / Anywhere, / Anytime.)
                         Continuous random-mode cycling + wild hover explosion
   2. .fw-section-phrase → Section gradient headings (Perfect Travel, etc.)
                           Same continuous cycling + explosion, unique palettes
   3. .fw-anime-label (not above classes) → Standard labels (Hot Routes badge…)
                           Idle float + explode on hover
   Exposes window.FWAnime.reattach(el) for elements whose text is set dynamically.
   Requires: anime.js 3.x loaded before this file.
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Colour palettes ─────────────────────────────────────────────────────── */
  var PALETTES = {
    /* Hero words */
    heroWordFly:      ['#00d4ff', '#38bdf8', '#7c3aed', '#e879f9', '#00e396'],
    heroWordAnywhere: ['#f5c842', '#fb923c', '#ff6b6b', '#e879f9', '#fbbf24'],
    heroWordAnytime:  ['#00e396', '#34d399', '#00d4ff', '#7c3aed', '#6ee7b7'],
    /* Section phrases */
    phraseTravel:    ['#7c3aed', '#a78bfa', '#00d4ff', '#e879f9', '#818cf8'],
    phraseHappening: ['#00e396', '#34d399', '#f5c842', '#fb923c', '#10b981'],
    phraseSaying:    ['#f5c842', '#fbbf24', '#fb923c', '#ff6b6b', '#fcd34d'],
    phraseLive:      ['#00d4ff', '#38bdf8', '#00e396', '#6366f1', '#22d3ee'],
    greetName:       ['#00d4ff', '#7c3aed', '#e879f9', '#00e396', '#f5c842'],
    /* Fallback */
    default:         ['#00d4ff', '#7c3aed', '#f5c842', '#00e396', '#e879f9'],
    /* Plain labels */
    label:           ['#00d4ff', '#7c3aed', '#f5c842', '#ff6b6b', '#00e396', '#fb923c', '#e879f9', '#38bdf8'],
  };

  function getPalette(el) {
    return PALETTES[el.id] || PALETTES.default;
  }

  /* Merge any palettes registered by page code before this script loaded
     (e.g. award cards in track.html use window._FWAnimePendingPalettes) */
  function mergePendingPalettes() {
    if (window._FWAnimePendingPalettes) {
      Object.assign(PALETTES, window._FWAnimePendingPalettes);
      delete window._FWAnimePendingPalettes;
    }
  }

  /* ── Utility: split element text into per-char spans ──────────────────── */
  function splitLetters(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    el.dataset.original  = el.innerHTML;
    var chars = Array.from(el.textContent);
    el.innerHTML = chars.map(function (ch) {
      if (ch === ' ') return '<span class="fw-char" style="display:inline-block;white-space:pre"> </span>';
      return '<span class="fw-char" style="display:inline-block;position:relative;will-change:transform">' + ch + '</span>';
    }).join('');
  }

  function killChars(el) {
    if (window.anime) anime.remove(el.querySelectorAll('.fw-char'));
  }

  /* ════════════════════════════════════════════════════════════════════════
     IDLE ANIMATION MODES  (shared by hero words & section phrases)
  ════════════════════════════════════════════════════════════════════════ */

  function modeWave(chars, palette) {
    return anime({
      targets: chars,
      translateY: function (_, i) { return [0, -10 - (i * 3 % 8)]; },
      color: function (_, i) { return palette[i % palette.length]; },
      duration: 900, delay: anime.stagger(80, { from: 'center' }),
      direction: 'alternate', loop: true, easing: 'easeInOutSine',
    });
  }

  function modeGlitch(chars, palette) {
    var tl = anime.timeline({ loop: true, easing: 'steps(1)' });
    tl.add({ targets: chars, translateX: function () { return (Math.random() - 0.5) * 14; }, translateY: function () { return (Math.random() - 0.5) * 8; }, color: function (_, i) { return palette[i % palette.length]; }, duration: 80, delay: anime.stagger(12) })
      .add({ targets: chars, translateX: 0, translateY: 0, color: '', duration: 60 })
      .add({ targets: chars, translateX: function () { return (Math.random() - 0.5) * 20; }, color: function (_, i) { return palette[(i + 2) % palette.length]; }, duration: 90 })
      .add({ targets: chars, translateX: 0, translateY: 0, color: '', duration: 400, easing: 'easeOutQuad' });
    return tl;
  }

  function modeBounce(chars, palette) {
    return anime({
      targets: chars,
      scaleY: [1, 1.35, 0.85, 1], scaleX: [1, 0.85, 1.12, 1],
      color: function (_, i) { return palette[i % palette.length]; },
      duration: 700, delay: anime.stagger(55, { start: 0 }),
      loop: true, easing: 'easeInOutBack',
    });
  }

  function modeOrbit(chars, palette) {
    return anime({
      targets: chars,
      rotate: function (_, i) { return (i % 2 === 0 ? 1 : -1) * (8 + (i % 4) * 5); },
      translateX: function (_, i) { return Math.sin(i * 1.2) * 12; },
      color: function (_, i) { return palette[i % palette.length]; },
      duration: 1100, delay: anime.stagger(70, { from: 'last' }),
      direction: 'alternate', loop: true, easing: 'easeInOutQuart',
    });
  }

  function modeFlicker(chars, palette) {
    var tl = anime.timeline({ loop: true });
    var steps = [
      { opacity: [1, 0.15], dur: 60 },
      { opacity: [0.15, 1], dur: 40 },
      { opacity: [1, 0.5],  dur: 55 },
      { opacity: [0.5, 1],  dur: 35 },
      { opacity: 1,          dur: 600 },
    ];
    steps.forEach(function (s, si) {
      tl.add({
        targets: chars,
        opacity: s.opacity || 1,
        color: function (_, i) { return (si % 2 === 0) ? palette[i % palette.length] : ''; },
        duration: s.dur, delay: si === 0 ? anime.stagger(20) : 0, easing: 'linear',
      });
    });
    return tl;
  }

  function modeFan(chars, palette) {
    return anime({
      targets: chars,
      translateX: function (_, i) { return (i - (chars.length / 2)) * 3; },
      translateY: function (_, i) { return -Math.abs(i - chars.length / 2) * 4; },
      rotate:     function (_, i) { return (i - chars.length / 2) * 4; },
      color: function (_, i) { return palette[i % palette.length]; },
      duration: 1000, delay: anime.stagger(50, { from: 'center' }),
      direction: 'alternate', loop: true, easing: 'easeInOutCubic',
    });
  }

  function modeShake(chars, palette) {
    var tl = anime.timeline({ loop: true });
    for (var k = 0; k < 3; k++) {
      tl.add({ targets: chars, translateX: function () { return (Math.random() - 0.5) * 10; }, translateY: function () { return (Math.random() - 0.5) * 6; }, color: function (_, i) { return palette[i % palette.length]; }, duration: 60, easing: 'linear', delay: anime.stagger(8) });
    }
    tl.add({ targets: chars, translateX: 0, translateY: 0, color: '', duration: 700, easing: 'easeOutElastic(1,.6)' });
    tl.add({ targets: chars, duration: 900 });
    return tl;
  }

  function modeRainbow(chars) {
    var rainbow = ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#0099ff', '#6600ff', '#ff00ff'];
    return anime({
      targets: chars,
      color: function (_, i) { return rainbow[i % rainbow.length]; },
      translateY: function (_, i) { return [0, -6, 0]; },
      duration: 800, delay: anime.stagger(60, { from: 'first' }),
      loop: true, easing: 'easeInOutSine',
    });
  }

  function modeMagnet(chars, palette) {
    return anime({
      targets: chars,
      translateX: function (_, i) { return Math.cos(i * 0.9) * 8; },
      translateY: function (_, i) { return Math.sin(i * 1.1) * 8; },
      rotate: function (_, i) { return Math.sin(i) * 15; },
      color: function (_, i) { return palette[i % palette.length]; },
      duration: 1400, delay: anime.stagger(45, { from: 'center' }),
      direction: 'alternate', loop: true, easing: 'easeInOutQuad',
    });
  }

  var MODES = [modeWave, modeGlitch, modeBounce, modeOrbit, modeFlicker, modeFan, modeShake, modeRainbow, modeMagnet];

  /* ── Advance to next idle mode ────────────────────────────────────────── */
  function nextMode(el, palette, modeIdx) {
    if (el._hovered) return;
    killChars(el);
    var chars = Array.from(el.querySelectorAll('.fw-char'));
    if (!chars.length) return;

    var fn = MODES[modeIdx % MODES.length];
    el._idleAnim = fn(chars, palette);
    el._modeTimer = setTimeout(function () {
      if (el._idleAnim && el._idleAnim.pause) el._idleAnim.pause();
      anime({
        targets: chars,
        translateX: 0, translateY: 0, rotate: 0, scale: 1, opacity: 1, color: '',
        duration: 300, easing: 'easeOutQuad',
        complete: function () { nextMode(el, palette, modeIdx + 1); },
      });
    }, 3800 + Math.random() * 1200);
  }

  /* ── Wild hover explosion (4-stage) ─────────────────────────────────── */
  function heroExplode(el, palette) {
    killChars(el);
    var chars = Array.from(el.querySelectorAll('.fw-char'));
    if (!chars.length) return;

    var tl = anime.timeline({ easing: 'easeOutExpo' });
    tl.add({
      targets: chars,
      translateX: function (_, i) { return (Math.random() - 0.5) * 280 * (1 + i * 0.15); },
      translateY: function (_, i) { return (Math.random() - 0.5) * 160 * (1 + i * 0.1); },
      rotate:  function () { return (Math.random() - 0.5) * 900; },
      scale:   function () { return 0.05 + Math.random() * 3.5; },
      color:   function (_, i) { return palette[i % palette.length]; },
      opacity: [1, 0.7],
      duration: 500, delay: anime.stagger(35, { from: 'center' }),
    }).add({
      targets: chars,
      rotate:  function () { return (Math.random() - 0.5) * 360; },
      color:   function (_, i) { return palette[(i + 3) % palette.length]; },
      scale:   function () { return 0.5 + Math.random() * 2; },
      duration: 350, delay: anime.stagger(25, { from: 'random' }),
      easing: 'easeInOutSine',
    }).add({
      targets: chars,
      opacity: [0.7, 0.1, 0.9, 0.2, 1],
      color:   function (_, i) { return palette[(i + 1) % palette.length]; },
      duration: 250, easing: 'steps(5)',
    }).add({
      targets: chars,
      translateX: 0, translateY: 0, rotate: 0, scale: 1, color: '', opacity: 1,
      duration: 900, delay: anime.stagger(22, { from: 'center' }),
      easing: 'spring(1, 80, 12, 0)',
    });
    return tl;
  }

  /* ── Core attach logic (shared by hero words & section phrases) ──────── */
  function attachAnimated(el, palette, startModeOffset) {
    el.dataset.animeAttached = '1';
    el.style.display = 'inline-block';
    el.style.cursor  = 'pointer';

    splitLetters(el);

    var startDelay = 400 + Math.random() * 800;
    setTimeout(function () {
      nextMode(el, palette, (startModeOffset || 0) + Math.floor(Math.random() * MODES.length));
    }, startDelay);

    el.addEventListener('mouseenter', function () {
      el._hovered = true;
      clearTimeout(el._modeTimer);
      if (el._idleAnim && el._idleAnim.pause) el._idleAnim.pause();
      heroExplode(el, palette);
    });

    el.addEventListener('mouseleave', function () {
      el._hovered = false;
      killChars(el);
      var chars = Array.from(el.querySelectorAll('.fw-char'));
      anime({
        targets: chars,
        translateX: 0, translateY: 0, rotate: 0, scale: 1, opacity: 1, color: '',
        duration: 700, delay: anime.stagger(20, { from: 'center' }),
        easing: 'spring(1, 80, 14, 0)',
        complete: function () {
          nextMode(el, palette, Math.floor(Math.random() * MODES.length));
        },
      });
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     ATTACH FUNCTIONS PER CATEGORY
  ════════════════════════════════════════════════════════════════════════ */

  function attachHeroWord(el) {
    if (el.dataset.animeAttached) return;
    attachAnimated(el, getPalette(el), 0);
  }

  function attachSectionPhrase(el) {
    if (el.dataset.animeAttached) return;
    attachAnimated(el, getPalette(el), 3); /* offset so modes differ from hero */
  }

  /* Plain labels – idle float + simple explode */
  var LABEL_COLORS = PALETTES.label;

  function labelExplode(el) {
    splitLetters(el);
    var chars = el.querySelectorAll('.fw-char');
    if (!chars.length) return;
    if (window.anime) anime.remove(chars);
    anime({
      targets: chars,
      translateX: function (_, i) { return (Math.random() - 0.5) * 200 * (i % 2 === 0 ? 1.4 : 0.8); },
      translateY: function (_, i) { return (Math.random() - 0.5) * 120 + (i % 3 === 0 ? -60 : 30); },
      rotate:  function () { return (Math.random() - 0.5) * 720; },
      scale:   function () { return 0.1 + Math.random() * 2.2; },
      color:   function (_, i) { return LABEL_COLORS[i % LABEL_COLORS.length]; },
      opacity: [1, 0.85],
      duration: 600, delay: anime.stagger(28, { from: 'center' }),
      easing: 'easeOutExpo',
    });
  }

  function labelReassemble(el) {
    var chars = el.querySelectorAll('.fw-char');
    if (!chars.length) return;
    if (window.anime) anime.remove(chars);
    anime({
      targets: chars,
      translateX: 0, translateY: 0, rotate: 0, scale: 1, color: '', opacity: 1,
      duration: 900, delay: anime.stagger(18, { from: 'center' }),
      easing: 'spring(1, 90, 14, 0)',
    });
  }

  function labelIdlePulse(el) {
    if (el._idleAnim) el._idleAnim.pause();
    splitLetters(el);
    var chars = el.querySelectorAll('.fw-char');
    if (!chars.length) return;
    el._idleAnim = anime({
      targets: chars,
      translateY: function (_, i) { return [0, -3 - (i % 3)]; },
      duration: 1200, delay: anime.stagger(60, { start: 0 }),
      direction: 'alternate', loop: true, easing: 'easeInOutSine',
    });
  }

  function attachLabel(el) {
    if (el.dataset.animeAttached) return;
    el.dataset.animeAttached = '1';
    el.style.display = 'inline-block';
    el.style.cursor  = 'pointer';
    setTimeout(function () { labelIdlePulse(el); }, 600 + Math.random() * 400);
    el.addEventListener('mouseenter', function () {
      if (el._idleAnim) { el._idleAnim.pause(); anime.remove(el.querySelectorAll('.fw-char')); }
      labelExplode(el);
    });
    el.addEventListener('mouseleave', function () {
      labelReassemble(el);
      setTimeout(function () { labelIdlePulse(el); }, 1000);
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     PUBLIC API – for elements whose text is set dynamically (e.g. greetName)
  ════════════════════════════════════════════════════════════════════════ */
  window.FWAnime = {
    /**
     * Call after setting element.textContent dynamically.
     * Resets all anime state and re-attaches from scratch.
     */
    reattach: function (el) {
      if (!el) return;
      /* Stop any running animations */
      clearTimeout(el._modeTimer);
      if (el._idleAnim && el._idleAnim.pause) el._idleAnim.pause();
      /* Reset split/attach flags so attachAnimated runs fresh */
      delete el.dataset.splitDone;
      delete el.dataset.animeAttached;
      el._hovered = false;
      /* Re-attach based on which class the element has */
      if (!window.anime) return; /* anime.js not yet loaded */
      if (el.classList.contains('fw-hero-word'))       { attachHeroWord(el); }
      else if (el.classList.contains('fw-section-phrase')) { attachSectionPhrase(el); }
      else if (el.classList.contains('fw-anime-label'))    { attachLabel(el); }
    },
  };

  /* ════════════════════════════════════════════════════════════════════════
     BOOTSTRAP
  ════════════════════════════════════════════════════════════════════════ */

  function attachAll() {
    document.querySelectorAll('.fw-hero-word').forEach(attachHeroWord);
    document.querySelectorAll('.fw-section-phrase').forEach(attachSectionPhrase);
    document.querySelectorAll('.fw-anime-label:not(.fw-hero-word):not(.fw-section-phrase)').forEach(attachLabel);
  }

  function init() {
    mergePendingPalettes(); /* pull in any palettes registered before load */
    if (!window.anime) {
      var check = setInterval(function () {
        if (window.anime) { clearInterval(check); mergePendingPalettes(); attachAll(); }
      }, 50);
      return;
    }
    attachAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Watch for dynamically added labels */
  var obs = new MutationObserver(function () { attachAll(); });
  document.addEventListener('DOMContentLoaded', function () {
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  });
})();
