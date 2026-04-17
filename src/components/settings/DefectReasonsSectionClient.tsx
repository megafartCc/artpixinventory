"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DefectReasonsSectionClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const syncSample = async () => {
    setSyncing(true);
    setMessage("");

    const response = await fetch("/api/defect-reasons/sync-sample", {
      method: "POST",
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSyncing(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Failed to sync defect reasons.");
      return;
    }

    setMessage(payload.message ?? "Defect reasons synced.");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Defect Reasons</h2>
          <p className="mt-1 text-sm text-slate-500">
            Synced/manual reasons used in Session 16 defect reporting and review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncSample()}
          disabled={syncing}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync from ERPIX"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
