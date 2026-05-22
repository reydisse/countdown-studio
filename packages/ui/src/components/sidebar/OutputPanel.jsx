import { useState } from 'react';
import { SidebarSection } from './SidebarSection.jsx';
import { TabGroup }       from '../shared/TabGroup.jsx';
import { Button }         from '../shared/Button.jsx';
import { getServerUrl }   from '../../adapter/index.js';
import { exportHtml }     from '../../utils/exportHtml.js';

const OUTPUT_URL  = `${getServerUrl()}/output`;
const TABS = [
  { value: 'browser', label: 'Browser' },
  { value: 'vmix',    label: 'vMix'    },
  { value: 'export',  label: 'Export'  },
];

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex gap-1.5">
      <code className="flex-1 px-2 py-1.5 rounded bg-surface-base border border-border-default text-xs text-text-secondary font-mono truncate select-all">
        {value}
      </code>
      <Button size="sm" onClick={copy} variant={copied ? 'primary' : 'secondary'}>
        {copied ? '✓' : 'Copy'}
      </Button>
    </div>
  );
}

export function OutputPanel() {
  const [tab, setTab] = useState('browser');

  return (
    <SidebarSection title="Output" defaultOpen={false}>
      <TabGroup tabs={TABS} value={tab} onChange={setTab} size="sm" />

      {/* ── Browser Source ─────────────────────────────────────────── */}
      {tab === 'browser' && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Add as a Browser Source in OBS, Resolume, or any HDMI capture tool.
          </p>
          <div className="space-y-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Output URL</p>
            <CopyField value={OUTPUT_URL} />
          </div>
          <div className="rounded-md bg-surface-elevated border border-border-default p-3 space-y-1.5 text-xs text-text-secondary">
            <p><span className="text-text-muted">Width:</span> 1920</p>
            <p><span className="text-text-muted">Height:</span> 1080</p>
            <p><span className="text-text-muted">FPS:</span> 30</p>
            <p><span className="text-text-muted">CSS:</span> body &#123; background: transparent &#125;</p>
          </div>
        </div>
      )}

      {/* ── vMix ──────────────────────────────────────────────────── */}
      {tab === 'vmix' && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Add as a <strong className="text-text-secondary">Web Browser</strong> input in vMix.
          </p>
          <div className="space-y-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">URL</p>
            <CopyField value={OUTPUT_URL} />
          </div>
          <div className="rounded-md bg-surface-elevated border border-border-default p-3 space-y-1.5 text-xs text-text-secondary">
            <p>1. Add Input → Web Browser</p>
            <p>2. Paste the URL above</p>
            <p>3. Set resolution to 1920 × 1080</p>
            <p>4. Enable <em>Transparent Background</em></p>
          </div>
        </div>
      )}

      {/* ── Export ─────────────────────────────────────────────────── */}
      {tab === 'export' && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Generate a self-contained HTML file with all settings, media, and cues
            baked in. Works in OBS, vMix, Resolume, or any browser — no server needed.
          </p>
          <p className="text-[11px] text-text-muted">
            Tip: append <code className="font-mono bg-surface-elevated px-1 rounded">?autoplay=1</code> to
            the URL for browser sources that auto-start.
          </p>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={async () => {
              try { await exportHtml(); }
              catch (err) { console.error('Export failed:', err); }
            }}
          >
            Export Standalone HTML
          </Button>
        </div>
      )}
    </SidebarSection>
  );
}
