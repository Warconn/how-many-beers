import type {Dish} from './meal';
export function turkeyPreparation(dish:Dish):NonNullable<Dish['turkeyPrep']>{
 return dish.turkeyPrep??{state:'frozen',thawDays:Math.ceil((dish.weightLb??22)/4),brineHours:22,dryHours:2.25};
}
