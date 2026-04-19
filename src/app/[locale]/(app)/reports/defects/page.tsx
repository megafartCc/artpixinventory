import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/CsvExportButton";
import { PdfExportButton } from "@/components/PdfExportButton";

export default async function DefectsReportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsDefects" });

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
  const topProduct = Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const csvHeaders = [
    t("columns.report"),
    t("columns.date"),
    t("columns.product"),
    t("columns.reason"),
    t("columns.faultType"),
    t("columns.qty"),
    t("columns.machine"),
  ];

  const csvRows = items.map((item) => [
    item.defectReport.reportNumber,
    item.defectReport.createdAt.toISOString().slice(0, 10),
    `${item.product.compoundId} — ${item.product.name}`,
    item.reason.name,
    item.faultType,
    item.quantity,
    item.defectReport.machine?.name ?? "-",
  ]);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          <div className="flex gap-3">
            <CsvExportButton
              filename={`defects-${new Date().toISOString().slice(0, 10)}.csv`}
              headers={csvHeaders}
              rows={csvRows}
            />
            <PdfExportButton
              filename={`defects-${new Date().toISOString().slice(0, 10)}.pdf`}
              title={t("title")}
              headers={csvHeaders}
              rows={csvRows}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric title={t("metrics.totalDefects")} value={String(totalDefects)} />
          <Metric title={t("metrics.vendorFault")} value={String(vendorTotal)} />
          <Metric title={t("metrics.internalFault")} value={String(internalTotal)} />
          <Metric title={t("metrics.topProduct")} value={topProduct} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.report")}</th>
                  <th className="px-4 py-3">{t("columns.date")}</th>
                  <th className="px-4 py-3">{t("columns.product")}</th>
                  <th className="px-4 py-3">{t("columns.reason")}</th>
                  <th className="px-4 py-3">{t("columns.faultType")}</th>
                  <th className="px-4 py-3">{t("columns.qty")}</th>
                  <th className="px-4 py-3">{t("columns.machine")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.defectReport.reportNumber}</td>
                    <td className="px-4 py-3">{item.defectReport.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">{item.product.compoundId} — {item.product.name}</td>
                    <td className="px-4 py-3">{item.reason.name}</td>
                    <td className="px-4 py-3">{t(`faultType.${item.faultType}` as "faultType.VENDOR")}</td>
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
