import type {StepForecast} from '@/domain/cookForecast';
const format=(iso:string)=>new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export default function StepForecastTime({forecast,part}:{forecast:StepForecast;part:'start'|'finish'}){
 const value=forecast[part];
 if(part==='start'&&forecast.start&&forecast.status==='unknown')return <span>Estimated start <time aria-label="Estimated start" dateTime={forecast.start}>{format(forecast.start)}</time> · Duration unknown</span>;
 if(part==='start'&&forecast.start&&forecast.status==='blocked')return <span>Fixed start <time aria-label="Fixed start" dateTime={forecast.start}>{format(forecast.start)}</time> · Review timing</span>;
 if(!value||(['blocked','unknown','condition','overdue'].includes(forecast.status)&&part==='start'))return <span>{forecast.reason??'Timing unknown'}</span>;
 const label=(forecast.status==='planned'?'Planned ':'Estimated ')+part;
 return <span>{label} <time aria-label={label} dateTime={value}>{format(value)}</time></span>;
}
