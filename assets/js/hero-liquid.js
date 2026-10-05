(() => {
  'use strict';

  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('heroLiquid');
  var fallbackEl = document.getElementById('heroLiquidLogo');
  if (!hero || !canvas || !fallbackEl) return;

  /* Shared clock: the seam-crosses canvas below reads the same origin, so the
     background reveal keeps running as one continuous field across the hero's
     bottom edge (the hero's own noise time is wall-clock based, not paused
     while the canvas is off screen). */
  var timeOrigin = performance.now();
  window.__heroLiquidStart = timeOrigin;

  function staticOnly() {
    hero.classList.remove('is-live');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    staticOnly();
    return;
  }

  var opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) {
    staticOnly();
    return;
  }

  var DEBUG = false;
  try {
    var dm = /[?&]debug(?:=([^&]*))?/.exec(window.location.search);
    if (dm) DEBUG = dm[1] !== '0';
  } catch (e) {}

  /* ---------------------------------------------------------------- *
   * Tunables. `TUNE` is read once so the values stay in one place.    *
   * ---------------------------------------------------------------- */
  var TUNE = {
    followTau: 0.05,
    presenceUp: 0.16,
    presenceDown: 0.80,
    jitter: 0.0006,
    resetHold: 1.00,
    resetTime: 4.80,
    maskR: 0.22,
    activityTau: 1.20,
    brushR: 0.055,
    push: 1.35,
    deltaMax: 0.055,
    velDecayTau: 0.30,
    warpDecayTau: 0.60,
    visc: 0.08,
    ambient: 0.0,
    velMax: 0.006,
    warpMax: 0.065,
    warpGain: 0.50,
    swirl: 0.90,
    pushDrag: 2.20,
    pushBrush: 2.20,
    pushMax: 0.10,
    pushDecayTau: 0.34,
    dispScale: 1.0,
    sdfRange: 12.0,
    strokePx: 4.0,
    lensR: 0.30,
    crossCell: 12.0,
    bgCell: 8.0,
    bgBend: 0.12,
    crossGlow: 0.04,
    crossSize: 1.00,
    crossBend: 3.00,
    grain: 0.020,
    moveGlow: 0.40,
    moveDrift: 0.00,
    lensAmt: 0.26
  };

  var COMMON = [
    'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0; float a = 0.5;',
    '  for(int i = 0; i < 4; i++){ v += a * vnoise(p); p = p * 2.03 + 11.3; a *= 0.5; }',
    '  return v;',
    '}',
    'vec2 curl(vec2 p){',
    '  float e = 0.16;',
    '  float n1 = fbm(p + vec2(0.0, e));',
    '  float n2 = fbm(p - vec2(0.0, e));',
    '  float n3 = fbm(p + vec2(e, 0.0));',
    '  float n4 = fbm(p - vec2(e, 0.0));',
    '  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);',
    '}',
    'float dither4x4(vec2 position, float brightness){',
    '  int x = int(mod(position.x, 4.0));',
    '  int y = int(mod(position.y, 4.0));',
    '  int index = x + y * 4;',
    '  float limit = 0.0;',
    '  if(index == 0) limit = 0.0625; if(index == 1) limit = 0.5625;',
    '  if(index == 2) limit = 0.1875; if(index == 3) limit = 0.6875;',
    '  if(index == 4) limit = 0.8125; if(index == 5) limit = 0.3125;',
    '  if(index == 6) limit = 0.9375; if(index == 7) limit = 0.4375;',
    '  if(index == 8) limit = 0.25;   if(index == 9) limit = 0.75;',
    '  if(index == 10) limit = 0.125; if(index == 11) limit = 0.625;',
    '  if(index == 12) limit = 1.0;   if(index == 13) limit = 0.5;',
    '  if(index == 14) limit = 0.875; if(index == 15) limit = 0.375;',
    '  return brightness < limit ? 0.0 : 1.0;',
    '}'
  ].join('\n');

  var uniformLimit = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64;
  var MAXS = Math.max(2, Math.min(8, Math.floor((uniformLimit - 30) / 3)));

  function makeTex(w, h, type, filter) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    return t;
  }

  function testRenderable(type) {
    var t = makeTex(2, 2, type, gl.NEAREST);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(t);
    return ok;
  }

  var FIELD_TYPE = gl.UNSIGNED_BYTE;
  var FIELD_FILTER = gl.LINEAR;
  var FIELD_SCALE = 1.0;
  (function chooseFieldType() {
    var hfExt = gl.getExtension('OES_texture_half_float');
    var hf = hfExt && (hfExt.HALF_FLOAT_OES || 0x8D61);
    if (hf && testRenderable(hf)) {
      FIELD_TYPE = hf;
      if (gl.getExtension('OES_texture_half_float_linear')) {
        FIELD_FILTER = gl.LINEAR; FIELD_SCALE = 0.5;
      } else {
        FIELD_FILTER = gl.NEAREST;
      }
      return;
    }
    if (gl.getExtension('OES_texture_float') && testRenderable(gl.FLOAT)) {
      FIELD_TYPE = gl.FLOAT;
      if (gl.getExtension('OES_texture_float_linear')) {
        FIELD_FILTER = gl.LINEAR; FIELD_SCALE = 0.5;
      } else {
        FIELD_FILTER = gl.NEAREST;
      }
    }
  })();

  var VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FIELD = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uPrev;',
    'uniform vec2 uRes;',
    'uniform float uAspect;',
    'uniform float uTime;',
    'uniform float uVelDecay;',
    'uniform float uWarpDecay;',
    'uniform float uVisc;',
    'uniform float uIdle;',
    'uniform float uVelMax;',
    'uniform float uWarpMax;',
    'uniform float uWarpGain;',
    'uniform float uSwirl;',
    'uniform float uReset;',
    'uniform int uCount;',
    'uniform vec4 uSplat[' + MAXS + '];',
    'uniform vec2 uDeltaA[' + MAXS + '];',
    COMMON,
    'vec2 dec(vec2 e){ return e * 2.0 - 1.0; }',
    'vec2 enc(vec2 v){ return v * 0.5 + 0.5; }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec4 P = texture2D(uPrev, uv);',
    '  vec2 vel = dec(P.rg);',
    '  vec2 pc = vec2(uv.x * uAspect, uv.y);',
    '  vec2 srcV = uv - vel;',
    '  vec2 tx = 1.0 / uRes;',
    '  vec2 va = dec(texture2D(uPrev, srcV).rg);',
    '  vec2 nb = dec(texture2D(uPrev, srcV + vec2(tx.x, 0.0)).rg)',
    '         + dec(texture2D(uPrev, srcV - vec2(tx.x, 0.0)).rg)',
    '         + dec(texture2D(uPrev, srcV + vec2(0.0, tx.y)).rg)',
    '         + dec(texture2D(uPrev, srcV - vec2(0.0, tx.y)).rg);',
    '  va = mix(va, nb * 0.25, uVisc);',
    '  vec2 v2 = va * uVelDecay;',
    '  vec2 amb = curl(pc * 3.0 + vec2(uTime * 0.06, -uTime * 0.04));',
    '  v2 += amb * uIdle;',
    '  for(int i = 0; i < ' + MAXS + '; i++){',
    '    if(i >= uCount) break;',
    '    vec4 sp = uSplat[i];',
    '    vec2 off = pc - vec2(sp.x * uAspect, sp.y);',
    '    float q = dot(off, off) / max(sp.z * sp.z, 1e-5);',
    '    float fall = (1.0 - q) * exp(-q);',
    '    vec2 d = uDeltaA[i];',
    '    v2 += (d + vec2(-d.y, d.x) * uSwirl) * fall * sp.w;',
    '  }',
    '  v2 = clamp(v2, vec2(-uVelMax), vec2(uVelMax));',
    '  vec2 srcW = uv - v2;',
    '  vec2 w = dec(texture2D(uPrev, srcW).ba) * uWarpDecay + v2 * uWarpGain;',
    '  w = clamp(w, vec2(-uWarpMax), vec2(uWarpMax));',
    '  float rs = 1.0 - uReset;',
    '  v2 *= rs;',
    '  w *= rs;',
    '  gl_FragColor = vec4(enc(v2), enc(w));',
    '}'
  ].join('\n');

  var PUSH = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uPrev;',
    'uniform float uAspect;',
    'uniform float uDecay;',
    'uniform float uMax;',
    'uniform float uBrush;',
    'uniform float uReset;',
    'uniform float uADecay;',
    'uniform float uMaskR;',
    'uniform int uCount;',
    'uniform vec4 uSplat[' + MAXS + '];',
    'uniform vec2 uDeltaA[' + MAXS + '];',
    'vec2 dec(vec2 e){ return e * 2.0 - 1.0; }',
    'vec2 enc(vec2 v){ return v * 0.5 + 0.5; }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec4 P = texture2D(uPrev, uv);',
    '  vec2 D = dec(P.rg) * uDecay;',
    '  float A = P.b * uADecay;',
    '  vec2 pc = vec2(uv.x * uAspect, uv.y);',
    '  for(int i = 0; i < ' + MAXS + '; i++){',
    '    if(i >= uCount) break;',
    '    vec4 sp = uSplat[i];',
    '    vec2 off = pc - vec2(sp.x * uAspect, sp.y);',
    '    float R = max(sp.z * uBrush, 1e-4);',
    '    float q = dot(off, off) / (R * R);',
    '    float fall = (1.0 - q) * exp(-q);',
    '    D += uDeltaA[i] * fall * sp.w;',
    '    float qm = dot(off, off) / (uMaskR * uMaskR);',
    '    A = max(A, clamp((1.0 - qm) * exp(-qm), 0.0, 1.0) * sp.w);',
    '  }',
    '  D = clamp(D, vec2(-uMax), vec2(uMax));',
    '  D *= (1.0 - uReset);',
    '  A *= (1.0 - uReset);',
    '  gl_FragColor = vec4(enc(D), min(A, 1.0), 1.0);',
    '}'
  ].join('\n');

  var DISP = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uD;',
    'uniform sampler2D uPush;',
    'uniform sampler2D uSdf;',
    'uniform vec3 uBg;',
    'uniform vec3 uInk;',
    'uniform vec2 uRes;',
    'uniform float uAspect;',
    'uniform float uTime;',
    'uniform float uScale;',
    'uniform float uCell;',
    'uniform float uBgCell;',
    'uniform float uBgBend;',
    'uniform float uCrossGlow;',
    'uniform float uCrossSize;',
    'uniform float uCrossBend;',
    'uniform vec2 uPointer;',
    'uniform float uPointerR;',
    'uniform float uPointerW;',
    'uniform vec2 uBgPointer;',
    'uniform float uBgPointerW;',
    'uniform float uStroke;',
    'uniform float uSdfR;',
    'uniform float uGrain;',
    'uniform float uMoveGlow;',
    'uniform float uMoveDrift;',
    'uniform float uLensAmt;',
    COMMON,
    'vec2 dec(vec2 e){ return e * 2.0 - 1.0; }',
    'float crossMask(vec2 g, float s){',
    '  vec2 ca = abs(fract(g) - 0.5) / max(s, 0.25);',
    '  float th = 0.10;',
    '  float ln = 0.36;',
    '    float aa2 = 0.16;',
    '  float hx = (1.0 - smoothstep(th, th + aa2, ca.y)) * (1.0 - smoothstep(ln, ln + aa2, ca.x));',
    '  float hy = (1.0 - smoothstep(th, th + aa2, ca.x)) * (1.0 - smoothstep(ln, ln + aa2, ca.y));',
    '  return clamp(hx + hy, 0.0, 1.0);',
    '}',
    'vec2 lensWarp(vec2 gc){',
    '  vec2 pc = vec2(uBgPointer.x * uRes.x, uBgPointer.y * uRes.y) / uCell;',
    '  vec2 v0 = gc - pc;',
    '  float rr = length(v0);',
    '  float Rc = max(uPointerR * uRes.y / uCell, 1.0);',
    '  float t = rr / Rc;',
    /* smooth gaussian falloff: no hard rim, the lattice bends gradually so the
       edge of the influence never reads as a seam or an arch */
    '  float ff = exp(-t * t * 1.5) * uBgPointerW;',
    '  return pc + v0 * (1.0 - uLensAmt * ff);',
    '}',
    'void bgCrosses(out float cross, out vec3 tint, out float bright){',
    '  vec2 gv = vec2(vUv.x * uAspect, vUv.y);',
    '  float b1 = vnoise(gv * 0.42 + vec2(uTime * 0.060, -uTime * 0.040));',
    '  float b2 = vnoise(gv * 0.42 + 41.7 + vec2(-uTime * 0.050, uTime * 0.056));',
    '  vec2 gBase = gl_FragCoord.xy / uCell + (vec2(b1, b2) - 0.5) * uCrossBend;',
    '  vec2 g0 = lensWarp(gBase);',
    '  float sz = vnoise(gv * 0.80 + 17.3 + vec2(uTime * 0.100, -uTime * 0.072));',
    '  float s = 1.0 + (sz - 0.5) * uCrossSize;',
    '  cross = crossMask(g0, s);',
    '  float gr = 0.5 + 0.5 * sin(gv.x * 1.35 + gv.y * 0.95 - uTime * 0.11);',
    '  tint = mix(vec3(0.05, 0.07, 0.50), vec3(0.24, 0.05, 0.50), 0.5 + 0.5 * sin(gv.x * 1.10 - uTime * 0.07));',
    '  tint = mix(tint, vec3(0.04, 0.28, 0.48), 0.5 + 0.5 * sin(gv.y * 1.00 + uTime * 0.05));',
    '  bright = 0.30 + 0.70 * gr;',
    '}',
    /* Background: a fixed 12x12px lattice that is revealed in three layers
       inside slowly wandering rounded regions - first a sparse layer, then the
       cells between them, then the remaining ones, so a patch fills up and
       thins out again. The lattice itself never moves; only the reveal moves,
       which reads as motion. */
    'void bgReveal(out float c){',
    '  vec2 gv = vec2(vUv.x * uAspect, vUv.y);',
    '  vec2 g = gl_FragCoord.xy / uBgCell;',
    /* gentle lens bend around the cursor - no colour change, just a small warp */
    '  vec2 pcell = vec2(uBgPointer.x * uRes.x, uBgPointer.y * uRes.y) / uBgCell;',
    '  vec2 vo = g - pcell;',
    '  float rl = length(vo) / max(uPointerR * uRes.y / uBgCell, 1.0);',
    '  g = pcell + vo * (1.0 - uBgBend * exp(-rl * rl * 1.5) * uBgPointerW);',
    /* hard-edged plus: the whole cross is there, or it is not */
    '  vec2 f = abs(fract(g) - 0.5);',
    '  float th = 0.10;',
    '  float ln = 0.36;',
    '  float base = clamp(step(f.y, th) * step(f.x, ln) + step(f.x, th) * step(f.y, ln), 0.0, 1.0);',
    '  vec2 id = floor(g);',
    '  float ex = 1.0 - step(0.5, mod(id.x, 2.0));',
    '  float ey = 1.0 - step(0.5, mod(id.y, 2.0));',
    '  float ox = step(0.5, mod(id.x, 2.0));',
    '  float oy = step(0.5, mod(id.y, 2.0));',
    '  float l1 = ex * ey;',
    '  float l2 = ox * ey + ex * oy;',
    '  float l3 = ox * oy;',
    '  vec2 warp = vec2(',
    '    vnoise(gv * 0.70 + vec2(uTime * 0.112, -uTime * 0.076)),',
    '    vnoise(gv * 0.70 + 11.7 + vec2(-uTime * 0.092, uTime * 0.112))',
    '  );',
    '  float fld = fbm(gv * 1.30 + warp * 0.95 + vec2(-uTime * 0.080, uTime * 0.060));',
    '  float m = smoothstep(0.26, 0.74, fld);',
    /* hard thresholds: a cross is drawn whole or not at all - no fade */
    '  float s1 = step(0.24, m);',
    '  float s2 = step(0.50, m);',
    '  float s3 = step(0.78, m);',
    '  c = base * clamp(l1 * s1 + l2 * s2 + l3 * s3, 0.0, 1.0);',
    '}',
    'void main(){',
    '  vec4 PU = texture2D(uPush, vUv);',
    '  float infl = clamp(PU.b, 0.0, 1.0);',
    '  vec2 D = (dec(texture2D(uD, vUv).ba) + dec(PU.rg)) * uScale * infl;',
    '  vec2 wuv = vUv - D;',
    '  float sd = (texture2D(uSdf, clamp(wuv, 0.0, 1.0)).r - 0.5) * (2.0 * uSdfR);',
    '  float aa = 0.9;',
    '  float fill = smoothstep(-aa, aa, sd);',
    '  vec2 pc = vec2(vUv.x * uAspect, vUv.y);',
    '  float pattern = fbm(pc * 2.0 + vec2(0.0, uTime * 0.1));',
    '  float dth = dither4x4(gl_FragCoord.xy * 0.25 + D * uRes, pattern * 0.85 + 0.15);',
    '  float fillI = mix(0.82, 1.0, dth);',
    '  float cross; vec3 tint; float bright;',
    '  bgCrosses(cross, tint, bright);',
    /* letters keep their original cross texture (untouched) */
    '  vec3 bgInk = uBg + tint * cross * (uCrossGlow * bright);',
    '  float bgc;',
    '  bgReveal(bgc);',
    '  vec2 dvc = pc - vec2(uPointer.x * uAspect, uPointer.y);',
    '  float cMask = (1.0 - smoothstep(uPointerR * 0.30, uPointerR, length(dvc))) * uPointerW;',
    '  cMask = clamp(cMask, 0.0, 1.0);',
    /* every cross is one colour; the cursor only bends them (see bgReveal) */
    '  vec3 bg = uBg + vec3(0.02745, 0.03922, 0.18039) * bgc;',
    '  vec3 col = mix(bg, mix(bgInk, uInk, fillI), fill);',
    '  float ring = 1.0 - smoothstep(uStroke - aa, uStroke + aa, abs(sd));',
    '  col = mix(col, bg, cMask * fill);',
    '  col = mix(col, uInk, cMask * ring);',
    '  float bpat = fbm(pc * 2.0 + vec2(0.0, -uTime * 0.1));',
    '  float bdth = dither4x4(gl_FragCoord.xy * 0.25 + 37.0, bpat * 0.85 + 0.15);',
    '  col += uInk * uGrain * bdth * (1.0 - fill);',
    '  vec2 q = vUv - 0.5;',
    '  col *= 1.0 - dot(q, q) * 0.12;',
    '  if(' + (DEBUG ? 'true' : 'false') + '){ col = vec3(fill, ring, cMask); }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function program(fsSrc) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  var fieldProg, pushProg, dispProg;
  try {
    fieldProg = program(FIELD);
    pushProg = program(PUSH);
    dispProg = program(DISP);
  } catch (e) {
    staticOnly();
    return;
  }

  var fieldU = {
    prev: gl.getUniformLocation(fieldProg, 'uPrev'),
    res: gl.getUniformLocation(fieldProg, 'uRes'),
    aspect: gl.getUniformLocation(fieldProg, 'uAspect'),
    time: gl.getUniformLocation(fieldProg, 'uTime'),
    velDecay: gl.getUniformLocation(fieldProg, 'uVelDecay'),
    warpDecay: gl.getUniformLocation(fieldProg, 'uWarpDecay'),
    visc: gl.getUniformLocation(fieldProg, 'uVisc'),
    idle: gl.getUniformLocation(fieldProg, 'uIdle'),
    velMax: gl.getUniformLocation(fieldProg, 'uVelMax'),
    warpMax: gl.getUniformLocation(fieldProg, 'uWarpMax'),
    warpGain: gl.getUniformLocation(fieldProg, 'uWarpGain'),
    swirl: gl.getUniformLocation(fieldProg, 'uSwirl'),
    reset: gl.getUniformLocation(fieldProg, 'uReset'),
    count: gl.getUniformLocation(fieldProg, 'uCount'),
    splat: gl.getUniformLocation(fieldProg, 'uSplat[0]'),
    deltaA: gl.getUniformLocation(fieldProg, 'uDeltaA[0]')
  };
  var pushU = {
    prev: gl.getUniformLocation(pushProg, 'uPrev'),
    aspect: gl.getUniformLocation(pushProg, 'uAspect'),
    decay: gl.getUniformLocation(pushProg, 'uDecay'),
    max: gl.getUniformLocation(pushProg, 'uMax'),
    brush: gl.getUniformLocation(pushProg, 'uBrush'),
    reset: gl.getUniformLocation(pushProg, 'uReset'),
    aDecay: gl.getUniformLocation(pushProg, 'uADecay'),
    maskR: gl.getUniformLocation(pushProg, 'uMaskR'),
    count: gl.getUniformLocation(pushProg, 'uCount'),
    splat: gl.getUniformLocation(pushProg, 'uSplat[0]'),
    deltaA: gl.getUniformLocation(pushProg, 'uDeltaA[0]')
  };
  var dispU = {
    d: gl.getUniformLocation(dispProg, 'uD'),
    push: gl.getUniformLocation(dispProg, 'uPush'),
    sdf: gl.getUniformLocation(dispProg, 'uSdf'),
    bg: gl.getUniformLocation(dispProg, 'uBg'),
    ink: gl.getUniformLocation(dispProg, 'uInk'),
    res: gl.getUniformLocation(dispProg, 'uRes'),
    aspect: gl.getUniformLocation(dispProg, 'uAspect'),
    time: gl.getUniformLocation(dispProg, 'uTime'),
    scale: gl.getUniformLocation(dispProg, 'uScale'),
    cell: gl.getUniformLocation(dispProg, 'uCell'),
    bgCell: gl.getUniformLocation(dispProg, 'uBgCell'),
    bgBend: gl.getUniformLocation(dispProg, 'uBgBend'),
    crossGlow: gl.getUniformLocation(dispProg, 'uCrossGlow'),
    crossSize: gl.getUniformLocation(dispProg, 'uCrossSize'),
    crossBend: gl.getUniformLocation(dispProg, 'uCrossBend'),
    pointer: gl.getUniformLocation(dispProg, 'uPointer'),
    pointerR: gl.getUniformLocation(dispProg, 'uPointerR'),
    pointerW: gl.getUniformLocation(dispProg, 'uPointerW'),
    bgPointer: gl.getUniformLocation(dispProg, 'uBgPointer'),
    bgPointerW: gl.getUniformLocation(dispProg, 'uBgPointerW'),
    stroke: gl.getUniformLocation(dispProg, 'uStroke'),
    sdfR: gl.getUniformLocation(dispProg, 'uSdfR'),
    grain: gl.getUniformLocation(dispProg, 'uGrain'),
    moveGlow: gl.getUniformLocation(dispProg, 'uMoveGlow'),
    moveDrift: gl.getUniformLocation(dispProg, 'uMoveDrift'),
    lensAmt: gl.getUniformLocation(dispProg, 'uLensAmt')
  };

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function target(w, h, clear) {
    var tex = makeTex(w, h, FIELD_TYPE, FIELD_FILTER);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb };
  }

  var FIELD_CLEAR = [0.5, 0.5, 0.5, 0.5];
  var PUSH_CLEAR = [0.5, 0.5, 0.0, 1.0];

  var W = 0, H = 0, lastW = 0, lastH = 0;
  var fieldW = 0, fieldH = 0;
  var fieldA = null, fieldB = null;
  var pushA = null, pushB = null;
  var sdfTex = null;
  var textCanvas = document.createElement('canvas');
  var textCtx = textCanvas.getContext('2d');
  var logo = null;

  function buildLogoImage() {
    var clone = fallbackEl.cloneNode(true);
    clone.removeAttribute('class');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    var paths = clone.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) paths[i].setAttribute('fill', '#ffffff');
    clone.setAttribute('fill', '#ffffff');
    var str = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  }

  function chamfer(d, w, h) {
    var INF = 1e7, D1 = 1.0, D2 = 1.41421356;
    var x, y, i, m;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        m = d[i];
        if (x > 0 && d[i - 1] + D1 < m) m = d[i - 1] + D1;
        if (y > 0) {
          if (d[i - w] + D1 < m) m = d[i - w] + D1;
          if (x > 0 && d[i - w - 1] + D2 < m) m = d[i - w - 1] + D2;
          if (x < w - 1 && d[i - w + 1] + D2 < m) m = d[i - w + 1] + D2;
        }
        d[i] = m;
      }
    }
    for (y = h - 1; y >= 0; y--) {
      for (x = w - 1; x >= 0; x--) {
        i = y * w + x;
        m = d[i];
        if (x < w - 1 && d[i + 1] + D1 < m) m = d[i + 1] + D1;
        if (y < h - 1) {
          if (d[i + w] + D1 < m) m = d[i + w] + D1;
          if (x < w - 1 && d[i + w + 1] + D2 < m) m = d[i + w + 1] + D2;
          if (x > 0 && d[i + w - 1] + D2 < m) m = d[i + w - 1] + D2;
        }
        d[i] = m;
      }
    }
  }

  function buildSdf(w, h) {
    var n = w * h;
    if (n <= 0) return;
    var img = textCtx.getImageData(0, 0, w, h).data;
    var dF = new Float32Array(n);
    var dB = new Float32Array(n);
    var INF = 1e7;
    for (var i = 0; i < n; i++) {
      if (img[i * 4] > 127) { dF[i] = 0; dB[i] = INF; }
      else { dF[i] = INF; dB[i] = 0; }
    }
    chamfer(dF, w, h);
    chamfer(dB, w, h);
    var out = new Uint8Array(n * 4);
    var inv = 255 / (2 * TUNE.sdfRange);
    for (i = 0; i < n; i++) {
      var sd = dB[i] - dF[i];
      if (sd > TUNE.sdfRange) sd = TUNE.sdfRange;
      else if (sd < -TUNE.sdfRange) sd = -TUNE.sdfRange;
      var v = (sd + TUNE.sdfRange) * inv;
      out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
    }
    if (!sdfTex) {
      sdfTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, sdfTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  var sdfTimer = 0;

  function composeText(w, h) {
    textCanvas.width = w;
    textCanvas.height = h;
    textCtx.fillStyle = '#000';
    textCtx.fillRect(0, 0, w, h);
    var ratio = 1694 / 426;
    var tw = w;
    var th = tw / ratio;
    if (th > h * 0.9) { th = h * 0.9; tw = th * ratio; }
    textCtx.imageSmoothingEnabled = true;
    textCtx.imageSmoothingQuality = 'high';
    // lift the logotype 72 CSS px above centre (the texture maps 1:1 to the
    // hero element, so the offset is scaled by h / hero height)
    var heroCssH = hero.clientHeight || window.innerHeight || h;
    var lift = h * (72 / heroCssH);
    textCtx.drawImage(logo, (w - tw) / 2, (h - th) / 2 - lift, tw, th);

    if (!sdfTex) {
      buildSdf(w, h);
    } else {
      clearTimeout(sdfTimer);
      sdfTimer = setTimeout(function () {
        buildSdf(textCanvas.width, textCanvas.height);
        display();
      }, 130);
    }
  }

  function bind(targetTex, loc, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, targetTex);
    gl.uniform1i(loc, unit);
  }

  function draw() {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var pointer = null;
  var follow = { x: 0.5, y: 0.5 };
  var lastPointer = { x: 0.5, y: 0.5 };
  var pointerMoved = false;
  var presence = 0;
  var settle = 0;
  var resetDone = false;
  var lastMoveAt = 0;
  var uTime = 0;
  var splatArr = new Float32Array(MAXS * 4);
  var deltaArr = new Float32Array(MAXS * 2);
  var pushArr = new Float32Array(MAXS * 2);

  /* Background-lattice cursor: tracked across the whole page (not just the
     hero) so the hero's plus-lattice and the seam canvas below, which continues
     the same lattice, bend around one shared cursor and never disagree at the
     boundary. Exposed as window.__crossCursor for seam-crosses.js. */
  var bgPointer = null;
  var bgFollow = { x: 0.5, y: 0.5 };
  var bgLastMoveAt = 0;
  var bgPresence = 0;

  function bgOnMove(e) {
    bgPointer = toUv(e);
    bgLastMoveAt = performance.now();
  }
  window.addEventListener('pointermove', bgOnMove, { passive: true });
  window.addEventListener('pointerdown', bgOnMove, { passive: true });

  function update(dt) {
    uTime = (performance.now() - timeOrigin) / 1000;
    var dx = 0, dy = 0;
    if (pointer) {
      var k = 1 - Math.exp(-dt / TUNE.followTau);
      follow.x += (pointer.x - follow.x) * k;
      follow.y += (pointer.y - follow.y) * k;
      if (pointerMoved) {
        dx = pointer.x - lastPointer.x;
        dy = pointer.y - lastPointer.y;
        lastPointer.x = pointer.x;
        lastPointer.y = pointer.y;
      }
    }
    pointerMoved = false;
    var now = performance.now();
    if (Math.abs(dx) + Math.abs(dy) >= TUNE.jitter) lastMoveAt = now;
    var idle = (now - lastMoveAt) / 1000;
    var gate = idle <= TUNE.resetHold
      ? 1
      : Math.max(0, 1 - (idle - TUNE.resetHold) / TUNE.resetTime);
    if (!pointer) {
      presence += (0 - presence) * (1 - Math.exp(-dt / TUNE.presenceDown));
    } else if (gate > presence) {
      presence += (gate - presence) * (1 - Math.exp(-dt / TUNE.presenceUp));
    } else {
      presence = gate;
    }
    settle = 1 - gate;
    if (settle < 1) resetDone = false;
    var dm = TUNE.deltaMax;
    if (dx > dm) dx = dm; else if (dx < -dm) dx = -dm;
    if (dy > dm) dy = dm; else if (dy < -dm) dy = -dm;
    deltaArr[0] = dx * TUNE.push;
    deltaArr[1] = dy * TUNE.push;
    pushArr[0] = dx * TUNE.pushDrag;
    pushArr[1] = dy * TUNE.pushDrag;
    splatArr[0] = follow.x;
    splatArr[1] = follow.y;
    splatArr[2] = TUNE.brushR;
    splatArr[3] = presence;

    /* the background lattice rides its own cursor (see bgPointer above) */
    if (bgPointer) {
      var kb = 1 - Math.exp(-dt / TUNE.followTau);
      bgFollow.x += (bgPointer.x - bgFollow.x) * kb;
      bgFollow.y += (bgPointer.y - bgFollow.y) * kb;
    }
    var bgIdle = (now - bgLastMoveAt) / 1000;
    var bgGate = bgIdle <= TUNE.resetHold
      ? 1
      : Math.max(0, 1 - (bgIdle - TUNE.resetHold) / TUNE.resetTime);
    if (!bgPointer) {
      bgPresence += (0 - bgPresence) * (1 - Math.exp(-dt / TUNE.presenceDown));
    } else if (bgGate > bgPresence) {
      bgPresence += (bgGate - bgPresence) * (1 - Math.exp(-dt / TUNE.presenceUp));
    } else {
      bgPresence = bgGate;
    }
    window.__crossCursor = { x: bgFollow.x, y: bgFollow.y, w: bgPresence, t: now };
  }

  function fieldStep(dt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fieldB.fb);
    gl.viewport(0, 0, fieldW, fieldH);
    gl.useProgram(fieldProg);
    bind(fieldA.tex, fieldU.prev, 0);
    gl.uniform2f(fieldU.res, fieldW, fieldH);
    gl.uniform1f(fieldU.aspect, W / H);
    gl.uniform1f(fieldU.time, uTime);
    gl.uniform1f(fieldU.velDecay, Math.exp(-dt / TUNE.velDecayTau));
    gl.uniform1f(fieldU.warpDecay, Math.exp(-dt / TUNE.warpDecayTau));
    gl.uniform1f(fieldU.visc, TUNE.visc);
    gl.uniform1f(fieldU.idle, TUNE.ambient * 0.000012);
    gl.uniform1f(fieldU.velMax, TUNE.velMax);
    gl.uniform1f(fieldU.warpMax, TUNE.warpMax);
    gl.uniform1f(fieldU.warpGain, TUNE.warpGain);
    gl.uniform1f(fieldU.swirl, TUNE.swirl);
    gl.uniform1f(fieldU.reset, settle);
    gl.uniform1i(fieldU.count, 1);
    gl.uniform4fv(fieldU.splat, splatArr);
    gl.uniform2fv(fieldU.deltaA, deltaArr);
    draw();
    var t = fieldA; fieldA = fieldB; fieldB = t;
  }

  function pushStep(dt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, pushB.fb);
    gl.viewport(0, 0, fieldW, fieldH);
    gl.useProgram(pushProg);
    bind(pushA.tex, pushU.prev, 0);
    gl.uniform1f(pushU.aspect, W / H);
    gl.uniform1f(pushU.decay, Math.exp(-dt / TUNE.pushDecayTau));
    gl.uniform1f(pushU.max, TUNE.pushMax);
    gl.uniform1f(pushU.brush, TUNE.pushBrush);
    gl.uniform1f(pushU.reset, settle);
    gl.uniform1f(pushU.aDecay, Math.exp(-dt / TUNE.activityTau));
    gl.uniform1f(pushU.maskR, TUNE.maskR);
    gl.uniform1i(pushU.count, 1);
    gl.uniform4fv(pushU.splat, splatArr);
    gl.uniform2fv(pushU.deltaA, pushArr);
    draw();
    var t = pushA; pushA = pushB; pushB = t;
  }

  function cssWidth() {
    return Math.max(1, hero.clientWidth || window.innerWidth);
  }

  function display() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(dispProg);
    if (!sdfTex) return;
    bind(fieldA.tex, dispU.d, 0);
    bind(pushA.tex, dispU.push, 1);
    bind(sdfTex, dispU.sdf, 2);
    gl.uniform3f(dispU.bg, 0.0, 0.0, 0.0);
    gl.uniform3f(dispU.ink, 0.078, 0.0, 1.0);
    gl.uniform2f(dispU.res, W, H);
    gl.uniform1f(dispU.aspect, W / H);
    gl.uniform1f(dispU.time, uTime);
    gl.uniform1f(dispU.scale, TUNE.dispScale);
    gl.uniform1f(dispU.cell, TUNE.crossCell * (W / cssWidth()));
    gl.uniform1f(dispU.bgCell, TUNE.bgCell * (W / cssWidth()));
    gl.uniform1f(dispU.bgBend, TUNE.bgBend);
    gl.uniform1f(dispU.crossGlow, TUNE.crossGlow);
    gl.uniform1f(dispU.crossSize, TUNE.crossSize);
    gl.uniform1f(dispU.crossBend, TUNE.crossBend);
    gl.uniform2f(dispU.pointer, follow.x, follow.y);
    gl.uniform1f(dispU.pointerR, TUNE.lensR);
    gl.uniform1f(dispU.pointerW, presence);
    gl.uniform2f(dispU.bgPointer, bgFollow.x, bgFollow.y);
    gl.uniform1f(dispU.bgPointerW, bgPresence);
    gl.uniform1f(dispU.sdfR, TUNE.sdfRange);
    gl.uniform1f(dispU.grain, TUNE.grain);
    gl.uniform1f(dispU.moveGlow, TUNE.moveGlow);
    gl.uniform1f(dispU.moveDrift, TUNE.moveDrift);
    gl.uniform1f(dispU.lensAmt, TUNE.lensAmt);
    gl.uniform1f(dispU.stroke, TUNE.strokePx * 0.5 * (W / cssWidth()));
    draw();
  }

  function clearFields() {
    var targets = [fieldA, fieldB, pushA, pushB];
    var clears = [FIELD_CLEAR, FIELD_CLEAR, PUSH_CLEAR, PUSH_CLEAR];
    for (var i = 0; i < targets.length; i++) {
      if (!targets[i]) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[i].fb);
      gl.clearColor(clears[i][0], clears[i][1], clears[i][2], clears[i][3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function step(dt) {
    update(dt);
    if (settle >= 1) {
      if (!resetDone) { clearFields(); resetDone = true; }
    } else {
      fieldStep(dt);
      pushStep(dt);
    }
    display();
  }

  var last = 0;
  var running = false;
  var onScreen = true;
  var docVisible = !document.hidden;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    step(dt);
  }

  function start() {
    if (running || !logo || !onScreen || !docVisible) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
  }

  function resize() {
    var cw = hero.clientWidth || window.innerWidth;
    var ch = hero.clientHeight || window.innerHeight;
    if (cw < 2 || ch < 2) return;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(2, Math.round(cw * scale));
    H = Math.max(2, Math.round(ch * scale));
    var maxArea = 3200000;
    if (W * H > maxArea) {
      var k = Math.sqrt(maxArea / (W * H));
      W = Math.max(2, Math.round(W * k));
      H = Math.max(2, Math.round(H * k));
    }
    if (W === lastW && H === lastH) return;
    lastW = W; lastH = H;
    canvas.width = W;
    canvas.height = H;
    fieldW = Math.max(2, Math.round(W * FIELD_SCALE));
    fieldH = Math.max(2, Math.round(H * FIELD_SCALE));
    fieldA = target(fieldW, fieldH, FIELD_CLEAR);
    fieldB = target(fieldW, fieldH, FIELD_CLEAR);
    pushA = target(fieldW, fieldH, PUSH_CLEAR);
    pushB = target(fieldW, fieldH, PUSH_CLEAR);
    composeText(W, H);
    presence = 0;
    follow.x = 0.5; follow.y = 0.5;
    display();
  }

  function toUv(e) {
    var r = hero.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width),
      y: 1 - (e.clientY - r.top) / Math.max(1, r.height)
    };
  }

  function onMove(e) {
    pointer = toUv(e);
    pointerMoved = true;
  }

  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerdown', onMove, { passive: true });
  hero.addEventListener('pointerleave', function () { pointer = null; lastMoveAt = performance.now(); }, { passive: true });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resize(); start(); }, 120);
  });

  if ('IntersectionObserver' in window) {
    var sync = function () {
      if (onScreen && docVisible) start(); else stop();
    };
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onScreen = e.isIntersecting; });
      sync();
    }).observe(canvas);
    document.addEventListener('visibilitychange', function () {
      docVisible = !document.hidden; sync();
    });
  }

  var img = new Image();
  img.onload = function () {
    logo = img;
    resize();
    display();
    hero.classList.add('is-live');
    start();
  };
  img.onerror = function () { staticOnly(); };
  img.src = buildLogoImage();
})();
