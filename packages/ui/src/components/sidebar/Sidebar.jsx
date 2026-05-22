import { TimerPanel }      from './TimerPanel.jsx';
import { BackgroundPanel } from './BackgroundPanel.jsx';
import { LogoPanel }       from './LogoPanel.jsx';
import { TypographyPanel } from './TypographyPanel.jsx';
import { EffectsPanel }    from './EffectsPanel.jsx';
import { OutputPanel }     from './OutputPanel.jsx';
import { MediaPanel }      from './MediaPanel.jsx';

export function Sidebar() {
  return (
    <aside
      className="
        w-80 shrink-0 flex flex-col
        bg-surface-raised border-l border-border-subtle
        overflow-y-auto overflow-x-hidden
      "
    >
      <div className="divide-y divide-border-subtle">
        <TimerPanel />
        <BackgroundPanel />
        <MediaPanel />
        <LogoPanel />
        <TypographyPanel />
        <EffectsPanel />
        <OutputPanel />
      </div>
    </aside>
  );
}
