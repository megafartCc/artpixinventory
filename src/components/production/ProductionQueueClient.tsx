"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function ProductionQueueClient({
  rows,
  lastSynced,
}: {
  rows: Array<{
    id: string;
    machineName: string;
    productName: string;
    productCompoundId: string;
    quantityNeeded: number;
    quantityInStock: number;
    sufficient: boolean;
    syncedAt: string;
  }>;
  lastSynced: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    const response = await fetch("/api/production/sync", { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setSyncing(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to sync production queue.");
      return;
    }

    startTransition(() => router.refresh());
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Production Queue</h1>
            <p className="mt-1 text-slate-500">Placeholder ERPIX-driven restock requirements per machine.</p>
            <p className="mt-1 text-xs text-slate-400">Last synced: {lastSynced}</p>
          </div>
          <button
            onClick={() => void syncNow()}
            disabled={syncing}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Needed</th>
                  <th className="px-4 py-3">In Stock</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                      No production queue records yet. Click “Sync Now” to generate placeholder data.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-4">{row.machineName}</td>
                      <td className="px-4 py-4">{row.productCompoundId} — {row.productName}</td>
                      <td className="px-4 py-4">{row.quantityNeeded}</td>
                      <td className="px-4 py-4">{row.quantityInStock}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.sufficient ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.sufficient ? "Sufficient" : "Restock Needed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
