import type {StepForecast} from '@/domain/cookForecast';
const format=(iso:string,simple=false)=>new Date(iso).toLocaleString([],simple&&new Date(iso).toDateString()===new Date().toDateString()?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export default function StepForecastTime({forecast,part,simple=false}:{forecast:StepForecast;part:'start'|'finish';simple?:boolean}){
 if(simple&&(forecast.status==='condition'||forecast.template?.kind==='checkpoint'))return <span>Check when ready</span>;
 if(simple&&forecast.status==='blocked'&&(!forecast.start||forecast.template))return <span>Waiting for previous action</span>;
 if(forecast.template){
  const t=forecast.template,phase=t.minutes!==undefined,value=phase&&part==='finish'?forecast.finish:t.at;
  if(!value)return <span>{phase?'Start needed for a finish estimate':'Checkpoint time not set'}</span>;
  const label=simple?(part==='finish'?'Estimated finish':'Estimated start'):phase?(t.basis==='planned'?'Planned ':'Estimated ')+(part==='finish'?(t.kind==='cook'?'cook finish':t.kind==='rest'?'rest/hold finish':'finish'):'start'):t.basis==='actual'?'Checkpoint started':t.basis==='fixed'?'Fixed checkpoint':(t.basis==='planned'?'Planned ':'Estimated ')+(t.kind==='preparation'?'step':t.kind==='serve'?'ready time':'checkpoint');
  return <span>{label} <time aria-label={label} dateTime={value}>{format(value,simple)}</time></span>;
 }
 const value=forecast[part];
 if(part==='start'&&forecast.start&&forecast.status==='unknown')return <span>Estimated start <time aria-label="Estimated start" dateTime={forecast.start}>{format(forecast.start)}</time> · Duration unknown</span>;
 if(part==='start'&&forecast.start&&forecast.status==='blocked')return <span>Fixed start <time aria-label="Fixed start" dateTime={forecast.start}>{format(forecast.start)}</time> · Review timing</span>;
 if(!value||(['blocked','unknown','condition','overdue'].includes(forecast.status)&&part==='start'))return <span>{forecast.reason??'Timing unknown'}</span>;
 const label=(forecast.status==='planned'?'Planned ':'Estimated ')+part;
 return <span>{label} <time aria-label={label} dateTime={value}>{format(value,simple)}</time></span>;
}
