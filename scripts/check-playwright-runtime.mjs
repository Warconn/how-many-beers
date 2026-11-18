import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const version=require('@playwright/test/package.json').version;
if(version!==process.env.PLAYWRIGHT_IMAGE_VERSION)throw Error(`Playwright ${version} must match the browser image ${process.env.PLAYWRIGHT_IMAGE_VERSION}. Update the image with the lockfile.`);
const {chromium,webkit}=require('@playwright/test');
for(const browser of [chromium,webkit])if(!existsSync(browser.executablePath()))throw Error(`Preinstalled ${browser.name()} is missing.`);
console.log(`Verified Playwright ${version}, Chromium and WebKit.`);
