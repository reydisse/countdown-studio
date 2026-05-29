import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { usePrompterStore } from './store/prompterStore.js';
import { RoomGate }         from './components/shared/RoomGate.jsx';
import { ControllerView }   from './components/controller/ControllerView.jsx';
import { ReaderView }       from './components/reader/ReaderView.jsx';

const API = import.meta.env.VITE_API_URL || '';

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ShowStack] Unhandled error in', this.props.name ?? 'component', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#000', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'sans-serif', gap: 16, padding: 32,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e8a838" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: '#737373', maxWidth: 400, textAlign: 'center' }}>
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{
            marginTop: 8, padding: '8px 24px', background: '#e8a838', color: '#000',
            border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

// ── Reader loader — joins room from URL code so direct navigation works ───────
function ReaderLoader() {
  const { code }   = useParams();
  const room       = usePrompterStore(s => s.room);
  const setRoom    = usePrompterStore(s => s.setRoom);
  const [ready,   setReady]   = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (room?.code === code) { setReady(true); return; }
    fetch(`${API}/api/rooms/${code}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(r => { setRoom(r); setReady(true); })
      .catch(() => { setMissing(true); setReady(true); });
  }, [code]);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #e8a838', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
  if (missing) return <Navigate to="/" replace />;
  return (
    <ErrorBoundary name="ReaderView">
      <ReaderView />
    </ErrorBoundary>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [ready, setReady] = useState(false);
  const room = usePrompterStore(s => s.room);

  useEffect(() => {
    usePrompterStore.getState().initialize().finally(() => setReady(true));
  }, []);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050505', gap: 32 }}>
      <style>{`
        @keyframes shimmer {
          0%   { backgroundPosition: -400px 0; }
          100% { backgroundPosition:  400px 0; }
        }
        @keyframes skimFade {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>

      <img src="/showstack-logo.svg" alt="ShowStack" style={{ height: 40, opacity: 0.6 }} />

      {/* Skeleton script lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 280 }}>
        {[90, 75, 95, 60, 82].map((w, i) => (
          <div key={i} style={{
            height: 13, borderRadius: 6,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
            backgroundSize: '400px 100%',
            animation: `shimmer 1.6s ease-in-out ${i * 0.12}s infinite`,
            width: `${w}%`,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', animation: 'skimFade 1.8s ease-in-out infinite' }}>
        <div style={{ width: 20, height: 20, border: '2px solid rgba(232,168,56,0.5)', borderTopColor: '#e8a838', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading
      </div>
    </div>
  );

  return (
    <ErrorBoundary name="App">
      <Routes>
        <Route
          path="/"
          element={room ? <Navigate to={`/room/${room.code}`} replace /> : <RoomGate />}
        />
        <Route
          path="/room/:code"
          element={room
            ? <ErrorBoundary name="ControllerView"><ControllerView /></ErrorBoundary>
            : <Navigate to="/" replace />}
        />
        <Route path="/room/:code/read" element={<ReaderLoader />} />
      </Routes>
    </ErrorBoundary>
  );
}
