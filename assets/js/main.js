(() => {
  'use strict';

  // Header: transparent over the home hero and the design intro; the edge-to-edge
  // frosted bar everywhere else, and on the home page once the hero is passed.
  // On the design deck the active panel drives it (see setActive below).
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const isHome = document.body.classList.contains('home');
    const isWork = document.documentElement.classList.contains('work');
    const heroEl = document.querySelector('.hero');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // null = this page has no frosted-bar state (the design deck)
    const barWanted = () => {
      if (isHome) {
        const h = heroEl ? heroEl.offsetHeight : window.innerHeight;
        return window.scrollY > Math.max(0, h - 64);
      }
      if (!isWork) return window.scrollY > 40;
      return null;
    };
    let navOutTimer = 0;
    const finishHide = () => {
      clearTimeout(navOutTimer);
      navbar.classList.remove('nav-out');
      navbar.classList.remove('scrolled');
    };
    const onScroll = () => {
      const on = barWanted();
      if (on === null) return;
      if (on) {
        clearTimeout(navOutTimer);
        navbar.classList.remove('nav-out');
        navbar.classList.add('scrolled');
        return;
      }
      if (navbar.classList.contains('nav-out')) return; // hide animation in flight
      // On the home page the bar leaves the viewport on its own (the header is
      // absolute there), so play an explicit slide-out first; elsewhere the
      // ::before transition already animates the bar away.
      if (isHome && !reduceMotion && navbar.classList.contains('scrolled')) {
        navbar.classList.add('nav-out');
        clearTimeout(navOutTimer);
        // safety net in case animationend never arrives
        navOutTimer = setTimeout(() => {
          if (navbar.classList.contains('nav-out')) finishHide();
        }, 500);
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    navbar.addEventListener('animationend', (e) => {
      if (e.animationName !== 'navUp' || !navbar.classList.contains('nav-out')) return;
      finishHide();
    });
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  // Hero -> content seam: the glint rides the arc with the scroll — when the
  // arc sits low on screen it is at the left edge, as the seam climbs it
  // slides over the apex to the right edge. --glint (0..1) is driven by the
  // apex's position in the viewport, frame-throttled.
  const seamBlock = document.querySelector('.seam');
  if (seamBlock && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let seamRaf = 0;
    let seamApex = 0;
    let vh = 1;
    const measureSeam = () => {
      vh = window.innerHeight || 1;
      const r = seamBlock.getBoundingClientRect();
      const cs = getComputedStyle(seamBlock);
      const arcRise = (parseFloat(cs.getPropertyValue('--arc-rise')) || 0) * window.innerWidth / 100;
      const drop = parseFloat(cs.getPropertyValue('--drop')) || 0;
      seamApex = r.top + window.scrollY + r.height / 2 + drop / 2 - arcRise;
    };
    const updateSeam = () => {
      seamRaf = 0;
      const p = Math.min(1, Math.max(0, (vh - (seamApex - window.scrollY)) / vh));
      seamBlock.style.setProperty('--glint', p.toFixed(4));
    };
    const onSeamScroll = () => { if (!seamRaf) seamRaf = requestAnimationFrame(updateSeam); };
    measureSeam();
    updateSeam();
    addEventListener('scroll', onSeamScroll, { passive: true });
    addEventListener('resize', () => { measureSeam(); updateSeam(); }, { passive: true });
  }

  // Footer copyright: stamp the current year so the markup never goes stale
  const yearEl = document.querySelector('.sfooter-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Footer: line the menu column up with the tagline below it (its exact left
  // edge), instead of the fixed offset that drifts with the viewport/fonts.
  const footerNav = document.querySelector('.sfooter-nav');
  const footerTagline = document.querySelector('.sfooter-tagline');
  if (footerNav && footerTagline) {
    const alignFooterNav = () => {
      if (window.innerWidth < 1201) { footerNav.style.left = ''; return; }
      footerNav.style.left = '0px';
      const delta = footerTagline.getBoundingClientRect().left - footerNav.getBoundingClientRect().left;
      footerNav.style.left = delta.toFixed(1) + 'px';
    };
    alignFooterNav();
    addEventListener('resize', alignFooterNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignFooterNav);
  }

  // Expertise index hover: mirror each title's words into data-text so the CSS
  // ramp copy can wipe in over them.
  document.querySelectorAll('.xi-fill').forEach((el) => {
    el.setAttribute('data-text', el.textContent);
  });

  // Design intro rows: index each row so its entrance can be staggered.
  document.querySelectorAll('.intro-skills li').forEach((li, i) => {
    li.style.setProperty('--intro-i', i);
  });

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

  // Hero lead: keep the statement on three lines at every screen width by
  // scaling the type so its longest line exactly fills the content column
  // (viewport minus the --edge gutters).
  const heroLeadEl = document.querySelector('.hero-lead');
  if (heroLeadEl) {
    const leadLines = Array.from(heroLeadEl.querySelectorAll('.hero-lead-big'));
    // the first real text node of each line (line 3 also holds the <br> + link)
    const leadNodes = leadLines.map((el) => {
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.textContent.trim()) return n;
      }
      return null;
    });
    const leadFull = leadNodes.map((n) => (n ? n.textContent : ''));
    const leadShown = leadFull.slice(); // currently visible prefix per line
    // the blinking cursor that rides the line being typed
    const typeCaret = document.createElement('span');
    typeCaret.className = 'hero-type-caret';
    typeCaret.setAttribute('aria-hidden', 'true');
    const fitHeroLead = () => {
      const cs = getComputedStyle(heroLeadEl);
      const avail = heroLeadEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (avail <= 0 || !leadLines.length) return;
      // measure with the finished text, even mid-typing, so the scale is always
      // based on the complete line and never drifts
      leadNodes.forEach((n, i) => { if (n && n.textContent !== leadFull[i]) n.textContent = leadFull[i]; });
      if (typeCaret.parentNode) typeCaret.style.display = 'none'; // ignore the cursor width
      const tw = heroLeadEl.querySelector('.hero-lead-tw');
      const twFull = tw ? (tw.dataset.full || tw.textContent) : null;
      const twTyped = tw ? tw.textContent : null;
      if (tw && twTyped !== twFull) tw.textContent = twFull;
      const REF = 100;
      heroLeadEl.style.setProperty('--hero-lead-fs', REF + 'px');
      let maxW = 0;
      leadLines.forEach((el) => { maxW = Math.max(maxW, el.getBoundingClientRect().width); });
      leadNodes.forEach((n, i) => { if (n) n.textContent = leadShown[i]; });
      if (typeCaret.parentNode) typeCaret.style.display = '';
      if (tw && twTyped !== twFull) tw.textContent = twTyped;
      if (maxW <= 0) return;
      heroLeadEl.style.setProperty('--hero-lead-fs', (avail * REF / maxW).toFixed(2) + 'px');
    };
    fitHeroLead();
    addEventListener('resize', fitHeroLead);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeroLead);

    // Link typist setup. The link text is hidden up front and only typed once
    // the three statement lines are done.
    const twLink = heroLeadEl.querySelector('.hero-lead-link');
    const twText = heroLeadEl.querySelector('.hero-lead-tw');
    const linkText = twText ? twText.textContent : '';
    if (twText) twText.dataset.full = linkText;

    // Timing shared by every typist.
    const TYPE_MS = 8;      // per character, the same speed everywhere
    const BLINK_MS = 600;   // matches the heroCaretBlink animation
    const BLINKS = 2;       // blinks before the first line starts

    // Typewriter for the three statement lines. Before each line the cursor
    // moves onto that line and blinks, then the line is typed.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const typeLeadLine = (i) => {
        if (i >= leadNodes.length) {
          if (typeCaret.parentNode) typeCaret.parentNode.removeChild(typeCaret);
          startLinkTyping();
          return;
        }
        const node = leadNodes[i];
        const full = leadFull[i];
        if (!node || !full) return typeLeadLine(i + 1);
        // park the cursor on this line, let it blink, then type
        node.parentNode.insertBefore(typeCaret, node.nextSibling);
        // the first line blinks a few times; the rest just once
        const wait = (i === 0 ? BLINKS : 1) * BLINK_MS;
        setTimeout(() => {
          let c = 0;
          const step = () => {
            c += 1;
            leadShown[i] = full.slice(0, c);
            node.textContent = leadShown[i];
            if (c < full.length) setTimeout(step, TYPE_MS);
            else typeLeadLine(i + 1);
          };
          step();
        }, wait);
      };
      // clear up front so the finished lines never flash before typing
      leadNodes.forEach((n) => { if (n) n.textContent = ''; });
      leadShown.fill('');
      if (twText) twText.textContent = ''; // the link is typed later
      typeLeadLine(0);
    }

    // Typist for the "Обсудить проект" link. It only starts once the three
    // statement lines are done: the caret appears, blinks, then the words are
    // typed at the same speed as the lines.
    const startLinkTyping = () => {
      if (!twLink || !twText) return;
      twText.textContent = '';
      twLink.classList.add('hero-lead-link--typing');
      twLink.tabIndex = -1;
      const type = () => {
        let i = 0;
        const step = () => {
          i += 1;
          twText.textContent = linkText.slice(0, i);
          if (i < linkText.length) {
            setTimeout(step, TYPE_MS);
          } else {
            // let the caret blink once more, then drop it and activate the link
            setTimeout(() => {
              twLink.classList.remove('hero-lead-link--typing');
              twLink.classList.add('hero-lead-link--typed');
              twLink.removeAttribute('tabindex');
            }, 350);
          }
        };
        step();
      };
      setTimeout(type, BLINK_MS); // the link is the fourth line: one blink
    };
  }

  // Home page reveal footer: the footer is pinned to the viewport bottom behind
  // the page, so give the content a bottom gap equal to its height - scrolling
  // to the end then reveals the whole footer from behind the grey panel.
  {
    const footEl = document.querySelector('.sfooter');
    const pageEl = document.querySelector('main');
    if (document.body.classList.contains('home') && footEl && pageEl) {
      // Stop the scroll so the grey panel's bottom never rises more than 52px
      // above the footer's "Антон Миньков" name; the black behind (the footer
      // plus its 140px climb) fills whatever shows below it.
      const setFooterReveal = () => {
        const nameEl = footEl.querySelector('.sfooter-name');
        if (!nameEl) return;
        const nameTop = nameEl.getBoundingClientRect().top;
        pageEl.style.marginBottom = Math.max(0, window.innerHeight - (nameTop - 52)) + 'px';
      };
      setFooterReveal();
      addEventListener('resize', setFooterReveal, { passive: true });
      addEventListener('load', setFooterReveal);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(setFooterReveal);
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

  // Design intro (#intro, design.html) — the right-hand column of the opening:
  // a terminal that types the design keywords. The active line is pinned to the
  // foot of the competency list; each finished word rises one step and fades as it
  // goes up. Long terms run off the right edge; without JS (or with reduced motion)
  // the plain static word is left.
  const introTitle = document.querySelector('.panel--intro .panel-intro');
  const introInner = introTitle ? introTitle.parentNode : null;
  const introCopy = introInner ? introInner.querySelector('.intro-copy') : null;
  const introList = introInner ? introInner.querySelector('.intro-skills') : null;
  if (introTitle && introInner && !reducedMotion) {
    const INTRO_WORDS = [
      'Design', 'UX/UI', 'Design System', 'UX Metrics', 'Retention',
      'Conversion Rate', 'North Star Metric', 'A/B Testing', 'Hypotheses', 'User Flow'
    ];
    const INTRO_BLINK_MS = 600;  // matches the heroCaretBlink animation
    const INTRO_BLINKS = 4;      // caret blinks before the very first word
    const INTRO_TYPE_MS = 40;    // per character
    const INTRO_ENTER_MS = 400;  // pause after a word, before "Enter"
    const INTRO_RISE_MS = 600;   // pause after "Enter", before the next word
    const INTRO_MIN_W = 240;     // below this the terminal is dropped
    const INTRO_FS = 80;         // one fixed size for every term

    const innerRect = () => introInner.getBoundingClientRect();
    // the active line is pinned to the foot of the competency list (the text),
    // not to the heading above it
    const anchorBottom = () => {
      const r = innerRect();
      const el = introList || introCopy;
      return el ? el.getBoundingClientRect().bottom - r.top : introInner.clientHeight;
    };

    // the terminal occupies the right half (CSS left: 50%); its width also tells
    // us whether it is visible at all (hidden below 1080px)
    if (introTitle.clientWidth >= INTRO_MIN_W) {
      // the terminal is decorative (aria-hidden in the markup); clear the static
      // fallback word before the animated lines are built
      introTitle.textContent = '';

      const caret = document.createElement('span');
      caret.className = 'intro-caret';
      caret.setAttribute('aria-hidden', 'true');
      introInner.appendChild(caret);

      let active = null;
      const lines = [];

      // the active line is pinned to the foot of the competency list; each
      // finished word rises one step up and fades as it goes
      const setOrigin = () => {
        const center = introInner.clientHeight / 2;
        introTitle.style.transform = 'translateY(' + (anchorBottom() - center) + 'px)';
      };
      const place = () => {
        lines.forEach((line) => {
          line.el.style.transform = 'translateY(' + (-line.d * INTRO_FS) + 'px)';
          line.el.style.opacity = Math.max(0, 1 - 0.1 * line.d).toFixed(2);
        });
      };
      // every term is the same fixed size; long ones simply run off the right
      const buildLine = (word) => {
        const el = document.createElement('span');
        el.className = 'intro-line';
        el.setAttribute('aria-hidden', 'true');
        el.style.fontSize = INTRO_FS + 'px';
        const text = document.createTextNode('');
        el.appendChild(text);
        introTitle.appendChild(el);
        const line = { el, text, fs: INTRO_FS, d: 0, word };
        lines.push(line);
        return line;
      };
      // once a word has risen past the fade it can leave the DOM
      const recycle = () => {
        while (lines.length && lines[0].d > 10) {
          const old = lines.shift();
          if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
        }
      };
      const setCaret = (x) => {
        const r = innerRect();
        caret.style.left = (introTitle.getBoundingClientRect().left - r.left + x) + 'px';
      };
      const setCaretTop = () => {
        caret.style.top = (anchorBottom() - (active ? active.fs / 2 : 0)) + 'px';
      };
      const caretX = (line) => {
        if (!line.text.nodeValue) return 0;
        const r = document.createRange();
        r.selectNodeContents(line.text);
        const rect = r.getBoundingClientRect();
        return rect.width > 0 ? rect.right - introTitle.getBoundingClientRect().left : 0;
      };

      const typeWord = (line, word, done) => {
        caret.classList.remove('intro-caret--glide');  // character steps must not ease
        let i = 0;
        const step = () => {
          i += 1;
          line.text.nodeValue = word.slice(0, i);
          setCaret(caretX(line));
          if (i < word.length) setTimeout(step, INTRO_TYPE_MS);
          else setTimeout(done, INTRO_ENTER_MS);
        };
        step();
      };

      const pressEnter = (index) => {
        lines.forEach((line) => { line.d += 1; });      // finished words fall a step
        const nextWord = INTRO_WORDS[index + 1];        // undefined after the last term
        const line = buildLine(nextWord == null ? '' : nextWord);
        active = line;
        place();                                        // animate the fall + fade
        recycle();
        caret.classList.add('intro-caret--glide');
        void caret.offsetWidth;                         // settle the start of the glide
        caret.style.fontSize = line.fs + 'px';
        setCaret(0);                                    // hop to the left edge of the new line
        setCaretTop();
        // after the last term the cycle starts over, so the list never ends
        const word = nextWord == null ? INTRO_WORDS[0] : nextWord;
        const nextIndex = nextWord == null ? 0 : index + 1;
        setTimeout(() => {
          typeWord(line, word, () => pressEnter(nextIndex));
        }, INTRO_RISE_MS);
      };

      const startWord = (index, blinks) => {
        const word = INTRO_WORDS[index];
        const line = buildLine(word);
        active = line;
        place();
        caret.style.fontSize = line.fs + 'px';
        setCaret(0);
        setCaretTop();
        setTimeout(() => {
          typeWord(line, word, () => pressEnter(index));
        }, blinks * INTRO_BLINK_MS);
      };

      setOrigin();
      startWord(0, INTRO_BLINKS);

      // keep the top origin right on resize
      addEventListener('resize', () => {
        if (introTitle.clientWidth < INTRO_MIN_W) return;
        setOrigin();
        setCaretTop();
      });
    }
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
    const GS_FORWARD = 11500; // ms the forward intro takes
    const GS_HOLD = 1500;     // idle time on the finished screen before looping
    const GS_RETURN = 800;    // ms until the loader relaunches (matches the scene-up)
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
      // The NDA bento runs white cards under the fixed right-hand chrome.
      const isNda = !!(panels[i] && panels[i].id === 'nda');
      // myexport's video has a dark floor behind the fixed chrome — keep the
      // back-to-top outline white there.
      const isMyexport = !!(panels[i] && panels[i].id === 'myexport');
      if (dotsNav) dotsNav.classList.toggle('dots--on-light', onLight);
      if (toTopEl) {
        toTopEl.classList.toggle('to-top--on-light', onLight);
        toTopEl.classList.toggle('to-top--nda', isNda);
        toTopEl.classList.toggle('to-top--myexport', isMyexport);
        // nothing to scroll up to on the first panel
        toTopEl.classList.toggle('to-top--hidden', i === 0);
      }
      // Replay the cover's entrance animation whenever it becomes active.
      if (introCopy) {
        if (i === 0) {
          introCopy.classList.remove('is-in');
          void introCopy.offsetWidth;   // restart the CSS animation
          introCopy.classList.add('is-in');
        } else {
          introCopy.classList.remove('is-in');
        }
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

    // The header copy colour is applied only once the swap has finished: while a
    // panel is still moving the bar keeps the colour of the one it is leaving and
    // flips when the new card has fully arrived (see paint()/animateTo below).
    const setNavbar = (i) => {
      if (!navbar || i < 0) return;
      const onLight = !!(panels[i] && panels[i].classList.contains('panel--light'));
      navbar.classList.toggle('navbar--on-light', onLight);
      navbar.classList.toggle('navbar--bm', !!(panels[i] && panels[i].id === 'bm'));
      // Design deck stays transparent over every panel — no frosted bar.
      navbar.classList.remove('scrolled');
    };

    let active = -1;
    let target = 0;
    let animating = false;
    let lockUntil = 0;
    let ticking = false;
    let rafId = 0;

    // The closing NDA screen (#nda) is a sideways strip of two rows of tiles. The
    // wheel pans it continuously (eased, not stepped); keyboard and touch still
    // move roughly a screenful at a time. A slim scrollbar at the foot reflects
    // the position.
    const ndaPanel = document.getElementById('nda');
    const ndaViewport = ndaPanel ? ndaPanel.querySelector('.nda-viewport') : null;
    const ndaTrack = ndaPanel ? ndaPanel.querySelector('.nda-track') : null;
    const ndaRows = ndaTrack ? Array.from(ndaTrack.querySelectorAll('.nda-row')) : [];
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

    // width of one row of tiles, measured from the row's left edge to the last
    // tile's right edge; both rows carry the same set of wide/square tiles so
    // either one measures the strip
    const ndaRowWidth = (r) => {
      const last = r.lastElementChild;
      if (!last) return 0;
      return last.getBoundingClientRect().right - r.getBoundingClientRect().left;
    };
    const ndaContentWidth = () => {
      let w = 0;
      ndaRows.forEach((r) => { w = Math.max(w, ndaRowWidth(r)); });
      return w;
    };
    // keyboard/touch step: glide roughly a screenful of tiles at a time
    const ndaStep = () => Math.max(200, (ndaViewport ? ndaViewport.clientWidth : 900) * 0.85);
    // the strip never wraps; when it is narrower than the viewport centre it,
    // otherwise fall back to the CSS edge gutters (padding reset to '')
    // room left for the two rows once the heading, the rail and the fixed 40px
    // gaps around the strip are taken out of the panel's content box
    const ndaAvail = () => {
      const cs = getComputedStyle(ndaPanel);
      const headEl = ndaPanel.querySelector('.nda-head');
      const headH = headEl ? headEl.offsetHeight : 0;
      const navH = ndaScroll ? ndaScroll.offsetHeight : 0;
      const gapTop = parseFloat(getComputedStyle(ndaViewport).marginTop) || 0;
      const gapNav = ndaScroll ? (parseFloat(getComputedStyle(ndaScroll).marginTop) || 0) : 0;
      return ndaPanel.clientHeight
        - (parseFloat(cs.paddingTop) || 0)
        - (parseFloat(cs.paddingBottom) || 0)
        - headH - navH - gapTop - gapNav;
    };
    const ndaLayout = () => {
      if (!ndaTrack || !ndaViewport || !ndaRows.length) return;
      // fit the two rows into the space left under the heading: 288 square tiles
      // when there is room (the design size), scaled down on shorter screens so
      // the strip never overflows the panel
      const gap = parseFloat(getComputedStyle(ndaTrack).getPropertyValue('--nda-gap')) || 24;
      const size = Math.max(120, Math.min(288, Math.floor((ndaAvail() - gap) / 2)));
      ndaTrack.style.setProperty('--nda-size', size + 'px');
      const cw = ndaContentWidth();
      const pad = Math.max(0, (ndaViewport.clientWidth - cw) / 2);
      if (pad > 0) {
        ndaTrack.style.paddingLeft = pad.toFixed(1) + 'px';
        ndaTrack.style.paddingRight = pad.toFixed(1) + 'px';
      } else {
        ndaTrack.style.paddingLeft = '';
        ndaTrack.style.paddingRight = '';
      }
    };
    // width of the whole strip including the edge gutters, so the strip can pan
    // until its last tile sits flush against the trailing gutter
    const ndaStride = () => {
      if (!ndaTrack) return 0;
      const cs = getComputedStyle(ndaTrack);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      return ndaContentWidth() + padL + padR;
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
      // while a swap is in flight the bar keeps the colour it had; it flips to
      // the new panel only when the motion has settled (animating === false)
      if (!animating) {
        setNavbar(active);
        // the dot strip only appears once the swap has settled — at the end of
        // the scroll, not as it starts — and it is hidden on the cover panel
        if (dotsNav) dotsNav.classList.toggle('dots--hidden', active === 0);
      }
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
      if (ndaTrack && ndaRows.length && panels[target] && panels[target].id === 'nda') {
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

    const introScroll = document.getElementById('introScroll');
    if (introScroll) introScroll.addEventListener('click', () => goTo(target + 1));

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
    // the heading's loaded font can change how much room is left for the strip
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { ndaLayout(); applyNda(); });
    }
  }
})();
