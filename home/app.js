/**
 * CTY MINISTRIES - INTERACTIVE SCROLL ANIMATION & PAGE CONTROLLER
 * High-performance 240-frame sequence scrubber + Scroll Reveal Observer
 */

(function () {
  'use strict';

  const TOTAL_FRAMES = 240;
  const FRAME_PATH = (idx) => `../zip2/ezgif-frame-${String(idx).padStart(3, '0')}.jpg`;

  // DOM Elements
  const track = document.getElementById('scroll-track');
  const viewport = document.getElementById('sticky-viewport');
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const scrollCue = document.getElementById('scroll-cue');
  const progressLine = document.getElementById('scroll-progress-line');
  const heroHeaderOverlay = document.getElementById('hero-header-overlay');
  const siteHeader = document.getElementById('site-header');

  // Image Storage & State
  const images = new Array(TOTAL_FRAMES + 1);
  let loadedCount = 0;
  let targetFrame = 1;
  let currentFrame = 1;
  let lastDrawnFrame = null;

  // ---------------------------------------------------------------------------
  // 1. CANVAS RESIZING & DRAWING
  // ---------------------------------------------------------------------------
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = viewport.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    lastDrawnFrame = null;
    drawFrame(Math.round(currentFrame));
  }

  function getClosestLoadedImage(frameIdx) {
    if (images[frameIdx] && images[frameIdx].complete && images[frameIdx].naturalWidth > 0) {
      return images[frameIdx];
    }
    // Search outward for closest available loaded frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const down = frameIdx - offset;
      if (down >= 1 && images[down] && images[down].complete && images[down].naturalWidth > 0) {
        return images[down];
      }
      const up = frameIdx + offset;
      if (up <= TOTAL_FRAMES && images[up] && images[up].complete && images[up].naturalWidth > 0) {
        return images[up];
      }
    }
    return null;
  }

  function drawFrame(frameIdx) {
    const img = getClosestLoadedImage(frameIdx);
    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const canvasRatio = cw / ch;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let dw, dh, ox, oy;
    if (canvasRatio > imgRatio) {
      dw = cw;
      dh = cw / imgRatio;
      ox = 0;
      oy = (ch - dh) / 2;
    } else {
      dh = ch;
      dw = ch * imgRatio;
      ox = (cw - dw) / 2;
      oy = 0;
    }

    ctx.fillStyle = '#F7F1E4';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, ox, oy, dw, dh);
    lastDrawnFrame = frameIdx;
  }

  // ---------------------------------------------------------------------------
  // 2. PROGRESSIVE PRELOAD ENGINE
  // ---------------------------------------------------------------------------
  function loadSingleFrame(idx) {
    return new Promise((resolve) => {
      if (images[idx]) return resolve();
      const img = new Image();
      img.src = FRAME_PATH(idx);
      img.onload = () => {
        images[idx] = img;
        loadedCount++;
        onProgressUpdate();
        if (idx === 1 && !lastDrawnFrame) {
          drawFrame(1);
        }
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
    });
  }

  function onProgressUpdate() {
    const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    if (statusText) {
      statusText.textContent = `Optimizing 3D frames (${percent}%)`;
    }
    if (loadedCount >= 24 && statusIndicator) {
      statusIndicator.classList.add('hidden');
    }
  }

  async function startPreloading() {
    // 1. Immediately load & render Frame 1
    await loadSingleFrame(1);
    drawFrame(1);

    // 2. Keyframes every 10 frames
    const keyframes = [];
    for (let i = 10; i <= TOTAL_FRAMES; i += 10) {
      keyframes.push(i);
    }
    keyframes.push(TOTAL_FRAMES);
    await Promise.all(keyframes.map(loadSingleFrame));

    // 3. Batch load remaining frames
    const remaining = [];
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      if (!images[i]) {
        remaining.push(i);
      }
    }

    const BATCH_SIZE = 10;
    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const batch = remaining.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(loadSingleFrame));
    }

    if (statusIndicator) {
      statusIndicator.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. SCROLL & LERP RENDER LOOP
  // ---------------------------------------------------------------------------
  function updateScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    const trackTop = track.offsetTop;
    const trackHeight = track.offsetHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = trackHeight - viewportHeight;

    // Hero sequence progress (0 to 1)
    let heroProgress = 0;
    if (maxScroll > 0) {
      heroProgress = Math.max(0, Math.min(1, (scrollY - trackTop) / maxScroll));
    }

    targetFrame = 1 + Math.round(heroProgress * (TOTAL_FRAMES - 1));

    if (siteHeader) {
      const showHeader = heroProgress >= 1;
      siteHeader.classList.toggle('-translate-y-full', !showHeader);
      siteHeader.classList.toggle('opacity-0', !showHeader);
      siteHeader.classList.toggle('pointer-events-none', !showHeader);
    }

    // Top progress line over entire page
    const totalDocHeight = document.documentElement.scrollHeight - viewportHeight;
    const globalProgress = totalDocHeight > 0 ? (scrollY / totalDocHeight) * 100 : 0;
    if (progressLine) {
      progressLine.style.width = `${Math.min(100, Math.max(0, globalProgress))}%`;
    }

    // Scroll prompt fade
    if (scrollCue) {
      if (scrollY > 30) {
        scrollCue.classList.add('faded');
      } else {
        scrollCue.classList.remove('faded');
      }
    }

    // Heading & Subheading fade away smoothly by 30% scroll of the scroll animation section
    if (heroHeaderOverlay) {
      const FADE_LIMIT = 0.30;
      if (heroProgress <= 0) {
        heroHeaderOverlay.style.opacity = '1';
        heroHeaderOverlay.style.transform = 'translate(-50%, 0px)';
      } else if (heroProgress < FADE_LIMIT) {
        const ratio = heroProgress / FADE_LIMIT;
        const opacity = Math.max(0, 1 - ratio);
        const translateY = -ratio * 25;
        heroHeaderOverlay.style.opacity = opacity.toFixed(3);
        heroHeaderOverlay.style.transform = `translate(-50%, ${translateY.toFixed(1)}px)`;
      } else {
        heroHeaderOverlay.style.opacity = '0';
        heroHeaderOverlay.style.transform = 'translate(-50%, -25px)';
      }
    }
  }

  function renderLoop() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.01) {
      currentFrame += diff * 0.25;
      drawFrame(Math.round(currentFrame));
    } else if (Math.round(currentFrame) !== lastDrawnFrame) {
      currentFrame = targetFrame;
      drawFrame(Math.round(currentFrame));
    }

    requestAnimationFrame(renderLoop);
  }

  // ---------------------------------------------------------------------------
  // 4. SCROLL REVEAL OBSERVER FOR CONTENT SECTIONS
  // ---------------------------------------------------------------------------
  function setupScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // ---------------------------------------------------------------------------
  // 5. INITIALIZATION
  // ---------------------------------------------------------------------------
  function init() {
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', updateScroll, { passive: true });

    resizeCanvas();
    updateScroll();
    startPreloading();
    requestAnimationFrame(renderLoop);
    setupScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
