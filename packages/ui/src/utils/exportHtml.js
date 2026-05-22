import { useSettingsStore } from '../stores/settingsStore.js';
import { useCueStore }      from '../stores/cueStore.js';
import { useMediaStore }    from '../stores/mediaStore.js';
import { useTimerStore }    from '../stores/timerStore.js';

// ── Blob → base64 data URL ────────────────────────────────────────────────────
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ── Collect every asset ID referenced by settings + cues ─────────────────────
function collectAssetIds(settings, cues) {
  const ids = new Set();
  if (settings.bgAssetId)   ids.add(settings.bgAssetId);
  if (settings.logoAssetId) ids.add(settings.logoAssetId);
  for (const id of settings.slideshowAssetIds ?? []) ids.add(id);
  for (const cue of cues) {
    for (const action of cue.actions ?? []) {
      if (action.payload?.assetId) ids.add(action.payload.assetId);
    }
  }
  ids.delete(null); ids.delete(undefined);
  return [...ids];
}

// ── Embed assets as base64 data URLs ─────────────────────────────────────────
async function embedAssets(assetIds, assetsMap) {
  const embedded = {};
  await Promise.allSettled(
    assetIds.map(async (id) => {
      const asset = assetsMap[id];
      if (!asset?.url) return;
      try {
        const res  = await fetch(asset.url);
        const blob = await res.blob();
        embedded[id] = { ...asset, dataUrl: await blobToDataUrl(blob) };
      } catch {
        /* skip unreachable assets */
      }
    })
  );
  return embedded;
}

