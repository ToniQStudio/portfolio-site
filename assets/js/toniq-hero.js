(() => {
  'use strict';

  const canvas = document.getElementById('toniqHeroCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: false,
    premultipliedAlpha: false
  }) || canvas.getContext('experimental-webgl');
  if (!gl) return; // the CSS background stays if WebGL is unavailable

  // The studio's vocabulary, laid out as a wall of type: each phrase stays
  // intact when the copy wraps, so terms like "A/B Testing" never split.
  const PHRASES = [
    'Design', 'User Experience', 'User Interface', 'Product Design',
    'Human-Computer Interaction', 'Sketch', 'Wireframe', 'Mockup', 'Prototype',
    'User Flow', 'Design System', 'UI Kit', 'Atomic Design', 'Layout',
    'Customer Development', 'Usability Testing', 'A/B Testing', 'Persona',
    'Customer Journey Map', 'Jobs to be Done', 'Conversion Rate', 'Retention Rate',
    'Churn Rate', 'Lifetime Value', 'Customer Acquisition Cost', 'Onboarding',
    'Affordance', 'Accessibility', 'Dark Patterns', 'Microcopy', 'Leadership',
    'Management', 'Vision', 'Strategy', 'Design Operations', 'Design Maturity',
    'Resource Allocation', 'Capacity Planning', 'Skill Matrix', 'Performance Review',
    'Career Ladder', 'Hiring Pipeline', 'Talent Retention', 'Return on Investment',
    'Product-Market Fit', 'Objectives and Key Results', 'Key Performance Indicators',
    'North Star Metric', 'Handoff Process', 'Cross-Functional Collaboration',
    'Design Governance', 'Quality Assurance', 'Executive Stakeholder Management',
    'Change Management', 'Budgeting & Procurement', 'Product Strategy',
    'Agile / Scrum / Kanban', 'User-Centered Culture', 'Evangelism'
  ];
  const TERMS = PHRASES.map((p) => p.toUpperCase());

  const FONT_STACK = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const BG = [0.102, 0.102, 0.102];  // #1a1a1a, matches the page background
  const INK = [1.0, 1.0, 1.0];
  const SCROLL_SPEED = 34;           // css px the wall travels upward per second
  const LEADING = 0.92;              // line height / font size (tight, caps-only)
  // The type is drawn wider than the viewport (a wall that bleeds off the right),
  // so the letters can be large while rows still carry several terms.
  const ROW_FACTOR = 1.5;
  const FONT_FACTOR = 0.15;          // on-screen font size as a fraction of the width
  const WARP_PX = 70;                // strength of the liquid warp, css px

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // ---- shaders ---------------------------------------------------------

  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    varying vec2 v_uv;

    uniform float u_time;
    uniform vec2  u_res;
    uniform float u_dpr;
    uniform vec2  u_cursor;    // css px, from the top-left
    uniform float u_cursorOn;
    uniform float u_hoverR;
    uniform float u_texK;
    uniform float u_scroll;
    uniform float u_uvXScale;
    uniform float u_uvXOff;
    uniform vec2  u_uvPerPx;
    uniform float u_warp;
    uniform sampler2D u_fill;
    uniform sampler2D u_stroke;
    uniform vec3  u_bg;
    uniform vec3  u_ink;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    // One layer of rounded, slowly drifting dots on a jittered grid.
    float dotLayer(vec2 px, float t, float cell, float speed, float seed, float rscale) {
      vec2 g = px / cell;
      g += vec2(t * speed, t * speed * 0.5);
      vec2 id = floor(g);
      vec2 lp = fract(g) - 0.5;
      float show = step(hash(id + seed), 0.78);
      vec2 c = (vec2(hash(id + seed + 1.3), hash(id + seed + 2.9)) - 0.5) * 0.55;
      float ecc = 1.0 + 0.6 * hash(id + seed + 8.1);
      float rad = (0.05 + 0.09 * hash(id + seed + 5.7)) * rscale;
      float dd = length((lp - c) * vec2(ecc, 1.0));
      return (1.0 - smoothstep(rad - 0.012, rad + 0.012, dd)) * show;
    }

    void main() {
      vec2 fragPx = gl_FragCoord.xy / u_dpr;             // css px, bottom-up
      vec2 curPx = vec2(u_cursor.x, u_res.y - u_cursor.y);
      float t = u_time;

      // The water: a broad travelling wave bends the glyphs across the screen,
      // with a slight in-phase squeeze so letters stretch and compress.
      float ph = t * 0.35;
      float w = sin(v_uv.x * 3.4 - ph) + 0.45 * sin(v_uv.x * 6.8 - ph * 1.6 + 1.1);
      float dyPx = w * u_warp;
      float dxPx = cos(v_uv.x * 3.4 - ph) * u_warp * 0.22;

      vec2 baseUV = vec2(v_uv.x * u_uvXScale + u_uvXOff, v_uv.y * u_texK - u_scroll);
      vec2 suv = baseUV + vec2(dxPx, dyPx) * u_uvPerPx;
      vec2 sampleUV = vec2(suv.x, fract(suv.y));

      float fill   = texture2D(u_fill, sampleUV).r;
      float stroke = texture2D(u_stroke, sampleUV).r;

      float d = distance(fragPx, curPx);

      // the cursor turns glyphs to a thin outline
      float hover = (1.0 - smoothstep(u_hoverR * 0.30, u_hoverR, d)) * u_cursorOn;
      float glyph = mix(fill, stroke, hover);

      // a field of small, thin crosses around the cursor
      float crosses = 0.0;
      {
        float sp = 38.0;
        vec2 g = fragPx / sp;
        vec2 id = floor(g);
        vec2 lp = fract(g) - 0.5;
        float w2 = 0.020;
        float arm = 0.11;
        float ax = abs(lp.x);
        float ay = abs(lp.y);
        float vbar = (1.0 - smoothstep(w2, w2 + 0.006, ax)) * (1.0 - smoothstep(arm, arm + 0.006, ay));
        float hbar = (1.0 - smoothstep(w2, w2 + 0.006, ay)) * (1.0 - smoothstep(arm, arm + 0.006, ax));
        float plus = max(vbar, hbar);
        float prox = 1.0 - smoothstep(u_hoverR * 0.40, u_hoverR * 1.9, d);
        crosses = plus * prox * step(hash(id), 0.7) * u_cursorOn;
      }

      // several adjacent layers of rounded dots, drifting over the crosses
      float proxD = 1.0 - smoothstep(u_hoverR * 0.40, u_hoverR * 2.0, d);
      float dots = 0.0;
      dots += dotLayer(fragPx, t, 50.0, 0.020, 1.0, 1.0);
      dots += dotLayer(fragPx, t, 72.0, 0.014, 3.0, 1.15);
      dots += dotLayer(fragPx, t, 98.0, 0.009, 7.0, 1.30);
      dots = clamp(dots, 0.0, 1.0) * proxD * u_cursorOn;

      vec3 col = u_bg;
      col = mix(col, u_ink, clamp(crosses, 0.0, 1.0) * 0.5);
      col = mix(col, u_ink, dots * 0.30);
      col = mix(col, u_ink, clamp(glyph, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // ---- program ---------------------------------------------------------

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('toniq-hero shader:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('toniq-hero link:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['u_time', 'u_res', 'u_dpr', 'u_cursor', 'u_cursorOn', 'u_hoverR',
   'u_texK', 'u_scroll', 'u_uvXScale', 'u_uvXOff', 'u_uvPerPx', 'u_warp',
   'u_fill', 'u_stroke', 'u_bg', 'u_ink'].forEach((n) => {
    U[n] = gl.getUniformLocation(program, n);
  });

  const fillTex = gl.createTexture();
  const strokeTex = gl.createTexture();
  gl.uniform1i(U.u_fill, 0);
  gl.uniform1i(U.u_stroke, 1);
  gl.uniform3fv(U.u_bg, BG);
  gl.uniform3fv(U.u_ink, INK);
  gl.uniform1f(U.u_warp, WARP_PX);
  gl.uniform1f(U.u_uvXOff, 0.0);

  // ---- geometry / state ------------------------------------------------

  let CW = 0, CH = 0, dpr = 1;
  let TW = 0, TH = 0;
  let scrollUV = 0;
  let cursor = { x: -9999, y: -9999 };
  let cursorOn = 0;
  let cursorTarget = 0;
  let ready = false;
  const HOVER_R = 190;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  const wrapPhrases = (ctx, maxW) => {
    const lines = [];
    let line = '';
    for (const phrase of TERMS) {
      const test = line ? line + ' ' + phrase : phrase;
      if (!line || ctx.measureText(test).width <= maxW) {
        line = test;
      } else {
        lines.push(line);
        line = phrase;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const fontAt = (px) => '800 ' + px.toFixed(2) + 'px ' + FONT_STACK;

  const buildTextures = () => {
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const rowFactor = CW < 760 ? 1.0 : ROW_FACTOR;   // phones keep rows on-screen
    const layoutW = CW * rowFactor;
    const texScale = Math.min(Math.min(dpr, 2), maxTex / layoutW);
    TW = Math.max(2, Math.round(layoutW * texScale));
    const margin = TW * 0.02;
    const maxW = TW * 0.96 - margin;

    const c = document.createElement('canvas');
    const fctx = c.getContext('2d');

    // Largest font whose longest phrase still fits the tile width.
    fctx.font = fontAt(100);
    let longest = 1;
    for (const p of TERMS) longest = Math.max(longest, fctx.measureText(p).width);
    const fitFont = maxW / (longest / 100);

    let screenFont = clamp(CW * FONT_FACTOR, 48, 320);
    let ft = Math.min(screenFont * texScale, fitFont);
    let lines = [];
    for (let i = 0; i < 90; i++) {
      fctx.font = fontAt(ft);
      lines = wrapPhrases(fctx, maxW);
      if (lines.length * ft * LEADING <= maxTex) break;
      ft *= 0.95;
    }
    TH = Math.max(TW, Math.round(lines.length * ft * LEADING));

    c.width = TW; c.height = TH;
    fctx.font = fontAt(ft);
    fctx.textAlign = 'left';
    fctx.textBaseline = 'middle';

    const upload = (unit, tex) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      fctx.clearRect(0, 0, TW, TH);
    };

    // fill pass
    fctx.fillStyle = '#fff';
    for (let i = 0; i < lines.length; i++) fctx.fillText(lines[i], margin, (i + 0.5) * ft * LEADING);
    upload(0, fillTex);

    // hairline outline pass, into the same canvas
    fctx.strokeStyle = '#fff';
    fctx.lineWidth = Math.max(1.2, ft * 0.008);
    fctx.lineJoin = 'round';
    for (let i = 0; i < lines.length; i++) fctx.strokeText(lines[i], margin, (i + 0.5) * ft * LEADING);
    upload(1, strokeTex);

    gl.uniform1f(U.u_texK, (CH * texScale) / TH);
    gl.uniform1f(U.u_uvXScale, 1 / rowFactor);
    gl.uniform2f(U.u_uvPerPx, (1 / rowFactor) / CW, texScale / TH);
    gl.uniform2f(U.u_res, CW, CH);
    gl.uniform1f(U.u_dpr, dpr);
    ready = true;
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    CW = Math.max(1, Math.round(rect.width));
    CH = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildTextures();
  };

  // ---- interaction -----------------------------------------------------

  const setPointer = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = clientX - rect.left;
    cursor.y = clientY - rect.top;
    cursorTarget = 1;
  };

  addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  document.addEventListener('mouseleave', () => { cursorTarget = 0; });
  addEventListener('touchmove', (e) => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  addEventListener('touchend', () => { cursorTarget = 0; });

  // ---- loop ------------------------------------------------------------

  const draw = (time) => {
    if (!ready) return;
    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_scroll, scrollUV - Math.floor(scrollUV));
    gl.uniform2f(U.u_cursor, cursor.x, cursor.y);
    gl.uniform1f(U.u_cursorOn, cursorOn);
    gl.uniform1f(U.u_hoverR, HOVER_R);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let last = 0;
  const loop = (now) => {
    if (!ready) { requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const t = now / 1000;

    scrollUV += dt * SCROLL_SPEED * (TW / (CW * (CW < 760 ? 1.0 : ROW_FACTOR))) / TH;
    cursorOn += (cursorTarget - cursorOn) * Math.min(1, dt * 6);

    draw(t);
    requestAnimationFrame(loop);
  };

  const start = () => {
    resize();
    cursorOn = 0;
    if (reduceMotion.matches) {
      draw(0);
      ready = false; // freeze the frame
      return;
    }
    requestAnimationFrame(loop);
  };

  addEventListener('resize', () => {
    clearTimeout(start._t);
    start._t = setTimeout(() => {
      resize();
      if (reduceMotion.matches) draw(0);
    }, 150);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }
})();