/** Calendar inputs use the viewer's timezone; saved planned times are UTC instants. */
function parts(iso: string, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  return Object.fromEntries(values.map(p => [p.type, p.value]));
}
export function formatLocalDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const p = parts(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localTimeCandidates(value: string, timeZone: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Enter a valid date and time.');
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  if (year < 1000 || new Date(naive).toISOString().slice(0, 16) !== value) throw new Error('Enter a valid date and time.');
  // Sampling both sides of a transition discovers fractional-hour offsets as well.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = naive + hours * 3_600_000;
    const p = parts(new Date(sample).toISOString(), timeZone);
    offsets.add(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - sample);
  }
  return [...offsets].map(offset => new Date(naive - offset).toISOString())
    .filter(iso => formatLocalDateTime(iso, timeZone) === value).sort();
}
export function resolvePlannedTime(value: string, timeZone: string, choice?: string, previous?: string | null): string {
  const candidates = localTimeCandidates(value, timeZone);
  if (!candidates.length) throw new Error(`This local time does not exist in ${timeZone}. Choose another time.`);
  if (previous && formatLocalDateTime(previous, timeZone) === value) {
    const minute = new Date(Math.floor(Date.parse(previous) / 60_000) * 60_000).toISOString();
    if (!choice || choice === minute) return previous;
  }
  if (candidates.length === 1) return candidates[0];
  if (choice && candidates.includes(choice)) return choice;
  throw new Error('This time occurs twice. Choose its UTC offset.');
}
export function offsetLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(iso)).find(p => p.type === 'timeZoneName')?.value.replace('GMT', 'UTC') ?? 'UTC';
}
export function estimatedFinish(task: { scheduledAt: string | null; durationMinutes?: number | null }): string | null {
  if (!task.scheduledAt || task.durationMinutes == null || !Number.isFinite(task.durationMinutes) || task.durationMinutes < 0) return null;
  const end = Date.parse(task.scheduledAt) + task.durationMinutes * 60_000;
  return Number.isFinite(end) ? new Date(end).toISOString() : null;
}
export function chronologicalTasks<T extends { scheduledAt: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => (a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity) - (b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity));
}

/** Readable elapsed duration; saved values always remain minutes. */
export function formatDuration(minutes:number):string{
 const rounded=Math.round(minutes*1000)/1000;
 if(rounded<60)return rounded+' min';
 const hours=Math.floor(rounded/60),rest=Math.round((rounded-hours*60)*1000)/1000;
 return hours+' hr'+(rest?' '+rest+' min':'');
}
