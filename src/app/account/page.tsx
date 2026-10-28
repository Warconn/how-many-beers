"use client";
import AccountPanel from "@/components/AccountPanel";
import { accountHomePath } from "@/auth/returnToCook";
export default function AccountPage() {
  return (
    <main className="shell account-page">
      <a href={accountHomePath()}>← Back to cook</a>
      <div className="panel">
        <AccountPanel />
      </div>
    </main>
  );
}
