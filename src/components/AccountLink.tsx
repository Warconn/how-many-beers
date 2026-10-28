"use client";
import { useEffect, useState } from "react";
import { accountConfig, accountPath } from "@/auth/config";
export default function AccountLink() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!!accountConfig(window.location.origin)), []);
  return enabled ? (
    <a className="account-link" href={accountPath()}>
      Account preview
    </a>
  ) : null;
}
