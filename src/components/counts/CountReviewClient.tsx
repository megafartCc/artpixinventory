"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { ActivityTimeline } from "@/components/ActivityTimeline";

type ReviewEntry = {
  id: string;
  compoundId: string;
  productName: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
  notes: string | null;
};

export function CountReviewClient({
  locale,
  countSessionId,
  countName,
  locationName,
  entries,
}: {
  locale: string;
  countSessionId: string;
  countName: string;
  locationName: string;
  entries: ReviewEntry[];
}) {
  const t = useTranslations("Counts");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useToastFeedback(error, feedback);

  const approve = async () => {
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/counts/${countSessionId}/review`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.approveFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.approved"));
    startTransition(() => router.push(`/${locale}/counts/${countSessionId}`));
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href={`/${locale}/counts/${countSessionId}`}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            {t("backToCount")}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{t("reviewTitle")}</h1>
          <p className="mt-1 text-slate-500">{countName} • {locationName}</p>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t("reviewSummary")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("reviewSummarySubtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => void approve()}
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 lg:min-h-0 lg:text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{submitting ? t("approving") : t("approve")}</span>
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.product")}</th>
                  <th className="px-4 py-3 text-right">{t("columns.expected")}</th>
                  <th className="px-4 py-3 text-right">{t("columns.counted")}</th>
                  <th className="px-4 py-3 text-right">{t("columns.variance")}</th>
                  <th className="px-4 py-3">{t("columns.notes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{entry.compoundId}</p>
                      <p className="text-xs text-slate-500">{entry.productName}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{entry.expectedQty}</td>
                    <td className="px-4 py-3 text-right">{entry.countedQty}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      entry.variance === 0
                        ? "text-emerald-600"
                        : Math.abs(entry.variance) <= 3
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}>
                      {entry.variance > 0 ? `+${entry.variance}` : entry.variance}
                    </td>
                    <td className="px-4 py-3">{entry.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("activity")}</h2>
          <div className="mt-5">
            <ActivityTimeline entityType="CountSession" entityId={countSessionId} />
          </div>
        </section>
      </div>
    </div>
  );
}
