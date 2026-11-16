import {expect,type Locator} from '@playwright/test';

/** Product geometry, shared by both saved-item screens and all browser projects. */
export async function compactLibraryCard(card:Locator,removeName:string){
  const heading=card.locator('.library-item-heading');
  await expect(heading).toBeVisible();
  const trash=heading.getByRole('button',{name:removeName,exact:true});
  await expect(trash.locator('[data-icon="trash"]')).toBeVisible();
  await expect(trash).toHaveText('');
  await expect(trash).toHaveAttribute('title',removeName);
  const actionRow=card.locator('.library-card-actions');
  await expect(actionRow.getByRole('button')).toHaveCount(2);
  const [outer,head,remove,count,actions]=await Promise.all([
    card.boundingBox(),heading.boundingBox(),trash.boundingBox(),
    heading.locator('.history-count').boundingBox(),actionRow.boundingBox()
  ]);
  expect(remove!.width).toBeGreaterThanOrEqual(44);
  expect(remove!.height).toBeGreaterThanOrEqual(44);
  expect(remove!.x+remove!.width).toBeLessThanOrEqual(outer!.x+outer!.width);
  expect(remove!.y-head!.y).toBeLessThanOrEqual(1);
  expect(count!.x+count!.width).toBeLessThanOrEqual(remove!.x);
  // Dates/equipment get the whole row, rather than wrapping beside the tools.
  const metadata=await heading.locator('.library-item-metadata').boundingBox();
  expect(metadata!.width).toBeGreaterThanOrEqual(head!.width-1);
  expect(actions!.y-(head!.y+head!.height)).toBeGreaterThanOrEqual(8);
  expect(actions!.y-(head!.y+head!.height)).toBeLessThanOrEqual(13);
  for(const button of await actionRow.getByRole('button').all()){
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  return card.evaluate(el=>{
    const style=getComputedStyle(el);
    return {padding:style.padding,rowGap:getComputedStyle(el.querySelector('.library-card-actions')!).marginTop};
  });
}
