import { useEffect, useRef, useState } from 'react';
import { useWebSocket }    from '../../hooks/useWebSocket.js';
import { send }            from '../../wsClient.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }    from '../../stores/mediaStore.js';
import { useTimerStore }    from '../../stores/timerStore.js';
import { useRoomStore }     from '../../stores/roomStore.js';
import { PreviewCanvas }   from '../canvas/PreviewCanvas.jsx';
import { OutputPage }      from '../canvas/OutputPage.jsx';
import { Sidebar }         from '../sidebar/Sidebar.jsx';
import { PlanView }        from '../plan/PlanView.jsx';
import { ModeBar }         from './ModeBar.jsx';
import { Footer }          from './Footer.jsx';
import { RoomGate }        from '../RoomGate.jsx';
import { UpdateBanner }    from '../shared/UpdateBanner.jsx';

export function AppShell() {
  if (typeof window !== 'undefined' && window.location.pathname === '/output') {
    return <OutputPage />;
  }
  const [ready, setReady] = useState(false);
  const room              = useRoomStore(s => s.room);

  // Restore session from sessionStorage on first mount
  useEffect(() => {
    useRoomStore.getState().initialize().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!room) return <RoomGate />;

  return <MainApp />;
}

function MainApp() {
  useWebSocket();

  const [mode, setMode] = useState('design');
  const slideshowRef    = useRef(null);

  useEffect(() => { useMediaStore.getState().fetchAll(); }, []);

  // ── Push settings to server via WS so all clients stay in sync ────────────
  useEffect(() => {
    let timer    = null;
    let saveTimer = null;
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
        if (hash === lastHash) return;
        lastHash = hash;
        send('settings:update', payload);
        // Persist to DB with a longer debounce so the output page can load
        // settings even when the studio isn't open
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          useSettingsStore.getState().saveToRoom().catch(() => {});
        }, 2000);
      }, 300);
    }

    sync();
    const unsubS = useSettingsStore.subscribe(sync);
    const unsubM = useMediaStore.subscribe(sync);
    return () => { clearTimeout(timer); clearTimeout(saveTimer); unsubS(); unsubM(); };
  }, []);

  // ── End-behaviour ─────────────────────────────────────────────────────────
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

  const isElectron = typeof window !== 'undefined' && !!window.__ELECTRON__
  const room = useRoomStore(s => s.room)

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary overflow-hidden font-sans">
      <UpdateBanner />
      <ModeBar mode={mode} onModeChange={setMode} rightSlot={isElectron && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.__ELECTRON_API__?.openOutputWindow(room?.code)}
            title="Open output window"
            className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-transparent hover:border-border-subtle transition-colors"
          >
            Output ↗
          </button>
          <button
            onClick={() => window.__ELECTRON_API__?.openTeleprompterReader(room?.code)}
            title="Open teleprompter reader"
            className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-transparent hover:border-border-subtle transition-colors"
          >
            Teleprompter ↗
          </button>
        </div>
      )} />

      <main className="flex flex-1 overflow-hidden">
        {mode === 'design' ? (
          <>
            <div className="flex-1 flex items-center justify-center p-6 bg-surface-base overflow-hidden">
              <PreviewCanvas
                slideshowRef={slideshowRef}
                className="max-h-full shadow-2xl"
              />
            </div>
            <Sidebar />
          </>
        ) : (
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
