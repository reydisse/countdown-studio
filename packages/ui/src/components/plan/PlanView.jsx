import { useCallback, useEffect, useState } from 'react';
import { useCueStore }   from '../../stores/cueStore.js';
import { send }          from '../../wsClient.js';
import {
  getProjects, saveProject,
  getCues, createCue, updateCue, deleteCue,
} from '../../adapter/index.js';
import { PreviewCanvas } from '../canvas/PreviewCanvas.jsx';
import { Timeline }      from './Timeline.jsx';
import { CueList }       from './CueList.jsx';
import { CueEditor }     from './CueEditor.jsx';

const LOAD_PROJECT = 'project:load';

async function ensureProject() {
  const projects = await getProjects();
  if (projects.length > 0) return projects[0].id;
  const p = await saveProject({ name: 'Default Project', settings: {} });
  return p.id;
}

export function PlanView({ slideshowRef }) {
  const activeProjectId = useCueStore(s => s.activeProjectId);
  const storeLload      = useCueStore(s => s.load);
  const storeSetCues    = useCueStore(s => s.setCues);
  const cues = useCueStore(s => s.cues);

  const [selectedCue, setSelectedCue] = useState(null);
  const [saving,      setSaving]      = useState(false);

  // ── Bootstrap: ensure there is an active project ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pid  = await ensureProject();
        if (cancelled) return;
        storeLload(pid);                                  // sets activeProjectId + sends WS LOAD_PROJECT
        const list = await getCues(pid);
        if (cancelled) return;
        storeSetCues(list);
      } catch (err) {
        console.error('PlanView init:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Cue CRUD helpers ─────────────────────────────────────────────────────
  const handleCreate = useCallback(async (triggerAt, label = 'New Cue') => {
    if (!activeProjectId) return;
    const cue = await createCue(activeProjectId, {
      trigger_at: triggerAt,
      label,
      actions:    [],
    });
    useCueStore.getState().add(cue);
    setSelectedCue(cue);
  }, [activeProjectId]);

  const handleSave = useCallback(async (cueId, data) => {
    if (!activeProjectId) return;
    setSaving(true);
    try {
      const updated = await updateCue(activeProjectId, cueId, data);
      useCueStore.getState().update(cueId, updated);
      setSelectedCue(null);
      send(LOAD_PROJECT, { projectId: activeProjectId });
    } finally {
      setSaving(false);
    }
  }, [activeProjectId]);

  const handleDelete = useCallback(async (cueId) => {
    if (!activeProjectId) return;
    await deleteCue(activeProjectId, cueId);
    useCueStore.getState().remove(cueId);
    setSelectedCue(null);
    send(LOAD_PROJECT, { projectId: activeProjectId });
  }, [activeProjectId]);

  // Drag-and-drop move on the timeline
  const handleCommitMove = useCallback(async (cueId, newTriggerAt) => {
    if (!activeProjectId) return;
    const cue = useCueStore.getState().cues.find(c => c.id === cueId);
    if (!cue) return;
    const updated = await updateCue(activeProjectId, cueId, {
      trigger_at: newTriggerAt,
      label:      cue.label,
      actions:    cue.actions,
    });
    useCueStore.getState().update(cueId, updated);
    send(LOAD_PROJECT, { projectId: activeProjectId });
  }, [activeProjectId]);

  return (
    // relative so CueEditor can be absolutely positioned within
    <div className="flex-1 flex overflow-hidden relative">

      <div className="flex flex-col min-h-0" style={{ flex: '1 1 0' }}>

        {/* ── Top row: small preview LEFT + timeline RIGHT (side by side) ── */}
        {/* Fixed 152px height — preview never dominates the workspace       */}
        <div className="shrink-0 flex border-b border-border-subtle" style={{ height: '152px' }}>

          {/* Preview: fixed 240×135 (16:9) — w-full inside PreviewCanvas    */}
          {/* stays 240px so the canvas doesn't balloon to viewport width    */}
          <div className="shrink-0 flex items-center justify-center p-2 bg-surface-base border-r border-border-subtle">
            <div style={{ width: '240px', height: '135px' }}>
              <PreviewCanvas slideshowRef={slideshowRef} className="rounded-md shadow-lg" />
            </div>
          </div>

          {/* Timeline fills the rest of the row width */}
          <Timeline
            cues={cues}
            onCueEdit={setSelectedCue}
            onCueDelete={handleDelete}
            onCueCreate={handleCreate}
            onCommitMove={handleCommitMove}
          />
        </div>

        {/* ── CueList fills all remaining vertical space ─────────────────── */}
        <CueList
          cues={cues}
          onEdit={setSelectedCue}
          onDelete={handleDelete}
          onUpdateTime={handleCommitMove}
          onCreate={handleCreate}
        />
      </div>

      {/* ── CueEditor slide-in ──────────────────────────────────────── */}
      {selectedCue && (
        <CueEditor
          key={selectedCue.id}
          cue={selectedCue}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelectedCue(null)}
        />
      )}
    </div>
  );
}
