import { useRef } from 'react';

export function ScriptImporter({ onImport }) {
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text  = ev.target.result ?? '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      onImport(text, words);
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".txt,text/plain" onChange={handleFile} className="hidden" />
      <button onClick={() => inputRef.current?.click()}
        className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
        Import .txt
      </button>
    </>
  );
}
