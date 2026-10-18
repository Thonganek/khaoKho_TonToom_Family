/* ==========================================================================
   ABOVE THE CLOUDS — a warm family film
   --------------------------------------------------------------------------
   The curated edit (film-edit.js, written after looking at every photo)
   cuts the album into a film: a trailer-style cold open, chapters that
   follow the trip, soft photographic compositions — dreamy heroes whose
   edges melt into their own colours, epic landscapes, soft photo cards,
   scrapbook polaroids, collages — dressed with handwriting, doodles,
   stickers, fairy dust and tiny stars hidden on the lights of night
   photographs, and a finale where every photograph flies in to form a heart.
   Photos the edit doesn't name are cut automatically.

   Every frame is a pure function of film time `t`, so pause, seek, loop,
   score and recording stay exact. The canvas is 1080 px on its short side
   and takes the screen's shape (desktop, iPad, phone; landscape or portrait).
   There is no control bar: tap = play/pause, double-tap = fullscreen,
   long-press (or P) = edit suite.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------------
     Geometry
     --------------------------------------------------------------------- */
  const BASE = 1080;
  let W = 1920, H = 1080, PORT = false;
  const IMG_RE = /\.(jpe?g|png|webp)$/i;
  const FOLDER_HINT = 'C:\\Users\\USER\\Desktop\\เที่ยวเขาค้อ\\คัดแล้ว';
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------------------------------------------------------------
     Math & easing
     --------------------------------------------------------------------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ramp = (u, a, b) => clamp((u - a) / (b - a));
  const bump = (u, c, w) => Math.exp(-((u - c) * (u - c)) / (2 * w * w));
  const E = {
    sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    outSine: k => Math.sin((k * Math.PI) / 2),
    outCubic: k => 1 - Math.pow(1 - k, 3),
    outQuart: k => 1 - Math.pow(1 - k, 4),
    inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    pop: k => 1 + 3.4 * Math.pow(k - 1, 3) + 2.4 * Math.pow(k - 1, 2),     // gentle bounce for stickers
  };
  const r2 = n => Math.round(n * 100) / 100;
  const r4 = n => Math.round(n * 10000) / 10000;
  const pad2 = n => String(n).padStart(2, '0');
  const fmt = s => { s = Math.max(0, Math.floor(s + 1e-4)); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); };
  const ratioOf = p => p.w / p.h;
  const fitIn = (r, mw, mh) => { let w = mw, hh = w / r; if (hh > mh) { hh = mh; w = hh * r; } return { w, h: hh }; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const rng = seed => { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const bez = (P, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  };

  /* ---------------------------------------------------------------------
     DOM helpers
     --------------------------------------------------------------------- */
  const $ = id => document.getElementById(id);
  const h = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  };
  const css = (el, prop, val) => {                       // cached style writes
    const c = el._c || (el._c = {});
    if (c[prop] === val) return;
    c[prop] = val;
    el.style[prop] = val;
  };
  const setMask = (el, val) => {
    const c = el._c || (el._c = {});
    if (c.mask === val) return;
    c.mask = val;
    el.style.webkitMaskImage = val;
    el.style.maskImage = val;
  };
  const show = (el, on) => css(el, 'visibility', on ? 'visible' : 'hidden');
  const op = (el, v) => css(el, 'opacity', String(r4(clamp(v))));
  const imgEl = (photo, cls) => {
    const i = h('img', cls);
    i.src = photo.url; i.alt = ''; i.draggable = false; i.decoding = 'sync';
    return i;
  };
  let toastTimer = 0;
  function toast(msg, ms = 3400) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
  }

  /* ---------------------------------------------------------------------
     Words (used when the edit doesn't say otherwise)
     --------------------------------------------------------------------- */
  const AUTO_DEFS = [
    { en: 'Little Adventures', th: 'การผจญภัยเล็ก ๆ', mood: 'farm', line: { en: 'Little adventures, big smiles.', th: 'การผจญภัยเล็ก ๆ กับรอยยิ้มกว้าง ๆ' } },
    { en: 'Smiles All Around', th: 'รอยยิ้มรอบตัว', mood: 'garden', line: { en: 'Joy was everywhere we looked.', th: 'ความสุขอยู่ทุกที่ที่เรามอง' } },
    { en: 'Together, Always', th: 'ด้วยกันเสมอ', mood: 'morning', line: { en: 'We laughed more than we planned to.', th: 'เราหัวเราะมากกว่าที่ตั้งใจไว้' } },
    { en: 'Happy Days', th: 'วันแสนสุข', mood: 'garden', line: { en: 'Every moment, a little brighter.', th: 'ทุกช่วงเวลา สดใสขึ้นอีกนิด' } },
  ];
  const AUTO_MIST = { en: 'Above the Clouds', th: 'เหนือทะเลหมอก', mood: 'mist', line: { en: 'For a while, the clouds were beneath us.', th: 'ชั่วขณะหนึ่ง ทะเลเมฆอยู่ใต้เท้าเรา' } };
  const AUTO_NIGHT = { en: 'Starry Nights', th: 'ค่ำคืนแสนอบอุ่น', mood: 'night', line: { en: 'And the night was full of stories.', th: 'และค่ำคืนก็เต็มไปด้วยเรื่องเล่า' } };
  const EXTRA_DEF = { en: 'More Moments', th: 'ช่วงเวลาดี ๆ', mood: 'garden', line: AUTO_DEFS[1].line };
  const COPY = {
    card1: { en: 'Some journeys', th: 'บางการเดินทาง' },
    card2: { en: 'aren\u2019t measured in miles', th: 'ไม่ได้วัดกันที่ระยะทาง' },
    end: { en: 'Until the mist calls us back.', th: 'จนกว่าสายหมอกจะเรียกเรากลับมา' },
    heart: 'ครอบครัวของเรา',
    thanks: 'ขอบคุณที่เป็นครอบครัวของกันและกัน',
  };
  const CAPTIONS = [
    { th: 'ยิ้มกว้าง ๆ นะ', en: 'Big smiles' },
    { th: 'ด้วยกันเสมอ', en: 'Together, always' },
    { th: 'อบอุ่นหัวใจ', en: 'Warm hearts' },
    { th: 'ใต้ฟ้าเดียวกัน', en: 'Under the same sky' },
    { th: 'อยู่ต่ออีกนิดนะ', en: 'Stay a little longer' },
    { th: 'วันที่ดีที่สุด', en: 'The best of days' },
  ];
  const NOTES = ['อากาศดีมาก!', 'วิวสวยจัง', 'ความสุขเล็ก ๆ', 'จำวันนี้ไว้นะ', 'สนุกสุด ๆ', 'หัวใจพองโต', 'อิ่มใจจัง'];
  const POL = ['♡ เขาค้อ', 'ยิ้มสิ!', 'แชะ!', 'คิดถึงนะ', 'สุดยอด!', 'วันนี้ดีจัง', 'ไปด้วยกัน', 'เย้!', 'จำไว้นะ'];
  const ALBUM_TITLES = ['ความทรงจำของเรา', 'วันที่ดีที่สุด', 'ยิ้มเยอะ ๆ นะ', 'ครอบครัวของเรา ♡', 'เก็บไว้ในใจ'];
  const TAPES = ['#f6c1cc', '#bcd8f2', '#bfe3d0', '#f6e3a6', '#d9c8f0'];

  /* ---------------------------------------------------------------------
     Hand-drawn doodles [path, viewBox w, viewBox h] and stickers
     --------------------------------------------------------------------- */
  const DOODLE = {
    heart: ['M50 84 C 27 67, 9 50, 16 31 C 22 16, 41 15, 50 31 C 59 15, 78 16, 84 31 C 91 50, 73 67, 50 84 Z', 100, 100],
    sparkle: ['M50 6 C 53 34, 66 47, 94 50 C 66 53, 53 66, 50 94 C 47 66, 34 53, 6 50 C 34 47, 47 34, 50 6 Z', 100, 100],
    star: ['M50 8 L60 38 L92 39 L66 58 L76 89 L50 70 L24 89 L34 58 L8 39 L40 38 Z', 100, 100],
    arrow: ['M10 80 C 22 36, 58 20, 68 44 C 75 62, 50 70, 50 54 C 50 36, 74 26, 92 18 M79 12 L93 17 L87 30', 100, 100],
    squiggle: ['M4 26 C 24 6, 40 6, 54 24 S 84 44, 100 22 S 132 2, 148 22 S 180 40, 196 18', 200, 40],
  };
  const STICKER = {
    heart: '<path d="M50 88 C 24 70, 4 52, 12 30 C 19 13, 40 11, 50 29 C 60 11, 81 13, 88 30 C 96 52, 76 70, 50 88 Z" fill="url(#stkPink)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="M27 32 C 29 25, 35 21, 41 22" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="6" stroke-linecap="round"/>',
    star: '<path d="M50 6 L61 37 L94 38 L68 58 L78 91 L50 72 L22 91 L32 58 L6 38 L39 37 Z" fill="url(#stkGold)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="M40 33 L47 30" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="5" stroke-linecap="round"/>',
    cloud: '<path d="M24 74 C 8 74, 8 50, 26 50 C 26 32, 50 28, 56 44 C 62 32, 86 36, 84 54 C 98 56, 96 74, 80 74 Z" fill="url(#stkSky)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>',
  };

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  const EDIT = window.FILM_EDIT && Array.isArray(window.FILM_EDIT.chapters) ? window.FILM_EDIT : null;
  const FOCUS = (EDIT && EDIT.focus) || {};
  const state = {
    photos: [], order: [], sourceLabel: '', curated: !!EDIT,
    t: 0, playing: false, baseT: 0, baseNow: 0, dirty: true, ready: false,
    items: [], scenes: [], starts: [], durs: [], total: 1, groups: [],
    scoreStart: 0, cues: [], lastItem: -1, photoItem: [], keyPos: -1, seq: [],
    objectUrls: [], warmed: new Set(), recording: null,
  };

  /* =====================================================================
     MIST — WebGL shader with CSS fallback
     ===================================================================== */
  const FOG_VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FOG_FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    uniform vec2 uRes;
    uniform float uTime, uAmount, uLow, uWarm;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * aspect, uv.y) * 1.6;
      float t = uTime * 0.04;
      vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.6, 0.0)));
      float f = fbm(p * 1.1 + q * 1.6 + vec2(t * 1.4, t * 0.1));
      float dens = smoothstep(0.32, 0.9, f);
      float low = mix(1.0, smoothstep(1.0, 0.0, uv.y) * 1.35, uLow);
      float a = clamp(dens * low * uAmount, 0.0, 0.9);
      vec3 col = mix(vec3(0.96, 0.96, 0.98), vec3(1.0, 0.95, 0.88), uWarm);
      gl_FragColor = vec4(col * a, a);
    }`;
  class FogRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ok = false;
      this.visible = true;
      let gl = null;
      try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }); } catch (e) { gl = null; }
      if (!gl) return;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      try {
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, FOG_VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FOG_FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        this.u = {};
        ['uRes', 'uTime', 'uAmount', 'uLow', 'uWarm'].forEach(n => { this.u[n] = gl.getUniformLocation(prog, n); });
        this.gl = gl;
        this.ok = true;
      } catch (e) { console.warn('WebGL mist unavailable, using CSS fallback.', e); }
    }
    resize() {
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
      if (!this.ok) return;
      this.canvas.width = Math.round(W * 0.4);
      this.canvas.height = Math.round(H * 0.4);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    draw(time, p) {
      if (!this.ok) return;
      const on = p.amount > 0.004;
      if (on !== this.visible) { this.canvas.style.opacity = on ? '1' : '0'; this.visible = on; }
      if (!on) return;
      const gl = this.gl, u = this.u;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, time + 30);
      gl.uniform1f(u.uAmount, p.amount);
      gl.uniform1f(u.uLow, p.low);
      gl.uniform1f(u.uWarm, p.warm);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /* =====================================================================
     PARTICLES — warm bokeh, drifting petals, fireflies and twinkling stars
     ===================================================================== */
  class Particles {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.on = true;
      const radial = (stops, size = 96) => {
        const s = document.createElement('canvas');
        s.width = s.height = size;
        const g = s.getContext('2d'), c = size / 2;
        const grd = g.createRadialGradient(c, c, 0, c, c, c);
        stops.forEach(([o, col]) => grd.addColorStop(o, col));
        g.fillStyle = grd;
        g.fillRect(0, 0, size, size);
        return s;
      };
      this.bokehS = [
        radial([[0, 'rgba(255,246,230,0.95)'], [0.45, 'rgba(255,214,170,0.4)'], [0.75, 'rgba(255,200,150,0.1)'], [1, 'rgba(255,200,150,0)']]),
        radial([[0, 'rgba(255,240,246,0.95)'], [0.45, 'rgba(255,176,200,0.38)'], [0.75, 'rgba(255,150,180,0.1)'], [1, 'rgba(255,150,180,0)']]),
        radial([[0, 'rgba(255,252,236,0.95)'], [0.45, 'rgba(255,232,160,0.4)'], [0.75, 'rgba(255,220,140,0.1)'], [1, 'rgba(255,220,140,0)']]),
      ];
      this.flyS = radial([[0, 'rgba(255,255,236,1)'], [0.2, 'rgba(255,232,150,0.85)'], [0.55, 'rgba(255,200,90,0.2)'], [1, 'rgba(255,190,80,0)']], 64);
      const pc = document.createElement('canvas');
      pc.width = 64; pc.height = 40;
      const pg = pc.getContext('2d');
      const pgr = pg.createLinearGradient(0, 0, 64, 40);
      pgr.addColorStop(0, 'rgba(255,240,246,0.98)'); pgr.addColorStop(0.55, 'rgba(255,186,206,0.95)'); pgr.addColorStop(1, 'rgba(243,146,178,0.9)');
      pg.fillStyle = pgr;
      pg.beginPath(); pg.moveTo(4, 20); pg.bezierCurveTo(14, 0, 46, 0, 60, 16); pg.lineTo(52, 20); pg.lineTo(60, 24); pg.bezierCurveTo(46, 40, 14, 40, 4, 20); pg.fill();
      this.petalS = pc;
      const tc = document.createElement('canvas');
      tc.width = tc.height = 64;
      const tg = tc.getContext('2d');
      const tr = tg.createRadialGradient(32, 32, 0, 32, 32, 32);
      tr.addColorStop(0, 'rgba(255,255,250,1)'); tr.addColorStop(0.18, 'rgba(255,240,200,0.6)'); tr.addColorStop(1, 'rgba(255,230,180,0)');
      tg.fillStyle = tr; tg.fillRect(0, 0, 64, 64);
      const lh = tg.createLinearGradient(0, 0, 64, 0);
      lh.addColorStop(0, 'rgba(255,248,230,0)'); lh.addColorStop(0.5, 'rgba(255,255,255,1)'); lh.addColorStop(1, 'rgba(255,248,230,0)');
      tg.fillStyle = lh; tg.fillRect(0, 31, 64, 2);
      const lv = tg.createLinearGradient(0, 0, 0, 64);
      lv.addColorStop(0, 'rgba(255,248,230,0)'); lv.addColorStop(0.5, 'rgba(255,255,255,1)'); lv.addColorStop(1, 'rgba(255,248,230,0)');
      tg.fillStyle = lv; tg.fillRect(31, 0, 2, 64);
      this.starS = tc;
      const rnd = rng(17);
      this.bokeh = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.01, vy: 0.005 + rnd() * 0.012, r: 14 + Math.pow(rnd(), 2) * 70, a: 0.25 + rnd() * 0.55, tw: 0.4 + rnd() * 1.2, ph: rnd() * 6.28 }));
      this.petals = Array.from({ length: 28 }, () => ({ x: rnd(), y: rnd() * 1.1, vx: 0.012 + rnd() * 0.02, vy: 0.028 + rnd() * 0.04, s: 22 + rnd() * 26, spin: 0.5 + rnd() * 1.4, rot: rnd() * 6.28, f: 0.5 + rnd(), ph: rnd() * 6.28, a: 0.55 + rnd() * 0.4 }));
      this.flies = Array.from({ length: 46 }, () => ({ x: rnd(), y: 0.12 + rnd() * 0.82, f1: 0.15 + rnd() * 0.35, f2: 0.12 + rnd() * 0.3, ph: rnd() * 6.28, s: 8 + rnd() * 18, tw: 0.8 + rnd() * 2 }));
      this.stars = Array.from({ length: 30 }, () => ({ x: rnd(), y: rnd() * 0.9, s: 16 + rnd() * 28, f: 0.35 + rnd() * 0.5, ph: rnd() * 6.28 }));
    }
    resize() {
      this.canvas.width = Math.round(W * 0.5);
      this.canvas.height = Math.round(H * 0.5);
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
    }
    draw(t, f) {
      const any = f.bokeh > 0.004 || f.petals > 0.004 || f.flies > 0.004 || f.stars > 0.004;
      if (any !== this.on) { this.canvas.style.opacity = any ? '1' : '0'; this.on = any; }
      const c = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
      c.clearRect(0, 0, cw, ch);
      if (!any) return;
      const unit = Math.min(cw, ch) / 540;
      c.globalCompositeOperation = 'lighter';
      if (f.bokeh > 0.004) this.bokeh.forEach((p, i) => {
        const x = ((((p.x + p.vx * t) % 1) + 1) % 1) * cw;
        const y = ((((p.y - p.vy * t) % 1) + 1) % 1) * ch + Math.sin(t * 0.5 + p.ph) * 8 * unit;
        const s = p.r * unit;
        c.globalAlpha = clamp(f.bokeh * p.a * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph)));
        c.drawImage(this.bokehS[i % 3], x - s / 2, y - s / 2, s, s);
      });
      if (f.flies > 0.004) this.flies.forEach(p => {
        const x = (p.x + Math.sin(t * p.f1 + p.ph) * 0.05) * cw;
        const y = (p.y + Math.cos(t * p.f2 + p.ph * 1.3) * 0.04) * ch;
        const s = p.s * unit;
        c.globalAlpha = clamp(f.flies * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * p.tw + p.ph), 2)));
        c.drawImage(this.flyS, x - s / 2, y - s / 2, s, s);
      });
      if (f.stars > 0.004) this.stars.forEach(p => {
        const k = Math.pow(Math.max(0, Math.sin(t * p.f * 2 + p.ph)), 8);
        if (k < 0.01) return;
        const s = p.s * unit * (0.5 + 0.5 * k);
        c.globalAlpha = clamp(f.stars * k);
        c.drawImage(this.starS, p.x * cw - s / 2, p.y * ch - s / 2, s, s);
      });
      c.globalCompositeOperation = 'source-over';
      if (f.petals > 0.004) this.petals.forEach(p => {
        const x = ((((p.x + p.vx * t + Math.sin(t * p.f + p.ph) * 0.03) % 1) + 1) % 1) * cw;
        const y = (((((p.y + p.vy * t) % 1.1) + 1.1) % 1.1) - 0.05) * ch;
        const s = p.s * unit;
        c.save();
        c.translate(x, y);
        c.rotate(p.rot + t * p.spin);
        c.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * p.f * 1.7 + p.ph)));
        c.globalAlpha = clamp(f.petals * p.a);
        c.drawImage(this.petalS, -s / 2, -s * 0.31, s, s * 0.62);
        c.restore();
      });
      c.globalAlpha = 1;
    }
  }

  /* =====================================================================
     PHOTOGRAPHS
     ===================================================================== */
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const naturalSort = (a, b) => collator.compare(a.name, b.name);
  const numOf = name => { const m = /_(\d+)\.[a-z0-9]+$/i.exec(name); return m ? m[1] : name; };

  // Brightest small highlights (lamps, sun) — where tiny stars are hidden.
  function findGlints(L, GW, GH, lum) {
    const night = lum < 0.38, minL = night ? 0.62 : 0.88, minC = night ? 0.2 : 0.26, maxN = night ? 5 : 3, R = 5;
    const S = new Float64Array((GW + 1) * (GH + 1));
    for (let y = 1; y <= GH; y++) {
      let row = 0;
      for (let x = 1; x <= GW; x++) { row += L[(y - 1) * GW + x - 1]; S[y * (GW + 1) + x] = S[(y - 1) * (GW + 1) + x] + row; }
    }
    const cands = [];
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        const v = L[y * GW + x];
        if (v < minL) continue;
        let isMax = true;
        for (let dy = -1; dy <= 1 && isMax; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && L[(y + dy) * GW + x + dx] > v) { isMax = false; break; }
        if (!isMax) continue;
        const x0 = Math.max(0, x - R), x1 = Math.min(GW, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(GH, y + R + 1);
        const sum = S[y1 * (GW + 1) + x1] - S[y0 * (GW + 1) + x1] - S[y1 * (GW + 1) + x0] + S[y0 * (GW + 1) + x0];
        const con = v - sum / ((x1 - x0) * (y1 - y0));
        if (con >= minC) cands.push([x, y, con * v]);
      }
    }
    cands.sort((a, b) => b[2] - a[2]);
    const pick = [];
    for (const c of cands) {
      if (pick.every(p => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) >= 12)) pick.push(c);
      if (pick.length >= maxN) break;
    }
    return pick.map(c => [(c[0] + 0.5) / GW, (c[1] + 0.5) / GH, clamp(c[2] * 3, 0.45, 1)]);
  }
  // Measures for photos picked from disk (the manifest's photos come pre-measured).
  function analyse(img) {
    try {
      const GW = 96, GH = 72;
      const cv = document.createElement('canvas');
      cv.width = GW; cv.height = GH;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, GW, GH);
      const d = g.getImageData(0, 0, GW, GH).data;
      const L = new Float32Array(GW * GH);
      let top = 0, topN = 0, bot = 0, botN = 0, all = 0;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = (y * GW + x) * 4, r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
          const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
          L[y * GW + x] = l;
          all += l;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx > 0 ? (mx - mn) / mx : 0;
          if (y < 26) { top += Math.max(0, b - (r + gg) / 2) * 1.6 + l * 0.4; topN++; }
          if (y >= 44) { bot += l * (1 - s); botN++; }
        }
      }
      const lum = all / (GW * GH);
      return { sky: top / topN + 0.8 * (bot / botN), lum, glints: findGlints(L, GW, GH, lum) };
    } catch (e) { return null; }                       // file:// images taint the canvas; the manifest carries the measures
  }
  const canAnalyse = url => url.startsWith('blob:') || location.protocol.startsWith('http');

  function loadImage(url, analyseIt) {
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight, m: analyseIt ? analyse(img) : null });
      img.onerror = () => resolve({ ok: false });
      img.src = url;
    });
  }
  async function preparePhotos(entries, onProgress) {
    let done = 0;
    const results = await Promise.all(entries.map(async e => {
      const r = await loadImage(e.url, e.sky == null && canAnalyse(e.url));
      onProgress && onProgress(++done, entries.length);
      if (!r.ok) return null;
      const m = r.m || {};
      return {
        id: e.name, name: e.name, num: numOf(e.name), url: e.url, w: r.w, h: r.h, portrait: r.h > r.w * 1.02,
        sky: e.sky != null ? e.sky : m.sky, lum: e.lum != null ? e.lum : m.lum, glints: e.glints || m.glints || null,
      };
    }));
    return results.filter(Boolean).sort(naturalSort);
  }
  function manifestEntries() {
    const m = window.PHOTO_MANIFEST;
    if (!m || !Array.isArray(m.files) || !m.files.length) return null;
    const folder = (m.folder || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const meta = m.meta || {};
    return m.files.filter(n => IMG_RE.test(n)).map(name => {
      const mm = meta[name] || {};
      return {
        name,
        url: (folder ? folder + '/' : '') + encodeURIComponent(name),
        sky: typeof mm.sky === 'number' ? mm.sky : null,
        lum: typeof mm.lum === 'number' ? mm.lum : null,
        glints: Array.isArray(mm.glints) ? mm.glints : null,
      };
    });
  }

  async function pickFolder() {
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ id: 'khaokho-photos', mode: 'read' });
        const files = [];
        for await (const [name, handle] of dir.entries()) {
          if (handle.kind === 'file' && IMG_RE.test(name)) files.push(await handle.getFile());
        }
        await loadFromFiles(files, dir.name);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    $('folderInput').value = '';
    $('folderInput').click();
  }
  $('folderInput').addEventListener('change', async e => {
    let files = Array.from(e.target.files || []).filter(f => IMG_RE.test(f.name));
    const top = files.filter(f => (f.webkitRelativePath || '').split('/').length <= 2);
    if (top.length) files = top;
    await loadFromFiles(files, (files[0] && files[0].webkitRelativePath || '').split('/')[0] || 'Selected folder');
  });
  async function loadFromFiles(files, label) {
    if (!files.length) { toast('ไม่พบไฟล์ภาพ JPG / PNG / WebP ในโฟลเดอร์นี้'); return; }
    const old = state.objectUrls;
    state.objectUrls = [];
    const entries = files.map(f => { const url = URL.createObjectURL(f); state.objectUrls.push(url); return { name: f.name, url }; });
    setLoader(`กำลังเตรียมภาพ 0 / ${entries.length}`, 0);
    const photos = await preparePhotos(entries, (d, n) => setLoader(`กำลังเตรียมภาพ ${d} / ${n}`, d / n));
    if (!photos.length) { toast('ไม่สามารถอ่านไฟล์ภาพได้'); return; }
    setTimeout(() => old.forEach(u => URL.revokeObjectURL(u)), 4000);
    usePhotos(photos, label);
    if (!state.ready) start(); else toast(`โหลดภาพแล้ว ${photos.length} ภาพ`);
  }
  function usePhotos(photos, label) {
    state.photos = photos;
    state.order = photos.slice();
    state.sourceLabel = label;
    state.curated = !!EDIT;
    rebuild(true);
  }

  /* =====================================================================
     BUILDING BLOCKS
     ===================================================================== */
  const focusOf = p => FOCUS[p.num] || [50, p.portrait ? 36 : 42];

  // Tiny stars that twinkle on the lights of night photographs (placed in image space).
  function glintLayer(photo, parent, bw, bh, focus) {
    if (!photo.glints || !photo.glints.length || !(photo.lum < 0.38)) return null;
    const s = Math.max(bw / photo.w, bh / photo.h), dw = photo.w * s, dh = photo.h * s;
    const ox = (bw - dw) * (focus ? focus[0] / 100 : 0.5), oy = (bh - dh) * (focus ? focus[1] / 100 : 0.5);
    const base = Math.min(bw, bh);
    const out = [];
    photo.glints.forEach(([gx, gy, st], i) => {
      const x = ox + gx * dw, y = oy + gy * dh;
      if (x < 4 || y < 4 || x > bw - 4 || y > bh - 4) return;
      const g = h('i', 'glint', '<i></i>');
      g.style.cssText = `left:${r2(x)}px;top:${r2(y)}px;--gs:${r2(base * (0.05 + 0.05 * st))}px`;
      parent.append(g);
      out.push({ el: g, ph: i * 1.7 + gx * 5, st, f: 1.2 + (i % 3) * 0.35 });
    });
    return out.length ? out : null;
  }
  function renderGlints(gl, u, a) {
    if (!gl) return;
    const k = ramp(u, a, a + 1.2);
    gl.forEach(g => {
      const tw = Math.pow(0.5 + 0.5 * Math.sin(u * g.f + g.ph), 3);
      op(g.el, k * g.st * (0.25 + 0.75 * tw));
      css(g.el, 'transform', `rotate(${r2((u * 12 + g.ph * 30) % 360)}deg) scale(${r4(0.45 + 0.75 * tw)})`);
    });
  }

  // A photograph in a box (full frame by default) with an inner layer for the camera.
  function photoBox(photo, parent, rect, cls, glow) {
    const r = rect || { x: 0, y: 0, w: W, h: H };
    const box = h('div', 'pb' + (cls ? ' ' + cls : ''));
    box.style.cssText = `left:${r2(r.x)}px;top:${r2(r.y)}px;width:${r2(r.w)}px;height:${r2(r.h)}px`;
    const kb = h('div', 'kb');
    const f = focusOf(photo), pos = `${f[0]}% ${f[1]}%`;
    const im = imgEl(photo);
    im.style.objectPosition = pos;
    kb.append(im);
    if (glow) { const g = imgEl(photo, 'ph-glow'); g.style.objectPosition = pos; kb.append(g); }
    const gl = glintLayer(photo, kb, r.w, r.h, f);
    box.append(kb);
    parent.append(box);
    return { box, kb, w: r.w, h: r.h, gl };
  }
  // The same photograph, softly blurred, as the colour field behind a composition.
  function fieldOf(photo, parent) {
    const f = h('div', 'field');
    f.append(imgEl(photo), h('div', 'field__tone'));
    parent.append(f);
    return f;
  }
  const shade = (parent, kind) => { const s = h('div', 'shade shade--' + kind); parent.append(s); return s; };

  // Dream: the whole photograph, its edges melting into its own colours.
  function dreamPhoto(photo, parent, rect, cls) {
    const box = h('div', 'dream' + (cls ? ' ' + cls : ''));
    box.style.cssText = `left:${r2(rect.x)}px;top:${r2(rect.y)}px;width:${r2(rect.w)}px;height:${r2(rect.h)}px`;
    const inner = h('div', 'dream__in');
    const kb = h('div', 'kb');
    kb.append(imgEl(photo), imgEl(photo, 'ph-glow'));
    const gl = glintLayer(photo, kb, rect.w, rect.h, null);
    inner.append(kb);
    box.append(inner);
    parent.append(box);
    return { box, kb, w: rect.w, h: rect.h, gl };
  }
  // Landscape screens: full-bleed. Portrait screens: a dream band over the colour field.
  function heroPhoto(p, root, cls) {
    if (!PORT) return { pb: photoBox(p, root, null, cls, true), field: null };
    const field = fieldOf(p, root);
    const box = fitIn(ratioOf(p), W * 0.98, H * 0.62);
    return { pb: dreamPhoto(p, root, { x: (W - box.w) / 2, y: H * 0.44 - box.h / 2, w: box.w, h: box.h }, cls), field };
  }
  // Soft card: rounded corners, a soft shadow and an aura of the photo's own colours.
  function softCard(photo, parent, rect, o = {}) {
    const el = h('div', 'sc' + (o.cls ? ' ' + o.cls : ''));
    el.style.cssText = `left:${r2(rect.x)}px;top:${r2(rect.y)}px;width:${r2(rect.w)}px;height:${r2(rect.h)}px`;
    if (o.aura) { const a = h('div', 'sc__aura'); a.append(imgEl(photo)); el.append(a); }
    const clip = h('div', 'sc__clip');
    const kb = h('div', 'kb');
    kb.append(imgEl(photo));
    const gl = glintLayer(photo, kb, rect.w, rect.h, null);
    const sheen = h('div', 'sheen');
    clip.append(kb, sheen);
    el.append(clip);
    parent.append(el);
    return { el, kb, sheen, gl, w: rect.w, h: rect.h, rect };
  }
  const POL_SIDE = 18, POL_TOP = 18, POL_BOT = 84;
  function polaroid(parent, photo, pw, ph, cx, cy, rot, caption, tapeColor) {
    const w = pw + 2 * POL_SIDE, hh = ph + POL_TOP + POL_BOT;
    const el = h('div', 'pol');
    el.style.cssText = `left:${r2(cx - w / 2)}px;top:${r2(cy - hh / 2)}px;width:${r2(w)}px;height:${r2(hh)}px`;
    const win = h('div', 'pol__ph');
    win.style.cssText = `left:${POL_SIDE}px;top:${POL_TOP}px;width:${r2(pw)}px;height:${r2(ph)}px`;
    const kb = h('div', 'kb');
    kb.append(imgEl(photo));
    const gl = glintLayer(photo, kb, pw, ph, null);
    const sheen = h('div', 'sheen');
    win.append(kb, sheen);
    const cap = h('div', 'hand pol__cap', caption);
    cap.style.cssText = `top:${r2(POL_TOP + ph)}px;height:${POL_BOT}px;line-height:${POL_BOT}px`;
    el.append(win, cap);
    const tp = tape(el, tapeColor, 'left:50%;top:-20px', rot > 0 ? -7 : 6);
    parent.append(el);
    return { el, kb, sheen, gl, cap, tape: tp, w, h: hh, cx, cy, rot };
  }
  function tape(parent, color, place, rot) {
    const t = h('div', 'tape');
    t.style.cssText = place;
    t.style.setProperty('--tc', color);
    t._rot = rot;
    parent.append(t);
    return t;
  }
  function popTape(t, u, a) {
    const k = E.outCubic(ramp(u, a, a + 0.5));
    op(t, k);
    css(t, 'transform', `translateX(-50%) rotate(${t._rot}deg) scale(${r4(1.14 - 0.14 * k)})`);
  }
  function doodle(parent, kind, x, y, size, rot = 0, color, cls) {
    const [d, vw, vh] = DOODLE[kind];
    const hgt = (size * vh) / vw;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('class', 'doodle' + (cls ? ' ' + cls : ''));
    let st = `width:${r2(size)}px;height:${r2(hgt)}px;--sw:${r2(Math.max(1, (3.8 * vw) / size))};`;
    if (x != null) st += `left:${r2(x - size / 2)}px;top:${r2(y - hgt / 2)}px;`;
    if (rot) st += `transform:rotate(${rot}deg);`;
    if (color) st += `--dc:${color};`;
    svg.setAttribute('style', st);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    svg.append(p);
    parent.append(svg);
    return { svg, p };
  }
  function doodleInline(parent, kind, cls) {                // sized by CSS
    const [d, vw, vh] = DOODLE[kind];
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('class', 'doodle doodle--inline ' + cls);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    svg.append(p);
    parent.append(svg);
    return { svg, p };
  }
  function draw(dd, u, a, dur = 1, alpha = 1) {
    const k = E.inOutCubic(ramp(u, a, a + dur));
    css(dd.p, 'strokeDashoffset', String(r4(1 - k)));
    op(dd.svg, (k > 0 ? 1 : 0) * alpha);
  }
  function sticker(parent, kind, x, y, size, rot = 0) {
    const el = h('div', 'sticker', `<svg viewBox="0 0 100 100">${STICKER[kind]}</svg>`);
    el.style.cssText = `left:${r2(x - size / 2)}px;top:${r2(y - size / 2)}px;width:${r2(size)}px;height:${r2(size)}px`;
    el._rot = rot;
    parent.append(el);
    return el;
  }
  function pop(el, u, a, alpha = 1) {
    const k = ramp(u, a, a + 0.7);
    if (k <= 0) { op(el, 0); return; }
    op(el, ramp(u, a, a + 0.1) * alpha);
    css(el, 'transform', `rotate(${r2(el._rot - 24 * (1 - E.outCubic(k)) + Math.sin((u - a) * 1.8) * 2.5 * k)}deg) scale(${r4(E.pop(k))})`);
  }
  // Handwriting: the words write themselves from left to right.
  function handWrite(el, u, a, d = 1.3, alpha = 1) {
    const k = ramp(u, a, a + d);
    op(el, (k > 0 ? 1 : 0) * alpha);
    css(el, 'clipPath', k >= 1 ? 'none' : `inset(-40% ${r2((1 - (0.2 * E.sine(k) + 0.8 * k)) * 100)}% -50% -10%)`);
  }
  function maskRow(parent, html, cls) {
    const m = h('div', 'm');
    const mi = h('div', 'mi' + (cls ? ' ' + cls : ''), html);
    m.append(mi);
    parent.append(m);
    return mi;
  }
  function rise(mi, u, a, d = 1.3) {
    const k = E.outQuart(ramp(u, a, a + d));
    css(mi, 'transform', `translate3d(0,${r2((1 - k) * 108)}%,0)`);
    op(mi, ramp(u, a, a + d * 0.55));
  }
  function sheenSweep(sheen, u, a) {
    css(sheen, 'transform', `translate3d(${r2(-130 + 260 * E.inOutCubic(ramp(u, a, a + 1.8)))}%,0,0)`);
  }
  // Rows of text that rise out of invisible lines (title cards, narration).
  function textBlock(parent, cls, rows, base = '') {
    const el = h('div', 'tb ' + cls);
    const lines = rows.map(r => {
      const m = h('div', 'm' + (r.rule ? ' m--rule' : '') + (r.cls ? ' ' + r.cls : ''));
      const mi = h('div', 'mi', r.rule ? '' : r.html);
      m.append(mi);
      el.append(m);
      return { mi, rule: !!r.rule };
    });
    parent.append(el);
    el.style.transform = base || 'none';
    return { el, lines, base };
  }
  function playText(tb, u, a, b, o = {}) {
    const st = o.stagger != null ? o.stagger : 0.12, d = o.dur || 1.3, od = o.outDur || 0.7;
    const kout = b == null ? 0 : E.sine(ramp(u, b, b + od));
    const vis = u >= a - 0.02 && kout < 1;
    show(tb.el, vis);
    if (!vis) return;
    op(tb.el, 1 - kout);
    const z = o.zoom ? 1 + o.zoom * (1 - E.outCubic(ramp(u, a, a + (o.zoomDur || 3)))) : 1;
    css(tb.el, 'transform', `${tb.base} translate3d(0,${r2(-kout * 12)}px,0) scale(${r4(z)})`);
    tb.lines.forEach((ln, i) => {
      const s = a + i * st;
      if (ln.rule) { css(ln.mi, 'transform', `scaleX(${r4(E.inOutCubic(ramp(u, s, s + d)))})`); return; }
      const k = E.outQuart(ramp(u, s, s + d));
      css(ln.mi, 'transform', `translate3d(0,${r2((1 - k) * 108)}%,0)`);
      op(ln.mi, ramp(u, s, s + d * 0.55));
    });
  }
  const lettersHTML = s => s.split(' ').map(w =>
    `<span class="w${w === 'the' ? ' w--em' : ''}">${Array.from(w).map(c => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');

  // Camera moves — constant-speed documentary Ken Burns: [x, y, scale] for k ∈ [0, 1].
  const MOVES = {
    push: k => [0, -0.008 * k, 1.04 + 0.08 * k],
    pull: k => [0, 0.006 * k, 1.13 - 0.08 * k],
    panL: k => [0.032 - 0.064 * k, 0, 1.12],
    panR: k => [-0.032 + 0.064 * k, 0, 1.12],
    rise: k => [0, 0.024 - 0.048 * k, 1.11],
    sink: k => [0, -0.02 + 0.04 * k, 1.1],
    drift: k => [-0.016 + 0.032 * k, 0.01 - 0.02 * k, 1.05 + 0.06 * k],
    settle: k => [0, 0, 1.07 - 0.07 * E.outCubic(k)],
  };
  function kenBurns(pb, move, k, dx = 0, amp = 1) {
    const [x, y, s] = MOVES[move](clamp(k));
    css(pb.kb, 'transform', `translate3d(${r2(x * amp * pb.w + dx)}px,${r2(y * amp * pb.h)}px,0) scale(${r4(1 + (s - 1) * amp)})`);
  }

  // Fairy dust: a fleeting trail of golden light that curves across a photograph.
  function dustTrail(parent, rect, seed) {
    const rnd = rng(seed * 7919 + 13);
    const wrap = h('div', 'dust');
    wrap.style.cssText = `left:${r2(rect.x)}px;top:${r2(rect.y)}px;width:${r2(rect.w)}px;height:${r2(rect.h)}px`;
    const dots = [];
    for (let i = 0; i < 20; i++) {
      const d = h('i', i === 0 ? 'head' : '');
      wrap.append(d);
      dots.push({ el: d, jx: (rnd() - 0.5) * 26, jy: (rnd() - 0.5) * 26, s: 0.5 + rnd() * 0.8 });
    }
    parent.append(wrap);
    const P = rnd() < 0.5
      ? [[-0.06, 0.78], [0.3, 0.18], [0.66, 0.96], [1.06, 0.26]]
      : [[1.06, 0.74], [0.7, 0.12], [0.34, 0.96], [-0.06, 0.32]];
    return { wrap, dots, P, w: rect.w, h: rect.h };
  }
  function renderDust(d, u, a, dur = 2.6) {
    const k0 = (u - a) / dur;
    const on = k0 > -0.02 && k0 < 1.5;
    show(d.wrap, on);
    if (!on) return;
    const n = d.dots.length;
    d.dots.forEach((dot, i) => {
      const k = k0 - i * 0.022;
      if (k < 0 || k > 1) { op(dot.el, 0); return; }
      const [x, y] = bez(d.P, E.inOutCubic(k));
      const tail = i / n;
      op(dot.el, Math.pow(1 - tail, 1.2) * Math.sin(Math.PI * k) * (i === 0 ? 1 : 0.9));
      css(dot.el, 'transform', `translate3d(${r2(x * d.w + dot.jx * tail)}px,${r2(y * d.h + dot.jy * tail)}px,0) scale(${r4(dot.s * (1 - tail * 0.6))})`);
    });
  }

  /* =====================================================================
     THE EDIT
     ===================================================================== */
  const DUR = { epic: 4.4, dream: 4.6, pair: 5.6, card: 5.2, album: 8.0, collage: 7.2 };
  const CH_EXTRA = 2.8, CH_IN = 0.95, CH_OUT = 3.7, LINE_EXTRA = 1.4;
  const CARDY = { pair: 1, card: 1, collage: 1, album: 1 };
  const TROT = ['dissolve', 'drift', 'dissolve', 'soft-wipe', 'dissolve', 'light', 'dissolve', 'drift'];
  const MROT = ['push', 'panL', 'rise', 'pull', 'panR', 'drift'];

  const splitEven = (arr, c) => {
    const out = [];
    let s = 0;
    for (let k = 0; k < c; k++) { const e = Math.round(((k + 1) * arr.length) / c); out.push(arr.slice(s, e)); s = e; }
    return out.filter(x => x.length);
  };

  // Cold open: a light streak, a location card, three flash-cut montages
  // separated by two words cards, accelerating into a hit and the title.
  function planOpener(pool) {
    const pick = k => (pool.length ? pool[Math.min(pool.length - 1, Math.floor(((k + 0.5) * pool.length) / 13))] : null);
    const cuts = [];
    const add = (t, d, flash) => { const k = cuts.length, p = pick(k); if (p) cuts.push({ t, d, flash, photo: p, dx: (k % 2 ? -1 : 1) * 26, dy: (((k * 7) % 3) - 1) * 12 }); };
    [3.0, 3.7, 4.4].forEach(t => add(t, 0.7, 0.24));
    [6.3, 6.8, 7.3, 7.8].forEach(t => add(t, 0.5, 0.28));
    let t = 9.5;
    [0.42, 0.36, 0.31, 0.28, 0.27, 0.26].forEach((d, k) => { add(t, d, 0.3 + k * 0.03); t += d; });
    return { cuts, titleAt: 11.4 };
  }

  function autoKey(order) {
    const lands = order.filter(p => !p.portrait);
    const scored = lands.filter(p => typeof p.sky === 'number');
    return scored.length ? scored.reduce((a, b) => (b.sky > a.sky ? b : a)) : (lands[Math.floor(lands.length / 2)] || order[0]);
  }
  function epicTest(list) {
    const skies = list.filter(x => !x.p.portrait && typeof x.p.sky === 'number').map(x => x.p.sky).sort((a, b) => b - a);
    const thr = skies.length ? skies[Math.max(0, Math.floor(skies.length * 0.3) - 1)] : Infinity;
    return p => !p.portrait && typeof p.sky === 'number' && p.sky >= thr;
  }
  // Shots for one auto chapter, keeping the order: portrait pairs, single cards,
  // one scrapbook page, maybe a collage, and dreamy or epic heroes.
  function planChapter(chunk, c, isEpic) {
    const out = [];
    let i = 0, albumUsed = false, collageUsed = false;
    while (i < chunk.length) {
      const left = chunk.length - i, a = chunk[i], b = chunk[i + 1];
      if (!albumUsed && out.length >= 1 + (c % 2) && left >= 3) { out.push({ type: 'album', ph: chunk.slice(i, i + 3) }); i += 3; albumUsed = true; continue; }
      if (a.p.portrait) {
        if (b && b.p.portrait) { out.push({ type: 'pair', ph: [a, b] }); i += 2; }
        else { out.push({ type: 'card', ph: [a] }); i += 1; }
        continue;
      }
      let run = 0;
      while (i + run < chunk.length && !chunk[i + run].p.portrait) run++;
      if (!collageUsed && out.length >= 2 && run >= 4) { out.push({ type: 'collage', ph: chunk.slice(i, i + 4) }); i += 4; collageUsed = true; continue; }
      out.push({ type: isEpic(a.p) ? 'epic' : 'dream', ph: [a] });
      i += 1;
    }
    return out;
  }
  function nameChapters(chunks) {
    const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    const stats = chunks.map(ch => ({
      lum: avg(ch.filter(x => typeof x.p.lum === 'number').map(x => x.p.lum)),
      sky: avg(ch.filter(x => !x.p.portrait && typeof x.p.sky === 'number').map(x => x.p.sky)),
    }));
    const defs = new Array(chunks.length).fill(null);
    stats.forEach((s, i) => { if (s.lum != null && s.lum < 0.32) defs[i] = AUTO_NIGHT; });
    let best = -1, bestSky = -Infinity;
    stats.forEach((s, i) => { if (!defs[i] && s.sky != null && s.sky > bestSky) { bestSky = s.sky; best = i; } });
    if (best >= 0 && chunks.length >= 3) defs[best] = AUTO_MIST;
    let g = 0;
    defs.forEach((d, i) => { if (!d) defs[i] = AUTO_DEFS[g++ % AUTO_DEFS.length]; });
    return defs;
  }

  // The curated edit, adapted to the photos that are actually here.
  function degrade(s, xs) {
    const n = xs.length;
    const asCard = x => ({ type: x.p.portrait ? 'card' : 'dream', ph: [x], caption: typeof s.caption === 'string' ? { th: s.caption, en: '' } : s.caption, note: s.note });
    if (s.type === 'pair' && n < 2) return [asCard(xs[0])];
    if (s.type === 'album' && n === 1) return [asCard(xs[0])];
    if (s.type === 'album' && n === 2) return [{ type: 'pair', ph: xs, caption: s.title }];
    if (s.type === 'collage' && n < 3) return xs.map(x => ({ type: 'dream', ph: [x] }));
    return [Object.assign({}, s, { ph: xs })];
  }
  function curatedPlan(order) {
    const byNum = new Map(order.map((p, pos) => [p.num, { p, pos }]));
    const keyX = byNum.get(String(EDIT.key));
    if (!keyX) return null;
    const used = new Set([keyX.p]);
    const chapters = [];
    EDIT.chapters.forEach(ch => {
      const shots = [];
      (ch.shots || []).forEach(s => {
        const xs = (s.photos || []).map(n => byNum.get(String(n))).filter(x => x && !used.has(x.p));
        xs.forEach(x => used.add(x.p));
        if (xs.length) shots.push(...degrade(s, xs));
      });
      if (shots.length) chapters.push({ def: { en: ch.en, th: ch.th, mood: ch.mood }, shots });
    });
    const rest = order.map((p, pos) => ({ p, pos })).filter(x => !used.has(x.p));
    if (rest.length) {
      chapters.splice(Math.max(0, chapters.length - 1), 0, { def: EXTRA_DEF, shots: planChapter(rest, chapters.length, epicTest(rest)), auto: true });
    }
    if (!chapters.length) return null;
    const montage = (EDIT.montage || []).map(n => byNum.get(String(n))).filter(Boolean).map(x => x.p);
    return { key: keyX.p, montage: montage.length >= 6 ? montage : order.filter(p => !p.portrait && p !== keyX.p), chapters, finale: EDIT.finale || {} };
  }
  function autoPlan(order) {
    const key = autoKey(order);
    const list = order.map((p, pos) => ({ p, pos })).filter(x => x.p !== key || order.length === 1);
    const isEpic = epicTest(list);
    const C = Math.max(1, Math.min(6, Math.round(list.length / 7.5)));
    const chunks = splitEven(list, C);
    const defs = nameChapters(chunks);
    const lands = list.filter(x => !x.p.portrait).map(x => x.p);
    return {
      key,
      montage: lands.length >= 8 ? lands : list.map(x => x.p),
      chapters: chunks.map((chunk, c) => ({ def: defs[c], shots: planChapter(chunk, c, isEpic), auto: true })),
      finale: {},
    };
  }
  function buildEdit(order) {
    const plan = (state.curated && EDIT && curatedPlan(order)) || autoPlan(order);
    const items = [];
    items.push(Object.assign({ type: 'opener', group: 0, trans: 'cut', photos: [plan.key], dur: 19.4, idx: 0 }, planOpener(plan.montage)));
    let tr = 0, mv = 0, cap = 0, note = 0, pol = 0, side = 0;
    plan.chapters.forEach((ch, c) => {
      let lineGiven = ch.shots.some(s => s.line);
      ch.shots.forEach((s, k) => {
        const it = { type: s.type, photos: s.ph.map(x => x.p), pos: s.ph.map(x => x.pos), group: c + 1, def: ch.def, idx: items.length };
        it.trans = s.trans || (k === 0 ? 'dip-light' : s.type === 'album' ? 'dissolve' : TROT[tr++ % TROT.length]);
        it.dur = s.dur || DUR[s.type];
        if (k === 0) { it.chapter = { num: c + 1, en: ch.def.en, th: ch.def.th }; it.dur += CH_EXTRA + (CARDY[s.type] ? 1.4 : 0); }
        if (s.type === 'epic' || s.type === 'dream') it.move = MROT[mv++ % MROT.length];
        if (s.type === 'card') it.caption = s.caption ? (typeof s.caption === 'string' ? { th: s.caption, en: '' } : s.caption) : CAPTIONS[cap++ % CAPTIONS.length];
        if (s.type === 'pair') it.caption = typeof s.caption === 'string' ? s.caption : (s.caption && s.caption.th) || CAPTIONS[cap++ % CAPTIONS.length].th;
        if (s.type === 'card' || s.type === 'pair') it.side = side++ % 2 ? 'right' : 'left';
        if (s.type === 'album') {
          it.title = s.title || ALBUM_TITLES[c % ALBUM_TITLES.length];
          it.caps = s.caps && s.caps.length >= it.photos.length ? s.caps : it.photos.map(() => POL[pol++ % POL.length]);
        }
        if (s.line) { it.line = s.line; it.dur += LINE_EXTRA + (k === 0 ? 1.2 : 0); }
        else if (!lineGiven && ch.def.line && (s.type === 'epic' || s.type === 'dream') && (k >= 1 || ch.shots.length === 1)) {
          it.line = ch.def.line; it.dur += LINE_EXTRA; lineGiven = true;
        }
        if (s.note) it.note = s.note;
        else if (ch.auto && (s.type === 'epic' || s.type === 'dream') && !it.line && !it.chapter) it.note = NOTES[note++ % NOTES.length];
        it.dust = (s.type === 'epic' || s.type === 'dream' || s.type === 'card') && !(it.photos[0].lum < 0.38) && it.idx % 2 === 1;
        items.push(it);
      });
    });
    const C = plan.chapters.length;
    items.push({ type: 'finale', group: C + 1, trans: 'light', photos: [plan.key], dur: 23.6, idx: items.length, fin: plan.finale });
    return { items, chapters: C, key: plan.key, defs: plan.chapters.map(ch => ch.def) };
  }

  /* =====================================================================
     OVERLAYS — chapter titles, narration, handwritten notes
     ===================================================================== */
  function chapterCard(ctx, align) {
    const { root, tl, item } = ctx;
    const c = item.chapter;
    const sh = shade(root, align === 'center' ? 'center' : 'chapter');
    const el = h('div', 'chap chap--' + align);
    const num = maskRow(el, `Chapter <b>${pad2(c.num)}</b>`, 'chap__num');
    const row = h('div', 'chap__handrow');
    const hand = h('div', 'hand chap__hand', c.th);
    const stk = h('span', 'sticker sticker--inline', `<svg viewBox="0 0 100 100">${STICKER.heart}</svg>`);
    stk._rot = 10;
    row.append(hand, stk);
    el.append(row);
    const en = maskRow(el, c.en, 'chap__en');
    const sw = doodleInline(el, 'squiggle', 'chap__swash');
    tl.append(el);
    const base = align === 'center' ? 'translate(-50%,-50%)' : 'translateY(-50%)';
    ctx.cue(CH_IN + 1.9, () => audio.pop());
    return u => {
      const out = E.sine(ramp(u, CH_OUT, CH_OUT + 0.9));
      op(sh, ramp(u, 0.1, 0.9) * (1 - E.sine(ramp(u, CH_OUT + 0.2, CH_OUT + 1.4))));
      op(el, (u > 0 ? 1 : 0) * (1 - out));
      css(el, 'transform', `${base} translate3d(0,${r2(-out * 16)}px,0)`);
      rise(num, u, CH_IN);
      handWrite(hand, u, CH_IN + 0.25, 1.5);
      rise(en, u, CH_IN + 1.0);
      draw(sw, u, CH_IN + 1.3, 1.1);
      pop(stk, u, CH_IN + 1.9);
    };
  }
  function lineOverlay(ctx) {
    const { root, tl, item } = ctx;
    const sh = shade(root, 'bottom');
    const a = item.chapter ? CH_OUT + 1.1 : 0.9, b = item.dur - 0.25;
    const tb = textBlock(tl, 'line', [{ html: item.line.en, cls: 'line__en' }, { html: item.line.th, cls: 'line__th' }]);
    return u => {
      op(sh, ramp(u, a - 0.4, a + 0.6) * (1 - ramp(u, b, b + 0.9)));
      playText(tb, u, a, b, { stagger: 0.22, dur: 1.5, outDur: 0.9 });
    };
  }
  // A handwritten note with a little star, on a soft warm glow so it always reads.
  function noteBlock(ctx, text, x, y, rot, anchor, a) {
    const { root, tl, item } = ctx;
    const fs = 62, tw = Math.min(900, Array.from(text).length * fs * 0.5);
    const cx = anchor === 'right' ? x - tw / 2 : anchor === 'left' ? x + tw / 2 : x;
    const glow = h('div', 'shade note-shade');
    glow.style.cssText = `inset:auto;left:${r2(cx - tw / 2 - 150)}px;top:${r2(y - 130)}px;width:${r2(tw + 300)}px;height:260px`;
    root.append(glow);
    const wrap = h('div', 'note note--' + anchor);
    wrap.style.left = `${r2(x)}px`;
    wrap.style.top = `${r2(y)}px`;
    wrap.style.setProperty('--rot', `${rot}deg`);
    const hand = h('div', 'hand note__hand', text);
    wrap.append(hand);
    const star = doodle(wrap, 'sparkle', null, null, 46, 0, null, 'note__star');
    tl.append(wrap);
    ctx.cue(a + 1.0, () => audio.twinkle());
    return u => {
      const out = 1 - ramp(u, item.dur - 0.2, item.dur + 0.6);
      op(glow, 0.8 * ramp(u, a - 0.3, a + 0.5) * out);
      op(wrap, out);
      handWrite(hand, u, a, 1.3);
      draw(star, u, a + 1.0, 0.7);
    };
  }
  function overlays(ctx, o = {}) {
    const { item } = ctx;
    const parts = [];
    if (item.chapter) parts.push(chapterCard(ctx, PORT ? 'center' : o.align || 'left'));
    if (item.line) parts.push(lineOverlay(ctx));
    return u => { for (const f of parts) f(u); };
  }

  /* =====================================================================
     COMPOSITIONS — each gets { root, tl, item, n, all, cue } and returns
     { render(u), fx(u) }, u = seconds since the shot began.
     ===================================================================== */
  const MOODS = {
    farm: { glow: 0.32, glowX: 0.86, glowY: 0.1, bokeh: 0.26, stars: 0.16 },
    garden: { petals: 0.44, bokeh: 0.14, glow: 0.24, glowX: 0.8, glowY: 0.12, stars: 0.14 },
    night: { flies: 0.72, bokeh: 0.06, grade: 0.14, fade: 0.08, vignette: 0.3, stars: 0.3 },
    mist: { fog: 0.26, rays: 0.3, bokeh: 0.12, glow: 0.3, glowX: 0.76, glowY: 0.12, stars: 0.12 },
    morning: { glow: 0.36, glowX: 0.82, glowY: 0.1, bokeh: 0.26, petals: 0.12, stars: 0.16 },
  };
  const mood = (item, o = {}, force) => fx(Object.assign({}, o, (item.def && MOODS[item.def.mood]) || {}, force || {}));
  const contentAt = item => (item.chapter ? CH_OUT + 0.35 : 0);

  // COLD OPEN — light streak → location card → flash-cut montage → words →
  // faster cuts → a warm hit → the key-art landscape and the title.
  function compOpener(ctx) {
    const { root, tl, item } = ctx;
    const TA = item.titleAt;
    const streak = h('div', 'streak', '<i></i>');
    root.append(streak);
    const cuts = item.cuts.map(c => Object.assign({}, c, { pb: photoBox(c.photo, root, null, 'pb--cut') }));
    const hero = heroPhoto(item.photos[0], root, 'pb--key');
    const shadeT = shade(root, 'title');
    const card0 = textBlock(tl, 'card card--small', [
      { html: 'Khao Kho · Phetchabun', cls: 'card__en' },
      { html: 'เขาค้อ · เพชรบูรณ์ · ประเทศไทย', cls: 'card__th' },
    ], 'translateY(-50%)');
    const card1 = textBlock(tl, 'card', [{ html: COPY.card1.en, cls: 'card__en' }, { html: COPY.card1.th, cls: 'card__th' }], 'translateY(-50%)');
    const card2 = textBlock(tl, 'card', [{ html: COPY.card2.en, cls: 'card__en' }, { html: COPY.card2.th, cls: 'card__th' }], 'translateY(-50%)');
    const title = textBlock(tl, 'title', [
      { html: 'A Khao Kho Family Film', cls: 'title__eyebrow' },
      { html: lettersHTML('Above the Clouds'), cls: 'title__main' },
      { rule: true, cls: 'title__rule' },
      { html: 'การเดินทางเหนือทะเลหมอก', cls: 'title__th' },
      { html: 'A Family Travel Film · 2026', cls: 'title__foot' },
    ], 'translateY(-50%)');
    const letters = Array.from(title.el.querySelectorAll('.ch'));
    const mid = (letters.length - 1) / 2;
    [
      [0.15, () => audio.whoosh(1.5, 0.09)], [0.9, () => audio.drone(TA - 0.9)], [1.05, () => audio.ping(1174.66, 0.025)],
      [5.1, () => audio.whoosh(0.8, 0.05)], [8.3, () => audio.whoosh(0.8, 0.05)], [9.5, () => audio.riser(TA - 9.5)], [TA, () => audio.hit()],
    ].forEach(([t, fn]) => ctx.cue(t, fn));
    item.cuts.forEach((c, k) => ctx.cue(c.t, () => audio.cut(0.45 + k * 0.04)));
    return {
      render(u) {
        const ks = ramp(u, 0.2, 1.5);
        show(streak, ks > 0 && ks < 1);
        if (ks > 0 && ks < 1) {
          css(streak.firstChild, 'transform', `translate3d(${r2(-0.7 * W + 2.0 * W * E.inOutCubic(ks))}px,0,0)`);
          op(streak, Math.sin(Math.PI * ks));
        }
        playText(card0, u, 1.05, 2.5, { stagger: 0.18, dur: 1.2, outDur: 0.4, zoom: 0.05, zoomDur: 2 });
        playText(card1, u, 5.15, 5.95, { stagger: 0.14, dur: 0.9, outDur: 0.3, zoom: 0.07, zoomDur: 1.3 });
        playText(card2, u, 8.35, 9.15, { stagger: 0.14, dur: 0.9, outDur: 0.3, zoom: 0.07, zoomDur: 1.3 });
        cuts.forEach(c => {
          const vis = u >= c.t && u < c.t + c.d;
          show(c.pb.box, vis);
          if (!vis) return;
          const k = (u - c.t) / c.d;
          css(c.pb.kb, 'transform', `translate3d(${r2(c.dx * (1 - k))}px,${r2(c.dy * (1 - k))}px,0) scale(${r4(1.12 - 0.07 * E.outCubic(k))})`);
        });
        const hv = u >= TA - 0.02;
        show(hero.pb.box, hv);
        if (hero.field) show(hero.field, hv);
        if (hv) {
          const k = E.outCubic(ramp(u, TA, TA + 8));
          css(hero.pb.kb, 'transform', `translate3d(0,${r2(-0.012 * hero.pb.h * k)}px,0) scale(${r4(1.24 - 0.17 * k)})`);
          if (hero.field) css(hero.field, 'transform', `scale(${r4(1.12 - 0.06 * k)})`);
        }
        op(shadeT, hv ? 0.62 * ramp(u, TA + 0.5, TA + 1.8) : 0);
        playText(title, u, TA + 0.75, item.dur - 1.3, { stagger: 0.2, dur: 1.7, outDur: 1.0, zoom: 0.05, zoomDur: 6 });
        letters.forEach((el, i) => {
          const a = TA + 0.95 + Math.abs(i - mid) * 0.05;
          const k = E.outCubic(ramp(u, a, a + 1.4));
          op(el, k);
          css(el, 'filter', k >= 1 ? 'none' : `blur(${r2((1 - k) * 12)}px)`);
          css(el, 'transform', `translate3d(0,${r2((1 - k) * 22)}px,0)`);
        });
      },
      fx(u) {
        let flash = 0;
        for (const c of cuts) if (u >= c.t) flash = Math.max(flash, c.flash * Math.exp(-(u - c.t) / 0.12));
        const on = u >= TA;
        return fx({
          bloom: flash,
          white: on ? 1 - E.outCubic(ramp(u, TA, TA + 1.2)) : 0,
          fog: on ? 0.3 * ramp(u, TA + 0.2, TA + 2.5) : 0, fogLow: 0.95, fogWarm: 0.3,
          glow: on ? 0.32 : 0, glowX: 0.72, glowY: 0.2,
          leak: 0.45 * bump(u, TA + 0.6, 0.55),
          stars: on ? 0.3 : 0, bokeh: on ? 0.16 : 0,
          grade: on ? 0.24 : 0.1, fade: on ? 0.1 : 0, vignette: on ? 0.38 : 0.22, grain: 0.05,
        });
      },
    };
  }

  // EPIC — a landscape across the whole screen, slow camera, light and air.
  function compEpic(ctx) {
    if (PORT) return compDream(ctx);
    const { root, item } = ctx;
    const pb = photoBox(item.photos[0], root, null, '', true);
    const parts = [];
    if (item.note) {
      const right = item.idx % 2 === 0;
      parts.push(noteBlock(ctx, item.note, right ? W - 160 : 160, H * 0.8, right ? -4 : 3, right ? 'right' : 'left', 1.3));
    }
    const dust = item.dust ? dustTrail(root, { x: 0, y: 0, w: W, h: H }, item.idx) : null;
    const ov = overlays(ctx, { align: 'left' });
    const span = item.dur + 2;
    const dustAt = item.chapter ? CH_OUT + 0.6 : 1.4;
    return {
      render(u) {
        kenBurns(pb, item.move, u / span);
        renderGlints(pb.gl, u, 0.6);
        if (dust) renderDust(dust, u, dustAt);
        ov(u);
        parts.forEach(f => f(u));
      },
      fx: () => mood(item, { glow: 0.28, rays: 0.22 }),
    };
  }

  // DREAM — the whole photo, nothing cropped, edges melting into its own colours.
  function compDream(ctx) {
    const { root, item } = ctx;
    const p = item.photos[0];
    const field = fieldOf(p, root);
    const box = PORT ? fitIn(ratioOf(p), W * 0.96, H * 0.6) : fitIn(ratioOf(p), W * 0.86, H * 0.88);
    const cy = PORT ? H * 0.42 : H * 0.5;
    const rect = { x: (W - box.w) / 2, y: cy - box.h / 2, w: box.w, h: box.h };
    const dp = dreamPhoto(p, root, rect);
    const parts = [];
    if (item.note) {
      const right = item.idx % 2 === 0;
      if (PORT) parts.push(noteBlock(ctx, item.note, W / 2, rect.y + rect.h + 110, -2, 'center', 1.3));
      else parts.push(noteBlock(ctx, item.note, right ? rect.x + rect.w - 90 : rect.x + 90, rect.y + rect.h - 120, right ? -4 : 3, right ? 'right' : 'left', 1.3));
    }
    const dust = item.dust ? dustTrail(root, rect, item.idx) : null;
    const ov = overlays(ctx, { align: 'left' });
    const span = item.dur + 2;
    const dustAt = item.chapter ? CH_OUT + 0.6 : 1.4;
    return {
      render(u) {
        const k = u / span;
        css(field, 'transform', `scale(${r4(1.08 + 0.04 * k)})`);
        kenBurns(dp, item.move, k, 0, 0.6);
        css(dp.box, 'transform', `scale(${r4(0.985 + 0.02 * E.outSine(clamp(k)))})`);
        renderGlints(dp.gl, u, 0.6);
        if (dust) renderDust(dust, u, dustAt);
        ov(u);
        parts.forEach(f => f(u));
      },
      fx: () => mood(item, { glow: 0.22 }),
    };
  }

  // PAIR — two photos side by side, washi tape, a heart sticker and a handwritten caption.
  function compPair(ctx) {
    const { root, tl, item } = ctx;
    const [p1, p2] = item.photos;
    const T0 = contentAt(item);
    const field = fieldOf(p1, root);
    const r1 = ratioOf(p1), rr = ratioOf(p2);
    let defs, capY, heart;
    if (!PORT) {
      const gap = 92, Hc = Math.min(H * 0.66, (W * 0.84 - gap) / (r1 + rr));
      const w1 = Hc * r1, w2 = Hc * rr, x0 = (W - (w1 + w2 + gap)) / 2, cy = H * 0.455;
      defs = [
        { p: p1, rect: { x: x0, y: cy - Hc / 2 - 10, w: w1, h: Hc }, rot: -2.4, dx: -70 },
        { p: p2, rect: { x: x0 + w1 + gap, y: cy - Hc / 2 + 12, w: w2, h: Hc }, rot: 2.0, dx: 70 },
      ];
      capY = cy + Hc / 2 + 80;
      heart = [x0 + w1 + gap / 2, cy + Hc * 0.28, 104];
    } else {
      const Hc = Math.min(H * 0.34, (W * 0.74) / Math.max(r1, rr));
      const w1 = Hc * r1, w2 = Hc * rr;
      defs = [
        { p: p1, rect: { x: W * 0.4 - w1 / 2, y: H * 0.27 - Hc / 2, w: w1, h: Hc }, rot: -3, dx: -60 },
        { p: p2, rect: { x: W * 0.6 - w2 / 2, y: H * 0.6 - Hc / 2, w: w2, h: Hc }, rot: 2.6, dx: 60 },
      ];
      capY = H * 0.86;
      heart = [W * 0.5, H * 0.44, 124];
    }
    const cards = defs.map((d, j) => {
      const card = softCard(d.p, root, d.rect, { aura: true });
      const tp = tape(card.el, TAPES[(item.idx + j) % TAPES.length], 'left:50%;top:-18px', j ? 5 : -6);
      const dd = j === 0 ? doodle(card.el, 'sparkle', -24, -16, 66, -8, '#ffe3a6') : doodle(card.el, 'star', d.rect.w + 28, d.rect.h - 36, 60, 10, '#ffe3a6');
      return Object.assign(d, { card, tp, dd });
    });
    const hs = sticker(root, 'heart', heart[0], heart[1], heart[2], -8);
    const cap = h('div', 'hand paircap', item.caption);
    cap.style.top = `${r2(capY)}px`;
    tl.append(cap);
    const ov = overlays(ctx, { align: 'center' });
    ctx.cue(T0 + 1.95, () => audio.pop());
    return {
      render(u) {
        const k0 = u / (item.dur + 2);
        css(field, 'transform', `scale(${r4(1.12 + 0.04 * k0)})`);
        cards.forEach((c, j) => {
          const a = T0 + 0.15 + j * 0.35;
          const kin = E.outQuart(ramp(u, a, a + 1.6));
          const sway = Math.sin(u * 0.6 + j * 2) * 0.35 * kin;
          op(c.card.el, ramp(u, a, a + 0.8));
          css(c.card.el, 'transform', `translate3d(${r2(c.dx * (1 - kin))}px,${r2(30 * (1 - kin))}px,0) rotate(${r2(c.rot + (1 - kin) * (j ? 6 : -6) + sway)}deg)`);
          kenBurns(c.card, 'settle', ramp(u, a, a + 3.4));
          sheenSweep(c.card.sheen, u, a + 1.4);
          renderGlints(c.card.gl, u, a + 1);
          popTape(c.tp, u, a + 0.95);
          draw(c.dd, u, T0 + 2.2 + j * 0.3, 0.9);
        });
        pop(hs, u, T0 + 1.95);
        handWrite(cap, u, T0 + 2.0, 1.5, 1 - ramp(u, item.dur - 0.2, item.dur + 0.6));
        ov(u);
      },
      fx: () => mood(item, {}),
    };
  }

  // CARD — one photo on a soft card, a caption column in handwriting and serif.
  function compCard(ctx) {
    const { root, tl, item } = ctx;
    const p = item.photos[0], r = ratioOf(p);
    const T0 = contentAt(item);
    const field = fieldOf(p, root);
    const left = item.side === 'left';
    let rect, col;
    if (!PORT) {
      const hh = r >= 1 ? Math.min(H * 0.62, (W * 0.5) / r) : H * 0.76;
      const w = hh * r, cx = left ? W * 0.385 : W * 0.615;
      rect = { x: cx - w / 2, y: (H - hh) / 2, w, h: hh };
      col = h('div', 'capcol capcol--' + (left ? 'l' : 'r'));
      if (left) col.style.left = `${r2(rect.x + w + 110)}px`;
      else col.style.right = `${r2(W - rect.x + 110)}px`;
    } else {
      const f = fitIn(r, W * 0.8, H * 0.52);
      rect = { x: (W - f.w) / 2, y: H * 0.38 - f.h / 2, w: f.w, h: f.h };
      col = h('div', 'capcol capcol--c');
      col.style.top = `${r2(rect.y + f.h + 100)}px`;
    }
    const card = softCard(p, root, rect, { aura: true });
    const tp = tape(card.el, TAPES[item.idx % TAPES.length], left ? 'left:84%;top:-12px' : 'left:16%;top:-12px', left ? 32 : -32);
    const stk = sticker(card.el, item.idx % 2 ? 'star' : 'heart', left ? 22 : rect.w - 22, rect.h - 22, 100, left ? -12 : 12);
    const idx = maskRow(col, `${item.def ? item.def.en : 'Our trip'} <span>· Khao Kho</span>`, 'capcol__idx');
    const hand = h('div', 'hand capcol__hand', item.caption.th);
    col.append(hand);
    const en = item.caption.en ? maskRow(col, item.caption.en, 'capcol__en') : null;
    const dd = doodleInline(col, item.idx % 2 ? 'sparkle' : 'heart', 'capcol__doodle');
    tl.append(col);
    const dust = item.dust ? dustTrail(card.el, { x: 0, y: 0, w: rect.w, h: rect.h }, item.idx) : null;
    const ov = overlays(ctx, { align: 'center' });
    const capIn = T0 + 1.5;
    ctx.cue(T0 + 2.3, () => audio.pop());
    return {
      render(u) {
        const k = u / (item.dur + 2);
        css(field, 'transform', `translate3d(${r2((left ? -1 : 1) * 20 * k)}px,0,0) scale(${r4(1.1 + 0.04 * k)})`);
        const a = T0 + 0.1;
        const kin = E.outQuart(ramp(u, a, a + 1.7));
        const sway = Math.sin(u * 0.55) * 0.3 * kin;
        op(card.el, ramp(u, a, a + 0.9));
        css(card.el, 'transform', `translate3d(${r2((1 - kin) * (left ? -60 : 60))}px,${r2((1 - kin) * 24)}px,0) rotate(${r2((left ? -1.6 : 1.6) + (1 - kin) * (left ? -5 : 5) + sway)}deg)`);
        kenBurns(card, 'settle', ramp(u, a, a + 3.6));
        sheenSweep(card.sheen, u, a + 1.3);
        renderGlints(card.gl, u, a + 1);
        popTape(tp, u, a + 1.0);
        pop(stk, u, T0 + 2.3);
        if (dust) renderDust(dust, u, T0 + 2.6, 2.4);
        op(col, 1 - ramp(u, item.dur - 0.2, item.dur + 0.6));
        rise(idx, u, capIn);
        handWrite(hand, u, capIn + 0.2, 1.4);
        if (en) rise(en, u, capIn + 0.9);
        draw(dd, u, capIn + 1.3, 1.0);
        ov(u);
      },
      fx: () => mood(item, { vignette: 0.26 }),
    };
  }

  // ALBUM — a scrapbook page: three polaroids drop in, tape, handwriting, doodles, stickers.
  function compAlbum(ctx) {
    const { root, tl, item } = ctx;
    const T0 = contentAt(item);
    root.append(h('div', 'paper'));
    const ph = item.photos;
    let Hp, centers, rots;
    if (!PORT) {
      const gap = 74, sumR = ph.reduce((s, p) => s + ratioOf(p), 0);
      Hp = Math.min(H * 0.48, (W * 0.84 - gap * (ph.length - 1) - ph.length * 2 * POL_SIDE) / sumR);
      const widths = ph.map(p => Hp * ratioOf(p) + 2 * POL_SIDE);
      const total = widths.reduce((s, w) => s + w, 0) + gap * (ph.length - 1);
      let x = (W - total) / 2;
      const yOff = [-14, 26, -2];
      centers = widths.map((w, j) => { const c = [x + w / 2, H * 0.575 + yOff[j % 3]]; x += w + gap; return c; });
      rots = [-4, 2.6, -1.8];
    } else {
      // stacked down the page with room for every caption
      Hp = Math.min(H * 0.24 - POL_TOP - POL_BOT - 26, ...ph.map(p => (W * 0.62 - 2 * POL_SIDE) / ratioOf(p)));
      centers = [[W * 0.39, H * 0.3], [W * 0.61, H * 0.54], [W * 0.41, H * 0.78]];
      rots = [-4, 3, -2.2];
    }
    const pols = ph.map((p, j) => polaroid(root, p, Hp * ratioOf(p), Hp, centers[j][0], centers[j][1], rots[j % 3], item.caps[j], TAPES[(item.idx + j) % TAPES.length]));
    const tY = PORT ? H * 0.12 : H * 0.14;
    const title = h('div', 'hand albumtitle', item.title);
    title.style.top = `${r2(tY)}px`;
    tl.append(title);
    const sq = doodle(root, 'squiggle', W / 2, tY + (PORT ? 74 : 62), PORT ? 320 : 280, 0, '#d4a373');
    const [q0, q1, q2] = [pols[0], pols[1], pols[pols.length - 1]];
    const deco = [
      doodle(root, 'heart', q0.cx + q0.w / 2 + 34, q0.cy - q0.h / 2 - 8, 74, 12, '#e98aa5'),
      doodle(root, 'sparkle', q2.cx + q2.w / 2 + 30, q2.cy - q2.h / 2 + 34, 62, 0, '#d4a373'),
      doodle(root, 'sparkle', q2.cx + q2.w / 2 + 70, q2.cy - q2.h / 2 + 86, 38, 0, '#d4a373'),
    ];
    if (!PORT && pols.length > 1) deco.push(doodle(root, 'arrow', q1.cx - q1.w / 2 - 44, q1.cy - q1.h / 2 - 70, 112, 20, '#9fb8d8'));
    const stks = [sticker(q1.el, 'heart', q1.w - 18, q1.h - 34, 96, 12), sticker(q2.el, 'star', 12, 22, 84, -14)];
    stks.forEach((s, j) => ctx.cue(T0 + 3.3 + j * 0.35, () => audio.pop()));
    const D = item.dur;
    return {
      render(u) {
        const out = 1 - ramp(u, D - 0.2, D + 0.6);
        pols.forEach((pl, j) => {
          const a = T0 + 0.4 + j * 0.45;
          const k = E.outQuart(ramp(u, a, a + 1.3));
          const sway = Math.sin(u * 0.7 + j * 1.9) * 0.35 * k;
          op(pl.el, ramp(u, a, a + 0.5));
          css(pl.el, 'transform', `translate3d(0,${r2(-150 * (1 - k))}px,0) rotate(${r2(pl.rot + 10 * (1 - k) * (j % 2 ? -1 : 1) + sway)}deg) scale(${r4(1.06 - 0.06 * k)})`);
          kenBurns(pl, 'settle', ramp(u, a, a + 3.2));
          sheenSweep(pl.sheen, u, a + 1.6);
          renderGlints(pl.gl, u, a + 1);
          popTape(pl.tape, u, a + 1.0);
          handWrite(pl.cap, u, a + 1.3, 1.0);
        });
        handWrite(title, u, T0 + 0.5, 1.4, out);
        draw(sq, u, T0 + 1.6, 0.9);
        deco.forEach((d, j) => draw(d, u, T0 + 2.4 + j * 0.3, 0.9));
        stks.forEach((s, j) => pop(s, u, T0 + 3.3 + j * 0.35));
      },
      fx: () => mood(item, {}, { grade: 0.08, fade: 0.04, vignette: 0.12, glow: 0.12, rays: 0, fog: 0, bokeh: 0.1, flies: 0 }),
    };
  }

  // COLLAGE — three or four soft prints scattered; the last one opens up.
  function compCollage(ctx) {
    const { root, item } = ctx;
    const T0 = contentAt(item);
    const L = PORT
      ? (item.photos.length >= 4 ? [[0.42, 0.2, -3], [0.58, 0.4, 2.4], [0.42, 0.6, -2], [0.58, 0.8, 2.8]] : [[0.4, 0.25, -3], [0.6, 0.5, 2.4], [0.42, 0.75, -2]])
      : (item.photos.length >= 4 ? [[0.3, 0.29, -2.5], [0.7, 0.31, 2], [0.31, 0.71, 1.6], [0.69, 0.69, -2.2]] : [[0.27, 0.32, -2.6], [0.73, 0.36, 2.2], [0.5, 0.7, -1.2]]);
    const ph = item.photos.slice(0, L.length);
    const lastP = ph[ph.length - 1];
    const field = fieldOf(lastP, root);
    const cyC = PORT ? H * 0.45 : H * 0.5;
    const big = PORT ? fitIn(ratioOf(lastP), W * 0.9, H * 0.5) : fitIn(ratioOf(lastP), W * 0.8, H * 0.82);
    const cw = PORT ? W * 0.72 : W * 0.37, chh = PORT ? H * 0.2 : H * 0.37;
    const cells = ph.map((p, j) => {
      const f = fitIn(ratioOf(p), cw, chh);
      const isLast = j === ph.length - 1;
      const w = isLast ? big.w : f.w, hh = isLast ? big.h : f.h;
      const card = softCard(p, root, { x: W / 2 - w / 2, y: cyC - hh / 2, w, h: hh }, { cls: 'sc--small' });
      return { card, isLast, s0: isLast ? f.w / big.w : 1, tx: L[j][0] * W - W / 2, ty: L[j][1] * H - cyC, rot: L[j][2] };
    });
    const ov = overlays(ctx, { align: 'center' });
    const eA = item.dur - 2.6, eB = item.dur - 0.9;
    return {
      render(u) {
        const k0 = u / (item.dur + 2);
        css(field, 'transform', `scale(${r4(1.1 + 0.04 * k0)})`);
        const ke = E.inOutCubic(ramp(u, eA, eB));
        cells.forEach((c, j) => {
          const a = T0 + 0.15 + j * 0.4;
          const kin = E.outQuart(ramp(u, a, a + 1.5));
          const e = c.isLast ? ke : 0;
          const sc = c.isLast ? lerp(c.s0, 1, e) : 1;
          op(c.card.el, ramp(u, a, a + 0.8) * (c.isLast ? 1 : 1 - E.sine(ramp(u, eA, eA + 1.2))));
          css(c.card.el, 'zIndex', c.isLast ? '3' : '1');
          css(c.card.el, 'transform', `translate3d(${r2(c.tx * (1 - e))}px,${r2(c.ty * (1 - e) + (1 - kin) * 70)}px,0) rotate(${r2(c.rot * (1 - e) + (1 - kin) * (j % 2 ? 5 : -5))}deg) scale(${r4(sc * (0.97 + 0.03 * kin))})`);
          kenBurns(c.card, j % 2 ? 'pull' : 'push', k0, 0, 0.6);
          sheenSweep(c.card.sheen, u, a + 1.2);
          renderGlints(c.card.gl, u, a + 1);
        });
        ov(u);
      },
      fx: () => mood(item, {}),
    };
  }

  // FINALE — the key art again, the closing line, then every photograph
  // flies in to form a heart: it beats once, and the family's words appear.
  // Grid points filling the classic parametric heart (deep cleft, clear lobes).
  // Heart units: x ∈ [-0.94, 0.94], y ∈ [-1, 0.7], centre of the box at y = -0.15.
  const HEART = (() => {
    const poly = [];
    for (let i = 0; i < 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      poly.push([(16 * Math.pow(Math.sin(t), 3)) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]);
    }
    return poly;
  })();
  function insideHeart(x, y) {
    let c = false;
    for (let i = 0, j = HEART.length - 1; i < HEART.length; j = i++) {
      const [xi, yi] = HEART[i], [xj, yj] = HEART[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function heartPoints(n) {
    const grid = s => {
      const pts = [], K = Math.ceil(1.2 / s) + 1;
      for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) {
        const x = i * s, y = -0.15 + j * s;
        if (insideHeart(x, y)) pts.push([x, y]);
      }
      return pts;
    };
    let lo = 0.04, hi = 0.6, best = grid(lo);
    for (let it = 0; it < 28; it++) {
      const s = (lo + hi) / 2, pts = grid(s);
      if (pts.length >= n) { lo = s; best = pts; } else hi = s;
    }
    return { pts: best, s: lo };
  }
  function compFinale(ctx) {
    const { root, tl, item } = ctx;
    const all = ctx.all, D = item.dur, fin = item.fin || {};
    const hero = heroPhoto(item.photos[0], root, 'pb--key');
    const lineSh = shade(root, 'bottom');
    const endLine = fin.line || COPY.end;
    const line = textBlock(tl, 'line', [{ html: endLine.en, cls: 'line__en' }, { html: endLine.th, cls: 'line__th' }]);
    const stage = h('div', 'heart-stage');
    const glow = h('div', 'heart-glow');
    const tilesEl = h('div', 'heart-tiles');
    stage.append(glow, tilesEl);
    root.append(stage);
    const HS = PORT ? Math.min(W * 0.8, H * 0.4) : H * 0.7;          // heart height in px
    const hx = PORT ? W / 2 : W * 0.31, hy = PORT ? H * 0.34 : H * 0.5;
    const { pts, s } = heartPoints(Math.max(all.length, 64));       // enough tiles for a crisp shape
    const unit = HS / 1.72, size = s * unit * 0.9;
    tilesEl.style.transformOrigin = `${r2(hx)}px ${r2(hy)}px`;
    glow.style.cssText = `left:${r2(hx - HS * 0.8)}px;top:${r2(hy - HS * 0.75)}px;width:${r2(HS * 1.6)}px;height:${r2(HS * 1.5)}px`;
    const n = all.length;
    const stride = [7, 11, 13, 17, 5, 3, 1].find(v => gcd(v, n) === 1) || 1;
    const rnd = rng(4242);
    const A0 = 5.4, SPAN = 3.4;
    const ranked = pts.slice().sort((a, b) => a[1] - b[1]);       // from the bottom tip upward
    const tiles = ranked.map((pt, rank) => {
      const photo = all[(rank * stride) % n];
      const el = h('div', 'tile');
      const x = hx + pt[0] * unit, y = hy - (pt[1] + 0.15) * unit;
      el.style.cssText = `left:${r2(x - size / 2)}px;top:${r2(y - size / 2)}px;width:${r2(size)}px;height:${r2(size)}px`;
      const im = imgEl(photo, 'nodecode');
      const f = focusOf(photo);
      im.style.objectPosition = `${f[0]}% ${f[1]}%`;
      el.append(im);
      tilesEl.append(el);
      return { el, a: A0 + (rank / ranked.length) * SPAN + rnd() * 0.25, dx: (rnd() - 0.5) * W * 0.9, dy: H * 0.55 + rnd() * H * 0.45, srot: (rnd() - 0.5) * 70, rot: (rnd() - 0.5) * 6, ph: rnd() * 6.28 };
    });
    const HB = A0 + SPAN + 1.75;
    const txt = h('div', 'fin' + (PORT ? ' fin--port' : ''));
    if (PORT) txt.style.top = `${r2(hy + HS * 0.55 + 50)}px`;
    else { txt.style.left = `${r2(W * 0.555)}px`; txt.style.transform = 'translateY(-50%)'; }
    const row = h('div', 'fin__handrow');
    const fh = h('div', 'hand fin__hand', fin.hand || COPY.heart);
    row.append(fh);
    const fd = doodleInline(row, 'heart', 'fin__heart');
    txt.append(row);
    const ft = maskRow(txt, 'Above <em>the</em> Clouds', 'fin__title');
    const fr = h('div', 'fin__rule');
    txt.append(fr);
    const fm = maskRow(txt, 'Khao Kho · Phetchabun · 2026', 'fin__meta');
    const fth = maskRow(txt, fin.thanks || COPY.thanks, 'fin__th');
    tl.append(txt);
    const sts = [
      sticker(stage, 'heart', hx + 0.8 * unit, hy - 0.92 * unit, PORT ? 130 : 112, 12),
      sticker(stage, 'star', hx - 1.04 * unit, hy - 0.3 * unit, PORT ? 104 : 90, -14),
      sticker(stage, 'cloud', hx + 0.58 * unit, hy + 0.72 * unit, PORT ? 112 : 98, 8),
    ];
    ctx.cue(HB, () => audio.chime());
    sts.forEach((st, i) => ctx.cue(HB + 0.3 + i * 0.25, () => audio.pop()));
    return {
      render(u) {
        const aOn = u < 7.6;
        show(hero.pb.box, aOn);
        if (hero.field) show(hero.field, aOn);
        if (aOn) css(hero.pb.kb, 'transform', `scale(${r4(1.1 - 0.06 * clamp(u / 7))})`);
        op(lineSh, ramp(u, 0.6, 1.4) * (1 - ramp(u, 4.3, 5.3)));
        playText(line, u, 0.9, 4.5, { stagger: 0.24, dur: 1.6, outDur: 0.9 });
        const sOn = u >= 4.6;
        show(stage, sOn);
        if (!sOn) { op(txt, 0); return; }
        op(stage, E.sine(ramp(u, 4.6, 6.4)));
        const beat = 1 + 0.05 * bump(u, HB + 0.16, 0.11) + 0.025 * bump(u, HB + 0.46, 0.1);
        const cam = 1 + 0.035 * E.sine(ramp(u, HB, D - 2));
        css(tilesEl, 'transform', `scale(${r4(beat * cam)})`);
        op(glow, 0.3 + 0.5 * ramp(u, HB - 0.7, HB + 0.3) + 0.12 * Math.sin(u * 1.4) * ramp(u, HB, HB + 1));
        tiles.forEach(t => {
          const vis = u >= t.a;
          show(t.el, vis);
          if (!vis) return;
          const k = E.outQuart(ramp(u, t.a, t.a + 1.7));
          const bob = Math.sin(u * 1.1 + t.ph) * 2.2 * k;
          op(t.el, ramp(u, t.a, t.a + 0.5));
          css(t.el, 'transform', `translate3d(${r2(t.dx * (1 - k))}px,${r2(t.dy * (1 - k) + bob)}px,0) rotate(${r2(t.srot * (1 - k) + t.rot)}deg) scale(${r4(0.55 + 0.45 * k)})`);
        });
        sts.forEach((st, i) => pop(st, u, HB + 0.3 + i * 0.25));
        op(txt, 1);
        handWrite(fh, u, HB + 0.5, 1.5);
        draw(fd, u, HB + 1.9, 1.0);
        rise(ft, u, HB + 1.0, 1.5);
        css(fr, 'transform', `scaleX(${r4(E.inOutCubic(ramp(u, HB + 1.5, HB + 2.6)))})`);
        rise(fm, u, HB + 1.7);
        rise(fth, u, HB + 2.2, 1.5);
      },
      fx(u) {
        const st = ramp(u, 4.6, 6.4);
        return fx({
          glow: 0.3 * (1 - st) + 0.24 * st, glowX: 0.72, glowY: 0.18, rays: 0.2 * (1 - st),
          bokeh: 0.14 + 0.3 * st, flies: 0.3 * st, stars: 0.42 * st, petals: 0.3 * ramp(u, HB, HB + 2),
          bloom: 0.24 * bump(u, HB + 0.18, 0.22), leak: 0.3 * bump(u, HB + 0.3, 0.5),
          fog: 0.16 * (1 - st), grade: 0.18, fade: 0.06, vignette: 0.2 * (1 - st) + 0.08 * st,
          white: E.sine(ramp(u, D - 4.6, D - 2.6)) * (1 - ramp(u, D - 2.2, D - 0.4)),
          black: E.sine(ramp(u, D - 2.2, D - 0.4)),
        });
      },
    };
  }

  const COMP = { opener: compOpener, epic: compEpic, dream: compDream, pair: compPair, card: compCard, album: compAlbum, collage: compCollage, finale: compFinale };

  /* =====================================================================
     ENGINE
     ===================================================================== */
  const app = $('app');
  const stage = $('stage');
  const canvasRoot = $('canvasRoot');
  const scenesEl = $('scenes');
  const titlesEl = $('titles');
  const fxEls = {
    glow: $('fxGlow'), rays: $('fxRays'), leak: $('fxLeak'), bloom: $('fxBloom'), fade: $('fxFade'), grade: $('fxGrade'),
    vignette: $('fxVignette'), grain: $('fxGrain'), black: $('fxBlack'), white: $('fxWhite'), fogCss: $('fxFogCss'),
  };
  const fog = new FogRenderer($('fxFog'));
  if (!fog.ok) { $('fxFog').hidden = true; fxEls.fogCss.hidden = false; }
  const particles = new Particles($('fxParticles'));

  function computeDims() {
    const vw = innerWidth || stage.clientWidth, vh = innerHeight || stage.clientHeight;
    const a = vw / vh;
    return a >= 1
      ? { w: Math.round(BASE * Math.min(a, 2.4)), h: BASE, vw, vh }
      : { w: BASE, h: Math.round(BASE / Math.max(a, 0.42)), vw, vh };
  }
  function applyScale() {
    const { vw, vh } = computeDims();
    const s = Math.max(vw / W, vh / H);                       // always fill the screen
    canvasRoot.style.transform = `translate(${r2((vw - W * s) / 2)}px,${r2((vh - H * s) / 2)}px) scale(${r4(s)})`;
  }
  function setGeometry() {
    const d = computeDims();
    W = d.w; H = d.h; PORT = H > W;
    canvasRoot.style.width = W + 'px';
    canvasRoot.style.height = H + 'px';
    canvasRoot.classList.toggle('is-portrait', PORT);
    fog.resize();
    particles.resize();
    applyScale();
  }

  function rebuild(resetT) {
    setGeometry();
    scenesEl.innerHTML = '';
    titlesEl.innerHTML = '';
    const n = state.order.length;
    if (!n) return;
    const prevTotal = state.total;
    const { items, chapters, key, defs } = buildEdit(state.order);
    state.items = items;
    state.starts = [];
    let acc = 0;
    items.forEach(it => { state.starts.push(acc); acc += it.dur; });
    state.durs = items.map(it => it.dur);
    state.total = acc;
    state.keyPos = state.order.indexOf(key);
    state.scoreStart = items[0].titleAt + 0.7;
    state.groups = [];
    for (let gi = 0; gi < chapters + 2; gi++) {
      const idx = items.map((it, i) => (it.group === gi ? i : -1)).filter(i => i >= 0);
      if (!idx.length) continue;
      const startT = state.starts[idx[0]], last = idx[idx.length - 1];
      const ch = gi >= 1 && gi <= chapters ? defs[gi - 1] : null;
      state.groups.push({ gi, start: startT, dur: state.starts[last] + state.durs[last] - startT, items: idx, chapter: ch });
    }
    state.photoItem = new Array(n).fill(-1);
    items.forEach((it, i) => (it.pos || []).forEach(p => { if (state.photoItem[p] < 0) state.photoItem[p] = i; }));
    if (state.keyPos >= 0 && state.photoItem[state.keyPos] < 0) state.photoItem[state.keyPos] = 0;
    state.cues = [];
    state.scenes = items.map((item, i) => {
      const root = h('div', 'scene');
      const cam = h('div', 'cam');
      const tl = h('div', 'scene');
      root.style.zIndex = String(i + 1);
      root.append(cam);
      scenesEl.append(root);
      titlesEl.append(tl);
      const cues = [];
      const api = COMP[item.type]({ root: cam, tl, item, n, all: state.order, cue: (t, fn) => cues.push({ t, fn }) });
      cues.forEach(c => state.cues.push({ t: state.starts[i] + c.t, fn: c.fn }));
      return Object.assign({ root, cam, tl, item, visible: false, imgs: Array.from(cam.querySelectorAll('img:not(.nodecode)')) }, api);
    });
    state.cues.sort((a, b) => a.t - b.t);
    state.warmed = new Set();
    if (resetT) state.t = 0;
    else if (prevTotal > 1) state.t = clamp(state.t * (state.total / prevTotal), 0, state.total - 0.01);
    state.lastItem = itemAt(state.t);
    if (state.playing) { state.baseT = state.t; state.baseNow = performance.now(); }
    state.dirty = true;
    buildGallery();
  }

  function itemAt(t) {
    const s = state.starts;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m] <= t) lo = m; else hi = m - 1; }
    return lo;
  }
  function groupAt(t) {
    let g = 0;
    while (g < state.groups.length - 1 && t >= state.groups[g + 1].start) g++;
    return g;
  }

  // Decode a shot's photographs off the main thread shortly before it starts.
  function warm(i) {
    if (!state.scenes[i] || state.warmed.has(i)) return;
    state.warmed.add(i);
    state.scenes[i].imgs.forEach(img => { if (img.decode) img.decode().catch(() => {}); });
  }
  function warmAround(t) {
    const i = itemAt(t), u = t - state.starts[i];
    warm(i);
    if (state.durs[i] - u < 3.5) warm((i + 1) % state.scenes.length);
    if (i === 0) for (let k = 1; k < 3; k++) warm(k);
    if (state.warmed.size > 6) for (const k of state.warmed) if (k < i - 1 || k > i + 2) state.warmed.delete(k);
  }

  /* Transitions between shots (named on the incoming shot). */
  const TD = { cut: 0.05, dissolve: 1.4, 'soft-wipe': 1.6, light: 1.7, drift: 1.5, 'dip-light': 2.0 };
  const FX0 = {
    grade: 0.22, fade: 0.12, glow: 0, glowX: 0.72, glowY: 0.18, rays: 0, leak: 0, bloom: 0,
    fog: 0, fogLow: 0.85, fogWarm: 0.3, grain: 0.035, vignette: 0.22, black: 0, white: 0,
    bokeh: 0.14, petals: 0, flies: 0, stars: 0,
  };
  const fx = o => Object.assign({}, FX0, o);
  const mixFx = (a, b, k) => { const o = {}; for (const key in FX0) o[key] = lerp(a[key], b[key], k); return o; };

  function renderAt(t) {
    if (!state.scenes.length) return;
    const i = itemAt(t), u = t - state.starts[i];
    const it = state.items[i];
    const td = TD[it.trans] || 0;
    state.scenes.forEach((s, k) => {
      const vis = k === i || (k === i - 1 && u < td);
      if (vis !== s.visible) {
        s.root.classList.toggle('is-visible', vis);
        s.tl.classList.toggle('is-visible', vis);
        s.visible = vis;
      }
      if (!vis) return;
      s.render(t - state.starts[k]);
      css(s.root, 'transform', 'none');
      setMask(s.root, 'none');
      op(s.root, 1);
    });
    let f = state.scenes[i].fx(u);
    if (i > 0 && u < td) {
      const p = u / td, prev = state.scenes[i - 1], cur = state.scenes[i];
      f = mixFx(prev.fx(u + state.durs[i - 1]), f, E.sine(p));
      switch (it.trans) {
        case 'dissolve':
          op(cur.root, E.sine(p));
          break;
        case 'light':
          op(cur.root, E.sine(p));
          f.leak = Math.max(f.leak, 0.62 * Math.sin(Math.PI * p));
          f.bloom += 0.22 * Math.pow(Math.sin(Math.PI * p), 2);
          break;
        case 'soft-wipe': {
          const k = E.sine(p), dir = i % 2 ? 90 : 270;
          setMask(cur.root, `linear-gradient(${dir}deg, #000 ${r2(k * 140 - 40)}%, transparent ${r2(k * 140)}%)`);
          break;
        }
        case 'drift': {
          const k = E.inOutCubic(p);
          css(cur.root, 'transform', `translate3d(${r2((1 - k) * W * 0.06)}px,0,0)`);
          op(cur.root, E.sine(p));
          css(prev.root, 'transform', `translate3d(${r2(-k * W * 0.025)}px,0,0)`);
          break;
        }
        case 'dip-light':
          op(cur.root, p < 0.5 ? 0 : 1);
          f.white = Math.max(f.white, p < 0.5 ? E.sine(p / 0.5) : 1 - E.sine((p - 0.5) / 0.5));
          f.bloom += 0.15 * Math.sin(Math.PI * p);
          break;
        default: break;
      }
    }
    applyFx(f, t);
  }

  function applyFx(f, t) {
    const o = n => String(r4(clamp(n)));
    css(fxEls.grade, 'opacity', o(f.grade));
    css(fxEls.fade, 'opacity', o(f.fade));
    css(fxEls.glow, 'opacity', o(f.glow));
    if (f.glow > 0.001) css(fxEls.glow, 'transform', `translate3d(${r2(f.glowX * W)}px,${r2(f.glowY * H)}px,0)`);
    css(fxEls.rays, 'opacity', o(f.rays));
    if (f.rays > 0.001) css(fxEls.rays, 'transform', `rotate(${r2(Math.sin(t * 0.1) * 3)}deg)`);
    css(fxEls.leak, 'opacity', o(f.leak));
    if (f.leak > 0.001) css(fxEls.leak, 'transform', `translate3d(${r2(Math.sin(t * 0.6) * W * 0.1)}px,${r2(Math.cos(t * 0.45) * H * 0.05)}px,0) rotate(${r2((t * 5) % 360)}deg)`);
    css(fxEls.bloom, 'opacity', o(f.bloom));
    css(fxEls.vignette, 'opacity', o(f.vignette));
    css(fxEls.grain, 'opacity', o(f.grain));
    if (f.grain > 0.001) {
      const s = Math.floor(t * 12);
      css(fxEls.grain, 'transform', `translate3d(${(s * 37) % 160 - 80}px,${(s * 61) % 160 - 80}px,0)`);
    }
    css(fxEls.black, 'opacity', o(f.black));
    css(fxEls.white, 'opacity', o(f.white));
    particles.draw(t, f);
    const fp = { amount: clamp(f.fog), low: f.fogLow, warm: f.fogWarm };
    if (fog.ok) fog.draw(t, fp);
    else {
      css(fxEls.fogCss, 'opacity', o(fp.amount * 0.9));
      const [a, b] = fxEls.fogCss.children;
      css(a, 'transform', `translate3d(${r2(-(t * 14) % W)}px,${r2(60 * fp.low)}px,0)`);
      css(b, 'transform', `translate3d(${r2(((t * 9) % W) - W / 2)}px,${r2(120 * fp.low)}px,0) scaleY(-1)`);
    }
  }

  /* ---------------------------------------------------------------------
     Playback
     --------------------------------------------------------------------- */
  function play() {
    if (!state.scenes.length) return;
    state.playing = true;
    state.baseT = state.t;
    state.baseNow = performance.now();
    audio.onPlay(state.t);
    pokeIdle();
  }
  function pause() {
    state.playing = false;
    audio.onPause();
    pokeIdle();
  }
  function toggle(withGlyph = true) {
    audio.unlock();
    if (state.playing) pause(); else play();
    if (withGlyph) flashGlyph(state.playing ? 'play' : 'pause');
  }
  function seek(t) {
    const T = state.total;
    state.t = ((t % T) + T) % T;
    state.lastItem = itemAt(state.t);
    if (state.playing) { state.baseT = state.t; state.baseNow = performance.now(); }
    audio.onSeek(state.t, state.playing);
    state.dirty = true;
  }
  function prevChapter() {
    const g = groupAt(state.t), G = state.groups[g];
    seek(state.t - G.start > 2 || g === 0 ? G.start : state.groups[g - 1].start);
  }
  function nextChapter() {
    const g = groupAt(state.t);
    seek(g < state.groups.length - 1 ? state.groups[g + 1].start : 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!state.ready) return;
    if (state.playing) {
      const prevT = state.t;
      let t = state.baseT + (now - state.baseNow) / 1000;
      let wrapped = false;
      if (t >= state.total) {
        if (state.recording) {                               // the film is over: stop the recording on black
          state.t = state.total - 0.001;
          renderAt(state.t);
          finishRecording();
          pause();
          return;
        }
        t = t % state.total;                                  // loop the film
        state.baseT = t; state.baseNow = now;
        wrapped = true;
        audio.onSeek(t, true);
      }
      state.t = t;
      if (!wrapped) for (const c of state.cues) { if (c.t > t) break; if (prevT < c.t) c.fn(); }
      const ii = itemAt(t);
      if (ii !== state.lastItem) {
        if (ii === state.lastItem + 1 && state.items[ii].trans === 'dip-light') audio.air();
        state.lastItem = ii;
        updateUI();
      }
      state.dirty = true;
    }
    if (state.dirty) {
      warmAround(state.t);
      renderAt(state.t);
      state.dirty = false;
    }
    audio.tick(state.t, state.playing);
  }

  /* =====================================================================
     SOUND — a gentle piano and music-box score, mountain air, sound design
     ===================================================================== */
  const audio = (() => {
    let ctx = null, out = null, ambient = null, score = null, sfx = null, verbIn = null, verbOut = null;
    let padFilter = null, noiseBuf = null;
    const padOsc = [];
    let music = null, musicUrl = '';
    let volume = 0.8, muted = false, scoreOn = true, lastTick = 0, lastBeat = null;
    const BEAT = 60 / 72;
    // D – A – Bm – G, eight beats each: bass, pad voicing, arpeggio tones
    const PROG = [
      { bass: 146.83, pad: [146.83, 220.0, 293.66, 369.99], arp: [293.66, 369.99, 440.0, 587.33, 739.99] },
      { bass: 110.0, pad: [110.0, 164.81, 277.18, 329.63], arp: [277.18, 329.63, 440.0, 554.37, 659.25] },
      { bass: 123.47, pad: [123.47, 185.0, 246.94, 293.66], arp: [293.66, 369.99, 493.88, 587.33, 739.99] },
      { bass: 98.0, pad: [98.0, 146.83, 196.0, 246.94], arp: [293.66, 392.0, 493.88, 587.33, 783.99] },
    ];
    const ARP = [0, 2, 1, 3, 2, 4, 3, 1];
    const MEL = [[4, 3, 2], [3, 4, 2], [4, 2, 3], [2, 3, 4]];
    const vol = () => (muted ? 0 : volume);
    const live = () => !!ctx && ctx.state === 'running';
    const bed = () => !music;                                // built-in sound only without uploaded music
    const scoreEnv = t => E.sine(ramp(t, state.scoreStart - 0.3, state.scoreStart + 2.5)) * (1 - E.sine(ramp(t, state.total - 5, state.total - 0.5)));
    const musicEnv = t => E.sine(ramp(t, 0, 1.5)) * (1 - E.sine(ramp(t, state.total - 5, state.total - 0.5)));

    function gainTo(dest, v) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
    function makeImpulse(sec) {
      const len = Math.floor(ctx.sampleRate * sec);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
      }
      return buf;
    }
    function ensure() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createDynamicsCompressor();
      out.threshold.value = -16; out.knee.value = 12; out.ratio.value = 3; out.attack.value = 0.01; out.release.value = 0.25;
      out.connect(ctx.destination);
      ambient = gainTo(out, 0);
      score = gainTo(out, 0);
      sfx = gainTo(out, vol());
      verbIn = ctx.createConvolver();
      verbIn.buffer = makeImpulse(3.8);
      verbOut = gainTo(out, vol() * 0.55);
      verbIn.connect(verbOut);
      padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass'; padFilter.frequency.value = 820; padFilter.Q.value = 0.4;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      padFilter.connect(padGain);
      padGain.connect(score);
      padGain.connect(verbIn);
      PROG[0].pad.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = i % 2 ? 4 : -4;
        const g = ctx.createGain();
        g.gain.value = [0.55, 0.32, 0.28, 0.2][i];
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06 + i * 0.023;
        const lg = ctx.createGain();
        lg.gain.value = g.gain.value * 0.35;
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(padFilter);
        o.start(); lfo.start();
        padOsc.push(o);
      });
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const wind = ctx.createBufferSource();
      wind.buffer = noiseBuf; wind.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
      const wl = ctx.createOscillator(); wl.frequency.value = 0.07;
      const wlg = ctx.createGain(); wlg.gain.value = 200;
      wl.connect(wlg).connect(bp.frequency);
      wind.connect(bp).connect(gainTo(ambient, 0.03));
      wind.start(); wl.start();
    }
    function setPad(chord) {
      const now = ctx.currentTime;
      PROG[chord].pad.forEach((f, i) => padOsc[i].frequency.setTargetAtTime(f, now, 0.5));
    }
    // Felt-piano-like voice: triangle fundamental + soft harmonics, fast attack, long decay.
    function note(f, g, decay, when = 0, dest = score) {
      const t0 = ctx.currentTime + when;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3400, t0);
      lp.frequency.exponentialRampToValueAtTime(900, t0 + decay);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(g, t0 + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      lp.connect(env);
      env.connect(dest);
      env.connect(verbIn);
      [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.09], [4.02, 'sine', 0.045]].forEach(([m, type, a]) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f * m;
        const og = ctx.createGain();
        og.gain.value = a;
        o.connect(og); og.connect(lp);
        o.start(t0); o.stop(t0 + decay + 0.05);
      });
    }
    // Music-box / celesta voice.
    function bell(f, g, when = 0, dest = score) {
      const t0 = ctx.currentTime + when;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(g, t0 + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
      env.connect(dest);
      env.connect(verbIn);
      [[1, 1], [2.0, 0.22], [3.0, 0.1], [5.04, 0.035]].forEach(([m, a]) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f * m;
        const og = ctx.createGain();
        og.gain.value = a;
        o.connect(og).connect(env);
        o.start(t0); o.stop(t0 + 1.9);
      });
    }
    function noiseSweep(dur, f0, f1, peak, o = {}) {
      const t0 = ctx.currentTime;
      const at = o.peakAt || 0.6;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = o.type || 'bandpass'; bp.Q.value = o.q || 0.9;
      bp.frequency.setValueAtTime(f0, t0);
      bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur * at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + dur * at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp).connect(g);
      g.connect(sfx);
      if (o.verb) g.connect(verbIn);
      src.start(t0, Math.random() * 2);
      src.stop(t0 + dur + 0.05);
    }
    function playBeat(b) {
      const chord = Math.floor(b / 8) % PROG.length, step = b % 8, C = PROG[chord];
      if (step === 0) { setPad(chord); note(C.bass, 0.11, 4.2); }
      note(C.arp[ARP[step]], step === 0 ? 0.075 : 0.05, 2.8);
      if (b >= 32 && (step === 0 || step === 3 || step === 6)) bell(C.arp[MEL[chord][step / 3]] * 2, 0.028, 0.02);
      if (b >= 64 && (step === 2 || step === 6)) note(C.arp[(ARP[step] + 2) % 5] * 2, 0.02, 2.4, 0.45 * BEAT);
    }
    function scoreTick(t, playing) {
      if (!live() || !playing || !scoreOn || !bed()) { lastBeat = null; return; }
      const pos = (t - state.scoreStart) / BEAT, b = Math.floor(pos);
      if (b < 0) { lastBeat = null; return; }
      if (lastBeat === null || b < lastBeat || b > lastBeat + 2) {      // start, seek or loop: resync
        lastBeat = b;
        setPad(Math.floor(b / 8) % PROG.length);
        if (pos - b < 0.15) playBeat(b);
        return;
      }
      while (lastBeat < b) playBeat(++lastBeat);
    }
    function syncMusic(t, playing) {
      if (!music) return;
      const dur = isFinite(music.duration) ? music.duration : Infinity;
      if (!playing || t >= dur - 0.05) { if (!music.paused) music.pause(); return; }
      if (Math.abs(music.currentTime - t) > 0.3) { try { music.currentTime = t; } catch (e) { /* not seekable yet */ } }
      if (music.paused) music.play().catch(() => {});
    }
    const sfxOk = () => live() && bed() && vol() > 0;

    return {
      get running() { return live(); },
      unlock() {
        ensure();
        if (ctx && ctx.state !== 'running') ctx.resume().then(updateSoundHint, () => {});
        if (music && state.playing) syncMusic(state.t, true);
        updateSoundHint();
      },
      onPlay(t) { syncMusic(t, true); lastBeat = null; this.tick(t, true, true); },
      onPause() {
        if (music && !music.paused) music.pause();
        if (ctx) {
          const now = ctx.currentTime;
          [ambient, score, sfx].forEach(g => g.gain.setTargetAtTime(0, now, 0.12));
        }
      },
      onSeek(t, playing) {
        lastBeat = null;
        if (!music) return;
        const dur = isFinite(music.duration) ? music.duration : Infinity;
        if (t < dur) { try { music.currentTime = t; } catch (e) { /* ignore */ } }
        syncMusic(t, playing);
      },
      tick(t, playing, force) {
        scoreTick(t, playing);
        const now = performance.now();
        if (!force && now - lastTick < 100) return;
        lastTick = now;
        if (music) {
          music.volume = clamp(vol() * musicEnv(t));
          if (playing) syncMusic(t, true);
        }
        if (ctx) {
          const ct = ctx.currentTime, e = scoreEnv(t), on = playing && bed();
          ambient.gain.setTargetAtTime(on ? vol() * 0.7 * Math.max(e, 0.25) : 0, ct, 0.4);
          score.gain.setTargetAtTime(on && scoreOn ? vol() * 0.85 * e : 0, ct, 0.3);
          sfx.gain.setTargetAtTime(on ? vol() : 0, ct, 0.05);
          verbOut.gain.setTargetAtTime(vol() * 0.55, ct, 0.2);
        }
      },
      // cold-open design
      whoosh(d = 1.4, g = 0.08) { if (sfxOk()) noiseSweep(d, 240, 1800, g, { peakAt: 0.55, verb: true }); },
      ping(f, g) { if (sfxOk()) note(f, g, 3.4, 0, sfx); },
      drone(d) {
        if (!sfxOk()) return;
        const t0 = ctx.currentTime;
        [55, 110.0, 164.81].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = i ? 'triangle' : 'sine'; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime([0.16, 0.05, 0.025][i], t0 + d * 0.96);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.06);
          o.connect(g).connect(sfx);
          o.start(t0); o.stop(t0 + d + 0.1);
        });
      },
      riser(d) {
        if (!sfxOk()) return;
        noiseSweep(d, 300, 6500, 0.13, { peakAt: 0.97 });
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(70, t0);
        o.frequency.exponentialRampToValueAtTime(210, t0 + d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + d * 0.97);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.05);
        o.connect(g).connect(sfx);
        o.start(t0); o.stop(t0 + d + 0.1);
      },
      hit() {
        if (!sfxOk()) return;
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(120, t0);
        o.frequency.exponentialRampToValueAtTime(34, t0 + 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
        o.connect(g).connect(sfx);
        o.start(t0); o.stop(t0 + 3.3);
        noiseSweep(0.9, 1800, 260, 0.12, { peakAt: 0.04, type: 'lowpass', q: 0.7, verb: true });
        note(146.83, 0.1, 5.5, 0, sfx);
        note(587.33, 0.045, 5, 0.02, sfx);
        note(880.0, 0.035, 5, 0.05, sfx);
        note(1174.66, 0.025, 5, 0.09, sfx);
      },
      // montage cut: a click and a soft thump
      cut(level) {
        if (!sfxOk()) return;
        const t0 = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.1 * level, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
        src.connect(hp).connect(g).connect(sfx);
        src.start(t0, Math.random() * 2, 0.1);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(95, t0);
        o.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(0.32 * level, t0 + 0.006);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
        o.connect(og).connect(sfx);
        o.start(t0); o.stop(t0 + 0.4);
      },
      // warm, playful details
      pop() { if (sfxOk()) { bell(1567.98, 0.024, 0, sfx); bell(2093.0, 0.014, 0.07, sfx); } },
      twinkle() { if (sfxOk()) { bell(2349.32, 0.012, 0, sfx); bell(3135.96, 0.008, 0.09, sfx); } },
      chime() {
        if (!sfxOk()) return;
        [880, 1108.73, 1318.51, 1760].forEach((f, i) => bell(f, 0.03, i * 0.07, sfx));
        note(146.83, 0.08, 4.5, 0, sfx);
      },
      air() { if (sfxOk()) noiseSweep(1.8, 300, 1400, 0.035, { peakAt: 0.5, verb: true }); },
      setMusic(file) {
        this.clearMusic();
        musicUrl = URL.createObjectURL(file);
        music = new Audio();
        music.preload = 'auto';
        music.src = musicUrl;
        music.volume = 0;
        music.addEventListener('loadedmetadata', () => { if (state.playing) syncMusic(state.t, true); });
        music.addEventListener('error', () => { toast('ไฟล์เสียงนี้เล่นไม่ได้ กรุณาใช้ MP3 หรือ WAV'); this.clearMusic(); updateMusicUI(''); });
      },
      clearMusic() {
        if (music) { music.pause(); music.removeAttribute('src'); music.load(); }
        if (musicUrl) URL.revokeObjectURL(musicUrl);
        music = null; musicUrl = '';
      },
      setVolume(v) { volume = v; this.tick(state.t, state.playing, true); },
      toggleMute() { muted = !muted; this.tick(state.t, state.playing, true); return muted; },
      get muted() { return muted; },
      setScore(on) { scoreOn = on; this.tick(state.t, state.playing, true); },
      get score() { return scoreOn; },
    };
  })();

  /* =====================================================================
     RECORDING — capture the whole film from this tab to a video file
     ===================================================================== */
  async function recordFilm() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
      toast('เบราว์เซอร์นี้ไม่รองรับการบันทึกวิดีโอ — แนะนำ Google Chrome หรือ Edge บนคอมพิวเตอร์', 5200);
      return;
    }
    if (state.recording) return;
    audio.unlock();
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 }, audio: true,
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'include',
      });
    } catch (e) {
      toast('ยกเลิกการบันทึก');
      return;
    }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16e6 } : undefined); }
    catch (e) { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());
      const type = rec.mimeType || mime || 'video/webm';
      const blob = new Blob(chunks, { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Above-the-Clouds_Khao-Kho.${type.includes('mp4') ? 'mp4' : 'webm'}`;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
      app.classList.remove('is-recording');
      state.recording = null;
      toast('บันทึกวิดีโอเสร็จแล้ว — ไฟล์ถูกดาวน์โหลดเรียบร้อย', 5200);
    };
    stream.getVideoTracks()[0].addEventListener('ended', () => finishRecording());
    toggleDrawer(false);
    app.classList.add('is-recording', 'is-idle');
    state.recording = rec;
    pause();
    seek(0);
    state.lastItem = -1;
    // let the drawer slide away, then roll camera and film together from black
    setTimeout(() => { rec.start(1000); setTimeout(play, 250); }, 900);
  }
  function finishRecording() {
    const rec = state.recording;
    if (!rec || rec.state === 'inactive') return;
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 400);
  }

  /* =====================================================================
     INTERACTION — no control bar; taps, keys and the edit suite
     ===================================================================== */
  const glyph = $('glyph');
  const GLYPHS = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  };
  function flashGlyph(kind) {
    glyph.innerHTML = GLYPHS[kind] || '';
    glyph.classList.remove('is-on');
    void glyph.offsetWidth;                                   // restart the animation
    glyph.classList.add('is-on');
  }

  let hintTimer = 0;
  function updateSoundHint() {
    const hint = $('soundHint');
    const need = state.ready && !audio.running && !state.recording;
    if (!need) { hint.hidden = true; return; }
    if (hint.hidden && !hint._shown) {
      hint._shown = true;
      hint.hidden = false;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { hint.classList.add('is-fading'); setTimeout(() => { hint.hidden = true; }, 1300); }, 7000);
    }
  }

  // Resize → rescale immediately; re-layout when the screen's shape really changes.
  let resizeTimer = 0;
  function onResize() {
    applyScale();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const d = computeDims();
      if (Math.abs(d.w / d.h - W / H) / (W / H) > 0.03) {
        if (state.ready) rebuild(false); else setGeometry();
      }
    }, 200);
  }
  new ResizeObserver(onResize).observe(stage);
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 300));

  // the mouse cursor hides itself while the film plays
  let idleTimer = 0;
  function pokeIdle() {
    if (state.recording) return;
    app.classList.remove('is-idle');
    clearTimeout(idleTimer);
    if (state.playing && !drawer.classList.contains('is-open')) idleTimer = setTimeout(() => app.classList.add('is-idle'), 2500);
  }
  app.addEventListener('mousemove', pokeIdle, { passive: true });

  // tap = play/pause · double-tap = fullscreen · long-press = edit suite
  let tapTimer = 0, pressTimer = 0, pressed = false, down = null;
  stage.addEventListener('pointerdown', e => {
    if (state.recording) return;
    down = { x: e.clientX, y: e.clientY };
    pressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = true; toggleDrawer(true); }, 650);
  });
  stage.addEventListener('pointermove', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(pressTimer);
  });
  stage.addEventListener('pointerup', () => {
    clearTimeout(pressTimer);
    if (!down || pressed || state.recording) { down = null; return; }
    down = null;
    if (drawer.classList.contains('is-open')) { toggleDrawer(false); return; }
    const locked = !audio.running;
    audio.unlock();
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; toggleFullscreen(); return; }
    tapTimer = setTimeout(() => {
      tapTimer = 0;
      if (locked && state.playing) { flashGlyph('sound'); return; }  // the first tap only turns the sound on
      toggle();
    }, 280);
  });
  stage.addEventListener('pointercancel', () => { clearTimeout(pressTimer); down = null; });
  stage.addEventListener('contextmenu', e => e.preventDefault());
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, () => audio.unlock(), { passive: true }));
  $('soundHint').addEventListener('click', e => { e.stopPropagation(); audio.unlock(); flashGlyph('sound'); });

  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFullscreen() {
    if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const req = app.requestFullscreen || app.webkitRequestFullscreen;
    if (!req) { toast('อุปกรณ์นี้ไม่รองรับโหมดเต็มจอ — เพิ่มลงหน้าจอโฮมเพื่อดูแบบเต็มจอ'); return; }
    const r = req.call(app);
    if (r && r.catch) r.catch(() => {});
  }
  function toggleMute() { audio.unlock(); flashGlyph(audio.toggleMute() ? 'muted' : 'sound'); }

  document.addEventListener('keydown', e => {
    if (!state.ready) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    switch (e.key) {
      case ' ': case 'k': case 'K': e.preventDefault(); toggle(); break;
      case 'ArrowRight': e.preventDefault(); nextChapter(); break;
      case 'ArrowLeft': e.preventDefault(); prevChapter(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'p': case 'P': toggleDrawer(); break;
      case 'r': case 'R': seek(0); state.lastItem = -1; if (!state.playing) play(); break;
      case 'Escape': toggleDrawer(false); break;
      default: return;
    }
    pokeIdle();
  });

  /* ---------------------------------------------------------------------
     Edit suite: the cut chapter by chapter, drag & drop re-ordering
     --------------------------------------------------------------------- */
  const drawer = $('drawer');
  const gallery = $('gallery');
  function toggleDrawer(force) {
    const open = force != null ? force : !drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    if (open) updateUI(true);
    pokeIdle();
  }
  $('btnCloseDrawer').addEventListener('click', () => toggleDrawer(false));

  function thumbEl(p, pos, seqIdx, cls) {
    const el = h('div', 'thumb' + (cls ? ' ' + cls : ''));
    el.dataset.pos = String(pos);
    el.dataset.seq = String(seqIdx);
    el.title = p.name;
    const im = imgEl(p);
    im.loading = 'lazy';
    im.className = 'nodecode';
    el.append(im, h('span', 'thumb__n', p.num));
    return el;
  }
  function buildGallery() {
    gallery.innerHTML = '';
    state.seq = [];
    if (state.keyPos >= 0) {
      const g = h('div', 'group', '<div class="group__head"><span class="n">00</span><span class="t">ภาพเปิดและปิดเรื่อง · Key Art</span></div><div class="group__items"></div>');
      g.dataset.g = '0';
      state.seq.push(state.keyPos);
      g.lastChild.append(thumbEl(state.order[state.keyPos], state.keyPos, 0, 'is-key'));
      gallery.append(g);
    }
    state.groups.forEach(G => {
      if (!G.chapter) return;
      const g = h('div', 'group', `<div class="group__head"><span class="n">${pad2(G.gi)}</span><span class="t">${G.chapter.th} · ${G.chapter.en}</span></div><div class="group__items"></div>`);
      g.dataset.g = String(G.gi);
      const items = g.lastChild;
      G.items.forEach(i => (state.items[i].pos || []).forEach(p => {
        items.append(thumbEl(state.order[p], p, state.seq.length));
        state.seq.push(p);
      }));
      gallery.append(g);
    });
    const n = state.order.length;
    $('photoCount').textContent = `${n} ภาพ · ${state.groups.filter(g => g.chapter).length} บท · ${fmt(state.total)}${state.curated && EDIT ? ' · ตัดต่อตามเนื้อหา' : ' · ตัดต่ออัตโนมัติ'}`;
    updateUI(true);
  }
  const ui = { group: -1, item: -1 };
  function updateUI(force) {
    if (!drawer.classList.contains('is-open') && !force) return;
    const gi = groupAt(state.t), i = itemAt(state.t);
    if (force || gi !== ui.group) {
      ui.group = gi;
      const G = state.groups[gi];
      gallery.querySelectorAll('.group[data-g]').forEach(el => el.classList.toggle('is-current', G && +el.dataset.g === G.gi));
    }
    if (force || i !== ui.item) {
      ui.item = i;
      gallery.querySelectorAll('.thumb.is-playing').forEach(el => el.classList.remove('is-playing'));
      const it = state.items[i];
      if (!it) return;
      const list = it.pos || (it.type === 'opener' || it.type === 'finale' ? [state.keyPos] : []);
      list.forEach(p => { const el = gallery.querySelector(`.thumb[data-pos="${p}"]`); if (el) el.classList.add('is-playing'); });
    }
  }

  let drag = null;
  const clearMarks = () => gallery.querySelectorAll('.drop-before,.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    const th = el && el.closest && el.closest('.thumb[data-seq]:not(.is-key)');
    if (!th) return null;
    const r = th.getBoundingClientRect();
    return { th, before: x < r.left + r.width / 2 };
  }
  function beginDrag() {
    if (!drag || drag.active) return;
    drag.active = true;
    drag.th.classList.add('is-dragging');
    const g = h('div', 'drag-ghost');
    g.append(drag.th.querySelector('img').cloneNode());
    document.body.append(g);
    drag.ghost = g;
    moveGhost(drag.x, drag.y);
    if (navigator.vibrate) navigator.vibrate(12);
  }
  function moveGhost(x, y) { if (drag && drag.ghost) { drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px'; } }
  gallery.addEventListener('pointerdown', e => {
    const th = e.target.closest('.thumb[data-seq]');
    if (!th || e.button > 0) return;
    const movable = !th.classList.contains('is-key');
    drag = { th, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, active: false, mouse: e.pointerType === 'mouse', movable };
    if (!drag.mouse && movable) drag.timer = setTimeout(beginDrag, 300);
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 6) {
        clearTimeout(drag.timer);
        if (drag.mouse && drag.movable) beginDrag();
        else if (!drag.mouse) { drag = null; return; }
      }
      if (!drag || !drag.active) return;
    }
    moveGhost(drag.x, drag.y);
    clearMarks();
    const tg = dropTarget(drag.x, drag.y);
    if (tg) tg.th.classList.add(tg.before ? 'drop-before' : 'drop-after');
  });
  gallery.addEventListener('touchmove', e => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
  function endDrag(e, cancelled) {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag;
    drag = null;
    if (d.ghost) d.ghost.remove();
    d.th.classList.remove('is-dragging');
    clearMarks();
    if (!d.active) {
      if (!cancelled && Math.hypot(d.x - d.x0, d.y - d.y0) < 8) jumpToPos(+d.th.dataset.pos);
      return;
    }
    if (cancelled) return;
    const tg = dropTarget(e.clientX, e.clientY);
    if (!tg) return;
    const from = +d.th.dataset.seq;
    let to = +tg.th.dataset.seq + (tg.before ? 0 : 1);
    if (to > from) to -= 1;
    if (to === from) return;
    const seqPhotos = state.seq.map(p => state.order[p]);
    const missing = state.order.filter(p => !seqPhotos.includes(p));
    const [moved] = seqPhotos.splice(from, 1);
    seqPhotos.splice(to, 0, moved);
    state.order = seqPhotos.concat(missing);
    state.curated = false;
    rebuild(false);
    toast('จัดลำดับใหม่แล้ว · เปลี่ยนเป็นการตัดต่ออัตโนมัติ (กด Reset Edit เพื่อกลับไปใช้ฉบับตัดต่อตามเนื้อหา)', 5200);
  }
  window.addEventListener('pointerup', e => endDrag(e, false));
  window.addEventListener('pointercancel', e => endDrag(e, true));
  gallery.addEventListener('contextmenu', e => { if (e.target.closest('.thumb')) e.preventDefault(); });

  function jumpToPos(pos) {
    const i = state.photoItem[pos];
    if (i == null || i < 0) return;
    const it = state.items[i];
    const off = it.type === 'opener' ? it.titleAt + 0.4 : it.chapter ? contentAt(it) + 1.2 : 0.6;
    seek(state.starts[i] + off);
  }

  $('btnResetOrder').addEventListener('click', () => {
    state.order = state.photos.slice();
    state.curated = !!EDIT;
    rebuild(false);
    toast(EDIT ? 'กลับไปใช้ฉบับตัดต่อตามเนื้อหาแล้ว' : 'เรียงลำดับตามชื่อไฟล์แล้ว');
  });
  $('btnChangeFolder').addEventListener('click', pickFolder);
  $('btnSelectFolder').addEventListener('click', pickFolder);
  $('btnRecord').addEventListener('click', recordFilm);

  // Music & score
  const musicInput = $('musicInput');
  function updateMusicUI(name) {
    $('musicLabel').textContent = name || 'Add Music';
    $('musicRemove').hidden = !name;
    $('btnMusic').classList.toggle('is-on', !!name);
  }
  $('btnMusic').addEventListener('click', e => {
    audio.unlock();
    if (e.target.closest('#musicRemove')) {
      audio.clearMusic();
      updateMusicUI('');
      setScore(true);
      return;
    }
    musicInput.value = '';
    musicInput.click();
  });
  musicInput.addEventListener('change', () => {
    const file = musicInput.files && musicInput.files[0];
    if (!file) return;
    if (!/\.(mp3|wav)$/i.test(file.name) && !/^audio\/(mpeg|mp3|wav|x-wav|wave)$/.test(file.type)) { toast('กรุณาเลือกไฟล์ MP3 หรือ WAV'); return; }
    audio.setMusic(file);
    updateMusicUI(file.name);
    setScore(false);
    toast(`เพิ่มเพลงแล้ว: ${file.name} — เพลงเริ่มพร้อมภาพยนตร์ที่ 00:00`, 4200);
    if (state.playing) audio.onPlay(state.t);
  });
  function setScore(on) { audio.setScore(on); $('btnScore').classList.toggle('is-on', on); }
  $('btnScore').addEventListener('click', () => { audio.unlock(); setScore(!audio.score); });
  $('volume').addEventListener('input', e => audio.setVolume(+e.target.value / 100));

  /* =====================================================================
     BOOT — load the album and roll the film
     ===================================================================== */
  function setLoader(text, k) {
    $('loaderStatus').textContent = text;
    if (k != null) $('loaderBar').style.width = `${Math.round(k * 100)}%`;
  }
  function start() {
    state.ready = true;
    $('loader').classList.add('is-done');
    const m = /t=(\d+(?:\.\d+)?)/.exec(location.hash);     // index.html#t=45 opens at 00:45
    seek(m ? +m[1] : 0);
    state.lastItem = itemAt(state.t);
    audio.unlock();
    if (!(m && /pause/.test(location.hash))) {
      app.classList.add('is-idle');
      setTimeout(play, m ? 0 : 650);                          // roll once the loader has faded to black
    }
    updateSoundHint();
    setTimeout(updateSoundHint, 500);
  }
  async function boot() {
    setGeometry();
    const entries = manifestEntries();
    if (!entries) { showFallback(); return; }
    const folder = window.PHOTO_MANIFEST.folder || '';
    const photos = await preparePhotos(entries, (d, n) => setLoader(`กำลังเตรียมภาพถ่าย ${d} / ${n}`, d / n));
    if (state.ready) return;
    if (!photos.length) { showFallback(); return; }
    usePhotos(photos, folder);
    start();
  }
  function showFallback() {
    $('loaderStatus').hidden = true;
    $('loaderFallback').hidden = false;
    $('loaderFallback').querySelector('code').textContent = FOLDER_HINT;
  }

  requestAnimationFrame(frame);
  boot();
})();
