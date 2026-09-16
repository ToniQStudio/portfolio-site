(() => {
  'use strict';

  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance'
  });
  if (!gl) return; // CSS gradient fallback stays visible

  const VS = [
    'attribute vec2 a_pos;',
    'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  const FS = [
    'precision highp float;',
    '',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform vec2  u_mouse;',
    'uniform float u_strength;',
    '',
    '#define TAU  6.28318530718',
    '#define LOOP 40.0',
    '',
    'mat2 rot2(float a){',
    '  float c = cos(a), s = sin(a);',
    '  return mat2(c, -s, s, c);',
    '}',
    '',
    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for(int i = 0; i < 3; i++){',
    '    v += a * vnoise(p);',
    '    p = rot2(0.7) * p * 2.02 + vec2(53.7, 97.3);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'float warp(vec2 p){',
    '  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));',
    '  return fbm(p + 3.4 * q);',
    '}',
    '',
    'float band(vec2 p, float t, float flow, float ph, float baseY){',
    '  float k   = TAU / LOOP;',
    '  float yc  = baseY + 0.10 * sin(k * t + ph);',
    '  float hgt = 0.16 + 0.12 * sin(k * t * 2.0 + ph * 1.9);',
    '  float wv  = 0.10 * sin(p.x * 2.3 + ph * 2.0 + 0.9 * sin(k * t + ph * 2.4))',
    '            + 0.07 * sin(p.x * 5.1 - k * t + ph * 1.2)',
    '            + 0.24 * (flow - 0.5);',
    '  float d = (p.y - yc + wv) / max(hgt, 0.03);',
    '  return exp(-d * d * 2.8);',
    '}',
    '',
    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);',
    '  float t = mod(u_time, LOOP);',
    '  float k = TAU / LOOP;',
    '',
    '  float zoom = 1.0 + 0.08 * sin(k * t + 1.0);',
    '  float skew = 0.30 * sin(k * t + 0.9);',
    '  vec2 pan = vec2(0.45 * sin(k * t + 0.5), 0.12 * sin(k * t + 2.3));',
    '  vec2 p = uv * 1.05 * zoom + pan;',
    '  p.x += p.y * skew;',
    '',
    '  vec2 muv = (u_mouse * u_res - 0.5 * u_res) / min(u_res.x, u_res.y);',
    '  vec2 mp = muv * 1.05 * zoom + pan;',
    '  mp.x += mp.y * skew;',
    '  vec2 toM = p - mp;',
    '  float md = length(toM);',
    '  float mw = u_strength * exp(-md * md * 24.0);',
    '  p -= toM * mw * 0.6;',
    '',
    '  vec3 deep   = vec3(0.043, 0.078, 0.231);',
    '  vec3 red    = vec3(1.000, 0.000, 0.200);',
    '  vec3 blue   = vec3(0.000, 0.333, 1.000);',
    '  vec3 green  = vec3(0.000, 0.800, 0.400);',
    '  vec3 yellow = vec3(1.000, 0.800, 0.000);',
    '',
    '  float flow = warp(p * 1.35 + vec2(0.35 * sin(k * t), 0.15 * cos(k * t)));',
    '',
    '  vec3 col = deep;',
    '  float sum = 1.0;',
    '',
    '  float w  = band(p, t, flow, 0.0, -0.62); col += deep * w * 1.00;                     sum += w * 1.00;',
    '  w        = band(p, t, flow, 1.7, -0.47); col += mix(deep, blue, 0.60) * w * 0.95;    sum += w * 0.95;',
    '  w        = band(p, t, flow, 3.2, -0.32); col += blue * w * 0.95;                     sum += w * 0.95;',
    '  w        = band(p, t, flow, 4.9, -0.17); col += mix(blue, red, 0.45) * w * 0.95;     sum += w * 0.95;',
    '  w        = band(p, t, flow, 6.1, -0.02); col += red * w * 0.95;                      sum += w * 0.95;',
    '  w        = band(p, t, flow, 0.8,  0.13); col += mix(red, yellow, 0.50) * w * 0.95;   sum += w * 0.95;',
    '  w        = band(p, t, flow, 2.4,  0.28); col += yellow * w * 0.95;                   sum += w * 0.95;',
    '  w        = band(p, t, flow, 4.0,  0.43); col += mix(yellow, green, 0.55) * w * 0.85; sum += w * 0.85;',
    '  w        = band(p, t, flow, 5.6,  0.58); col += mix(green, deep, 0.40) * w * 0.50;   sum += w * 0.50;',
    '',
    '  col /= sum;',
    '',
    '  float gr = vnoise(gl_FragCoord.xy * 0.45 + 24.0 * vec2(sin(k * t), cos(k * t)));',
    '  col += (gr - 0.5) * 0.025;',
    '',
    '  col *= 1.0 - 0.40 * smoothstep(0.40, 1.45, length(uv));',
    '  col = pow(max(col, 0.0), vec3(0.95));',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function make(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return {
      s: s,
      ok: gl.getShaderParameter(s, gl.COMPILE_STATUS),
      log: gl.getShaderInfoLog(s)
    };
  }

  // Old GPUs often lack highp support in fragment shaders (optional in WebGL1)
  let fs = make(gl.FRAGMENT_SHADER, FS);
  if (!fs.ok) {
    fs = make(gl.FRAGMENT_SHADER, FS.replace('precision highp float;', 'precision mediump float;'));
  }
  if (!fs.ok) console.error('Shader error:', fs.log);

  const prog = gl.createProgram();
  gl.attachShader(prog, make(gl.VERTEX_SHADER, VS).s);
  gl.attachShader(prog, fs.s);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes  = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uStrength = gl.getUniformLocation(prog, 'u_strength');

  let scale = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(innerWidth  * dpr * scale);
    const h = Math.round(innerHeight * dpr * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  resize();
  addEventListener('resize', resize);

  document.body.classList.add('webgl');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, hot: 0, amp: 0 };
  function onMove(e) {
    mouse.tx = e.clientX / innerWidth;
    mouse.ty = 1 - e.clientY / innerHeight;
    mouse.hot = 1;
  }
  addEventListener('pointermove', onMove);
  addEventListener('touchmove', onMove, { passive: true });

  let running = true;
  let last = 0, frames = 0, acc = 0;
  function frame(now) {
    if (!running) return;
    const dt = last ? now - last : 16.7; last = now;
    acc += dt; frames++;
    if (frames >= 45) {
      const avg = acc / frames;
      if (avg > 18 && scale > 0.40)   { scale = Math.max(0.40, scale * 0.85); resize(); }
      else if (avg < 12 && scale < 1) { scale = Math.min(1, scale * 1.05); resize(); }
      frames = 0; acc = 0;
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 13.7 : now * 0.001);
    mouse.x = mouse.tx;
    mouse.y = mouse.ty;
    mouse.amp += (mouse.hot - mouse.amp) * 0.5;
    mouse.hot *= 0.94;
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uStrength, mouse.amp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced && running) requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true; last = 0; frames = 0; acc = 0;
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }

  if (!reduced && 'IntersectionObserver' in window) {
    let onScreen = true;
    let docVisible = !document.hidden;
    const update = () => {
      if (onScreen && docVisible) start();
      else stop();
    };
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { onScreen = e.isIntersecting; update(); });
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      docVisible = !document.hidden; update();
    });
  }

  requestAnimationFrame(frame);
})();
