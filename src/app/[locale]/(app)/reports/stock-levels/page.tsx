import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function StockLevelsReportPage() {
  noStore();

  const levels = await prisma.stockLevel.findMany({
    include: {
      product: {
        select: {
          compoundId: true,
          name: true,
          minStock: true,
          index: { select: { name: true } },
        },
      },
      location: { select: { name: true } },
    },
    orderBy: [{ product: { compoundId: "asc" } }, { location: { name: "asc" } }],
    take: 500,
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stock Levels Report</h1>
          <p className="mt-1 text-slate-500">Current stock snapshot (first 500 rows).</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Compound ID</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Index</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {levels.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">{entry.product.compoundId}</td>
                    <td className="px-4 py-3">{entry.product.name}</td>
                    <td className="px-4 py-3">{entry.product.index.name}</td>
                    <td className="px-4 py-3">{entry.location.name}</td>
                    <td className="px-4 py-3">{entry.quantity}</td>
                    <td className="px-4 py-3">{entry.product.minStock}</td>
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
