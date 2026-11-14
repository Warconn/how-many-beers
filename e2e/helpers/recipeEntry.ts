import type {Page} from '@playwright/test';
/** The owner-approved two-choice entry: My recipes also owns paste/upload. */
export async function openOwnRecipe(page:Page){
 await page.getByRole('button',{name:'My recipes',exact:true}).last().click();
 await page.getByRole('region',{name:'My recipes',exact:true}).getByRole('button',{name:'Add your own recipe',exact:true}).click();
}
