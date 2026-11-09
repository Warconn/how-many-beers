import type {Locator} from '@playwright/test';
/** Exercise the optional duration control through the same full editor in each view. */
export async function changeStepDuration(row:Locator,minutes:string){
 await row.getByRole('button',{name:/^Edit(?: |$)/}).click();
 const form=row.getByRole('form',{name:'Edit step',exact:true});
 await form.getByText(/^More options/).click();
 await form.getByLabel('Duration unit',{exact:true}).selectOption('minutes');
 await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill(minutes);
 await form.getByRole('button',{name:'Save',exact:true}).click();
}