// ── Generate the standalone HTML string ──────────────────────────────────────
function buildHtml({ settings, cues, total, assets }) {
  const {
    bgMode, bgColor, bgAssetId,
    imageSize, videoMuted, videoLoop,
    slideshowAssetIds, slideshowTransition, slideshowInterval, slideshowSize,
    logoAssetId, logoPosition, logoSize,
    overlayEnabled, overlayText,
    vignetteEnabled, vignetteIntensity,
    scanlinesEnabled, scanlinesIntensity,
    font, textColor, textSize,
    labelEnabled, labelMain, labelSub,
    blinkSeparator, warnFlashEnabled, warnThreshold, dangerThreshold,
  } = settings;

  const fontFamily = {
    display: '"Bebas Neue", sans-serif',
    sans:    '"DM Sans", sans-serif',
    mono:    '"JetBrains Mono", monospace',
  }[font] ?? '"Bebas Neue", sans-serif';

  const timerFontSize = `${(textSize / 100) * 20}vw`;
  const vigAlpha      = ((vignetteIntensity ?? 40) / 100) * 0.85;
  const scanAlpha     = ((scanlinesIntensity ?? 30) / 100) * 0.6;

  // Logo position CSS
  const LOGO_POS = {
    'top-left':      'top:4%;left:3%',
    'top-center':    'top:4%;left:50%;transform:translateX(-50%)',
    'top-right':     'top:4%;right:3%',
    'bottom-left':   'bottom:4%;left:3%',
    'bottom-center': 'bottom:4%;left:50%;transform:translateX(-50%)',
    'bottom-right':  'bottom:4%;right:3%',
  };

  // Only include assets that were successfully embedded
  const assetEntries = Object.entries(assets)
    .map(([id, a]) => `${JSON.stringify(id)}:${JSON.stringify({ dataUrl: a.dataUrl, type: a.type, url: a.url })}`)
    .join(',\n    ');

  // Clean cues: ensure actions array exists
  const cleanCues = cues.map(c => ({ ...c, actions: c.actions ?? [] }));

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Countdown</title>
  <!--
    Countdown Studio — standalone export
    Add ?autoplay=1 to URL to start automatically (browser sources).
    Press Space or click the timer to play/pause. Press H to hide controls.
  -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: ${bgColor}; }

    /* ── Layers ─────────────────────────────────────────────── */
    .layer {
      position: absolute;
      inset: 0;
      display: none;
    }
    #bg-layer      { display: block; background: ${bgColor}; }
    #countdown-layer { display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9; }

    /* ── Slideshow ──────────────────────────────────────────── */
    #ss-a, #ss-b {
      position: absolute;
      inset: 0;
      background-size: ${slideshowSize ?? 'cover'};
      background-position: center;
    }

    /* ── Vignette / scanlines ───────────────────────────────── */
    #vignette-layer {
      ${vignetteEnabled ? 'display:block;' : ''}
      background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${vigAlpha.toFixed(3)}) 100%);
      pointer-events: none;
    }
    #scanlines-layer {
      ${scanlinesEnabled ? 'display:block;' : ''}
      background-image: repeating-linear-gradient(0deg,
        rgba(0,0,0,${scanAlpha.toFixed(3)}) 0px, rgba(0,0,0,${scanAlpha.toFixed(3)}) 1px,
        transparent 1px, transparent 3px);
      pointer-events: none;
    }

    /* ── Flash ──────────────────────────────────────────────── */
    #flash-layer { pointer-events: none; z-index: 15; }
    @keyframes _flash { from { opacity: 0.4 } to { opacity: 0 } }

    /* ── Timer ──────────────────────────────────────────────── */
    #timer {
      font-family: ${fontFamily};
      font-size: ${timerFontSize};
      line-height: 0.88;
      letter-spacing: 0.04em;
      color: ${textColor};
      -webkit-font-smoothing: antialiased;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: color 0.2s ease;
    }
    #timer.warn   { color: #f5a623; }
    #timer.danger { color: #f5464a; }
    #timer.stopped { color: #8a8278; opacity: 0.6; }
    @keyframes _blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
    #timer-sep { ${blinkSeparator ? 'animation: _blink 1s step-end infinite;' : ''} }

    /* ── Labels ─────────────────────────────────────────────── */
    #labels { display: flex; flex-direction: column; align-items: center; margin-top: 2%; gap: 0.5%; font-family: "DM Sans", sans-serif; }
    #label-main { font-size: ${(textSize / 100) * 2.2}vw; color: ${textColor}; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
    #label-sub  { font-size: ${(textSize / 100) * 1.5}vw; color: #8a8278; letter-spacing: 0.08em; }

    /* ── Overlay ────────────────────────────────────────────── */
    #overlay-layer { ${overlayEnabled ? 'display:flex;' : ''} align-items: flex-end; justify-content: center; padding-bottom: 8%; z-index: 4; }
    #overlay-box   { background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 1.2rem 1.8rem; border-radius: 6px; color: white; font-family: ${fontFamily}; font-size: clamp(1rem,2.5vw,2rem); text-align: center; }

    /* ── Logo ───────────────────────────────────────────────── */
    #logo-layer  { pointer-events: none; z-index: 8; }
    #logo-img    { position: absolute; ${LOGO_POS[logoPosition] ?? LOGO_POS['top-right']}; width: ${logoSize ?? 80}px; height: auto; }

    /* ── Status dot ─────────────────────────────────────────── */
    #dot { position: fixed; top: 1.25rem; right: 1.25rem; width: 12px; height: 12px; border-radius: 50%; background: #3a3530; transition: background 0.3s, box-shadow 0.3s; }
    #dot.running { background: #34d48a; box-shadow: 0 0 0 4px rgba(52,212,138,0.2); }
    #dot.paused  { background: #f5a623; }

    /* ── Controls ───────────────────────────────────────────── */
    #controls {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 10px 16px;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      transition: opacity 0.3s;
    }
    #controls button {
      padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.08); color: #f0ede8; font-size: 13px;
      font-family: "DM Sans", sans-serif; cursor: pointer; transition: background 0.15s;
    }
    #controls button:hover { background: rgba(255,255,255,0.16); }
    #btn-play { background: rgba(232,168,56,0.2); border-color: rgba(232,168,56,0.4); color: #e8a838; }
    #btn-play:hover { background: rgba(232,168,56,0.35); }
    #ctrl-time { font-family: "JetBrains Mono", monospace; font-size: 14px; color: #b8b2a8; min-width: 70px; text-align: center; }
  </style>
