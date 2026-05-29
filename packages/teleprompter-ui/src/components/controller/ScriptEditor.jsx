import { useEffect, useRef, useState } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { ScriptImporter }   from './ScriptImporter.jsx';
import { exportScript }     from '../../utils/exportScript.js';
import { Toast }            from '../shared/Toast.jsx';

const AUTOSAVE_DELAY_MS = 1000;

export function ScriptEditor() {
  const { content, updateContent, saveScript, activeScriptId, scripts } = usePrompterStore();
  const timerRef = useRef(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!activeScriptId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveScript(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [content, activeScriptId]);

  function handleImport(text, words) {
    updateContent(text);
    setToast(`Imported — ${words} words`);
  }

  function handleExport() {
    const script = scripts.find(s => s.id === activeScriptId);
    if (!script) return;
    exportScript(script.name, content);
  }

  function handleAddCue() {
    const label = prompt('Cue label:');
    if (!label) return;
    const textarea  = document.querySelector('textarea[data-script-editor]');
    const pos       = textarea?.selectionStart ?? content.length;
    const insertion = `\n[CUE: ${label}]\n`;
    updateContent(content.slice(0, pos) + insertion + content.slice(pos));
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readMins  = wordCount > 0 ? Math.ceil(wordCount / 130) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle bg-surface-base shrink-0">
        <ScriptImporter onImport={handleImport} />
        <button onClick={handleExport}
          className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          Export .txt
        </button>
        <button onClick={handleAddCue}
          className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          + Cue
        </button>
        <span className="ml-auto text-xs text-text-disabled">
          {wordCount} words{readMins > 0 && <span className="text-text-muted"> · ~{readMins} min</span>}
        </span>
      </div>

      <textarea
        data-script-editor
        value={content}
        onChange={e => updateContent(e.target.value)}
        placeholder={"Paste or type your script here…\n\nUse **bold** for emphasis, [CUE: Label] for cue markers, --- for section breaks."}
        spellCheck
        className="flex-1 resize-none bg-surface-base text-text-primary text-sm leading-relaxed px-5 py-4 focus:outline-none font-reader placeholder-text-disabled"
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
