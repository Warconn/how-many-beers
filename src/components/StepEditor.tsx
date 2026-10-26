"use client";

import { useEffect, useRef, useState } from 'react';
import type { PlannedTask } from '@/domain/meal';
import type { StepPlanEdit } from '@/domain/cookState';
import { estimatedFinish, formatLocalDateTime, localTimeCandidates, offsetLabel, resolvePlannedTime } from '@/domain/stepTiming';

type Props = {
  task: PlannedTask;
  onSave: (title: string, instructions: string, details: StepPlanEdit) => void;
  onCancel: () => void;
};
export default function StepEditor({ task, onSave, onCancel }: Props) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [title, setTitle] = useState(task.title);
  const [instructions, setInstructions] = useState(task.instructions);
  const [timingMode, setTimingMode] = useState<StepPlanEdit['timingMode']>(task.timingMode ?? 'plan');
  const [localTime, setLocalTime] = useState(formatLocalDateTime(task.scheduledAt, zone));
  const [duration, setDuration] = useState(task.durationMinutes == null ? '' : String(task.durationMinutes));
  const [equipment, setEquipment] = useState(task.equipment ?? '');
  const [target, setTarget] = useState(task.targetTempF == null ? '' : String(task.targetTempF));
  const [offsetChoice, setOffsetChoice] = useState(task.scheduledAt ? new Date(Math.floor(Date.parse(task.scheduledAt) / 60000) * 60000).toISOString() : '');
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.focus({ preventScroll: true }); form.current?.scrollIntoView({ block: 'nearest' }); }, []);
  let candidates: string[] = [];
  try { if (localTime) candidates = localTimeCandidates(localTime, zone); } catch { /* Report invalid drafts on Save without losing their contents. */ }
  let previewTime: string | null = null;
  try { previewTime = timingMode === 'plan' ? task.baseScheduledAt ?? null : localTime ? resolvePlannedTime(localTime, zone, offsetChoice, task.scheduledAt) : null; } catch { /* No estimate until a valid local time is chosen. */ }
  const end = estimatedFinish({ scheduledAt: previewTime, durationMinutes: duration === '' ? null : Number(duration) });
  const resetTiming = () => {
    setTimingMode('plan');setLocalTime(formatLocalDateTime(task.baseScheduledAt, zone));
    setDuration(task.baseDurationMinutes == null ? '' : String(task.baseDurationMinutes));setOffsetChoice('');setError('');
  };
  return <form ref={form} tabIndex={-1} className="task-editor step-editor" aria-label="Edit step" noValidate
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation();onCancel(); } }}
    onSubmit={e => {
      e.preventDefault();
      try {
        if (!title.trim()) throw new Error('Please enter a task title.');
        if (title.trim().length > 160) throw new Error('Keep titles under 160 characters.');
        const minutes = duration === '' ? null : Number(duration);
        if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 43200)) throw new Error('Duration must be between 0 and 43200 minutes, or blank for unknown.');
        const temp = target === '' ? null : Number(target);
        if (temp !== null && (!Number.isFinite(temp) || temp <= 0 || temp > 600)) throw new Error('Target food temperature must be between 1 and 600°F, or blank.');
        if (equipment.trim().length > 80) throw new Error('Keep equipment names under 80 characters.');
        const scheduledAt = timingMode === 'fixed' ? resolvePlannedTime(localTime, zone, offsetChoice, task.scheduledAt) : null;
        onSave(title, instructions, { timingMode, scheduledAt, durationMinutes: minutes, equipment, targetTempF: temp });
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the step.'); }
    }}>
    <label>Task name<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)}/></label>
    <label>Instructions<textarea aria-label="Instructions" value={instructions} maxLength={500} rows={3} onChange={e => setInstructions(e.target.value)}/></label>
    <div className="step-field-grid">
      <label>Planned date and time<input type="datetime-local" value={localTime} onChange={e => {
        setLocalTime(e.target.value);setTimingMode(e.target.value ? 'fixed' : 'unscheduled');setOffsetChoice('');setError('');
      }}/></label>
      <label>Estimated duration (minutes)<input type="number" min="0" max="43200" step="any" value={duration} placeholder="Unknown" onChange={e => setDuration(e.target.value)}/></label>
    </div>
    <div className="step-time-source"><span>{timingMode === 'plan' ? 'Follows dish / original plan' : timingMode === 'fixed' ? 'Fixed time; stays put when serving time changes' : 'Unscheduled'}</span>
      <button type="button" className="link" onClick={resetTiming}>Use plan timing</button></div>
    <p className="muted small">Local time: {zone}. Clear the date for an unscheduled step. Leave duration blank if unknown; 0 means a milestone.</p>
    {timingMode === 'fixed' && candidates.length > 1 && <label>UTC offset for this time<select aria-label="UTC offset for this time" value={candidates.includes(offsetChoice) ? offsetChoice : ''} onChange={e => setOffsetChoice(e.target.value)}>
      <option value="">Choose which occurrence</option>{candidates.map((iso, i) => <option value={iso} key={iso}>{offsetLabel(iso, zone)} ({i === 0 ? 'first' : 'second'} occurrence)</option>)}
    </select></label>}
    {end && <p className="step-finish">Estimated finish: {new Date(end).toLocaleString()} ({duration} min)</p>}
    <p className="muted small">Duration changes this step's estimated finish, not other steps' start times. Condition checks still require actual verification.</p>
    <div className="step-field-grid">
      <label>Equipment for this step<input value={equipment} maxLength={80} placeholder={task.baseEquipment || 'Optional'} onChange={e => setEquipment(e.target.value)}/></label>
      <label>Target food temperature (°F)<input type="number" min="1" max="600" step="any" placeholder="Optional" value={target} onChange={e => setTarget(e.target.value)}/></label>
    </div>
    <p className="muted small">Equipment starts from the dish default. Targets are planning notes, separate from actual readings and food-safety verification.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="step-editor-actions"><button type="submit" className="button primary">Save &amp; Close</button><button type="button" className="button secondary" onClick={onCancel}>Cancel</button></div>
  </form>;
}
