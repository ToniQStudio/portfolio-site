(() => {
  'use strict';

  /* The hero's animated plus-lattice, continued down to the sphere.
     A small WebGL canvas at the top of the seam runs the exact same reveal
     field as hero-liquid.js (same noise, same thresholds, same wall clock
     origin), so the crosses flow across the hero's bottom edge as one
     continuous picture and melt away right above the arc. */

  var canvas = document.getElementById('seamCrosses');
  var seam = document.querySelector('.seam');
  var hero = document.querySelector('.hero');
  if (!canvas || !seam || !hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.__heroLiquidStart) return;

  var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return;

  var VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uW;',
    'uniform float uH;',
    'uniform float uHeroH;',
    'uniform float uArcR;',
    'uniform float uArcY;',
    'uniform float uPx;',
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
    'void main(){',
    /* hero-frame css coordinates: y = 0 on the hero's bottom edge (this
       canvas' top), negative going down - the same frame the hero shader
       feeds its background noise with */
    '  vec2 hc = vec2(vUv.x * uW, (vUv.y - 1.0) * uH);',
    '  vec2 gv = hc / uHeroH;',
    /* the 8px plus lattice (css units - cell scale cancels the device scale) */
    '  vec2 g = hc / 8.0;',
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
    '  float s1 = step(0.24, m);',
    '  float s2 = step(0.50, m);',
    '  float s3 = step(0.78, m);',
    '  float c = base * clamp(l1 * s1 + l2 * s2 + l3 * s3, 0.0, 1.0);',
    /* the crosses melt away just above the arc's rim */
    '  float dc = length(vec2(gl_FragCoord.x - uW * uPx * 0.5, gl_FragCoord.y - uArcY));',
    '  float fade = smoothstep(uArcR + 8.0 * uPx, uArcR + 120.0 * uPx, dc);',
    '  float a = c * fade;',
    '  gl_FragColor = vec4(vec3(0.02745, 0.03922, 0.18039) * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

  var U = {};
  ['uTime', 'uW', 'uH', 'uHeroH', 'uArcR', 'uArcY', 'uPx'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  var running = false;
  var onScreen = false;
  var geom = null;

  function measure() {
    var w = canvas.clientWidth || 1;
    var h = canvas.clientHeight || 1;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5);
    var rw = Math.max(2, Math.round(w * scale));
    var rh = Math.max(2, Math.round(h * scale));
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
    }
    var px = rw / w;
    var cs = getComputedStyle(seam);
    var vw = window.innerWidth;
    var arcR = (parseFloat(cs.getPropertyValue('--arc-r')) || 133.48) * vw / 100;
    var arcRise = (parseFloat(cs.getPropertyValue('--arc-rise')) || 9.72) * vw / 100;
    var drop = parseFloat(cs.getPropertyValue('--drop')) || 0;
    var seamH = seam.offsetHeight || h * 2;
    /* the arc's ends sit at --line-y = 50% + drop/2 inside the block */
    var lineY = seamH / 2 + drop / 2;
    var centerCss = lineY + arcR - arcRise;
    geom = {
      w: w,
      h: h,
      heroH: hero.clientHeight || window.innerHeight,
      px: px,
      arcR: arcR * px,
      arcY: (h - centerCss) * px
    };
  }

  function draw() {
    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, (performance.now() - window.__heroLiquidStart) / 1000);
    gl.uniform1f(U.uW, geom.w);
    gl.uniform1f(U.uH, geom.h);
    gl.uniform1f(U.uHeroH, geom.heroH);
    gl.uniform1f(U.uArcR, geom.arcR);
    gl.uniform1f(U.uArcY, geom.arcY);
    gl.uniform1f(U.uPx, geom.px);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!geom || !hero.classList.contains('is-live')) return;
    draw();
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function stop() { running = false; }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      if (onScreen) start();
    }, 120);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onScreen = e.isIntersecting; });
      if (onScreen) start(); else stop();
    }, { rootMargin: '80px 0px' }).observe(canvas);
  } else {
    onScreen = true;
    start();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (onScreen) start();
  });

  measure();

  /* wait for the hero canvas to come alive, then draw the continued field */
  var wait = setInterval(function () {
    if (hero.classList.contains('is-live')) {
      clearInterval(wait);
      measure();
      if (onScreen) start();
    }
  }, 250);
  setTimeout(function () { clearInterval(wait); }, 15000);
})();
