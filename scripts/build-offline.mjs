import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=process.env.DEPLOY_TARGET==='cloudflare'?'':'/how-many-beers';
async function files(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(directory,e.name)):path.join(directory,e.name)))).flat();
}
const paths=[...(await files('out/_next/static')).filter(f=>!f.endsWith('.map')),
  ...(await files('out/brand')), 'out/index.html','out/manifest.webmanifest','out/favicon.ico'];
const hash=createHash('sha256');
for(const file of paths.sort()){hash.update(file);hash.update(await readFile(file));}
const prefix='how-many-beers-shell:'+base+':';
const assets=paths.map(file=>file==='out/index.html'?base+'/':base+'/'+file.slice(4).split(path.sep).join('/'));
let worker=await readFile('scripts/service-worker.js','utf8');
// Include worker policy itself in the revision, so fixes always install anew.
hash.update(worker);
worker=worker.replace('__CACHE_NAME__',JSON.stringify(prefix+hash.digest('hex').slice(0,16)))
  .replace('__CACHE_PREFIX__',JSON.stringify(prefix)).replace('__BASE__',JSON.stringify(base)).replace('__ASSETS__',JSON.stringify(assets));
await writeFile('out/sw.js',worker);
console.log(`Prepared offline shell: ${assets.length} assets, scope ${base||'/'}`);
