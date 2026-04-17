"use client";

import Link from "next/link";

type DefectRow = {
  id: string;
  reportNumber: string;
  source: string;
  status: string;
  createdBy: string;
  createdAt: string;
  itemCount: number;
  totalQuantity: number;
  faultSummary: Record<string, number>;
};

export function DefectsClient({
  locale,
  defects,
  pendingCount,
}: {
  locale: string;
  defects: DefectRow[];
  pendingCount: number;
}) {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Defects</h1>
            <p className="mt-1 text-slate-500">
              Batch defect reporting for pre-production and production workflows.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/${locale}/defects/review`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Review Queue ({pendingCount})
            </Link>
            <Link
              href={`/${locale}/defects/new`}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              New Defect Report
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Report</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Fault Summary</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {defects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      No defect reports yet.
                    </td>
                  </tr>
                ) : (
                  defects.map((defect) => (
                    <tr key={defect.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{defect.reportNumber}</td>
                      <td className="px-4 py-4">{defect.source.replaceAll("_", " ")}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(defect.status)}`}>
                          {defect.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4">{defect.itemCount}</td>
                      <td className="px-4 py-4">{defect.totalQuantity}</td>
                      <td className="px-4 py-4">
                        {Object.entries(defect.faultSummary)
                          .map(([faultType, quantity]) => `${faultType}: ${quantity}`)
                          .join(" • ") || "-"}
                      </td>
                      <td className="px-4 py-4">{defect.createdBy}</td>
                      <td className="px-4 py-4">{defect.createdAt}</td>
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

function statusTone(status: string) {
  switch (status) {
    case "PENDING_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
