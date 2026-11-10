"use client";

import { useEffect, useRef, useState } from 'react';
import type { PlannedTask } from '@/domain/meal';
import type { StepPlanEdit } from '@/domain/cookState';
import { formatLocalDateTime, localTimeCandidates, offsetLabel, resolvePlannedTime } from '@/domain/stepTiming';

type Props = {
  task: PlannedTask;
  timeOnly?: boolean;
  actualRecorded?:boolean;
  onSave: (title: string, instructions: string, details: StepPlanEdit) => void;
  onCancel: () => void;
  onRemove?: () => void;
};
export default function StepEditor({ task, onSave, onCancel,onRemove,timeOnly=false,actualRecorded=false }: Props) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [title, setTitle] = useState(task.title);
  const [instructions, setInstructions] = useState(task.instructions);
  const [timingMode, setTimingMode] = useState<StepPlanEdit['timingMode']>(task.timingMode ?? 'plan');
  const [localTime, setLocalTime] = useState(formatLocalDateTime(task.scheduledAt, zone));
  const initialUnit=task.durationMinutes!=null && task.durationMinutes>=120 && task.durationMinutes%60===0?'hours':'minutes';
  const [durationUnit,setDurationUnit]=useState<'minutes'|'hours'>(initialUnit);
  const [duration, setDuration] = useState(task.durationMinutes == null ? '' : String(task.durationMinutes/(initialUnit==='hours'?60:1)));
  const [durationEdited,setDurationEdited] = useState(false);
  const durationMinutes=duration===''?null:Math.round(Number(duration)*(durationUnit==='hours'?60:1)*1000000)/1000000;
  const [equipment, setEquipment] = useState(task.equipment ?? '');
  const [target, setTarget] = useState(task.targetTempF == null ? '' : String(task.targetTempF));
  const [offsetChoice, setOffsetChoice] = useState(task.scheduledAt ? new Date(Math.floor(Date.parse(task.scheduledAt) / 60000) * 60000).toISOString() : '');
  const [timingEdited,setTimingEdited]=useState(false);
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if(timeOnly)form.current?.querySelector<HTMLInputElement>('input[type="datetime-local"]')?.focus({preventScroll:true});else form.current?.focus({ preventScroll: true }); form.current?.scrollIntoView({ block: 'nearest' }); }, []);
  let candidates: string[] = [];
  try { if (localTime) candidates = localTimeCandidates(localTime, zone); } catch { /* Report invalid drafts on Save without losing their contents. */ }
  const advancedSet = timingMode !== 'plan' || equipment !== (task.baseEquipment ?? '') || target !== '';
  const resetTiming = () => {
    setTimingEdited(true);setTimingMode('plan');setLocalTime(formatLocalDateTime(task.baseScheduledAt, zone));
    setOffsetChoice('');setError('');
  };
  return <form ref={form} tabIndex={-1} className="task-editor step-editor" aria-label={timeOnly?"Edit planned time":"Edit step"} noValidate
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation();onCancel(); } }}
    onSubmit={e => {
      e.preventDefault();
      try {
        if (!timeOnly && !title.trim()) throw new Error('Please enter a task title.');
        if (!timeOnly && title.trim().length > 160) throw new Error('Keep titles under 160 characters.');
        const minutes = durationMinutes;
        if (!timeOnly && minutes !== null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 43200)) throw new Error('Duration must be between 0 and 720 hours (43200 minutes), or blank for unknown.');
        const temp = target === '' ? null : Number(target);
        if (!timeOnly && temp !== null && (!Number.isFinite(temp) || temp <= 0 || temp > 600)) throw new Error('Target food temperature must be between 1 and 600°F, or blank.');
        if (!timeOnly && equipment.trim().length > 80) throw new Error('Keep equipment names under 80 characters.');
        const scheduledAt = timingMode === 'fixed' ? !timingEdited ? task.scheduledAt : resolvePlannedTime(localTime, zone, offsetChoice, task.scheduledAt) : null;
        onSave(title, instructions, { ...(timeOnly?{plannedTimeOnly:true}:{}), timingMode, scheduledAt, ...(durationEdited?{durationMinutes:minutes}:{}), equipment, targetTempF: temp });
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the step.'); }
    }}>
    {!timeOnly&&<>
    <label>Step name<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)}/></label>
    <label>Instructions<textarea aria-label="Instructions" value={instructions} maxLength={500} rows={2} onChange={e => setInstructions(e.target.value)}/></label>
    </>}
      <label>Planned date and time<input type="datetime-local" value={localTime} onChange={e => {
        setTimingEdited(true);setLocalTime(e.target.value);setTimingMode(e.target.value ? 'fixed' : 'unscheduled');setOffsetChoice('');setError('');
      }}/></label>
      <div className="step-time-source"><span>{timingMode === 'fixed' ? 'Fixed start' : timingMode === 'unscheduled' ? 'Unscheduled' : 'Plan timing'}</span><button type="button" className="link" onClick={resetTiming}>Use plan timing</button></div>
    {timingMode === 'fixed' && candidates.length > 1 && <label>UTC offset for this time<select aria-label="UTC offset for this time" value={candidates.includes(offsetChoice) ? offsetChoice : ''} onChange={e => {setTimingEdited(true);setOffsetChoice(e.target.value);}}>
      <option value="">Choose which occurrence</option>{candidates.map((iso, i) => <option value={iso} key={iso}>{offsetLabel(iso, zone)} ({i === 0 ? 'first' : 'second'} occurrence)</option>)}
    </select></label>}
    {!timeOnly&&<details className="step-more-options"><summary>More options{advancedSet && <span className="step-options-set" aria-label="Custom options set"> •</span>}</summary>
    <div className="duration-controls">
        <label>Estimated duration ({durationUnit})<input type="number" min="0" max={durationUnit==='hours'?720:43200} step="any" value={duration} placeholder={task.templateStage ? String(task.templateStage.minutes/(durationUnit==='hours'?60:1)) : "Unknown"} onChange={e => {setDurationEdited(true);setDuration(e.target.value);}}/></label>
        <label>Duration unit<select aria-label="Duration unit" value={durationUnit} onChange={e=>{
          const next=e.target.value as 'minutes'|'hours';
          if(duration!=='' && Number.isFinite(Number(duration)))setDuration(String(Number(duration)*(durationUnit==='hours'?60:1)/(next==='hours'?60:1)));
          setDurationUnit(next);setError('');
        }}><option value="minutes">Minutes</option><option value="hours">Hours</option></select></label>
    </div>
    <div className="step-field-grid">
      <label>Equipment for this step<input value={equipment} maxLength={80} placeholder={task.baseEquipment || 'Optional'} onChange={e => setEquipment(e.target.value)}/></label>
      <label>Target food temperature (°F)<input type="number" min="1" max="600" step="any" placeholder="Optional" value={target} onChange={e => setTarget(e.target.value)}/></label>
    </div>
    </details>}
    {timeOnly&&actualRecorded&&<p className="muted small">Changing the plan keeps recorded actual starts unchanged.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="step-editor-actions"><button type="submit" className="button primary">Save</button><button type="button" className="button secondary" onClick={onCancel}>Cancel</button>{!timeOnly&&onRemove&&<button type="button" className="link danger step-editor-remove" aria-label={'Remove step: '+task.title} onClick={onRemove}>Remove step</button>}</div>
  </form>;
}
