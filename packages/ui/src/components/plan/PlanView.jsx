import { useCallback, useEffect, useState } from 'react';
import { useCueStore }   from '../../stores/cueStore.js';
import { useRoomStore }  from '../../stores/roomStore.js';
import {
  getRoomCues, createRoomCue, updateRoomCue, deleteRoomCue,
} from '../../adapter/index.js';
import { PreviewCanvas } from '../canvas/PreviewCanvas.jsx';
import { Timeline }      from './Timeline.jsx';
import { CueList }       from './CueList.jsx';
import { CueEditor }     from './CueEditor.jsx';

export function PlanView({ slideshowRef }) {
  // Cues are scoped to the active room — never another project/room.
  const roomCode     = useRoomStore(s => s.room?.code ?? null);
  const storeSetCues = useCueStore(s => s.setCues);
  const cues = useCueStore(s => s.cues);

  const [selectedCue, setSelectedCue] = useState(null);
  const [saving,      setSaving]      = useState(false);

  // ── Bootstrap: load the active room's cues ───────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    (async () => {
      try {
        useCueStore.setState({ activeProjectId: roomCode });
        const list = await getRoomCues(roomCode);
        if (cancelled) return;
        // Parse actions_json → actions (DB field vs client field)
        storeSetCues(list.map(c => ({
          ...c,
          actions: (() => { try { return JSON.parse(c.actions_json ?? '[]') } catch { return [] } })(),
        })));
      } catch (err) {
        console.error('PlanView init:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [roomCode]);

  // ── Cue CRUD helpers ─────────────────────────────────────────────────────
  const handleCreate = useCallback(async (triggerAt, label = 'New Cue') => {
    if (!roomCode) return;
    const cue = await createRoomCue(roomCode, {
      trigger_at: triggerAt,
      label,
      actions:    [],
    });
    // Parse actions_json → actions from the API response
    const parsed = { ...cue, actions: (() => { try { return JSON.parse(cue.actions_json ?? '[]') } catch { return [] } })() };
    useCueStore.getState().add(parsed);
    setSelectedCue(parsed);
  }, [roomCode]);

  const handleSave = useCallback(async (cueId, data) => {
    if (!roomCode) return;
    setSaving(true);
    try {
      const updated = await updateRoomCue(roomCode, cueId, data);
      // Use the server response if it's a full cue object, otherwise merge sent data
      const merged = (updated && updated.id) ? updated : data;
      useCueStore.getState().update(cueId, merged);
      setSelectedCue(null);
    } finally {
      setSaving(false);
    }
  }, [roomCode]);

  const handleDelete = useCallback(async (cueId) => {
    if (!roomCode) return;
    // Optimistic removal
    useCueStore.getState().remove(cueId);
    setSelectedCue(null);
    try {
      await deleteRoomCue(roomCode, cueId);
    } catch (err) {
      console.error('Delete cue failed:', err);
      // Reload to restore correct state on failure
      try {
        const list = await getRoomCues(roomCode);
        useCueStore.getState().setCues(list.map(c => ({
          ...c,
          actions: (() => { try { return JSON.parse(c.actions_json ?? '[]') } catch { return [] } })(),
        })));
      } catch { /* ignore */ }
    }
  }, [roomCode]);

  // Drag-and-drop move on the timeline
  const handleCommitMove = useCallback(async (cueId, newTriggerAt) => {
    if (!roomCode) return;
    const cue = useCueStore.getState().cues.find(c => c.id === cueId);
    if (!cue) return;
    // Optimistically update position so it doesn't snap back
    useCueStore.getState().update(cueId, { trigger_at: newTriggerAt });
    try {
      await updateRoomCue(roomCode, cueId, {
        trigger_at: newTriggerAt,
        label:      cue.label,
        // Don't send actions on a position-only move — avoids accidentally overwriting
      });
    } catch (err) {
      console.error('Move cue failed:', err);
      useCueStore.getState().update(cueId, { trigger_at: cue.trigger_at });
    }
  }, [roomCode]);

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
