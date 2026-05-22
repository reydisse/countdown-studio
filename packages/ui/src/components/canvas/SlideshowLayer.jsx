import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { useShallow }       from 'zustand/react/shallow';

const DURATION = 600;

const KEYFRAMES = `
@keyframes ss-fade-in  { from{opacity:0}                         to{opacity:1} }
@keyframes ss-fade-out { from{opacity:1}                         to{opacity:0} }
@keyframes ss-zoom-in  { from{opacity:0;transform:scale(1.07)}  to{opacity:1;transform:scale(1)} }
@keyframes ss-slide-in { from{transform:translateX(100%)}        to{transform:translateX(0)} }
@keyframes ss-slide-out{ from{transform:translateX(0)}           to{transform:translateX(-100%)} }
@keyframes kenburns {
  0%  { transform: scale(1.00) translate( 0%,  0%); }
  33% { transform: scale(1.07) translate(-1%,-0.8%); }
  66% { transform: scale(1.04) translate( 1%, 1.2%); }
  100%{ transform: scale(1.09) translate(-0.5%, 0.5%); }
}
@keyframes blink-sep  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes flash-pulse { 0%{opacity:1} 100%{opacity:0} }
`;

function inAnim(t)  {
  if (t === 'fade' || t === 'crossfade') return `ss-fade-in  ${DURATION}ms ease-in-out both`;
  if (t === 'zoom')                      return `ss-zoom-in  ${DURATION}ms ease-out   both`;
  if (t === 'slide')                     return `ss-slide-in ${DURATION}ms ease-in-out both`;
  return 'none';
}
function outAnim(t) {
  if (t === 'fade' || t === 'crossfade') return `ss-fade-out  ${DURATION}ms ease-in-out both`;
  if (t === 'slide')                     return `ss-slide-out ${DURATION}ms ease-in-out both`;
  return 'none';
}

export const SlideshowLayer = forwardRef(function SlideshowLayer(_props, ref) {
  const bgMode              = useSettingsStore(s => s.bgMode);
  const slideshowAssetIds   = useSettingsStore(useShallow(s => s.slideshowAssetIds));
  const slideshowTransition = useSettingsStore(s => s.slideshowTransition);
  const slideshowInterval   = useSettingsStore(s => s.slideshowInterval);
  const slideshowSize       = useSettingsStore(s => s.slideshowSize);
  const assets              = useMediaStore(s => s.assets);

  const [activeIdx,  setActiveIdx]  = useState(0);
  const [outIdx,     setOutIdx]     = useState(null);
  const [inProgress, setInProgress] = useState(false);
  const [elapsed,    setElapsed]    = useState(0);

  const urls  = slideshowAssetIds.map(id => assets[id]?.url).filter(Boolean);
  const count = urls.length;

  // ── Mutable ref so callbacks stay stable (no stale-closure issues) ───────
  const sr = useRef({ activeIdx: 0, count: 0, lock: false, transition: 'fade' });
  // Keep ref in sync every render (before effects)
  sr.current.activeIdx  = activeIdx;
  sr.current.count      = count;
  sr.current.transition = slideshowTransition;

  // ── Clamp activeIdx when images are removed ───────────────────────────────
  useEffect(() => {
    if (count > 0 && activeIdx >= count) setActiveIdx(0);
  }, [count, activeIdx]);

  // ── Stable transition function — reads everything from sr ref ─────────────
  const goTo = useCallback((targetIdx) => {
    const { count, activeIdx, lock, transition } = sr.current;
    if (count < 2 || lock) return;
    const next = ((targetIdx % count) + count) % count;
    if (next === activeIdx) return;

    sr.current.lock      = true;
    sr.current.activeIdx = next;   // update ref immediately so interval is correct

    setOutIdx(activeIdx);
    setInProgress(true);
    setActiveIdx(next);
    setElapsed(0);

    const delay = transition === 'cut' ? 0 : DURATION;
    setTimeout(() => {
      setOutIdx(null);
      setInProgress(false);
      sr.current.lock = false;
    }, delay);
  }, []); // no deps — uses sr ref for all mutable values

  // ── Expose prev/next/goTo via ref ─────────────────────────────────────────
  const next = useCallback(() => goTo(sr.current.activeIdx + 1), [goTo]);
  const prev = useCallback(() => goTo(sr.current.activeIdx - 1), [goTo]);
  useImperativeHandle(ref, () => ({ next, prev, goTo }), [next, prev, goTo]);

  // ── Register runtime state in settingsStore for SlideDots ─────────────────
  useEffect(() => {
    useSettingsStore.setState({
      _slideshowActiveIndex: activeIdx,
      _slideshowCount:       count,
      _slideshowGoTo:        goTo,
    });
  }, [activeIdx, count, goTo]);

  // ── Auto-advance: stable interval (not restarted on every slide change) ───
  useEffect(() => {
    if (bgMode !== 'slideshow' || count < 2) return;
    const id = setInterval(() => {
      // Read from ref — never stale, never causes the effect to restart
      goTo(sr.current.activeIdx + 1);
    }, slideshowInterval);
    return () => clearInterval(id);
  }, [bgMode, count, slideshowInterval, goTo]); // goTo is stable ✓

  // ── Progress bar elapsed counter (resets on each slide change) ────────────
  useEffect(() => {
    if (bgMode !== 'slideshow' || count === 0) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed(e => e + 100), 100);
    return () => clearInterval(id);
  }, [activeIdx, bgMode, count]);

  if (bgMode !== 'slideshow' || count === 0) return null;

  const bgSize     = slideshowSize || 'cover';
  const isKenBurns = slideshowTransition === 'kenburns';
  const progress   = Math.min((elapsed / (slideshowInterval || 5000)) * 100, 100);

  // Clamp indices defensively
  const safeActive = Math.max(0, Math.min(activeIdx, count - 1));
  const safeOut    = outIdx !== null ? Math.max(0, Math.min(outIdx, count - 1)) : null;

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Outgoing slide */}
      {safeOut !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:    `url(${urls[safeOut]})`,
            backgroundSize:     bgSize,
            backgroundPosition: 'center',
            animation:          outAnim(slideshowTransition),
            zIndex:             2,
          }}
        />
      )}

      {/* Active slide */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 3 }}>
        <div
          style={{
            position:           'absolute',
            inset:              0,
            backgroundImage:    `url(${urls[safeActive]})`,
            backgroundSize:     bgSize,
            backgroundPosition: 'center',
            animation: inProgress
              ? inAnim(slideshowTransition)
              : isKenBurns
                ? `kenburns ${slideshowInterval}ms ease-in-out infinite alternate`
                : 'none',
          }}
        />
      </div>

      {/* Progress bar — studio-only indicator, not shown in output page */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ zIndex: 10 }}>
        <div className="h-full bg-accent transition-none" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
});
