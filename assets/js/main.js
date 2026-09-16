(() => {
  'use strict';

  // Header scroll state
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    if (window.scrollY > 40) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  // Fit the top line width to the name width
  const heroName = document.querySelector('.hero-name');
  const heroTopline = document.querySelector('.hero-topline');
  if (heroName && heroTopline) {
    const fitTopline = () => {
      const nameW = heroName.getBoundingClientRect().width;
      heroTopline.style.fontSize = '16px';
      const baseW = heroTopline.getBoundingClientRect().width;
      if (nameW > 0 && baseW > 0) heroTopline.style.fontSize = (16 * nameW / baseW).toFixed(2) + 'px';
    };
    fitTopline();
    addEventListener('resize', fitTopline);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTopline);
  }

  // Pause background videos for reduced motion
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('video').forEach((v) => v.pause());
  }

  // Mobile menu
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.body.classList.toggle('menu-open');
    });
    document.querySelectorAll('.overlay a').forEach((a) => {
      a.addEventListener('click', () => document.body.classList.remove('menu-open'));
    });
  }

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  // Stat count-up
  const statNums = document.querySelectorAll('.stat-num');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && statNums.length && !reducedMotion) {
    const run = (el) => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const suffix = el.dataset.suffix || '';
      const dur = 900;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run(entry.target);
          io2.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    statNums.forEach((el) => io2.observe(el));
  }

  // Sfera background videos: load and play only while on screen, pause otherwise
  const sferaVideos = document.querySelectorAll('.sfera-video');
  if (sferaVideos.length && !reducedMotion) {
    const loadSfera = (v) => {
      if (v.dataset.loaded === '1') return;
      const sources = v.querySelectorAll('source[data-src]');
      if (sources.length) {
        sources.forEach((s) => { if (!s.src) s.src = s.dataset.src; });
        v.load();
      } else if (!v.src && v.dataset.src) {
        v.src = v.dataset.src;
      }
      v.dataset.loaded = '1';
    };
    const playSfera = (v) => {
      loadSfera(v);
      if (!document.hidden && v.dataset.visible === '1') {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      }
    };
    sferaVideos.forEach((v) => {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            v.dataset.visible = e.isIntersecting ? '1' : '0';
            if (e.isIntersecting) playSfera(v);
            else v.pause();
          });
        }, { rootMargin: '200px 0px' }).observe(v);
      } else {
        v.dataset.visible = '1';
        playSfera(v);
      }
    });
    document.addEventListener('visibilitychange', () => {
      sferaVideos.forEach((v) => {
        if (document.hidden) v.pause();
        else playSfera(v);
      });
    });
  }

  // Clients logo rows: slide-up + per-logo stagger + 2s hold, crossfade loop
  const clientsStage = document.querySelector('.clients-stage');
  if (clientsStage && !reducedMotion) {
    const rows = clientsStage.querySelectorAll('.clients-row');
    if (rows.length) {
      const OUT = 500;
      const STAGGER = 100;
      const LOGO = 350;
      const HOLD = 1400;
      const STEP = LOGO + STAGGER * (rows[0].children.length - 1) + HOLD;
      let idx = 0;
      let timer = null;

      const enter = (i) => {
        rows.forEach((r, k) => {
          r.classList.toggle('is-active', k === i);
          if (k === i) r.classList.remove('is-leaving');
        });
      };

      const advance = () => {
        const cur = idx;
        idx = (idx + 1) % rows.length;
        rows[cur].classList.remove('is-active');
        rows[cur].classList.add('is-leaving');
        enter(idx);
        setTimeout(() => rows[cur].classList.remove('is-leaving'), OUT + 60);
      };

      const startClients = () => { if (timer === null) timer = setInterval(advance, STEP); };
      const stopClients = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

      enter(0);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((e) => (e.isIntersecting ? startClients() : stopClients()));
        }).observe(clientsStage);
      } else {
        startClients();
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopClients();
        else startClients();
      });
    }
  }

  // Butik card-stacks: pause while off-screen and reveal only once the photos are
  // decoded, so the first start does not pop while images are still loading.
  if (!reducedMotion && 'IntersectionObserver' in window) {
    document.querySelectorAll('.butik-slides').forEach((el) => {
      const veil = el.parentElement && el.parentElement.querySelector('.butik-veil');
      const imgs = Array.from(el.querySelectorAll('img'));
      let shown = false;
      const imagesReady = () => Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth) return Promise.resolve();
        img.loading = 'eager';
        return new Promise((res) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        });
      }));
      const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const reveal = () => {
        if (shown) { el.classList.remove('is-paused'); return; }
        imagesReady().then(nextFrame).then(() => {
          shown = true;
          el.classList.add('is-shown');
          el.classList.remove('is-paused');
          if (veil) veil.classList.add('is-hidden');
        });
      };
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) reveal();
          else el.classList.add('is-paused');
        });
      }, { rootMargin: '150px 0px' }).observe(el);
    });
  }
})();
