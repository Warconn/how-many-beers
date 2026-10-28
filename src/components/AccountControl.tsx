"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/auth/AccountProvider";
import { rememberCookReturn, type CookView } from "@/auth/returnToCook";
const AccountPanel = dynamic(() => import("./AccountPanel"), {
  loading: () => <p role="status">Opening your account…</p>,
});
export default function AccountControl({
  view,
  cookId,
  onOpenChange,
}: {
  view: CookView;
  cookId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { phase, user } = useAccount(),
    [open, setOpen] = useState(false);
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
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    onOpenChange(false);
    trigger.current?.focus();
  };
  if (phase === "loading" || phase === "disabled") return null;
  return (
    <div className="account-control">
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
          onOpenChange(true);
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 21v-2.5a7.5 7.5 0 0 1 15 0V21" />
        </svg>
        <span className="account-trigger-label">
          {user ? "Account" : phase === "guest" ? "Sign in" : "Account"}
        </span>
      </button>
      {open && (
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
            Your account
          </h2>
          <button
            type="button"
            className="account-close"
            onClick={close}
            aria-label="Close account"
          >
            Close
          </button>
          <AccountPanel />
        </dialog>
      )}
    </div>
  );
}
