import { usePrompterStore } from '../../store/prompterStore.js';

export function SpeedControl() {
  const speed = usePrompterStore(s => s.speed);
  const setSpeed = usePrompterStore(s => s.setSpeed);

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Speed</span>
        <span className="text-lg font-bold text-text-primary tabular-nums">{speed}</span>
      </div>

      <input type="range" min={1} max={10} value={speed}
        onChange={e => setSpeed(Number(e.target.value))}
        className="w-full accent-accent" />

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-disabled">Slow</span>
        <div className="flex gap-2">
          <button onClick={() => setSpeed(Math.max(1, speed - 1))}
            className="w-6 h-6 rounded bg-surface-base border border-border-default text-text-secondary hover:text-text-primary text-sm leading-none flex items-center justify-center transition-colors">
            −
          </button>
          <button onClick={() => setSpeed(Math.min(10, speed + 1))}
            className="w-6 h-6 rounded bg-surface-base border border-border-default text-text-secondary hover:text-text-primary text-sm leading-none flex items-center justify-center transition-colors">
            +
          </button>
        </div>
        <span className="text-xs text-text-disabled">Fast</span>
      </div>
    </div>
  );
}
