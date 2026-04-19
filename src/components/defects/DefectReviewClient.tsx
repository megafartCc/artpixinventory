"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

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
  useToastFeedback(error);

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
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1600px] space-y-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">{t("title")}</h1>
            <p className="mt-2 text-lg text-slate-500">{t("subtitle")}</p>
          </div>
          <Link
            href={`/${locale}/defects`}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {t("back")}
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white p-20 text-center font-medium text-slate-400">
            {t("empty")}
          </div>
        ) : (
          <div className="grid gap-8">
            {reports.map((report) => (
              <div key={report.id} className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{report.createdAt}</p>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">{report.reportNumber}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        {t("sourceLabel")}: <strong>{t(`source.${report.source}` as "source.PRE_PRODUCTION")}</strong>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        {t("createdBy")}: <strong>{report.createdBy}</strong>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        {report.machineName ? (
                          <>
                            {t("machine")}: <strong>{report.machineName}</strong>
                          </>
                        ) : (
                          <>
                            {t("fromLocation")}: <strong>{report.fromLocation}</strong>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => void review(report.id, "REJECT")}
                      disabled={pendingId === report.id}
                      className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      {t("reject")}
                    </button>
                    <button
                      onClick={() => void review(report.id, "CONFIRM")}
                      disabled={pendingId === report.id}
                      className="rounded-2xl bg-slate-950 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {t("confirm")}
                    </button>
                  </div>
                </div>

                <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        <tr>
                          <th className="px-6 py-4">{t("columns.product")}</th>
                          <th className="px-6 py-4">{t("columns.reason")}</th>
                          <th className="px-6 py-4">{t("columns.faultType")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.qty")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {report.items.map((item) => (
                          <tr key={item.id} className="transition hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-slate-950">{item.productLabel}</td>
                            <td className="px-6 py-4">{item.reason}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                item.faultType === "VENDOR" 
                                  ? "bg-amber-100 text-amber-700" 
                                  : "bg-slate-100 text-slate-700"
                              }`}>
                                {t(`faultType.${item.faultType}` as "faultType.VENDOR")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-black">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
