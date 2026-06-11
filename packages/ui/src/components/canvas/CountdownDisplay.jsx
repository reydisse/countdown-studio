import { useTimerStore }    from '../../stores/timerStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

const FONT_FAMILY = {
  display: '"Bebas Neue", sans-serif',
  sans:    '"DM Sans", sans-serif',
  mono:    '"JetBrains Mono", monospace',
};

function fmt(secs) {
  if (secs < 0) secs = 0;
  const h  = Math.floor(secs / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? [String(h), mm, ss] : [mm, ss];
}

export function CountdownDisplay() {
  const liveRemaining = useTimerStore(s => s.remaining);
  const liveStatus    = useTimerStore(s => s.status);

  // Plan-mode scrub preview: render the scrubbed time as if running so the
  // warn/danger colours show exactly what the output will look like then.
  const previewRemaining = useSettingsStore(s => s._previewRemaining);
  const remaining = previewRemaining ?? liveRemaining;
  const status    = previewRemaining != null ? 'running' : liveStatus;

  const font             = useSettingsStore(s => s.font);
  const textColor        = useSettingsStore(s => s.textColor);
  const textSize         = useSettingsStore(s => s.textSize);
  const blinkSeparator   = useSettingsStore(s => s.blinkSeparator);
  const warnFlashEnabled = useSettingsStore(s => s.warnFlashEnabled);
  const warnThreshold    = useSettingsStore(s => s.warnThreshold);
  const dangerThreshold  = useSettingsStore(s => s.dangerThreshold);
  const labelMain        = useSettingsStore(s => s.labelMain);
  const labelSub         = useSettingsStore(s => s.labelSub);
  const labelEnabled     = useSettingsStore(s => s.labelEnabled);

  let color = textColor;
  if (status === 'running') {
    if      (remaining <= dangerThreshold)                        color = '#f5464a';
    else if (warnFlashEnabled && remaining <= warnThreshold) color = '#f5a623';
  }
  if (status === 'stopped') color = '#8a8278';

  const fontFamily = FONT_FAMILY[font] ?? FONT_FAMILY.display;
  // cqw = container-query width — scales to the PreviewCanvas container,
  // not the viewport, so the timer is correctly sized at any canvas dimension.
  const fontSize   = `${(textSize / 100) * 20}cqw`;
  const parts      = (status === 'stopped' && remaining === 0) ? ['--', '--'] : fmt(remaining);

  const sepStyle = blinkSeparator && status === 'running'
    ? { animation: 'blink-sep 1s step-end infinite' }
    : {};

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 9 }}>
      {/* Main timer */}
      <div
        style={{
          fontFamily,
          fontSize,
          lineHeight: 0.88,
          letterSpacing: '0.04em',
          color,
          transition: 'color 0.2s ease',
          WebkitFontSmoothing: 'antialiased',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {parts.map((part, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span style={sepStyle}>:</span>}
            <span>{part}</span>
          </span>
        ))}
      </div>

      {/* Labels */}
      {labelEnabled && (labelMain || labelSub) && (
        <div
          className="flex flex-col items-center mt-[2%] gap-[0.5%]"
          style={{ fontFamily: FONT_FAMILY.sans }}
        >
          {labelMain && (
            <span style={{
              fontSize: `${(textSize / 100) * 2.2}cqw`,
              color: textColor,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}>
              {labelMain}
            </span>
          )}
          {labelSub && (
            <span style={{
              fontSize: `${(textSize / 100) * 1.5}cqw`,
              color: '#8a8278',
              letterSpacing: '0.08em',
            }}>
              {labelSub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
