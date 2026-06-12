import { useEffect, useRef, useState, useCallback } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { usePrompterWS }    from '../../hooks/usePrompterWS.js';
import { useScrollEngine }  from '../../hooks/useScrollEngine.js';
import { parseScript }      from '../../utils/scriptParser.js';
import { FocusLine }        from './FocusLine.jsx';
import { CueMarker }        from './CueMarker.jsx';

function FullscreenBtn({ bgColor }) {
  const [visible, setVisible] = useState(true);
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const fadeTimer = useRef(null);

  const resetFade = useCallback(() => {
    setVisible(true);
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setVisible(false), 2500);
  }, []);

  useEffect(() => {
    resetFade();
    window.addEventListener('mousemove', resetFade);
    const onFsChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('mousemove', resetFade);
      document.removeEventListener('fullscreenchange', onFsChange);
      clearTimeout(fadeTimer.current);
    };
  }, [resetFade]);

  function toggle() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // pick a contrasting icon color based on bg brightness
  const isDark = !bgColor || bgColor === '#000000' || bgColor === '#00b140';
  const iconColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  return (
    <button
      onClick={toggle}
      title={fs ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
      style={{
        position:   'fixed', bottom: 20, right: 20,
        opacity:    visible ? 1 : 0,
        transition: 'opacity 0.4s',
        background: 'none', border: 'none', cursor: 'pointer',
        zIndex: 50, padding: 8,
      }}
    >
      {fs ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
          <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V3h4"/><path d="M21 7V3h-4"/>
          <path d="M3 17v4h4"/><path d="M21 17v4h-4"/>
        </svg>
      )}
    </button>
  );
}

export function ReaderView() {
  usePrompterWS();

  const containerRef  = useRef(null);
  const contentRef    = useRef(null);
  const wsConnected   = usePrompterStore(s => s.wsConnected);
  useScrollEngine(containerRef);

  useEffect(() => { usePrompterStore.getState().loadScripts(); }, []);

  const {
    content, cues,
    fontSize, lineWidth, fontFamily, textColor, bgColor,
    isMirrored, isFlippedVertical, showFocusLine, focusLinePosition,
    play, pause, stop, setSpeed, speed, isPlaying,
    updateDisplay,
  } = usePrompterStore();

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let prevHeight = 0;
    const observer = new ResizeObserver(() => {
      const newHeight = el.scrollHeight;
      const container  = containerRef.current;

      // Content reflowed (live script edit, font/width change, etc.) — rescale
      // the scroll position proportionally so the reader stays at roughly the
      // same point in the script instead of snapping to whatever now lands at
      // the same pixel offset. Sync the corrected position back to the server
      // (and other clients) via seekTo so the scroll engine doesn't snap back.
      if (container && prevHeight > 0 && newHeight !== prevHeight) {
        const newScrollTop = container.scrollTop * (newHeight / prevHeight);
        container.scrollTop = newScrollTop;
        usePrompterStore.setState({ scrollPosition: newScrollTop });
        usePrompterStore.getState().seekTo(newScrollTop);
      }

      prevHeight = newHeight;
      usePrompterStore.getState().reportHeight(newHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':         e.preventDefault(); isPlaying ? pause() : play(); break;
        case 'r':
        case 'R':         stop(); break;
        case 'ArrowUp':   e.preventDefault(); setSpeed(Math.min(10, speed + 1)); break;
        case 'ArrowDown': e.preventDefault(); setSpeed(Math.max(1, speed - 1)); break;
        case 'f':
        case 'F':         updateDisplay({ showFocusLine: !showFocusLine }); break;
        case 'm':
        case 'M':         updateDisplay({ isMirrored: !isMirrored }); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, speed, showFocusLine, isMirrored]);

  const segments = parseScript(content);

  const transform = [
    isMirrored        ? 'scaleX(-1)' : '',
    isFlippedVertical ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ') || 'none';

  const fontClass = fontFamily === 'dm-mono' ? 'font-reader-mono' : 'font-reader';

  return (
    <div className="relative w-screen h-screen overflow-hidden"
      style={{ background: bgColor, transform }}>
      {showFocusLine && <FocusLine position={focusLinePosition} />}

      <div ref={containerRef} className="w-full h-full overflow-hidden">
        <div ref={contentRef}
          className={`mx-auto py-[50vh] ${fontClass}`}
          style={{ width: `${lineWidth}%`, fontSize: `${fontSize}px`, color: textColor, lineHeight: 1.5 }}>
          {segments.map((seg, i) => {
            if (seg.type === 'break') return (
              <hr key={i} className="my-8 border-t-2 opacity-20" style={{ borderColor: textColor }} />
            );
            if (seg.type === 'blank') return <div key={i} className="h-[1em]" />;
            if (seg.type === 'cue') {
              const cue = cues.find(c => c.label === seg.label);
              return <CueMarker key={i} label={seg.label} color={cue?.color ?? '#e8a838'} />;
            }
            return (
              <p key={i} className="mb-2">
                {seg.spans.map((span, j) => (
                  <span key={j} style={span.bold ? { fontWeight: 600, opacity: 1 } : { opacity: 0.9 }}>
                    {span.text}
                  </span>
                ))}
              </p>
            );
          })}
        </div>
      </div>

      <FullscreenBtn bgColor={bgColor} />

      {!wsConnected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, color: '#fff', fontFamily: 'sans-serif',
        }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e8a838', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.05em' }}>Reconnecting…</div>
        </div>
      )}
    </div>
  );
}
