(() => {
  'use strict';

  // Header scroll state
  const navbar = document.getElementById('navbar');
  const isWorkPage = document.documentElement.classList.contains('work');
  const onScroll = () => {
    if (!isWorkPage && window.scrollY > 40) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  // Footer copyright: stamp the current year so the markup never goes stale
  const yearEl = document.querySelector('.sfooter-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

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

  // Editorial figures that pan sideways on narrow screens should only enter the
  // tab order while they actually scroll, so a desktop reader isn't tabbed into
  // a region that has nothing to pan.
  const pans = document.querySelectorAll('.ed-fig--pan');
  if (pans.length) {
    const syncPans = () => {
      pans.forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) el.setAttribute('tabindex', '0');
        else el.removeAttribute('tabindex');
      });
    };
    syncPans();
    addEventListener('resize', syncPans);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncPans);
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

  // Work page: full-screen panels driven by a custom controller — exactly one
  // screen per gesture, in both directions. The incoming panel rides up from
  // below and layers on top; its gradient drifts up a third of the way while the
  // copy is pushed off the top edge at the speed of the incoming panel's climb.
  const snap = document.getElementById('snap');
  if (snap) {
    const panels = Array.from(snap.querySelectorAll('.panel'));
    const dots = Array.from(document.querySelectorAll('.dots .dot'));
    const inners = panels.map((p) => p.querySelector('.panel-inner'));
    const bgs = panels.map((p) => p.querySelector('.panel-bg'));
    const icons = panels.map((p) => p.querySelector('.panel-icon'));
    const btns = panels.map((p) => p.querySelector('.panel-btn'));
    const lastShift = new Array(panels.length).fill(null);
    const lastBg = new Array(panels.length).fill(null);
    const lastPar = new Array(panels.length).fill(null);
    const lastBtn = new Array(panels.length).fill(null);

    const RIDE = 12;        // % the incoming panel lags below before it settles
    const BG_DRIFT = 1 / 6; // how far the background drifts up during a swap
    const SWIPE = 40;       // px a touch must travel before it counts as a swipe
    const LOCK = 1200;      // ms before another gesture is accepted
    const SWAP = 1000;      // ms a one-screen move takes
    const SWAP_MAX = 2400;  // ms cap for multi-panel jumps
    const easeInOut = (t) => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

    const setActive = (i) => {
      if (i < 0) return;
      dots.forEach((d, k) => {
        const on = k === i;
        d.classList.toggle('is-active', on);
        if (on) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      if (navbar) {
        const onLight = !!(panels[i] && panels[i].classList.contains('panel--light'));
        navbar.classList.toggle('navbar--on-light', onLight);
      }
    };

    let active = -1;
    let target = 0;
    let animating = false;
    let lockUntil = 0;
    let ticking = false;
    let rafId = 0;

    // measure the real panel height (100vh) rather than innerHeight, so the maths
    // stays right on mobile where the visible viewport differs
    let vh = window.innerHeight || 1;
    const measure = () => {
      vh = (panels[0] && panels[0].getBoundingClientRect().height) || window.innerHeight || 1;
    };
    measure();

    // Snap offsets: one per panel, plus the footer when the page has one. Without
    // a footer the last panel is simply the end of the page — no wrap-around.
    const footerEl = document.querySelector('.sfooter');
    const footerIndex = footerEl ? panels.length : -1;
    const footerOffset = () => Math.max(0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight);
    const positions = () => {
      const ps = panels.map((_, i) => i * vh);
      if (footerEl) ps.push(Math.max(footerOffset(), (panels.length - 1) * vh));
      return ps;
    };

    const nearestIndex = (y) => {
      const ps = positions();
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < ps.length; i++) {
        const d = Math.abs(ps[i] - y);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    };

    // A footer taller than the viewport cannot be shown in one screen, so past
    // the last panel we hand scrolling back to the browser instead of snapping.
    const footerFree = () => !!footerEl && footerOffset() > footerIndex * vh &&
      window.scrollY >= footerIndex * vh - 2;

    const paint = () => {
      const h = vh;
      const center = window.scrollY / h;
      panels.forEach((p, i) => {
        const inner = inners[i];
        if (reducedMotion) {
          if (inner && lastShift[i] !== '') { inner.style.transform = ''; lastShift[i] = ''; }
          if (bgs[i] && lastBg[i] !== '') { bgs[i].style.transform = ''; lastBg[i] = ''; }
          if (icons[i] && lastPar[i] !== '') { icons[i].style.removeProperty('--par'); lastPar[i] = ''; }
          if (btns[i] && lastBtn[i] !== '') { btns[i].style.removeProperty('--btn-par'); lastBtn[i] = ''; }
          return;
        }
        // only the panels touching the viewport need per-frame updates
        if (i < center - 1 || i > center + 1) return;

        const outP = clamp01(center - i);
        // climb of the incoming panel's top edge, measured from the start of the swap
        const climb = outP * h + (RIDE / 100) * h * easeInOut(outP);

        if (inner) {
          const shift = outP > 0 ? 'translate3d(0,' + (-climb).toFixed(1) + 'px,0)' : '';
          if (lastShift[i] !== shift) { inner.style.transform = shift; lastShift[i] = shift; }
        }

        // the gradient (and the icon on it) drifts up a third as fast as the copy
        const drift = (-BG_DRIFT * outP * h).toFixed(1);
        if (bgs[i]) {
          const t = 'translate3d(0,' + drift + 'px,0)';
          if (lastBg[i] !== t) { bgs[i].style.transform = t; lastBg[i] = t; }
        }
        if (icons[i]) {
          const v = drift + 'px';
          if (lastPar[i] !== v) { icons[i].style.setProperty('--par', v); lastPar[i] = v; }
        }

        // the button rides up in lockstep with the copy
        if (btns[i]) {
          const v = (-climb).toFixed(1) + 'px';
          if (lastBtn[i] !== v) { btns[i].style.setProperty('--btn-par', v); lastBtn[i] = v; }
        }
      });

      const idx = nearestIndex(window.scrollY);
      if (!animating) target = idx;
      if (idx !== active) { active = idx; setActive(idx); }
    };

    const onWorkScroll = () => {
      if (ticking) return;
      ticking = true;
      const run = () => {
        if (!ticking) return;
        ticking = false;
        paint();
      };
      requestAnimationFrame(run);
      window.setTimeout(run, 60);
    };
    addEventListener('scroll', onWorkScroll, { passive: true });

    // on resize the panels change height, so re-anchor instantly to the current
    // one — otherwise a sliver of the neighbouring panel stays visible
    const onResize = () => {
      measure();
      cancelAnimationFrame(rafId);
      animating = false;
      const ps = positions();
      window.scrollTo({ top: ps[Math.min(target, ps.length - 1)] || 0, behavior: 'instant' });
      paint();
    };
    addEventListener('resize', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

    // rAF-driven scroll so the swap eases in and out instead of using the
    // browser's fixed-duration smooth scroll
    const animateTo = (to) => {
      cancelAnimationFrame(rafId);
      const from = window.scrollY;
      const dist = to - from;
      if (Math.abs(dist) < 1) { animating = false; paint(); return; }
      const dur = Math.min(SWAP_MAX, SWAP * Math.abs(dist) / vh);
      const t0 = performance.now();
      animating = true;
      const frame = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        window.scrollTo({ top: from + dist * easeInOut(p), behavior: 'instant' });
        if (p < 1) rafId = requestAnimationFrame(frame);
        else { animating = false; paint(); }
      };
      rafId = requestAnimationFrame(frame);
    };

    const goTo = (i) => {
      const ps = positions();
      const t = Math.min(Math.max(i, 0), ps.length - 1);
      target = t;
      if (t < panels.length) history.replaceState(null, '', '#' + panels[t].id);
      setActive(t);
      if (reducedMotion) {
        cancelAnimationFrame(rafId);
        animating = false;
        window.scrollTo({ top: ps[t], behavior: 'instant' });
        paint();
        return;
      }
      animateTo(ps[t]);
    };

    // one panel per gesture; the step past the last panel reveals the footer
    const step = (dir) => {
      const next = target + dir;
      if (next < 0) return;
      goTo(next);
    };

    const gesture = () => {
      const now = performance.now();
      if (now < lockUntil) return false;
      lockUntil = now + LOCK;
      return true;
    };

    addEventListener('wheel', (e) => {
      if (reducedMotion || e.ctrlKey) return; // let pinch-zoom through
      if (!animating && footerFree()) return;  // native scroll inside the footer
      e.preventDefault();
      if (animating || Math.abs(e.deltaY) < 2) return;
      if (!gesture()) return;
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    let touchY = 0;
    addEventListener('touchstart', (e) => {
      touchY = e.touches[0] ? e.touches[0].clientY : 0;
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (reducedMotion || e.touches.length > 1) return; // keep pinch-zoom working
      if (!animating && footerFree()) return;            // native scroll inside the footer
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchend', (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || reducedMotion) return;
      if (!animating && footerFree()) return;
      const dy = touchY - t.clientY;
      if (Math.abs(dy) < SWIPE) return;
      if (!gesture()) return;
      step(dy > 0 ? 1 : -1);
    }, { passive: true });

    addEventListener('keydown', (e) => {
      if (reducedMotion) return;
      if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
      if (e.key === 'End') { e.preventDefault(); goTo(positions().length - 1); return; }
      const dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      step(dir);
    });

    dots.forEach((d, i) => {
      d.addEventListener('click', (e) => {
        e.preventDefault();
        if (panels[i]) goTo(i);
      });
    });

    const toTop = document.getElementById('toTop');
    if (toTop) toTop.addEventListener('click', () => goTo(0));

    paint();
  }
})();
