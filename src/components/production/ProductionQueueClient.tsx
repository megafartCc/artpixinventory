"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

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
  const t = useTranslations("Production");
  const tc = useTranslations("CommonExtended");
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  useToastFeedback(error);

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    const response = await fetch("/api/production/sync", { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setSyncing(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.syncFailed"));
      return;
    }

    startTransition(() => router.refresh());
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
            <p className="mt-1 text-xs text-slate-400">{t("lastSynced")}: {lastSynced}</p>
          </div>
          <button
            onClick={() => void syncNow()}
            disabled={syncing}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {syncing ? t("syncing") : tc("syncNow")}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("machine")}</th>
                  <th className="px-4 py-3">{t("product")}</th>
                  <th className="px-4 py-3">{t("needed")}</th>
                  <th className="px-4 py-3">{t("inStock")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                      {t("noRows")}
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
                          {row.sufficient ? t("sufficient") : t("restock")}
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
