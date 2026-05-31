import { useEffect, useRef, useState } from 'react';
import { useWebSocket }    from '../../hooks/useWebSocket.js';
import { useRoomStore }    from '../../stores/roomStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useMediaStore }   from '../../stores/mediaStore.js';
import { getRoom }         from '../../adapter/index.js';
import { BgLayer }         from './BgLayer.jsx';
import { VideoLayer }      from './VideoLayer.jsx';
import { SlideshowLayer }  from './SlideshowLayer.jsx';
import { ImageLayer }      from './ImageLayer.jsx';
import { OverlayLayer }    from './OverlayLayer.jsx';
import { FlashLayer }      from './FlashLayer.jsx';
import { VignetteLayer }   from './VignetteLayer.jsx';
import { ScanlinesLayer }  from './ScanlinesLayer.jsx';
import { LogoLayer }       from './LogoLayer.jsx';
import { CountdownDisplay } from './CountdownDisplay.jsx';
import { SlideDots }       from './SlideDots.jsx';
import { ScrimLayer }      from './ScrimLayer.jsx';

function OutputCanvas() {
  useWebSocket();
  const slideshowRef = useRef(null);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        containerType: 'size',
      }}
    >
      <BgLayer />
      <VideoLayer />
      <SlideshowLayer ref={slideshowRef} />
      <ImageLayer />
      <OverlayLayer />
      <FlashLayer />
      <VignetteLayer />
      <ScanlinesLayer />
      <LogoLayer />
      <CountdownDisplay />
      <SlideDots />
      <ScrimLayer />
    </div>
  );
}

export function OutputPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('room');
    if (!code) { setReady(true); return; }
    getRoom(code)
      .then(room => {
        useRoomStore.getState().setRoom(room);
        // Apply persisted settings as a baseline (WS will override once studio connects)
        try {
          const saved = JSON.parse(room.settings_json || '{}');
          if (Object.keys(saved).length) useSettingsStore.getState().applyFromServer(saved);
        } catch {}
        // Populate media store so image/video layers can render
        useMediaStore.getState().fetchAll();
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready) return <div style={{ position: 'fixed', inset: 0, background: '#000' }} />;
  return <OutputCanvas />;
}
