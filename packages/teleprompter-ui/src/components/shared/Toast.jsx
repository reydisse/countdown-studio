import { useEffect, useState } from 'react';

export function Toast({ message, duration = 2500, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, duration);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-elevated border border-border-default text-text-primary text-sm px-4 py-2 rounded-lg shadow-xl z-50 pointer-events-none">
      {message}
    </div>
  );
}
