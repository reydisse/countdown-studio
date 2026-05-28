import { useEffect, useState } from 'react';

export function UpdateBanner() {
  const [state, setState] = useState(null); // null | 'available' | 'ready'

  useEffect(() => {
    if (!window.__ELECTRON_API__) return;
    window.__ELECTRON_API__.onUpdateAvailable(()  => setState('available'));
    window.__ELECTRON_API__.onUpdateDownloaded(() => setState('ready'));
  }, []);

  if (!state) return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-accent/10 border-b border-accent/20 text-xs text-accent">
      <span>
        {state === 'available'
          ? 'A new version of ShowStack is available. Downloading…'
          : 'Update ready. Restart to install.'}
      </span>
      {state === 'ready' && (
        <button
          onClick={() => window.__ELECTRON_API__.installUpdate()}
          className="px-3 py-0.5 rounded bg-accent text-black font-semibold hover:bg-accent-hover transition-colors"
        >
          Install Now
        </button>
      )}
    </div>
  );
}
