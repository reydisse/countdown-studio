import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { ScriptImporter }   from './ScriptImporter.jsx';
import { exportScript }     from '../../utils/exportScript.js';
import { Toast }            from '../shared/Toast.jsx';

const AUTOSAVE_DELAY_MS = 1000;

export function ScriptEditor() {
  const content = usePrompterStore(s => s.content);
  const updateContent = usePrompterStore(s => s.updateContent);
  const saveScript = usePrompterStore(s => s.saveScript);
  const renameScript = usePrompterStore(s => s.renameScript);
  const activeScriptId = usePrompterStore(s => s.activeScriptId);
  const scripts = usePrompterStore(s => s.scripts);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);
  const restoreRef = useRef(null);
  const [toast, setToast] = useState(null);
  const activeScript = scripts.find(s => s.id === activeScriptId);
  const [titleDraft, setTitleDraft] = useState('');

  useEffect(() => {
    if (!activeScriptId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveScript(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [content, activeScriptId]);

  useEffect(() => {
    setTitleDraft(activeScript?.name ?? '');
  }, [activeScript?.id, activeScript?.name]);

  useLayoutEffect(() => {
    const restore = restoreRef.current;
    const textarea = textareaRef.current;
    if (!restore || !textarea) return;
    textarea.scrollTop = restore.scrollTop;
    textarea.setSelectionRange(restore.selectionStart, restore.selectionEnd);
    restoreRef.current = null;
  }, [content]);

  function updateContentPreservingViewport(nextContent, selectionStart, selectionEnd) {
    const textarea = textareaRef.current;
    restoreRef.current = {
      scrollTop: textarea?.scrollTop ?? 0,
      selectionStart: selectionStart ?? textarea?.selectionStart ?? nextContent.length,
      selectionEnd: selectionEnd ?? textarea?.selectionEnd ?? nextContent.length,
    };
    updateContent(nextContent);
  }

  function handleImport(text, words) {
    updateContentPreservingViewport(text, 0, 0);
    setToast(`Imported — ${words} words`);
  }

  function handleExport() {
    if (!activeScript) return;
    exportScript(activeScript.name, content);
  }

  function handleAddCue() {
    const label = prompt('Cue label:');
    if (!label) return;
    const textarea  = textareaRef.current;
    const pos       = textarea?.selectionStart ?? content.length;
    const insertion = `\n[CUE: ${label}]\n`;
    updateContentPreservingViewport(
      content.slice(0, pos) + insertion + content.slice(pos),
      pos + insertion.length,
      pos + insertion.length
    );
  }

  function handleTitleBlur() {
    if (!activeScript) return;
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(activeScript.name);
      return;
    }
    if (next !== activeScript.name) renameScript(activeScript.id, next);
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readMins  = wordCount > 0 ? Math.ceil(wordCount / 130) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle bg-surface-base shrink-0">
        <input
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setTitleDraft(activeScript?.name ?? '');
              e.currentTarget.blur();
            }
          }}
          disabled={!activeScript}
          aria-label="Script title"
          className="w-40 min-w-0 rounded border border-border-default bg-surface-elevated px-2 py-1 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
        />
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
        ref={textareaRef}
        data-script-editor
        value={content}
        onChange={e => {
          updateContentPreservingViewport(
            e.target.value,
            e.target.selectionStart,
            e.target.selectionEnd
          );
        }}
        placeholder={"Paste or type your script here…\n\nUse **bold** for emphasis, [CUE: Label] for cue markers, --- for section breaks."}
        spellCheck
        className="flex-1 min-h-0 resize-none overflow-y-auto bg-surface-base text-text-primary text-sm leading-relaxed px-5 py-4 focus:outline-none font-reader placeholder-text-disabled"
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
