'use client';
import {useEffect,useRef,useState} from 'react';
export default function CancelCookDialog({name,onDismiss,onConfirm}:{name:string;onDismiss:()=>void;onConfirm:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=dialog.current!;el.showModal();return()=>el.close();},[]);
 return <dialog ref={dialog} className="account-dialog cancel-cook-dialog" aria-labelledby="cancel-cook-title" aria-describedby="cancel-cook-description" onCancel={e=>{e.preventDefault();if(!busy)onDismiss();}}>
  <h2 id="cancel-cook-title">Cancel this cook?</h2>
  <p id="cancel-cook-description"><strong>{name||'This cook'}</strong> will be removed from your active cooks and won’t appear in Past cooks.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <div className="cancel-cook-actions">
   <button type="button" className="button primary" autoFocus disabled={busy} onClick={onDismiss}>Keep cooking</button>
   <button type="button" className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onConfirm();}catch(e){setError(e instanceof Error?e.message:'Could not cancel this cook. Your progress is still available.');}finally{setBusy(false);}}}>{busy?'Canceling cook…':'Cancel cook'}</button>
  </div>
 </dialog>;
}
