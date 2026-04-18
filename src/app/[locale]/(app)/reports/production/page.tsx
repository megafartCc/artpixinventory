import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/CsvExportButton";

export default async function ProductionDailyReportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsProduction" });

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

  const csvHeaders = [
    t("columns.time"),
    t("columns.machine"),
    t("columns.product"),
    t("columns.qty"),
    t("columns.operator"),
  ];

  const csvRows = consumptions.map((entry) => [
    entry.consumedAt.toISOString().slice(11, 16),
    entry.machine.name,
    entry.product.compoundId,
    entry.quantity,
    entry.operatorName ?? "-",
  ]);

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("date")}: {start.toISOString().slice(0, 10)}</p>
          </div>
          <CsvExportButton
            filename={`production-${start.toISOString().slice(0, 10)}.csv`}
            headers={csvHeaders}
            rows={csvRows}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title={t("metrics.totalConsumed")} value={String(totalConsumed)} />
          <Metric title={t("metrics.totalDefective")} value={String(totalDefective)} />
          <Metric title={t("metrics.defectRate")} value={defectRate} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.time")}</th>
                  <th className="px-4 py-3">{t("columns.machine")}</th>
                  <th className="px-4 py-3">{t("columns.product")}</th>
                  <th className="px-4 py-3">{t("columns.qty")}</th>
                  <th className="px-4 py-3">{t("columns.operator")}</th>
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
