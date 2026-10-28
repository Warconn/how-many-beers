import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:['**/offline/*.spec.ts','**/reliability.spec.ts','**/personal-templates.spec.ts'],outputDir:'test-results-offline',workers:1,fullyParallel:false,timeout:60_000,
 expect:{timeout:15_000},retries:process.env.CI?1:0,
 reporter:process.env.CI?[['github'],['html',{open:'never',outputFolder:'playwright-offline-report'}]]:'list',
 use:{baseURL:'http://127.0.0.1:3200',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'offline-android',use:{...devices['Pixel 7']}},{name:'offline-iphone',use:{...devices['iPhone 13']}}],
 webServer:{command:'node scripts/serve-offline-test.mjs',url:'http://127.0.0.1:3200',reuseExistingServer:!process.env.CI},
});
