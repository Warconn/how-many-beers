import {spawnSync} from 'node:child_process';
const env={...process.env,DEPLOY_TARGET:'cloudflare',NEXT_TELEMETRY_DISABLED:'1'};
const command=process.platform==='win32'?'npm.cmd':'npm';
const build=spawnSync(command,['run','build'],{env,stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
const tests=spawnSync(command,['exec','--','playwright','test','--config=playwright.offline.config.ts',...process.argv.slice(2)],{env,stdio:'inherit'});
process.exit(tests.status??1);
