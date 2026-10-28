/* Generated with the static export. No cook data is stored in these caches. */
const CACHE_NAME = __CACHE_NAME__;
const CACHE_PREFIX = __CACHE_PREFIX__;
const BASE = __BASE__;
const ASSETS = __ASSETS__;
const HOME = BASE + '/';

async function prepare(){
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})));
}
self.addEventListener('install',event=>{
  // A failed cache fill must leave the previous worker and cache usable.
  event.waitUntil(prepare().catch(async error=>{await caches.delete(CACHE_NAME);throw error;}));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Retain old assets while another tab may still run their JavaScript. Normal
    // activation after all old tabs close can safely reclaim previous caches.
    const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(tabs.length===0){
      await Promise.all((await caches.keys()).filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return;}
  if(event.data?.type==='CHECK_OFFLINE'){
    event.waitUntil((async()=>{
      let ready=false;
      try{const cache=await caches.open(CACHE_NAME);ready=(await Promise.all(ASSETS.map(url=>cache.match(url)))).every(Boolean);}catch{/* Storage may be unavailable or evicted. */}
      event.ports[0]?.postMessage({ready});
    })());
  }
  if(event.data?.type==='PREPARE_OFFLINE')event.waitUntil((async()=>{
    try{await prepare();event.ports[0]?.postMessage({ready:true});}
    catch{event.ports[0]?.postMessage({ready:false});}
  })());
});
function staticAsset(url){
  return url.pathname.startsWith(BASE+'/_next/static/')||url.pathname.startsWith(BASE+'/brand/')
    ||url.pathname===BASE+'/favicon.ico'||url.pathname===BASE+'/manifest.webmanifest';
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&(url.pathname===HOME||url.pathname===BASE+'/index.html')){
    event.respondWith((async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
      try{const response=await fetch(request,{signal:controller.signal});if(response.ok)return response;}
      catch{/* Offline, an unavailable server, or a stalled connection. */}
      finally{clearTimeout(timer);}
      let cached;
      try{cached=await (await caches.open(CACHE_NAME)).match(HOME);}catch{/* No usable offline shell. */}
      return cached??new Response('Reconnect to open How Many Beers? Keep any cooking tabs open until saving is confirmed.',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
  }else if(staticAsset(url)){
    event.respondWith((async()=>{
      let cache,cached;
      try{
       cache=await caches.open(CACHE_NAME);cached=await cache.match(request);
       if(!cached){
        // An explicitly installed update must still serve old immutable chunks to
        // another open tab. Never search another application's caches.
        for(const name of (await caches.keys()).filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME)){
          cached=await (await caches.open(name)).match(request);if(cached)break;
        }
       }
      }catch{return fetch(request);}
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok){try{await cache.put(request,response.clone());}catch{/* Network response remains usable when cache quota is full. */}}
      return response;
    })());
  }
});
