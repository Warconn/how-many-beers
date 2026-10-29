import {test,expect} from '@playwright/test';
import {migrateMeal} from '../src/domain/cookState';

test('brand Home explains the cook and keeps the primary action visible',async({page},info)=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'How Many Beers?',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'From First Beer to First Bite.',exact:true})).toBeVisible();
  await expect(page.getByText('Plan every dish. Time your dinner. Enjoy the cook.',{exact:true})).toBeVisible();
  const start=page.getByRole('button',{name:/Plan a new cook/});
  await expect(start).toBeInViewport();
  for(const label of ['Set serving time','Add dishes','Adjust the plan','Cook and check it off']){
    await expect(page.getByRole('complementary',{name:'How it works'}).getByText(label,{exact:true})).toBeVisible();
  }
  await expect(page.locator('.brand-icon img')).toHaveJSProperty('naturalWidth',256);
  expect(await page.locator('main').innerText()).not.toMatch(/🍺|📖|⚠️/u);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('brand-home.png'),fullPage:true,style:'nextjs-portal{display:none}'});
});

test('brand metadata and share assets identify the public domain',async({page,request})=>{
  await page.goto('/');
  await expect(page).toHaveTitle('How Many Beers? | From First Beer to First Bite.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://howmanybeers.app/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://howmanybeers.app/brand/social-card.png');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary_large_image');
  for(const path of ['/brand/primary-mark.svg','/brand/badge-mark.svg','/brand/social-card.png','/brand/apple-touch-icon.png','/brand/favicon.svg','/favicon.ico']){
    const response=await request.get(path);
    expect(response.ok(),path).toBe(true);
  }
});

test('returning cooks get a compact brand header and unchanged resume data',async({page},info)=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Plan a new cook/}).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
  await page.getByRole('button',{name:'Start cooking',exact:true}).click();
  const saved=migrateMeal(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!)));
  await page.getByRole('button',{name:/Home/}).first().click();
  await page.reload();
  await expect(page.getByRole('heading',{name:'From First Beer to First Bite.',exact:true})).toHaveCount(0);
  const resume=page.getByRole('button',{name:/Continue cooking/});
  await expect(resume).toBeInViewport();
  await page.screenshot({path:info.outputPath('brand-returning-cook.png'),fullPage:true,style:'nextjs-portal{display:none}'});
  await resume.click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(saved);
  await expect(page.getByText("Today's checklist",{exact:true})).toBeVisible();
});
