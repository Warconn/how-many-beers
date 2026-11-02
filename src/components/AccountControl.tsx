"use client";
import Icon from './Icon';
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import OfflineSupport from "./OfflineSupport";
import { useAccount } from "@/auth/AccountProvider";
import { rememberCookReturn, type CookView } from "@/auth/returnToCook";
const AccountPanel = dynamic(() => import("./AccountPanel"), {
  loading: () => <p role="status">Opening your account…</p>,
});
export default function AccountControl({
  view,
  cookId,
  canReload,
  cookTools,
  savePhase,
}: {
  view: CookView;
  cookId: string;
  canReload: boolean;
  cookTools?: ReactNode;
  savePhase?: "loading" | "load-error" | "saved" | "syncing" | "unsaved" | "conflict" | "saving" | "blocked";
}) {
  const { phase, user } = useAccount(),
    [open, setOpen] = useState(false),
    [accountDraft, setAccountDraft] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    if (!modal) return;
    // Lock background scrolling without changing or unmounting the cook editor.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    return () => {
      modal.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);
  useEffect(()=>{
    const requested=()=>trigger.current?.click();
    window.addEventListener('hmb-open-account',requested);
    return ()=>window.removeEventListener('hmb-open-account',requested);
  },[]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    setAccountDraft(false);
    trigger.current?.focus();
  };
  const saving=savePhase==='saving'||savePhase==='syncing'||savePhase==='loading';
  const saveLabel=savePhase==='saved'?'Cook saved':savePhase==='loading'?'Loading cooks':saving?'Saving cook':'Saving needs attention';
  if (phase === "loading") return null;
  return (
    <div className="account-control">
      {savePhase&&<span className="account-save-indicator" data-state={savePhase} role="status" aria-live="polite" aria-label={saveLabel} title={saveLabel}>
        <Icon name={savePhase==='saved'?'cloud-check':saving?'sync':'alert'} className={saving?'save-in-progress':undefined}/>
        <span className="sr-only">{saveLabel}</span>
      </span>}
      <button
        type="button"
        className="account-trigger"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          try {
            rememberCookReturn(window.sessionStorage, view, cookId);
          } catch {
            /* Tab storage is optional. */
          }
          setOpen(true);

        }}
      >
        <Icon name="user"/>
        <span className="account-trigger-label">
          {phase === "disabled" ? "Menu" : user ? "Account" : phase === "guest" ? "Sign in" : "Account"}
        </span>
      </button>
        <dialog
          className="account-dialog"
          ref={dialog}
          aria-labelledby="account-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <h2 id="account-dialog-title" className="sr-only">
            {phase === "disabled" ? "App menu" : "Your account"}
          </h2>
          <button
            type="button"
            className="account-close"
            onClick={close}
            aria-label="Close account"
          >
            Close
          </button>
          {open && phase !== "disabled" && <AccountPanel cookTools={cookTools} onDraftChange={setAccountDraft} />}
          <OfflineSupport canReload={canReload && !accountDraft} />
        </dialog>
    </div>
  );
}
