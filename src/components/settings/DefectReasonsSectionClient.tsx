"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

export function DefectReasonsSectionClient({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useToastFeedback(error, feedback);

  const syncSample = async () => {
    setSyncing(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/defect-reasons/sync-sample", {
      method: "POST",
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSyncing(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.syncReasonsFailed"));
      return;
    }

    setFeedback(payload.message ?? t("reasonsSynced"));
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{t("reasonsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("reasonsSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncSample()}
          disabled={syncing}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {syncing ? t("syncing") : t("syncFromErpix")}
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
