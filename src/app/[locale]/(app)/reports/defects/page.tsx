import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function DefectsReportPage() {
  noStore();

  const items = await prisma.defectItem.findMany({
    include: {
      product: { select: { compoundId: true, name: true } },
      reason: { select: { name: true } },
      defectReport: {
        select: {
          reportNumber: true,
          source: true,
          createdAt: true,
          machine: { select: { name: true } },
        },
      },
    },
    orderBy: { defectReport: { createdAt: "desc" } },
    take: 500,
  });

  const totalDefects = items.reduce((sum, item) => sum + item.quantity, 0);
  const vendorTotal = items.filter((item) => item.faultType === "VENDOR").reduce((sum, item) => sum + item.quantity, 0);
  const internalTotal = totalDefects - vendorTotal;

  const byProduct = new Map<string, number>();
  for (const item of items) {
    const key = `${item.product.compoundId} — ${item.product.name}`;
    byProduct.set(key, (byProduct.get(key) ?? 0) + item.quantity);
  }
  const topProduct = Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Defects Report</h1>
          <p className="mt-1 text-slate-500">Latest defect items and fault distribution.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric title="Total Defects" value={String(totalDefects)} />
          <Metric title="Vendor Fault" value={String(vendorTotal)} />
          <Metric title="Internal Fault" value={String(internalTotal)} />
          <Metric title="Top Product" value={topProduct} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Report#</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Fault Type</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Machine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.defectReport.reportNumber}</td>
                    <td className="px-4 py-3">{item.defectReport.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">{item.product.compoundId} — {item.product.name}</td>
                    <td className="px-4 py-3">{item.reason.name}</td>
                    <td className="px-4 py-3">{item.faultType}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.defectReport.machine?.name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
