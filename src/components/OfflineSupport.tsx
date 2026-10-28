'use client';
import {useEffect,useRef,useState} from 'react';
export default function OfflineSupport({canReload}:{canReload:boolean}){
  const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
  const requested=useRef(false);
  useEffect(()=>{
    let alive=true;let registration:ServiceWorkerRegistration|undefined;
    // Check/repair cached assets silently; no install or offline help UI.
    const check=()=>{
      const worker=navigator.serviceWorker?.controller;if(!worker)return;
      const channel=new MessageChannel();
      channel.port1.onmessage=event=>{
        channel.port1.close();if(!alive||event.data?.ready===true||!navigator.onLine)return;
        const recovery=new MessageChannel();recovery.port1.onmessage=()=>recovery.port1.close();
        worker.postMessage({type:'PREPARE_OFFLINE'},[recovery.port2]);
      };
      worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
    };
    const connection=()=>{check();if(navigator.onLine)void registration?.update().catch(()=>{});};
    const controller=()=>{if(requested.current){window.location.reload();return;}check();};
    if(process.env.NODE_ENV==='production'&&'serviceWorker'in navigator){
      const base=process.env.NEXT_PUBLIC_BASE_PATH??'';
      void navigator.serviceWorker.register(base+'/sw.js',{scope:base+'/',updateViaCache:'none'}).then(reg=>{
        if(!alive)return;registration=reg;
        if(reg.waiting)setWaiting(reg.waiting);
        const watch=(worker:ServiceWorker|null)=>{
          worker?.addEventListener('statechange',()=>{
            if(alive&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(reg.waiting??worker);
          });
        };
        watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));
        void navigator.serviceWorker.ready.then(()=>{if(alive)check();});check();
      }).catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange',controller);
    }
    window.addEventListener('online',connection);window.addEventListener('offline',check);window.addEventListener('focus',connection);
    return ()=>{alive=false;window.removeEventListener('online',connection);window.removeEventListener('offline',check);window.removeEventListener('focus',connection);navigator.serviceWorker?.removeEventListener('controllerchange',controller);};
  },[]);
  if(process.env.NODE_ENV!=='production'||!waiting)return null;
  return <section className="offline-access" aria-label="App update">
    <div className="notice"><p>An app update is ready. Your cook will resume after reloading.</p>
      <button type="button" disabled={!canReload} onClick={()=>{requested.current=true;waiting.postMessage({type:'SKIP_WAITING'});}}>Update app</button>
      {!canReload&&<p>Save or cancel open forms and save your changes before updating.</p>}
    </div>
  </section>;
}
