import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function ProductionDailyReportPage() {
  noStore();

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const consumptions = await prisma.machineConsumption.findMany({
    where: { consumedAt: { gte: start } },
    include: {
      machine: { select: { name: true } },
      product: { select: { compoundId: true } },
    },
    orderBy: { consumedAt: "desc" },
  });

  const defectReports = await prisma.defectReport.findMany({
    where: { createdAt: { gte: start } },
    include: { items: { select: { quantity: true } } },
  });

  const totalConsumed = consumptions.reduce((sum, row) => sum + row.quantity, 0);
  const totalDefective = defectReports.flatMap((report) => report.items).reduce((sum, item) => sum + item.quantity, 0);
  const defectRate = totalConsumed > 0 ? ((totalDefective / totalConsumed) * 100).toFixed(2) : "0.00";

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Production Daily Report</h1>
          <p className="mt-1 text-slate-500">Date: {start.toISOString().slice(0, 10)}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Total Consumed" value={String(totalConsumed)} />
          <Metric title="Total Defective" value={String(totalDefective)} />
          <Metric title="Defect Rate %" value={defectRate} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {consumptions.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">{entry.consumedAt.toISOString().slice(11, 16)}</td>
                    <td className="px-4 py-3">{entry.machine.name}</td>
                    <td className="px-4 py-3">{entry.product.compoundId}</td>
                    <td className="px-4 py-3">{entry.quantity}</td>
                    <td className="px-4 py-3">{entry.operatorName ?? "-"}</td>
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
