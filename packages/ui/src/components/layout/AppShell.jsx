import { useEffect, useRef, useState } from 'react';
import { useWebSocket }    from '../../hooks/useWebSocket.js';
import { send }            from '../../wsClient.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { useTimerStore }    from '../../stores/timerStore.js';
import { PreviewCanvas }   from '../canvas/PreviewCanvas.jsx';
import { Sidebar }         from '../sidebar/Sidebar.jsx';
import { PlanView }        from '../plan/PlanView.jsx';
import { ModeBar }         from './ModeBar.jsx';
import { Footer }          from './Footer.jsx';

export function AppShell() {
  useWebSocket(); // mount once — establishes the singleton WS connection

  const [mode, setMode] = useState('design');
  const slideshowRef    = useRef(null);

  // Seed media store so assets are available immediately in all panels
  useEffect(() => { useMediaStore.getState().fetchAll(); }, []);

  // ── Push settings to server via WS so all clients stay in sync ────────────
  // Uses 'settings:update' (WS) instead of HTTP POST so the server can use
  // broadcastExcept — other studio windows and the output page receive
  // 'settings:changed' but the sender is excluded, preventing echo loops.
  //
  // Hash tracking stops ping-pong: when we receive settings from another
  // client, applyFromServer() updates our store. Our own debounce fires but
  // the hash matches lastHash so we skip the outgoing send.
  useEffect(() => {
    let timer    = null;
    let lastHash = '';

    function buildPayload() {
      const s      = useSettingsStore.getState();
      const assets = useMediaStore.getState().assets;
      const payload = {};
      for (const [k, v] of Object.entries(s)) {
        if (typeof v !== 'function' && !k.startsWith('_')) payload[k] = v;
      }
      payload.bgAssetUrl    = assets[s.bgAssetId]?.url    ?? null;
      payload.logoAssetUrl  = assets[s.logoAssetId]?.url  ?? null;
      payload.slideshowUrls = (s.slideshowAssetIds ?? [])
        .map(id => assets[id]?.url).filter(Boolean);
      payload.assetUrls = Object.fromEntries(
        Object.entries(assets).map(([id, a]) => [id, { url: a.url, type: a.type }])
      );
      return payload;
    }

    function sync() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = buildPayload();
        const hash    = JSON.stringify(payload);
        if (hash === lastHash) return; // nothing changed (or echo from server)
        lastHash = hash;
        send('settings:update', payload);
      }, 300);
    }

    sync();
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
