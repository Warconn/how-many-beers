import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function worker({offline=false,failInstall=false,openTabs=0,quota=false,base='',hanging=false}={}){
 const origin='https://howmanybeers.app',listeners:Record<string,(event:any)=>void>={};
 const stores=new Map<string,Map<string,Response>>();let skipped=0,claimed=0,network=0,includedOtherTabs=false;
 const key=(request:string|{url:string})=>new URL(typeof request==='string'?request:request.url,origin).href;
 class Request{url:string;method='GET';mode='cors';constructor(url:string){this.url=key(url);}}
 const fetch=async(request:{url:string},options?:{signal:AbortSignal}):Promise<Response>=>{
  network++;if(offline)throw Error('Offline');
  if(hanging)return new Promise((_resolve,reject)=>{options?.signal.addEventListener('abort',()=>reject(Error('Timed out')));});
  return new Response(request.url,{status:failInstall&&request.url.endsWith('/app.js')?404:200});
 };
 const caches={
  open:async(name:string)=>{
   if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name)!;
   return {match:async(request:string|{url:string})=>data.get(key(request))?.clone(),
    put:async(request:string|{url:string},response:Response)=>{if(quota)throw Error('Quota');data.set(key(request),response.clone());},
    addAll:async(requests:Request[])=>{
     const responses=await Promise.all(requests.map(request=>fetch(request)));if(responses.some(r=>!r.ok)||quota)throw Error('Cache failed');
     requests.forEach((r,i)=>data.set(r.url,responses[i]));
    }};
  },keys:async()=>[...stores.keys()],delete:async(name:string)=>stores.delete(name),
 };
 const self={location:{origin},clients:{matchAll:async(options:{includeUncontrolled?:boolean})=>{includedOtherTabs=options.includeUncontrolled===true;return Array(openTabs).fill({});},claim:async()=>{claimed++;}},
  skipWaiting:()=>{skipped++;},addEventListener:(name:string,fn:(event:any)=>void)=>{listeners[name]=fn;}};
 const source=readFileSync('scripts/service-worker.js','utf8').replace('__CACHE_NAME__',JSON.stringify('app:new'))
  .replace('__CACHE_PREFIX__',JSON.stringify('app:')).replace('__BASE__',JSON.stringify(base)).replace('__ASSETS__',JSON.stringify([base+'/',base+'/_next/static/app.js']));
 vm.runInNewContext(source,{self,caches,fetch,Request,Response,URL,Promise,AbortController,clearTimeout,setTimeout:hanging?(fn:()=>void)=>setTimeout(fn,0):setTimeout});
 async function dispatch(name:string,extra:Record<string,unknown>={}){
  let result:Promise<unknown>|undefined;
  listeners[name]({...extra,waitUntil:(p:Promise<unknown>)=>{result=p;},respondWith:(p:Promise<unknown>)=>{result=p;}});
  return result;
 }
 return {stores,dispatch,stats:()=>({skipped,claimed,network,includedOtherTabs})};
}
describe('offline worker policy',()=>{
 it('rejects an incomplete installation and preserves the previous cache',async()=>{
  const w=worker({failInstall:true});w.stores.set('app:old',new Map());
  await expect(w.dispatch('install')).rejects.toThrow();expect(w.stores.has('app:new')).toBe(false);expect(w.stores.has('app:old')).toBe(true);
  expect(w.stats().skipped).toBe(0);
 });
 it('serves a cached document when offline without inventing another route',async()=>{
  const w=worker({offline:true});w.stores.set('app:new',new Map([['https://howmanybeers.app/',new Response('Cached cook app')]]));
  const response=await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/?resume=1',method:'GET',mode:'navigate'}}) as Response;
  expect(await response.text()).toBe('Cached cook app');
  expect(await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/unknown',method:'GET',mode:'navigate'}})).toBeUndefined();
 });
 it('does not intercept APIs, other origins or non-GET requests',async()=>{
  const w=worker();
  for(const request of [{url:'https://howmanybeers.app/api/private',method:'GET'},{url:'https://recipes.example/recipe',method:'GET'},{url:'https://howmanybeers.app/',method:'POST'}]){
   expect(await w.dispatch('fetch',{request})).toBeUndefined();
  }
  expect(w.stats().network).toBe(0);
 });
 it('falls back to the cached app when a connected network stalls',async()=>{
  const w=worker({hanging:true});w.stores.set('app:new',new Map([['https://howmanybeers.app/',new Response('Cached app')]]));
  const response=await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/',method:'GET',mode:'navigate'}}) as Response;
  expect(await response.text()).toBe('Cached app');
 });
 it('supports the legacy subpath without intercepting the origin root',async()=>{
  const w=worker({offline:true,base:'/how-many-beers'});w.stores.set('app:new',new Map([['https://howmanybeers.app/how-many-beers/',new Response('Scoped app')]]));
  const response=await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/how-many-beers/',method:'GET',mode:'navigate'}}) as Response;
  expect(await response.text()).toBe('Scoped app');expect(await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/',method:'GET',mode:'navigate'}})).toBeUndefined();
 });
 it('retains old assets while another tab could still need them',async()=>{
  const w=worker({openTabs:1});w.stores.set('app:old',new Map());w.stores.set('another-app',new Map());
  await w.dispatch('activate');expect(w.stores.has('app:old')).toBe(true);expect(w.stores.has('another-app')).toBe(true);expect(w.stats().claimed).toBe(1);expect(w.stats().includedOtherTabs).toBe(true);
 });
 it('reclaims only its old caches when no tab remains on the old code',async()=>{
  const w=worker();w.stores.set('app:old',new Map());w.stores.set('app:new',new Map());w.stores.set('another-app',new Map());
  await w.dispatch('activate');expect([...w.stores.keys()]).toEqual(['app:new','another-app']);
 });
 it('activates a waiting update only after an explicit message',async()=>{
  const w=worker();await w.dispatch('install');expect(w.stats().skipped).toBe(0);
  await w.dispatch('message',{data:{type:'SKIP_WAITING'}});expect(w.stats().skipped).toBe(1);
 });
 it('serves an online asset even when a cache write exceeds quota',async()=>{
  const w=worker({quota:true});
  const response=await w.dispatch('fetch',{request:{url:'https://howmanybeers.app/brand/icon.png',method:'GET'}}) as Response;
  expect(response.ok).toBe(true);
 });
 it('reports cache loss rather than claiming offline readiness',async()=>{
  const w=worker();let reply:unknown;
  await w.dispatch('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:(message:unknown)=>{reply=message;}}]});
  expect(reply).toEqual({ready:false});
  await w.dispatch('install');await w.dispatch('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:(message:unknown)=>{reply=message;}}]});
  expect(reply).toEqual({ready:true});
 });
});
