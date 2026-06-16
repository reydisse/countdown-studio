import { usePrompterStore } from '../../store/prompterStore.js';

export function CueList() {
  const cues = usePrompterStore(s => s.cues);
  const jumpToCue = usePrompterStore(s => s.jumpToCue);
  const removeCue = usePrompterStore(s => s.removeCue);

  if (!cues.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted px-1">Cues</span>
      {cues.map(cue => (
        <div key={cue.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-elevated border border-border-subtle group">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cue.color }} />
          <button onClick={() => jumpToCue(cue.id)}
            className="flex-1 text-left text-xs text-text-secondary hover:text-text-primary transition-colors truncate">
            {cue.label}
          </button>
          <button onClick={() => removeCue(cue.id)}
            className="text-text-disabled hover:text-status-danger transition-colors opacity-0 group-hover:opacity-100 text-base leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
