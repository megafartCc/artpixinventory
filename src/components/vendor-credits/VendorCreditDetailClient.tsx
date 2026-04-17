"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setError(payload.error ?? "Failed to update status.");
      return;
    }

    router.refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href={`/${locale}/credits`} className="text-sm text-slate-500 hover:text-slate-700">Back to Credits</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{credit.creditNumber}</h1>
          <p className="mt-1 text-slate-500">{credit.vendorName} • {credit.reason} • ${credit.totalAmount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">Status: <span className="font-medium">{credit.status}</span></p>
          <p className="text-sm text-slate-700">PO: {credit.poNumber}</p>
          <p className="mt-2 text-sm text-slate-600">{credit.notes || "No notes."}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button key={status} disabled={busy || status === credit.status} onClick={() => void updateStatus(status)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50">
                Set {status}
              </button>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Notes</th>
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
