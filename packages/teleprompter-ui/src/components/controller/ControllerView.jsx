import { useEffect, useState } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { usePrompterWS }    from '../../hooks/usePrompterWS.js';
import { TopBar }           from '../shared/TopBar.jsx';
import { ScriptEditor }     from './ScriptEditor.jsx';
import { SpeedControl }     from './SpeedControl.jsx';
import { ProgressScrubber } from './ProgressScrubber.jsx';
import { CueList }          from './CueList.jsx';

export function ControllerView() {
  usePrompterWS();

  const {
    room, isPlaying, play, pause, stop,
    scripts, activeScriptId, selectScript, createScript,
    updateDisplay, wsConnected,
    fontSize, lineWidth, fontFamily, textColor, bgColor,
    isMirrored, isFlippedVertical, showFocusLine, focusLinePosition,
  } = usePrompterStore();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { usePrompterStore.getState().loadScripts(); }, []);

  function openReader() {
    const url = `${location.origin}/room/${room?.code}/read`;
    window.open(url, '_blank', 'width=1920,height=1080');
  }

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary overflow-hidden">
      {!wsConnected && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-yellow-950/60 border-b border-yellow-700/40 text-yellow-400 text-xs font-medium">
          <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin shrink-0" />
          Reconnecting to server…
        </div>
      )}
      <TopBar />

      <div className="flex flex-1 overflow-hidden">

        {/* Script area */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-border-subtle">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle bg-surface-raised overflow-x-auto shrink-0">
            {scripts.map(s => (
              <button key={s.id} onClick={() => selectScript(s.id, s.content)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap
                  ${s.id === activeScriptId
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'}`}>
                {s.name}
              </button>
            ))}
            <button
              onClick={() => { const name = prompt('Script name:'); if (name) createScript(name); }}
              className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
              + New
            </button>
          </div>

          <ScriptEditor />
        </div>

        {/* Controls panel */}
        <div className="w-72 flex flex-col gap-4 p-4 overflow-y-auto shrink-0 bg-surface-raised">

          <div className="flex flex-col gap-2">
            <button onClick={stop}
              className="w-full py-2 rounded-md bg-surface-elevated border border-border-default text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
              RESET
            </button>
            <button onClick={isPlaying ? pause : play}
              className={`w-full py-4 rounded-lg text-lg font-bold tracking-widest transition-colors
                ${isPlaying
                  ? 'bg-status-live/20 text-status-live border border-status-live/40 hover:bg-status-live/30'
                  : 'bg-accent text-black hover:bg-accent-hover'}`}>
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
          </div>

          <SpeedControl />

          <ProgressScrubber />

          {/* Display settings */}
          <div className="border border-border-subtle rounded-lg overflow-hidden">
            <button onClick={() => setShowSettings(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors">
              Display Settings
              <span className="text-base leading-none">{showSettings ? '−' : '+'}</span>
            </button>

            {showSettings && (
              <div className="flex flex-col gap-3 p-3 border-t border-border-subtle text-xs">
                <label className="flex flex-col gap-1 text-text-muted">
                  Font Size — {fontSize}px
                  <input type="range" min={24} max={120} value={fontSize}
                    onChange={e => updateDisplay({ fontSize: Number(e.target.value) })}
                    className="w-full accent-accent" />
                </label>

                <label className="flex flex-col gap-1 text-text-muted">
                  Line Width — {lineWidth}%
                  <input type="range" min={40} max={90} value={lineWidth}
                    onChange={e => updateDisplay({ lineWidth: Number(e.target.value) })}
                    className="w-full accent-accent" />
                </label>

                <label className="flex flex-col gap-1 text-text-muted">
                  Font
                  <select value={fontFamily} onChange={e => updateDisplay({ fontFamily: e.target.value })}
                    className="bg-surface-elevated border border-border-default rounded px-2 py-1 text-text-primary">
                    <option value="dm-sans">DM Sans</option>
                    <option value="dm-mono">DM Mono</option>
                  </select>
                </label>

                <div className="flex gap-2">
                  <label className="flex flex-col gap-1 text-text-muted flex-1">
                    Text
                    <input type="color" value={textColor}
                      onChange={e => updateDisplay({ textColor: e.target.value })}
                      className="h-8 w-full rounded cursor-pointer bg-transparent border-0" />
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted flex-1">
                    Background
                    <input type="color" value={bgColor}
                      onChange={e => updateDisplay({ bgColor: e.target.value })}
                      className="h-8 w-full rounded cursor-pointer bg-transparent border-0" />
                  </label>
                </div>

                <div className="flex gap-2">
                  {['#000000', '#ffffff', '#00b140'].map(c => (
                    <button key={c} onClick={() => updateDisplay({ bgColor: c })} title={c}
                      className="w-7 h-7 rounded border-2 transition-all"
                      style={{ background: c, borderColor: bgColor === c ? '#e8a838' : 'transparent' }} />
                  ))}
                </div>

                <label className="flex flex-col gap-1 text-text-muted">
                  Focus Line Position — {focusLinePosition}%
                  <input type="range" min={20} max={80} value={focusLinePosition}
                    onChange={e => updateDisplay({ focusLinePosition: Number(e.target.value) })}
                    className="w-full accent-accent" />
                </label>

                {[
                  ['showFocusLine',     showFocusLine,     'Focus Line'],
                  ['isMirrored',        isMirrored,        'Mirror (horizontal)'],
                  ['isFlippedVertical', isFlippedVertical, 'Flip Vertical'],
                ].map(([key, val, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input type="checkbox" checked={val}
                      onChange={e => updateDisplay({ [key]: e.target.checked })}
                      className="accent-accent" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <CueList />

          <button onClick={openReader}
            className="w-full py-2 rounded-md bg-surface-elevated border border-border-default text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            Open Reader Window ↗
          </button>
        </div>
      </div>
    </div>
  );
}
