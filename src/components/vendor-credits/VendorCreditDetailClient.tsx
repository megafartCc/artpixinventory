"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

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
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link href={`/${locale}/credits`} className="text-sm text-slate-500 hover:text-slate-700">{t("detailBack")}</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{credit.creditNumber}</h1>
          <p className="mt-1 text-slate-500">{credit.vendorName} • {credit.reason} • ${credit.totalAmount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">{t("status")}: <span className="font-medium">{credit.status}</span></p>
          <p className="text-sm text-slate-700">PO: {credit.poNumber}</p>
          <p className="mt-2 text-sm text-slate-600">{credit.notes || t("noNotes")}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button key={status} disabled={busy || status === credit.status} onClick={() => void updateStatus(status)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50">
                {t("set")} {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("columns.product")}</th>
                <th className="px-4 py-3">{t("columns.qty")}</th>
                <th className="px-4 py-3">{t("columns.unitCost")}</th>
                <th className="px-4 py-3">{t("columns.total")}</th>
                <th className="px-4 py-3">{t("columns.notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {credit.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.productLabel}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">${item.unitCost}</td>
                  <td className="px-4 py-3">${item.totalCredit}</td>
                  <td className="px-4 py-3">{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
