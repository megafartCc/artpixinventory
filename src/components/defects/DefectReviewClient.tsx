"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ReviewRow = {
  id: string;
  reportNumber: string;
  source: string;
  createdBy: string;
  createdAt: string;
  fromLocation: string;
  machineName: string;
  items: Array<{
    id: string;
    productLabel: string;
    reason: string;
    quantity: number;
    faultType: string;
  }>;
};

export function DefectReviewClient({
  locale,
  reports,
}: {
  locale: string;
  reports: ReviewRow[];
}) {
  const t = useTranslations("DefectReview");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const review = async (reportId: string, action: "CONFIRM" | "REJECT") => {
    setError("");
    setPendingId(reportId);

    const response = await fetch(`/api/defects/${reportId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const payload = (await response.json()) as { error?: string };
    setPendingId(null);

    if (!response.ok) {
      setError(payload.error ?? t("errors.reviewFailed"));
      return;
    }

    startTransition(() => router.refresh());
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          <Link
            href={`/${locale}/defects`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("back")}
          </Link>
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-slate-400">
            {t("empty")}
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">{report.createdAt}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{report.reportNumber}</h2>
                  <p className="text-sm text-slate-600">
                    {t("sourceLabel")}: {t(`source.${report.source}` as "source.PRE_PRODUCTION")} • {t("createdBy")} {report.createdBy}
                  </p>
                  <p className="text-sm text-slate-600">
                    {report.machineName ? `${t("machine")}: ${report.machineName}` : `${t("fromLocation")}: ${report.fromLocation}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void review(report.id, "REJECT")}
                    disabled={pendingId === report.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {t("reject")}
                  </button>
                  <button
                    onClick={() => void review(report.id, "CONFIRM")}
                    disabled={pendingId === report.id}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {t("confirm")}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">{t("columns.product")}</th>
                      <th className="py-2 pr-3">{t("columns.reason")}</th>
                      <th className="py-2 pr-3">{t("columns.faultType")}</th>
                      <th className="py-2 pr-3">{t("columns.qty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {report.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-3">{item.productLabel}</td>
                        <td className="py-2 pr-3">{item.reason}</td>
                        <td className="py-2 pr-3">{t(`faultType.${item.faultType}` as "faultType.VENDOR")}</td>
                        <td className="py-2 pr-3">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
