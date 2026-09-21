(() => {
  'use strict';

  const canvas = document.getElementById('toniqIntroCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const BG = '#1a1a1a';
  const INK = '#ffffff';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

  const CHAR_ASPECT = 0.6;   // monospace advance width / font size
  const LINE_FACTOR = 1.15;  // line height / font size
  const FILL_W = 0.94;       // copy block width as a fraction of the frame
  const CURSOR_H = 0.80;     // idle cursor height as a fraction of the frame
  const NAV_CLEAR = 84;      // px kept clear of the fixed menu at the top

  const DURATION = 5000;     // whole animation, ms
  const IDLE = 700;          // ms of blinking before the first key
  const BLINK = 300;         // ms per half-blink
  const ACCEL = 4.5;         // typing acceleration (exponential curve)

  // Three pages of the studio's own markup, cycled so the field never reads as
  // one line repeated.
  const DOCS = [
    [
      '<!DOCTYPE html>',
      '<html lang="ru">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>ToniQ Studio — дизайн, который работает</title>',
      '  <link rel="stylesheet" href="/assets/theme.css">',
      '  <script src="/assets/app.js" defer><\/script>',
      '</head>',
      '<body class="theme-toniq">',
      '  <header class="site-header">',
      '    <a class="brand" href="/">ToniQ Studio</a>',
      '    <nav class="site-nav" aria-label="Основная навигация">',
      '      <a href="/work">Проекты</a>',
      '      <a href="/process">Процесс</a>',
      '      <a href="/contact">Контакты</a>',
      '    </nav>',
      '  </header>',
      '  <main id="main">',
      '    <section class="hero">',
      '      <p class="hero-kicker">Продуктовый дизайн</p>',
      '      <h1 class="hero-title">Проектируем интерфейсы, которые работают</h1>',
      '      <p class="hero-lead">Исследования, дизайн-системы и прототипы для команд, которые ценят скорость и ясность.</p>',
      '      <a class="btn btn--primary" href="/contact">Обсудить проект</a>',
      '    </section>',
      '    <section class="services">',
      '      <article class="card">',
      '        <h2>Продуктовый дизайн</h2>',
      '        <p>От гипотезы до интерфейса: сценарии, прототипы, тесты.</p>',
      '      </article>',
      '      <article class="card">',
      '        <h2>Дизайн-системы</h2>',
      '        <p>Токены, компоненты и документация для масштабирования.</p>',
      '      </article>',
      '      <article class="card">',
      '        <h2>Консультации</h2>',
      '        <p>Аудит интерфейсов и процессы дизайн-команды.</p>',
      '      </article>',
      '    </section>',
      '  </main>',
      '  <footer class="site-footer">',
      '    <p>© ToniQ Studio</p>',
      '  </footer>',
      '</body>',
      '</html>'
    ].join('\n'),
    [
      '<!DOCTYPE html>',
      '<html lang="ru">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>Проекты — ToniQ Studio</title>',
      '</head>',
      '<body class="page-work">',
      '  <main class="work-grid">',
      '    <article class="project" data-year="2026">',
      '      <h2>Банк Онлайн</h2>',
      '      <p>Редизайн личного кабинета: 42 экрана, новая навигация и дизайн-система.</p>',
      '      <ul class="tags"><li>Fintech</li><li>Design System</li></ul>',
      '    </article>',
      '    <article class="project" data-year="2025">',
      '      <h2>Медицина</h2>',
      '      <p>Запись к врачу за три шага, доступность уровня WCAG 2.2 AA.</p>',
      '      <ul class="tags"><li>Health</li><li>Accessibility</li></ul>',
      '    </article>',
      '    <article class="project" data-year="2025">',
      '      <h2>Логистика</h2>',
      '      <p>Диспетчерская панель реального времени для 1200 машин.</p>',
      '      <ul class="tags"><li>Dashboard</li><li>Realtime</li></ul>',
      '    </article>',
      '  </main>',
      '</body>',
      '</html>'
    ].join('\n'),
    [
      '<!DOCTYPE html>',
      '<html lang="ru">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>Контакты — ToniQ Studio</title>',
      '</head>',
      '<body class="page-contact">',
      '  <section class="pricing">',
      '    <h1>Форматы работы</h1>',
      '    <div class="plans">',
      '      <div class="plan"><h2>Аудит</h2><p class="price">120 000 RUB</p></div>',
      '      <div class="plan plan--pro"><h2>Спринт</h2><p class="price">450 000 RUB</p></div>',
      '      <div class="plan"><h2>Подписка</h2><p class="price">по запросу</p></div>',
      '    </div>',
      '  </section>',
      '  <form class="contact-form" action="/api/lead" method="post">',
      '    <label>Имя<input type="text" name="name" required></label>',
      '    <label>Почта<input type="email" name="email" required></label>',
      '    <label>Задача<textarea name="brief" rows="4"></textarea></label>',
      '    <button class="btn" type="submit">Отправить</button>',
      '  </form>',
      '</body>',
      '</html>'
    ].join('\n')
  ].map((doc) => doc.replace(/\s*\n\s*/g, ' '));

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  let W = 0;
  let H = 0;
  let fs0 = 0;       // idle cursor font size
  let fsMin = 5;     // final "dot" font size
  let fillH = 0.8;   // block height, leaving the menu clear
  let aspect = 1;    // block columns per row that best matches the frame
  let nFinal = 1;    // characters typed by the end
  let text = '';

  let fsTarget = 0;  // monotonic, so the copy never grows back
  let elapsed = 0;
  let last = 0;
  let finished = false;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // The studio's markup, stamped and repeated until it covers the frame.
  const buildText = (minLen) => {
    const parts = [];
    let len = 0;
    let i = 0;
    while (len < minLen) {
      const chunk = DOCS[i % DOCS.length] + ' <!-- build ' + (i + 1) + ' --> ';
      parts.push(chunk);
      len += chunk.length;
      i++;
    }
    return parts.join('');
  };

  // Geometry for N characters: the column count grows with the copy, so the
  // font size falls and the block keeps roughly filling the frame.
  const layout = (n) => {
    const maxW = FILL_W * W;
    const maxH = fillH * H;
    const rows = Math.max(1, Math.round(Math.sqrt(Math.max(1, n) / aspect)));
    const cols = Math.max(1, Math.ceil(n / rows));
    const fs = Math.min(fs0, maxW / (cols * CHAR_ASPECT), maxH / (rows * LINE_FACTOR));
    return { fs: fs };
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fs0 = (CURSOR_H * H) / LINE_FACTOR;
    fsMin = clamp(H / 180, 4.5, 8);
    fillH = clamp(1 - (2 * NAV_CLEAR) / H, 0.68, 0.86);
    const maxW = FILL_W * W;
    const maxH = fillH * H;
    aspect = (maxW * LINE_FACTOR) / (maxH * CHAR_ASPECT);
    const rowsFinal = Math.max(1, Math.round(maxH / (LINE_FACTOR * fsMin)));
    nFinal = Math.max(1, Math.round(aspect * rowsFinal * rowsFinal));
    text = buildText(nFinal + 64);

    fsTarget = fs0;
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const typing = t > IDLE;
    let n = 0;
    if (typing) {
      const u = clamp((t - IDLE) / (DURATION - IDLE), 0, 1);
      n = Math.round(nFinal * (Math.exp(ACCEL * u) - 1) / (Math.exp(ACCEL) - 1));
      if (n < 1) n = 1;
    }

    // Reserve one cell for the cursor, so the block always has room for it.
    const count = typing ? n + 1 : 1;
    fsTarget = Math.min(fsTarget, layout(count).fs);
    const fs = fsTarget;

    const charW = fs * CHAR_ASPECT;
    const lineH = fs * LINE_FACTOR;
    const cols = Math.max(1, Math.floor((FILL_W * W) / charW));
    const rows = Math.max(1, Math.ceil(count / cols));

    const copy = typing ? text.slice(0, n) : '';
    const blockW = (rows > 1 ? cols : Math.min(cols, count)) * charW;
    const blockH = rows * lineH;
    const x0 = (W - blockW) / 2;
    const y0 = (H - blockH) / 2;

    ctx.font = fs.toFixed(2) + 'px ' + MONO;
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    for (let r = 0; r < rows; r++) {
      const start = r * cols;
      if (start >= copy.length) break;
      ctx.fillText(copy.substr(start, cols), x0, y0 + r * lineH);
    }

    const blinkOn = typing || Math.floor(t / BLINK) % 2 === 0;
    if (blinkOn) {
      const row = Math.min(Math.floor(n / cols), rows - 1);
      const col = n - row * cols;
      ctx.fillRect(x0 + col * charW, y0 + row * lineH, Math.max(1, charW), Math.max(1, lineH));
    }
  };

  const loop = (now) => {
    if (finished) return;
    elapsed += Math.min(64, now - (last || now));
    last = now;
    if (elapsed >= DURATION) {
      draw(DURATION);
      finished = true;
      return;
    }
    draw(elapsed);
    requestAnimationFrame(loop);
  };

  const restart = () => {
    resize();
    elapsed = 0;
    last = 0;
    finished = false;
    if (reduceMotion.matches) {
      draw(DURATION);
      finished = true;
    } else {
      draw(0);
      requestAnimationFrame(loop);
    }
  };

  restart();

  addEventListener('resize', () => {
    resize();
    if (finished) draw(DURATION);
  });
})();
