import {createDish as currentDish,type PresetId} from '../../src/domain/meal';
/** Frozen pre-November-9 fixture for existing-cook and historical timing regressions. */
export function legacyDish(preset:Exclude<PresetId,'custom'>){
 const dish=currentDish(preset);
 if(preset!=='brisket')return dish;
 const {brisketTemplateVersion,brisketPlan,...original}=dish;
 return {...original,pitTempF:180,restMinutes:160};
}
