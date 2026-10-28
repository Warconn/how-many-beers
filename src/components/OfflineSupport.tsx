'use client';
import {useEffect,useRef,useState} from 'react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function OfflineSupport({canReload}:{canReload:boolean}){
  const [online,setOnline]=useState(true),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [waiting,setWaiting]=useState<ServiceWorker|null>(null),[install,setInstall]=useState<InstallEvent|null>(null);
  const requested=useRef(false);
  useEffect(()=>{
    let alive=true;let registration:ServiceWorkerRegistration|undefined;
    const check=()=>{
      setOnline(navigator.onLine);
      const worker=navigator.serviceWorker?.controller;
      if(!worker){setReady(false);return;}
      const channel=new MessageChannel();
      channel.port1.onmessage=event=>{
        channel.port1.close();if(!alive)return;
        const available=event.data?.ready===true;setReady(available);
        if(!available&&navigator.onLine){
          const recovery=new MessageChannel();
          recovery.port1.onmessage=result=>{recovery.port1.close();if(alive){setReady(result.data?.ready===true);setFailed(result.data?.ready!==true);}};
          worker.postMessage({type:'PREPARE_OFFLINE'},[recovery.port2]);
        }
      };
      worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
    };
    const connection=()=>{check();if(navigator.onLine)void registration?.update().catch(()=>{});};
    const installed=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
    const controller=()=>{if(requested.current){window.location.reload();return;}check();};
    if(process.env.NODE_ENV==='production'&&'serviceWorker'in navigator){
      const base=process.env.NEXT_PUBLIC_BASE_PATH??'';
      void navigator.serviceWorker.register(base+'/sw.js',{scope:base+'/',updateViaCache:'none'}).then(reg=>{
        if(!alive)return;registration=reg;
        if(reg.waiting)setWaiting(reg.waiting);
        const watch=(worker:ServiceWorker|null)=>{
          worker?.addEventListener('statechange',()=>{
            if(!alive)return;
            if(worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(reg.waiting??worker);
            if(worker.state==='redundant')setFailed(true);
          });
        };
        watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));
        void navigator.serviceWorker.ready.then(()=>{if(alive)check();});
        check();
      }).catch(()=>{if(alive)setFailed(true);});
      navigator.serviceWorker.addEventListener('controllerchange',controller);
    }
    setOnline(navigator.onLine);
    window.addEventListener('online',connection);window.addEventListener('offline',check);
    window.addEventListener('beforeinstallprompt',installed);
    window.addEventListener('focus',connection);
    return ()=>{alive=false;window.removeEventListener('online',connection);window.removeEventListener('offline',check);window.removeEventListener('beforeinstallprompt',installed);window.removeEventListener('focus',connection);navigator.serviceWorker?.removeEventListener('controllerchange',controller);};
  },[]);
  if(process.env.NODE_ENV!=='production')return null;
  return <section className="offline-access" aria-label="Offline access">
    <p aria-live="polite">{!online?(ready?'Offline. Your cook can still save on this device.':'Offline access is not ready. Keep this tab open and back up your cook.'):
      ready?'Offline ready on this device':failed?'Offline access could not be prepared. Keep a backup of your cook.':'Preparing offline access…'}</p>
    {waiting&&<div className="notice"><p>An app update is ready. Your cook will resume after reloading.</p>
      <button type="button" disabled={!canReload} onClick={()=>{requested.current=true;waiting.postMessage({type:'SKIP_WAITING'});}}>Update app</button>
      {!canReload&&<p>Save or cancel open forms and save your changes before updating.</p>}
    </div>}
    <details><summary>Install and offline help</summary>
      <p>Visit once online and wait for “Offline ready” before relying on offline access. Saved cooks belong to this browser and site; export a backup before switching devices or clearing site data.</p>
      {install?<button type="button" onClick={()=>{void install.prompt().then(()=>install.userChoice).then(()=>setInstall(null));}}>Install app</button>:<p>On iPhone, use Safari’s Share menu → Add to Home Screen. On Android, use the browser menu → Install app or Add to Home screen when available.</p>}
      <p>Browser storage and offline files can be cleared or evicted by the device. Background timers and notifications are not provided.</p>
    </details>
  </section>;
}
