import { useEffect, useRef, useState } from 'react';
import { useWebSocket }    from '../../hooks/useWebSocket.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { useTimerStore }    from '../../stores/timerStore.js';
import { PreviewCanvas }   from '../canvas/PreviewCanvas.jsx';
import { Sidebar }         from '../sidebar/Sidebar.jsx';
import { PlanView }        from '../plan/PlanView.jsx';
import { ModeBar }         from './ModeBar.jsx';
import { Footer }          from './Footer.jsx';

const SERVER = 'http://localhost:9876';

export function AppShell() {
  useWebSocket(); // mount once — establishes the singleton WS connection

  const [mode, setMode] = useState('design');
  const slideshowRef    = useRef(null);

  // Seed media store so assets are available immediately in all panels
  useEffect(() => { useMediaStore.getState().fetchAll(); }, []);

  // ── Push visual settings to server so output.html stays in sync ───────────
  useEffect(() => {
    let timer = null;

    function sync() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s      = useSettingsStore.getState();
        const assets = useMediaStore.getState().assets;

        const payload = {};
        for (const [k, v] of Object.entries(s)) {
          if (typeof v !== 'function' && !k.startsWith('_')) payload[k] = v;
        }

        // Resolve asset IDs → URLs so the output page needs no extra lookups
        payload.bgAssetUrl    = assets[s.bgAssetId]?.url   ?? null;
        payload.logoAssetUrl  = assets[s.logoAssetId]?.url ?? null;
        payload.slideshowUrls = (s.slideshowAssetIds ?? [])
          .map(id => assets[id]?.url).filter(Boolean);
        // Full asset map for cue-action lookups in the output page
        payload.assetUrls = Object.fromEntries(
          Object.entries(assets).map(([id, a]) => [id, { url: a.url, type: a.type }])
        );

        fetch(`${SERVER}/api/settings`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }).catch(() => {});
      }, 300);
    }

    sync(); // immediate sync on mount
    const unsubS = useSettingsStore.subscribe(sync);
    const unsubM = useMediaStore.subscribe(sync);
    return () => { clearTimeout(timer); unsubS(); unsubM(); };
  }, []);

  // ── End-behaviour: react when timer naturally reaches 00:00 ───────────────
  useEffect(() => {
    return useTimerStore.subscribe((curr, prev) => {
      if (prev.status !== 'running' || curr.status !== 'stopped' || curr.remaining !== 0) return;
      const { endBehavior } = useSettingsStore.getState();
      if (endBehavior === 'fadeout') {
        useSettingsStore.setState({ _scrimColor: '#000000', _scrimTransition: 1500, _scrimOpacity: 1 });
      } else if (endBehavior === 'loop') {
        const { reset, play } = useTimerStore.getState();
        reset();
        setTimeout(play, 300);
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary overflow-hidden font-sans">
      <ModeBar mode={mode} onModeChange={setMode} />

      <main className="flex flex-1 overflow-hidden">
        {mode === 'design' ? (
          <>
            {/* Canvas area */}
            <div className="flex-1 flex items-center justify-center p-6 bg-surface-base overflow-hidden">
              <PreviewCanvas
                slideshowRef={slideshowRef}
                className="max-h-full shadow-2xl"
              />
            </div>

            <Sidebar />
          </>
        ) : (
          /* Plan mode: mini preview + timeline + cue editor */
          <>
            <PlanView slideshowRef={slideshowRef} />
            <Sidebar />
          </>
        )}
      </main>

      <Footer slideshowRef={slideshowRef} />
    </div>
  );
}
