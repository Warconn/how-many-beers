import {expect,type Page} from '@playwright/test';
/** Meal selection stays inline; the header library is a separate management path. */
export async function openOwnRecipe(page:Page){
 await page.getByRole('region',{name:'Cook overview',exact:true}).getByRole('button',{name:'My recipes',exact:true}).click();
 await expect(page.getByRole('region',{name:'My recipes',exact:true})).toHaveCount(0);
 expect(new URL(page.url()).hash).not.toBe('#my-recipes');
 await page.getByRole('region',{name:'Choose a saved recipe',exact:true}).getByRole('button',{name:'Add your own recipe',exact:true}).click();
}
