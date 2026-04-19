"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { ActivityTimeline } from "@/components/ActivityTimeline";

const statuses = ["PENDING", "APPROVED", "APPLIED", "CLOSED"];

export function VendorCreditDetailClient({
  locale,
  credit,
}: {
  locale: string;
  credit: {
    id: string;
    creditNumber: string;
    vendorName: string;
    poNumber: string;
    reason: string;
    status: string;
    totalAmount: string;
    notes: string;
    items: Array<{ id: string; productLabel: string; quantity: number; unitCost: string; totalCredit: string; notes: string }>;
  };
}) {
  const t = useTranslations("Credits");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useToastFeedback(error);

  const updateStatus = async (status: string) => {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/vendor-credits/${credit.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.updateStatus"));
      return;
    }

    router.refresh();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="w-full space-y-10">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/credits`}
                className="text-sm font-bold text-slate-400 transition hover:text-slate-600 uppercase tracking-widest"
              >
                ← {t("detailBack")}
              </Link>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">
                {credit.creditNumber}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-lg text-slate-500 font-medium">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  {credit.vendorName}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  {t(`reasons.${credit.reason}`)}
                </span>
                <span className="flex items-center gap-2 text-indigo-600 font-black">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  ${credit.totalAmount}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 px-2">
                Actions
              </p>
              {statuses.map((status) => (
                <button
                  key={status}
                  disabled={busy || status === credit.status}
                  onClick={() => void updateStatus(status)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                    status === credit.status
                      ? "bg-slate-950 text-white shadow-md"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  } disabled:opacity-50`}
                >
                  {t(`statuses.${status}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Items List</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-8 py-4">{t("columns.product")}</th>
                      <th className="px-8 py-4 text-center">{t("columns.qty")}</th>
                      <th className="px-8 py-4">{t("columns.unitCost")}</th>
                      <th className="px-8 py-4">{t("columns.total")}</th>
                      <th className="px-8 py-4">{t("columns.notes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {credit.items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/50">
                        <td className="px-8 py-5 font-bold text-slate-950">{item.productLabel}</td>
                        <td className="px-8 py-5 text-center font-black">{item.quantity}</td>
                        <td className="px-8 py-5 font-medium text-slate-500">${item.unitCost}</td>
                        <td className="px-8 py-5 font-black text-slate-950">${item.totalCredit}</td>
                        <td className="px-8 py-5 text-slate-500 italic">{item.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-8">
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Details</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
                  <p className="mt-2 text-lg font-black text-indigo-600 uppercase tracking-tight">
                    {t(`statuses.${credit.status}`)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">PO Number</label>
                  <p className="mt-2 text-lg font-bold text-slate-950">{credit.poNumber}</p>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes</label>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed italic">
                    {credit.notes || t("noNotes")}
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">{t("activity")}</h2>
              <ActivityTimeline entityType="VendorCredit" entityId={credit.id} />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