</head>
<body>
  <!-- Layer stack mirrors the React canvas -->
  <div class="layer" id="bg-layer"></div>

  <div class="layer" id="video-layer">
    <video id="video-el" style="width:100%;height:100%;object-fit:cover"
      ${videoMuted ? 'muted' : ''} ${videoLoop ? 'loop' : ''} playsinline autoplay></video>
  </div>

  <div class="layer" id="slideshow-layer">
    <div id="ss-a"></div>
    <div id="ss-b" style="opacity:0;transition:opacity 600ms ease-in-out;position:absolute;inset:0;background-size:cover;background-position:center"></div>
    <div id="ss-progress" style="position:absolute;bottom:0;left:0;height:2px;width:0;background:#e8a838;transition:none"></div>
  </div>

  <div class="layer" id="image-layer"></div>
  <div class="layer" id="overlay-layer"><div id="overlay-box">${overlayText ?? ''}</div></div>
  <div class="layer" id="flash-layer"></div>
  <div class="layer" id="vignette-layer"></div>
  <div class="layer" id="scanlines-layer"></div>

  <div class="layer" id="logo-layer">
    ${logoAssetId ? `<img id="logo-img" src="" alt="logo">` : ''}
  </div>

  <div class="layer" id="countdown-layer">
    <div id="timer" title="Click to play / pause">
      <span id="timer-digits">--:--</span>
    </div>
    ${labelEnabled ? `
    <div id="labels">
      <div id="label-main">${labelMain ?? ''}</div>
      <div id="label-sub">${labelSub ?? ''}</div>
    </div>` : ''}
  </div>

  <div id="dot"></div>

  <div id="controls">
    <button id="btn-play">▶ Play</button>
    <button id="btn-stop">■ Stop</button>
    <button id="btn-reset">↺ Reset</button>
    <span id="ctrl-time">--:--</span>
  </div>

  <script>
  'use strict';
  /* ── Embedded data ───────────────────────────────────────────── */
  const ASSETS = {
    ${assetEntries}
  };
  const SETTINGS = ${JSON.stringify({
    bgMode, bgColor, bgAssetId,
    imageSize, videoMuted, videoLoop,
    slideshowAssetIds, slideshowTransition, slideshowInterval, slideshowSize,
    logoAssetId, logoPosition, logoSize,
    overlayEnabled, overlayText,
    vignetteEnabled, vignetteIntensity,
    scanlinesEnabled, scanlinesIntensity,
    font, textColor, textSize,
    labelEnabled, labelMain, labelSub,
    blinkSeparator, warnFlashEnabled, warnThreshold: warnThreshold ?? 30, dangerThreshold: dangerThreshold ?? 10,
  }, null, 2)};
  const CUES  = ${JSON.stringify(cleanCues, null, 2)};
  const TOTAL = ${total};

  /* ── Helpers ─────────────────────────────────────────────────── */
  function fmt(s) {
    if (s < 0) s = 0;
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
    var mm = String(m).padStart(2,'0'), ss = String(sc).padStart(2,'0');
    return h > 0 ? h+':'+mm+':'+ss : mm+':'+ss;
  }
  function hexToRgb(hex) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    var n = parseInt(hex,16);
    return [(n>>16)&255,(n>>8)&255,n&255].join(',');
  }
  function el(id) { return document.getElementById(id); }

  /* ── Timer state ─────────────────────────────────────────────── */
  var remaining = TOTAL, status = 'stopped', _iv = null, firedCues = new Set();

  function play() {
    if (status === 'running' || remaining <= 0) return;
    status = 'running';
    _iv = setInterval(tick, 1000);
    startSlideshow();
    render();
  }
  function pause() {
    if (status !== 'running') return;
    clearInterval(_iv); _iv = null;
    status = 'paused';
    render();
  }
  function stop() {
    clearInterval(_iv); _iv = null; clearInterval(_ssIv); _ssIv = null;
    status = 'stopped'; remaining = TOTAL; firedCues = new Set();
    render();
  }
  function reset() { stop(); }

  function tick() {
    if (remaining <= 0) { stop(); return; }
    remaining--;
    checkCues();
    render();
  }

  /* ── Cue engine ──────────────────────────────────────────────── */
  function checkCues() {
    CUES.forEach(function(cue) {
      if (!firedCues.has(cue.id) && cue.trigger_at === remaining) {
        firedCues.add(cue.id);
        (cue.actions || []).forEach(executeAction);
      }
    });
  }

  function executeAction(action) {
    var p = action.payload || {};
    switch (action.type) {
      case 'SWAP_BG': {
        var a = ASSETS[p.assetId];
        if (!a) break;
        if (a.type === 'video') {
          el('video-el').src = a.dataUrl; el('video-layer').style.display = 'block';
          el('image-layer').style.display = 'none'; el('slideshow-layer').style.display = 'none';
        } else {
          el('image-layer').style.backgroundImage = 'url('+a.dataUrl+')';
          el('image-layer').style.display = 'block';
          el('video-layer').style.display = 'none'; el('slideshow-layer').style.display = 'none';
        }
        break;
      }
      case 'PLAY_AUDIO': {
        var a = ASSETS[p.assetId];
        if (a && a.dataUrl) {
          var aud = new Audio(a.dataUrl);
          aud.volume = Math.max(0, Math.min(1, (p.volume || 80) / 100));
          aud.play().catch(function(){});
        }
        break;
      }
      case 'SET_LABEL':
        if (el('label-main')) el('label-main').textContent = p.main || '';
        if (el('label-sub'))  el('label-sub').textContent  = p.sub  || '';
        break;
      case 'SET_OVERLAY': {
        var ob = el('overlay-box'), ol = el('overlay-layer');
        if (!ob) break;
        ob.textContent = p.text || '';
        ob.style.background = 'rgba('+hexToRgb(p.color||'#000000')+','+(((p.opacity||60)/100)).toFixed(2)+')';
        ol.style.display = 'flex';
        break;
      }
      case 'SWAP_LOGO': {
        var img = el('logo-img'), a = ASSETS[p.assetId];
        if (img && a && a.dataUrl) {
          img.src = a.dataUrl;
          img.style.width = (p.size || 80) + 'px';
        }
        break;
      }
      case 'TOGGLE_EFFECT':
        if (p.effect === 'vignette')  el('vignette-layer').style.display  = p.enabled ? 'block' : 'none';
        if (p.effect === 'scanlines') el('scanlines-layer').style.display  = p.enabled ? 'block' : 'none';
        break;
      case 'FLASH_SCREEN': {
        var fl = el('flash-layer'), dur = p.duration || 300;
        fl.style.cssText = 'position:absolute;inset:0;background:'+(p.color||'#fff')+';animation:_flash '+dur+'ms ease-out both;display:block;z-index:15';
        setTimeout(function(){ fl.style.display='none'; fl.style.animation=''; }, dur + 60);
        break;
      }
    }
  }

  /* ── Slideshow ───────────────────────────────────────────────── */
  var _ssIv = null, _ssIdx = 0, _ssActive = 'a';
  var slides = (SETTINGS.slideshowAssetIds || []).map(function(id){ return ASSETS[id]; }).filter(Boolean);

  function showSlide(idx) {
    var s = slides[idx]; if (!s) return;
    var from = el('ss-'+_ssActive), to = el('ss-'+(_ssActive==='a'?'b':'a'));
    to.style.backgroundImage = 'url('+s.dataUrl+')';
    if (SETTINGS.slideshowTransition === 'cut') {
      from.style.backgroundImage = 'url('+s.dataUrl+')';
    } else {
      to.style.opacity = '1'; from.style.opacity = '0';
      setTimeout(function(){ from.style.backgroundImage=''; from.style.opacity=''; }, 700);
      _ssActive = _ssActive === 'a' ? 'b' : 'a';
    }
  }

  function startSlideshow() {
    if (SETTINGS.bgMode !== 'slideshow' || slides.length < 2) return;
    if (_ssIv) clearInterval(_ssIv);
    _ssIv = setInterval(function(){
      _ssIdx = (_ssIdx + 1) % slides.length;
      showSlide(_ssIdx);
    }, SETTINGS.slideshowInterval || 5000);
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function render() {
    var d  = el('timer-digits');
    var wt = el('timer');
    var ct = el('ctrl-time');
    var dot = el('dot');

    var disp = (status === 'stopped' && remaining === 0) ? '--:--' : fmt(remaining);
    if (d)  d.textContent  = disp;
    if (ct) ct.textContent = disp;
    dot.className = status;

    if (wt) {
      wt.className = '';
      if (status === 'stopped') wt.classList.add('stopped');
      else if (status === 'running') {
        if (remaining <= (SETTINGS.dangerThreshold || 10)) wt.classList.add('danger');
        else if (SETTINGS.warnFlashEnabled && remaining <= (SETTINGS.warnThreshold || 30)) wt.classList.add('warn');
      }
    }

    var pb = el('btn-play');
    if (pb) pb.textContent = status === 'running' ? '⏸ Pause' : '▶ Play';
  }

  /* ── Init DOM from settings ──────────────────────────────────── */
  (function init() {
    // Background
    el('bg-layer').style.background = SETTINGS.bgColor;

    if (SETTINGS.bgMode === 'color') {
      el('bg-layer').style.display = 'block';
    } else if (SETTINGS.bgMode === 'image' && ASSETS[SETTINGS.bgAssetId]) {
      var a = ASSETS[SETTINGS.bgAssetId];
      var il = el('image-layer');
      il.style.backgroundImage    = 'url('+a.dataUrl+')';
      il.style.backgroundSize     = SETTINGS.imageSize || 'cover';
      il.style.backgroundPosition = 'center';
      il.style.display            = 'block';
    } else if (SETTINGS.bgMode === 'video' && ASSETS[SETTINGS.bgAssetId]) {
      var ve = el('video-el');
      ve.src = ASSETS[SETTINGS.bgAssetId].dataUrl;
      el('video-layer').style.display = 'block';
    } else if (SETTINGS.bgMode === 'slideshow' && slides.length) {
      el('slideshow-layer').style.display = 'block';
      el('ss-a').style.backgroundImage = 'url('+slides[0].dataUrl+')';
    }

    // Logo
    var li = el('logo-img');
    if (li && SETTINGS.logoAssetId && ASSETS[SETTINGS.logoAssetId]) {
      li.src = ASSETS[SETTINGS.logoAssetId].dataUrl;
      el('logo-layer').style.display = 'block';
    }

    // Overlay
    if (SETTINGS.overlayEnabled && SETTINGS.overlayText) {
      el('overlay-layer').style.display = 'flex';
    }

    render();
  })();

  /* ── Controls ────────────────────────────────────────────────── */
  el('btn-play').addEventListener('click', function(){ status==='running'?pause():play(); });
  el('btn-stop').addEventListener('click', stop);
  el('btn-reset').addEventListener('click', reset);
  el('timer-digits').addEventListener('click', function(){ status==='running'?pause():play(); });

  var ctrlsHidden = false;
  document.addEventListener('keydown', function(e) {
    if (e.key === 'h' || e.key === 'H') {
      ctrlsHidden = !ctrlsHidden;
      el('controls').style.opacity = ctrlsHidden ? '0' : '1';
      el('controls').style.pointerEvents = ctrlsHidden ? 'none' : '';
    }
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      status==='running'?pause():play();
    }
  });

  /* ── Autoplay ────────────────────────────────────────────────── */
  if (new URLSearchParams(location.search).has('autoplay')) {
    window.addEventListener('load', function(){ setTimeout(play, 300); });
  }
  </script>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function exportHtml() {
  const settings  = useSettingsStore.getState();
  const { cues }  = useCueStore.getState();
  const { assets } = useMediaStore.getState();
  const total     = useTimerStore.getState().total;

  const assetIds = collectAssetIds(settings, cues);
  const embedded = await embedAssets(assetIds, assets);

  const html = buildHtml({ settings, cues, total, assets: embedded });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'countdown-export.html';
  a.click();

  URL.revokeObjectURL(url);
}
