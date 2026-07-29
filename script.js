/**
 * ================================================================
 *  BMW M5 E60 — script.js
 *  Scroll-Linked Canvas Animasyonu + Detay Section Reveal
 * ================================================================
 *
 *  ── HIZLI YAPILANDIRMA KILAVUZU ──────────────────────────────
 *
 *  1. FRAME SAYISI
 *     frameCount → Klasörünüzdeki toplam WebP dosyası adedi.
 *     Mevcut: kare_0001.webp – kare_0158.webp → 158
 *
 *  2. DOSYA FORMATI  (getFramePath fonksiyonu)
 *     Mevcut : kare_0001.webp  → padStart(4, '0')
 *     Örnek A : frame001.webp  → `frame${String(i).padStart(3,'0')}.webp`
 *     Örnek B : img_00001.png  → `img_${String(i).padStart(5,'0')}.png`
 *
 *  3. KLASÖR YOLU
 *     framePath → Görsellerin bulunduğu klasör (index.html'e göre relatif)
 *
 *  4. SCROLL UZUNLUĞU
 *     scrollVH → Canvas bölümünün viewport-height cinsinden yüksekliği.
 *     Örn: 5 → kullanıcı 5 ekran boyu scroll edince tüm frame'ler biter.
 *     Artırırsanız döndürme daha yavaş/uzun olur.
 *
 *  5. EŞ ZAMANLI YÜKLEME
 *     concurrentLoads → Aynı anda kaç görsel indirilsin? (Önerilen: 4–8)
 * ================================================================
 */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. YAPILANDIRMA
   ════════════════════════════════════════════════════════════════ */

/** Klasördeki toplam WebP frame sayısı */
const frameCount = 158;

/** Görsel dosyalarının bulunduğu klasör */
const framePath = './webp/';

/**
 * Canvas bölümünün viewport-height cinsinden scroll uzunluğu.
 * 3 → 300vh → kullanıcı 3 ekran boyu scroll edince araba tam tur döner.
 * Daha hızlı geçiş için küçültün (min ~2), daha yavaş için büyütün.
 */
const scrollVH = 3;

/** Aynı anda indirilen görsel sayısı (bellek/ağ dengesi için 4–8 önerilir) */
const concurrentLoads = 6;

/**
 * Frame dosya yolunu üretir.
 * Kendi isimlendirmenize göre bu fonksiyonu güncelleyin.
 *
 * @param {number} i  1'den başlayan frame numarası (1 → frameCount)
 * @returns {string}  Tam dosya URL'si
 */
function getFramePath(i) {
  // kare_0001.webp, kare_0002.webp ... kare_0158.webp
  return `${framePath}kare_${String(i).padStart(4, '0')}.webp`;
}

/* ════════════════════════════════════════════════════════════════
   2. DOM REFERANSLARI
   ════════════════════════════════════════════════════════════════ */
const loader          = document.getElementById('loader');
const loaderFill      = document.getElementById('loaderFill');
const loaderPct       = document.getElementById('loaderPct');
const navbar          = document.getElementById('navbar');
const canvas          = document.getElementById('hero-canvas');
const ctx             = canvas.getContext('2d');
const canvasSpace     = document.getElementById('canvas-scroll-space');
const cvBadge         = document.getElementById('cvBadge');
const cvCounter       = document.getElementById('cvCounter');
const cvProgress      = document.getElementById('cvProgress');
const cvDeg           = document.getElementById('cvDeg');

/* Scroll-reveal ile animasyonlanacak tüm elementler */
const revealEls = document.querySelectorAll(
  '.ds-lead, .ds-body, .spec-grid, .info-strip, .legacy-quote, ' +
  '.ds-label-col, .closing-inner'
);

/* ════════════════════════════════════════════════════════════════
   3. STATE
   ════════════════════════════════════════════════════════════════ */
