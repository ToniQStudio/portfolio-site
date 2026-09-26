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

  // Expertise index hover: mirror each title's words into data-text so the CSS
  // ramp copy can wipe in over them.
  document.querySelectorAll('.xi-fill').forEach((el) => {
    el.setAttribute('data-text', el.textContent);
  });

  // Fit the top line width to the name width
  const heroName = document.querySelector('.hero-name');
  const heroTopline = document.querySelector('.hero-topline');
  if (heroName && heroTopline) {
    const fitTopline = () => {
      const nameW = heroName.getBoundingClientRect().width;
      heroTopline.style.fontSize = '16px';
      const baseW = heroTopline.getBoundingClientRect().width;
      if (nameW > 0 && baseW > 0) {
        // fit to the name width, but capped so enlarging the name no longer
        // inflates this line (on narrow screens it still shrinks to fit)
        const size = Math.min(16 * nameW / baseW, 15);
        heroTopline.style.fontSize = size.toFixed(2) + 'px';
      }
    };
    fitTopline();
    addEventListener('resize', fitTopline);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTopline);
  }

  // Butik (#butik): the copy column — and the CRT film below it — take the width
  // of the title's own longest line, and the whole group is centred on the page.
  const butikPanel = document.getElementById('butik');
  if (butikPanel) {
    const butikContent = butikPanel.querySelector('.butik-content');
    const butikTitle = butikPanel.querySelector('.panel-title');
    if (butikContent && butikTitle) {
      const fitButik = () => {
        butikTitle.style.width = 'max-content';
        const w = Math.ceil(butikTitle.getBoundingClientRect().width);
        butikTitle.style.width = '';
        if (w > 0) butikContent.style.setProperty('--butik-col', w + 'px');
      };
      fitButik();
      addEventListener('resize', fitButik);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitButik);
    }
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
    const dotsNav = document.getElementById('dots');
    const toTopEl = document.getElementById('toTop');
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

    // A panel's background clip (the Sfera one) is not looped: it plays once and
    // replays from the first frame every time its panel becomes the active one.
    // Loading is deferred — the source carries data-src — so it is fetched only
    // when first needed, and reduced-motion keeps the poster instead.
    const playPanelVideo = (v) => {
      if (reducedMotion) return;
      // drop any pending "replay after a beat" timer so a manual restart wins
      clearTimeout(v._loopTimer);
      v._loopTimer = 0;
      if (v.dataset.loaded !== '1') {
        const s = v.querySelector('source[data-src]');
        if (s) { s.src = s.dataset.src; v.load(); }
        v.dataset.loaded = '1';
      }
      try { v.currentTime = 0; } catch (e) { /* not seekable yet */ }
      const pr = v.play();
      if (pr && pr.catch) pr.catch(() => {});
    };

    // The Госуслуги monitor (#gosuslugi) runs a looping intro: copy -> loader -> bands
    // -> skeleton -> build -> assembled screen. It holds, then the screen scrolls
    // up and the copy scrolls back in from below, and it loops. Any interaction
    // defers the loop by another hold; scrolling away stops it.
    const gsPanel = document.getElementById('gosuslugi');
    const GS_FORWARD = 9500; // ms the forward intro takes
    const GS_HOLD = 3000;     // idle time on the finished screen before looping
    const GS_RETURN = 1800;   // ms the scroll-back takes
    let gsForwardTimer = 0;
    let gsReturnTimer = 0;
    let gsLoopActive = false;
    let gsForwardDone = false;

    const restartGsCycle = () => {
      if (!gsPanel || reducedMotion) return;
      gsPanel.classList.remove('is-returning');
      gsPanel.classList.remove('is-cycling');
      void gsPanel.offsetWidth; // reflow so the animations restart
      gsPanel.classList.add('is-cycling');
    };

    const gsScheduleReturn = () => {
      clearTimeout(gsReturnTimer);
      gsReturnTimer = setTimeout(() => {
        if (!gsLoopActive || !gsPanel.classList.contains('is-cycling')) return;
        gsPanel.classList.add('is-returning');
        gsForwardTimer = setTimeout(() => {
          if (!gsLoopActive) return;
          restartGsCycle();
          gsForwardDone = false;
          gsForwardTimer = setTimeout(() => { gsForwardDone = true; gsScheduleReturn(); }, GS_FORWARD);
        }, GS_RETURN);
      }, GS_HOLD);
    };

    const startGsLoop = () => {
      if (!gsPanel || reducedMotion) return;
      clearTimeout(gsForwardTimer);
      clearTimeout(gsReturnTimer);
      gsLoopActive = true;
      gsForwardDone = false;
      restartGsCycle();
      gsForwardTimer = setTimeout(() => { gsForwardDone = true; gsScheduleReturn(); }, GS_FORWARD);
    };

    const stopGsLoop = () => {
      gsLoopActive = false;
      gsForwardDone = false;
      clearTimeout(gsForwardTimer);
      clearTimeout(gsReturnTimer);
      if (gsPanel) gsPanel.classList.remove('is-returning');
    };

    // any interaction pushes the loop back by another full hold
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) =>
      addEventListener(ev, () => { if (gsLoopActive && gsForwardDone) gsScheduleReturn(); }, { passive: true }));

    // Dots are bound to panels by id, not by position, so panels without a dot
    // (the intro cover) don't shift every project's target.
    const panelIndexById = {};
    panels.forEach((p, k) => { if (p.id) panelIndexById['#' + p.id] = k; });

    const setActive = (i) => {
      if (i < 0) return;
      dots.forEach((d) => {
        const on = panelIndexById[d.getAttribute('href')] === i;
        d.classList.toggle('is-active', on);
        if (on) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      const onLight = !!(panels[i] && panels[i].classList.contains('panel--light'));
      if (navbar) navbar.classList.toggle('navbar--on-light', onLight);
      // The BM panel (#bm) gives the fixed navbar copy a matching halo too.
      if (navbar) navbar.classList.toggle('navbar--bm', !!(panels[i] && panels[i].id === 'bm'));
      // The NDA bento runs white cards under the fixed right-hand chrome.
      const isNda = !!(panels[i] && panels[i].id === 'nda');
      if (dotsNav) dotsNav.classList.toggle('dots--on-light', onLight);
      if (toTopEl) {
        toTopEl.classList.toggle('to-top--on-light', onLight);
        toTopEl.classList.toggle('to-top--nda', isNda);
        // nothing to scroll up to on the first panel
        toTopEl.classList.toggle('to-top--hidden', i === 0);
      }
      // Restart the active panel's clip; park every other one so nothing runs
      // off-screen. Re-entering the panel replays it from the top.
      panels.forEach((p, k) => {
        const v = p.querySelector('.panel-video');
        if (!v) return;
        if (k === i) playPanelVideo(v);
        else v.pause();
      });
      if (panels[i] && panels[i].id === 'gosuslugi') startGsLoop();
      else stopGsLoop();
    };

    let active = -1;
    let target = 0;
    let animating = false;
    let lockUntil = 0;
    let ticking = false;
    let rafId = 0;

    // The closing NDA screen (#nda) is a sideways strip of four bento blocks. The
    // wheel pans it continuously (eased, not stepped); keyboard and touch still
    // move a block at a time. A slim scrollbar at the foot reflects the position.
    const ndaPanel = document.getElementById('nda');
    const ndaViewport = ndaPanel ? ndaPanel.querySelector('.nda-viewport') : null;
    const ndaTrack = ndaPanel ? ndaPanel.querySelector('.nda-track') : null;
    const ndaBlocks = ndaTrack ? Array.from(ndaTrack.querySelectorAll('.nda-block')) : [];
    const ndaScroll = ndaPanel ? ndaPanel.querySelector('.nda-scroll') : null;
    const ndaThumb = ndaScroll ? ndaScroll.querySelector('.nda-thumb') : null;
    const NDA_EASE = 0.18;
    // The rubber band is proportional to the viewport so the left and right
    // stretches read the same on any screen instead of a fixed 125px.
    const ndaPullMax = () => {
      const vw = ndaViewport ? ndaViewport.clientWidth : 900;
      return Math.max(80, Math.min(170, vw * 0.11));
    };
    const ndaPullSoft = () => ndaPullMax() * 1.08;  // raw px yielding half the stretch
    const NDA_PULL_RELEASE = 0.6;                   // fraction of max at which an edge lets go
    let ndaPan = 0;        // px the strip is pulled left of its resting position
    let ndaPanTarget = 0;  // where the eased glide is heading
    let ndaRaf = 0;
    let ndaGliding = false;
    let ndaPull = 0;       // visual stretch beyond the edge
    let ndaPullDir = 0;    // +1 stretch right (start), -1 stretch left (end)
    let ndaEdgeRaw = 0;    // raw overscroll banked at the edge
    let ndaEdgeTimer = 0;
    let ndaSpringRaf = 0;
    let ndaSpringing = false;

    const ndaStep = () => {
      if (ndaBlocks.length > 1) return ndaBlocks[1].offsetLeft - ndaBlocks[0].offsetLeft;
      return ndaBlocks[0] ? ndaBlocks[0].offsetWidth : 0;
    };
    // each rest position centres the first/last block in the viewport instead of
    // hugging the content column: pad the strip by half the empty space a side
    const ndaLayout = () => {
      if (!ndaTrack || !ndaViewport || !ndaBlocks.length) return;
      const bw = ndaBlocks[0].offsetWidth;
      const pad = Math.max(0, (ndaViewport.clientWidth - bw) / 2);
      ndaTrack.style.paddingLeft = pad.toFixed(1) + 'px';
      ndaTrack.style.paddingRight = pad.toFixed(1) + 'px';
    };
    // width of the whole strip including both centring pads, so the strip can pan
    // until its last block sits centred in the viewport
    const ndaStride = () => {
      if (!ndaTrack) return 0;
      const last = ndaBlocks[ndaBlocks.length - 1];
      if (!last) return 0;
      const padR = parseFloat(getComputedStyle(ndaTrack).paddingRight) || 0;
      return last.offsetLeft + last.offsetWidth + padR;
    };
    const ndaMax = () => {
      if (!ndaTrack || !ndaViewport) return 0;
      return Math.max(0, ndaStride() - ndaViewport.clientWidth);
    };
    // park the strip exactly on an edge (and stop any glide) so the rubber band
    // starts attached to the edge rather than while the eased pan is still late
    const stopNdaGlide = (edge) => {
      cancelAnimationFrame(ndaRaf);
      ndaGliding = false;
      ndaPan = edge;
      ndaPanTarget = edge;
    };

    const updateNdaThumb = () => {
      if (!ndaThumb || !ndaScroll || !ndaTrack) return;
      const trackW = ndaScroll.clientWidth;
      const contentW = ndaStride();
      const visW = ndaViewport ? ndaViewport.clientWidth : 0;
      if (!trackW || !contentW) return;
      const thumbW = Math.max(10, Math.min(trackW, (trackW * (visW / contentW)) / 3));
      const max = ndaMax();
      const x = max > 0 ? (trackW - thumbW) * (ndaPan / max) : 0;
      ndaThumb.style.width = thumbW.toFixed(1) + 'px';
      ndaThumb.style.transform = 'translate(' + x.toFixed(1) + 'px, -50%)';
    };

    const applyNda = () => {
      if (ndaTrack) {
        const x = -ndaPan + ndaPull * ndaPullDir;
        ndaTrack.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
      }
      updateNdaThumb();
    };

    // rubber-band: past either edge the strip stretches with growing resistance
    const ndaPullFromRaw = (raw) => {
      const max = ndaPullMax();
      return max * (raw / (raw + ndaPullSoft()));
    };

    const ndaSpring = () => {
      cancelAnimationFrame(ndaSpringRaf);
      ndaEdgeRaw = 0;
      if (reducedMotion) { ndaPull = 0; ndaPullDir = 0; applyNda(); return; }
      if (ndaSpringing) return;
      ndaSpringing = true;
      let last = 0;
      const tick = (now) => {
        // decay by elapsed time, not frame count, so the release stays springy
        // at 60/120Hz alike
        const dt = last ? Math.min(48, now - last) : 16;
        last = now;
        ndaPull *= Math.pow(0.8, dt / 16);
        if (ndaPull < 0.4) {
          ndaPull = 0;
          ndaPullDir = 0;
          ndaSpringing = false;
          applyNda();
          return;
        }
        applyNda();
        ndaSpringRaf = requestAnimationFrame(tick);
      };
      ndaSpringRaf = requestAnimationFrame(tick);
    };

    const ndaRelease = (dir) => {
      clearTimeout(ndaEdgeTimer);
      cancelAnimationFrame(ndaSpringRaf);
      ndaSpringing = false;
      ndaEdgeRaw = 0;
      ndaPull = 0;
      ndaPullDir = 0;
      applyNda();
      if (dir < 0) {
        // end edge: hand forward to the site footer
        if (footerEl) { cancelAnimationFrame(ndaRaf); ndaGliding = false; animateTo(footerOffset()); }
      } else {
        goTo(target - 1);  // start edge: hand back to BM
      }
    };

    // d>0 scrolls forward (toward the end), d<0 scrolls back (toward the start)
    const ndaEdge = (d) => {
      cancelAnimationFrame(ndaSpringRaf);
      ndaSpringing = false;
      const wantDir = d < 0 ? 1 : -1;
      if (!ndaPullDir) stopNdaGlide(wantDir === 1 ? 0 : ndaMax());
      if (ndaPullDir && wantDir !== ndaPullDir) {
        // unwinding a stretch: shrink it, never release from here
        ndaEdgeRaw = Math.max(0, ndaEdgeRaw - Math.abs(d));
        if (!ndaEdgeRaw) { ndaPull = 0; ndaPullDir = 0; applyNda(); return; }
        ndaPull = ndaPullFromRaw(ndaEdgeRaw);
        applyNda();
        clearTimeout(ndaEdgeTimer);
        ndaEdgeTimer = setTimeout(ndaSpring, 140);
        return;
      }
      ndaPullDir = wantDir;
      ndaEdgeRaw += Math.abs(d);
      ndaPull = ndaPullFromRaw(ndaEdgeRaw);
      applyNda();
      if (ndaPull >= ndaPullMax() * NDA_PULL_RELEASE) {
        if (wantDir === 1) { ndaRelease(1); return; }
        if (wantDir === -1 && footerEl) { ndaRelease(-1); return; }
      }
      clearTimeout(ndaEdgeTimer);
      ndaEdgeTimer = setTimeout(ndaSpring, 140);
    };

    const ndaGlide = () => {
      if (ndaGliding) return;
      ndaGliding = true;
      const tick = () => {
        const diff = ndaPanTarget - ndaPan;
        if (Math.abs(diff) < 0.4) {
          ndaPan = ndaPanTarget;
          applyNda();
          ndaGliding = false;
          return;
        }
        ndaPan += diff * NDA_EASE;
        applyNda();
        ndaRaf = requestAnimationFrame(tick);
      };
      ndaRaf = requestAnimationFrame(tick);
    };

    const ndaSetPan = (px, glide) => {
      if (ndaPull || ndaPullDir) {
        clearTimeout(ndaEdgeTimer);
        cancelAnimationFrame(ndaSpringRaf);
        ndaSpringing = false;
        ndaPull = 0;
        ndaPullDir = 0;
        ndaEdgeRaw = 0;
      }
      ndaPanTarget = Math.max(0, Math.min(px, ndaMax()));
      if (reducedMotion || !glide) {
        cancelAnimationFrame(ndaRaf);
        ndaGliding = false;
        ndaPan = ndaPanTarget;
        applyNda();
        return;
      }
      ndaGlide();
    };

    // wheel over the bento strip: pan continuously; at either edge the strip
    // stretches like a taut band and springs back. The start edge only lets go
    // to BM once the pull passes the release threshold, so leaving is deliberate.
    const ndaWheel = (e) => {
      e.preventDefault();
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 16;                                                  // lines
      else if (e.deltaMode === 2) d *= (ndaViewport ? ndaViewport.clientWidth : 800);  // pages
      if (ndaEdgeRaw || ndaPullDir) { ndaEdge(d); return; }
      const max = ndaMax();
      if (d > 0 && ndaPanTarget >= max - 0.5) { ndaEdge(d); return; }  // end edge
      if (d < 0 && ndaPanTarget <= 0.5) { ndaEdge(d); return; }        // start edge
      ndaSetPan(ndaPanTarget + d, true);
    };

    // Background clips marked with data-loop-pause replay on a loop, holding a
    // beat (ms) between plays rather than looping seamlessly. Only the active
    // panel's clip restarts, so a parked one never wakes up off-screen.
    panels.forEach((p, k) => {
      const v = p.querySelector('.panel-video[data-loop-pause]');
      if (!v) return;
      const wait = parseInt(v.dataset.loopPause, 10) || 0;
      v.addEventListener('ended', () => {
        clearTimeout(v._loopTimer);
        v._loopTimer = setTimeout(() => {
          v._loopTimer = 0;
          if (k === active) playPanelVideo(v);
        }, wait);
      });
    });

    // measure the real panel height (100vh) rather than innerHeight, so the maths
    // stays right on mobile where the visible viewport differs
    let vh = window.innerHeight || 1;
    const measure = () => {
      vh = (panels[0] && panels[0].getBoundingClientRect().height) || window.innerHeight || 1;
    };
    measure();

    // Snap offsets: cumulative, one per panel, so a shorter closing panel still
    // lands correctly. Everything after the last panel — the closing panel and
    // the site footer — scrolls natively instead of snapping.
    const footerEl = document.querySelector('.sfooter');
    const footerOffset = () => Math.max(0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight);
    const positions = () => {
      const ps = [];
      let acc = 0;
      panels.forEach((p) => { ps.push(Math.round(acc)); acc += p.getBoundingClientRect().height; });
      return ps;
    };
    const lastStop = () => { const ps = positions(); return ps.length ? ps[ps.length - 1] : 0; };

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
    const footerFree = () => !!footerEl && footerOffset() > lastStop() &&
      window.scrollY >= lastStop() - 2;
    // the closing strip owns the wheel/keyboard/touch while the deck rests on the
    // last panel; once the page has scrolled past it into the footer, scroll is free
    const ndaEngaged = () => !!ndaTrack && panels[target] && panels[target].id === 'nda' &&
      window.scrollY <= lastStop() + 1;
    // past the last panel with a short footer: leaving it upward jumps straight
    // back to the top of the closing section instead of creeping through it
    const footerJump = () => !!footerEl && footerEl.offsetHeight <= vh - 1 &&
      window.scrollY > lastStop() + 1;

    const paint = () => {
      const h = vh;
      const center = window.scrollY / h;
      panels.forEach((p, i) => {
        const inner = inners[i];
        if (reducedMotion) {
          if (inner && lastShift[i] !== '') { inner.style.transform = ''; lastShift[i] = ''; }
          if (bgs[i] && lastBg[i] !== '') { bgs[i].style.transform = ''; lastBg[i] = ''; }
          if (icons[i] && lastPar[i] !== '') { icons[i].style.removeProperty('--par'); lastPar[i] = ''; }
          if (btns[i] && lastBtn[i] !== '') { p.style.removeProperty('--btn-par'); lastBtn[i] = ''; }
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

        // the CTA — and the panel's down cue, which inherits the variable —
        // ride up in lockstep with the copy
        if (btns[i]) {
          const v = (-climb).toFixed(1) + 'px';
          if (lastBtn[i] !== v) { p.style.setProperty('--btn-par', v); lastBtn[i] = v; }
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
      cancelAnimationFrame(ndaRaf);
      animating = false;
      if (ndaTrack) {
        clearTimeout(ndaEdgeTimer);
        cancelAnimationFrame(ndaSpringRaf);
        ndaSpringing = false;
        ndaEdgeRaw = 0;
        ndaPull = 0;
        ndaPullDir = 0;
        ndaGliding = false;
        ndaLayout();
        ndaPan = Math.min(ndaPan, ndaMax());
        ndaPanTarget = ndaPan;
        applyNda();
      }
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

    const goTo = (i, keepNda) => {
      const ps = positions();
      const t = Math.min(Math.max(i, 0), ps.length - 1);
      target = t;
      // entering the closing screen starts on the first bento block, unless we
      // are returning to it and should keep the strip where the user left it
      if (panels[t] && panels[t].id === 'nda' && ndaTrack && !keepNda) {
        cancelAnimationFrame(ndaRaf);
        ndaGliding = false;
        ndaSetPan(0, false);
      }
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

    // one panel per gesture; on the closing screen keyboard/touch step the bento
    // strip a block at a time, and only leaving the first block hands back to the
    // panels (up to BM)
    const step = (dir) => {
      if (ndaTrack && ndaBlocks.length && panels[target] && panels[target].id === 'nda') {
        const max = ndaMax();
        if (dir > 0) {
          if (ndaPanTarget >= max - 0.5 && footerEl) {   // at the end: into the footer
            cancelAnimationFrame(ndaRaf);
            ndaGliding = false;
            animateTo(footerOffset());
            return;
          }
          ndaSetPan(ndaPanTarget + ndaStep(), true);      // clamped by ndaSetPan
        } else if (ndaPanTarget <= 0) {
          goTo(target - 1);                               // start: back up to BM
        } else {
          ndaSetPan(ndaPanTarget - ndaStep(), true);
        }
        return;
      }
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
      if (!animating && ndaEngaged()) { ndaWheel(e); return; }
      if (!animating && footerJump()) {        // short footer: snap back to NDA
        e.preventDefault();
        if (e.deltaY < 0) goTo(panels.length - 1, true);
        return;
      }
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
      if (!animating && ndaEngaged()) { e.preventDefault(); return; }
      if (!animating && footerJump()) { e.preventDefault(); return; }
      if (!animating && footerFree()) return;            // native scroll inside the footer
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchend', (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || reducedMotion) return;
      if (!animating && !ndaEngaged() && footerJump()) {
        if (touchY - t.clientY < -SWIPE && gesture()) goTo(panels.length - 1, true);
        return;
      }
      if (!animating && !ndaEngaged() && footerFree()) return;
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
      if (dir < 0 && footerJump()) { goTo(panels.length - 1, true); return; }
      step(dir);
    });

    dots.forEach((d) => {
      d.addEventListener('click', (e) => {
        e.preventDefault();
        const i = panelIndexById[d.getAttribute('href')];
        if (i != null) goTo(i);
      });
    });

    const toTop = document.getElementById('toTop');
    if (toTop) toTop.addEventListener('click', () => goTo(0));

    // Deep link (#pNN from the home-page cards): land straight on the linked
    // panel before revealing the page, so the top panel never flashes first.
    const hashMatch = /^#([a-z][a-z0-9-]*)$/.exec(location.hash);
    if (hashMatch) {
      const i = panels.findIndex((p) => p.id === hashMatch[1]);
      if (i > 0) {
        target = i;
        window.scrollTo({ top: positions()[i] || 0, behavior: 'instant' });
      }
    }
    document.documentElement.classList.remove('work-init');

    ndaLayout();
    applyNda();
    paint();
  }
})();
