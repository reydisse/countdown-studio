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
    <div className="min-h-screen flex items-center justify-center bg-surface-base">
      <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
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
