import type {Meal,PlannedTask} from '@/domain/meal';
import type {CookProjection} from '@/domain/cookProjection';
import {homeNextAction} from '@/domain/homeNextAction';

export default function HomeNextAction({meal,tasks,projection,now,formatWhen}:{meal:Meal;tasks:PlannedTask[];projection:CookProjection|null;now:number;formatWhen:(at:string)=>string}){
 const next=homeNextAction(meal,tasks,projection,now);
 if(!next)return null;
 if(next.kind!=='action')return <p className="muted small home-next-waiting" aria-label="Cook progress">{next.cue}</p>;
 return <div className="home-next-action" role="group" aria-label="Next up">
  <p className="eyebrow">NEXT UP</p>
  <p className="home-next-title"><strong>{next.task.title}</strong>{meal.dishes.length>1&&<span className="muted"> · {next.task.dishName}</span>}</p>
  <p className="muted small">{next.at&&<>{next.timeLabel} <time dateTime={next.at}>{formatWhen(next.at)}</time> · </>}{next.cue}</p>
 </div>;
}