const images      = new Array(frameCount);  // Yüklenen Image objeleri
let   loadedCount = 0;                      // Yüklenen frame adedi
let   allLoaded   = false;                  // Tümü hazır mı?
let   currentFrame= 0;                      // Canvas'ta gösterilen frame (0-indexed)
let   rafId       = null;                   // requestAnimationFrame handle

/* ════════════════════════════════════════════════════════════════
   4. CANVAS BOYUTLANDIRMA
   Canvas her zaman tam ekran; görsel "cover" modda çizilir.
   ════════════════════════════════════════════════════════════════ */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (allLoaded && images[currentFrame]?.complete) {
    drawFrame(currentFrame);
  }
}

/* ════════════════════════════════════════════════════════════════
   5. FRAME ÇİZİMİ
   "cover" mantığı: görsel en-boy oranı korunarak canvas'ı tamamen kaplar.
   İsterseniz 'contain' için Math.min kullanın.
   ════════════════════════════════════════════════════════════════ */
function drawFrame(index) {
  const img = images[index];
  if (!img || !img.complete || !img.naturalWidth) return;

  const cw = canvas.width,  ch = canvas.height;
  const iw = img.naturalWidth, ih = img.naturalHeight;

  /* cover: oranı büyük boyuta göre ayarla */
  const scale = Math.max(cw / iw, ch / ih);
  const dw    = iw * scale;
  const dh    = ih * scale;
  const dx    = (cw - dw) / 2;
  const dy    = (ch - dh) / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ════════════════════════════════════════════════════════════════
   6. ÖN YÜKLEME (PRELOAD)
   Görseller concurrent olarak yüklenir.
   Her yükleme loading bar'ı ve yüzdeyi günceller.
   ════════════════════════════════════════════════════════════════ */
function preloadFrames() {
  let nextIndex = 1; // 1-indexed (kare_0001'den başlar)

  function loadNext() {
    if (nextIndex > frameCount) return;

    const frameNum = nextIndex;       // 1-based dosya numarası
    const arrIdx   = nextIndex - 1;   // 0-based dizi indeksi
    nextIndex++;

    const img = new Image();

    img.onload = () => {
      images[arrIdx] = img;
      loadedCount++;
      updateLoader();

      /* İlk frame yüklenir yüklenmez canvas'a çiz */
      if (arrIdx === 0) drawFrame(0);

      if (loadedCount >= frameCount) { onAllLoaded(); return; }
      loadNext(); // bir sonrakini sıraya al
    };

    img.onerror = () => {
      /* Bozuk/eksik frame: es geç, sayacı artır */
      console.warn(`[M5] Frame yüklenemedi: ${getFramePath(frameNum)}`);
      loadedCount++;
      updateLoader();
      if (loadedCount >= frameCount) { onAllLoaded(); return; }
      loadNext();
    };

    img.src = getFramePath(frameNum);
  }

  /* Paralel yükleme başlat */
  const slots = Math.min(concurrentLoads, frameCount);
  for (let s = 0; s < slots; s++) loadNext();
}

function updateLoader() {
  const pct = Math.round((loadedCount / frameCount) * 100);
  loaderFill.style.width   = `${pct}%`;
  loaderPct.textContent    = `${pct}%`;
}

function onAllLoaded() {
  allLoaded = true;

  /* Kısa gecikme: loading bar animasyonunun tamamlanması için */
  setTimeout(() => {
    loader.classList.add('hidden');

    /* Badge ve derece sayacını göster */
    cvBadge.classList.add('show');
    cvCounter.classList.add('show');
  }, 600);

  /* RAF döngüsünü başlat */
  startRenderLoop();
}

/* ════════════════════════════════════════════════════════════════
   7. SCROLL HESAPLAMASI
   ════════════════════════════════════════════════════════════════ */

/**
 * Canvas bölümünün scroll ilerlemesini 0–1 olarak döndürür.
 * Canvas bölümü bittikten sonra 1 sabit kalır.
 * Detay section'larının scroll'u bu değeri etkilemez.
 */
function getCanvasProgress() {
  const scrollY     = window.scrollY;
  const sectionH    = canvasSpace.offsetHeight;  // Toplam scroll uzayı (px)
  const viewportH   = window.innerHeight;

  /* Sticky wrapper'ın scroll'u: 0 → (sectionH - viewportH) */
  const maxScroll = sectionH - viewportH;
  if (maxScroll <= 0) return 0;

  return Math.max(0, Math.min(1, scrollY / maxScroll));
}

/** Progress 0–1 → Frame index 0–(frameCount-1) */
function progressToFrame(p) {
  return Math.min(frameCount - 1, Math.floor(p * (frameCount - 1)));
}

/* ════════════════════════════════════════════════════════════════
   8. RAF RENDER DÖNGÜSÜ
   Sadece frame değiştiğinde canvas'ı çizer → gereksiz iş yok.
   ════════════════════════════════════════════════════════════════ */
function renderLoop() {
  const progress  = getCanvasProgress();
  const newFrame  = progressToFrame(progress);

  /* Canvas'ı güncelle (sadece frame değiştiyse) */
  if (newFrame !== currentFrame) {
    currentFrame = newFrame;
    drawFrame(currentFrame);
  }

  /* İlerleme çubuğu ve derece sayacı */
  cvProgress.style.width = `${progress * 100}%`;
  cvDeg.textContent      = `${Math.round(progress * 360)}°`;

  rafId = requestAnimationFrame(renderLoop);
}

function startRenderLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  renderLoop();
}

/* ════════════════════════════════════════════════════════════════
   9. SCROLL UZAYINI AYARLA
   canvas-scroll-space yüksekliği = scrollVH × viewport yüksekliği.
   Bu, sticky canvas'ın ne kadar süre "ekranda kalacağını" belirler.
   ════════════════════════════════════════════════════════════════ */
function setCanvasScrollHeight() {
  canvasSpace.style.height = `${window.innerHeight * scrollVH}px`;
}

/* ════════════════════════════════════════════════════════════════
   10. NAVBAR EFEKTİ
   ════════════════════════════════════════════════════════════════ */
function updateNavbar() {
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

/* ════════════════════════════════════════════════════════════════
   11. SCROLL REVEAL — DETAY SECTION'LARI
   IntersectionObserver ile elementler viewport'a girince
   fade-in + translateY(0) animasyonu tetiklenir.
   ════════════════════════════════════════════════════════════════ */
function initScrollReveal() {
  /* Tüm reveal hedeflerine başlangıç sınıfı ekle */
  revealEls.forEach((el, i) => {
    el.classList.add('reveal');
    /* Birbiri ardına gelen elementler için staggered gecikme */
    el.style.transitionDelay = `${(i % 3) * 0.08}s`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          /* Bir kez tetiklendikten sonra gözlemlemeyi bırak */
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,       /* Elementin %12'si görününce tetikle */
      rootMargin: '0px 0px -60px 0px' /* Alt kenardan 60px önce tetikle */
    }
  );

  revealEls.forEach(el => observer.observe(el));
}

/* ════════════════════════════════════════════════════════════════
   12. PENCERE ODAK/BLUR — PİL TASARRUFU
   Sekme arka plana geçince RAF durur, öne gelince devam eder.
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  } else if (allLoaded) {
    startRenderLoop();
  }
});

/* ════════════════════════════════════════════════════════════════
   13. EVENT LISTENER'LAR
   ════════════════════════════════════════════════════════════════ */
window.addEventListener('resize', () => {
  resizeCanvas();
  setCanvasScrollHeight();
}, { passive: true });

window.addEventListener('scroll', updateNavbar, { passive: true });

/* ════════════════════════════════════════════════════════════════
   14. BAŞLANGIÇ
   ════════════════════════════════════════════════════════════════ */
(function init() {
  resizeCanvas();
  setCanvasScrollHeight();
  initScrollReveal();
  preloadFrames();
})();
