import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/CsvExportButton";

export default async function CreditsReportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "Credits" });
  const tReports = await getTranslations({ locale: params.locale, namespace: "ReportsHub" });

  const credits = await prisma.vendorCredit.findMany({
    include: {
      vendor: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const csvHeaders = [
    t("columns.credit"),
    t("vendor"),
    t("columns.po"),
    t("reason"),
    t("columns.total"),
    t("status"),
    t("columns.date"),
  ];

  const csvRows = credits.map((credit) => [
    credit.creditNumber,
    credit.vendor.name,
    credit.purchaseOrder?.poNumber ?? "-",
    credit.reason,
    credit.totalAmount.toString(),
    credit.status,
    credit.createdAt.toISOString().slice(0, 10),
  ]);

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          <CsvExportButton
            filename={`credits-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={csvHeaders}
            rows={csvRows}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.credit")}</th>
                  <th className="px-4 py-3">{t("vendor")}</th>
                  <th className="px-4 py-3">{t("columns.po")}</th>
                  <th className="px-4 py-3">{t("reason")}</th>
                  <th className="px-4 py-3">{t("columns.total")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3">{t("columns.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {credits.map((credit) => (
                  <tr key={credit.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{credit.creditNumber}</td>
                    <td className="px-4 py-3">{credit.vendor.name}</td>
                    <td className="px-4 py-3">{credit.purchaseOrder?.poNumber ?? "-"}</td>
                    <td className="px-4 py-3">{credit.reason}</td>
                    <td className="px-4 py-3">${credit.totalAmount.toString()}</td>
                    <td className="px-4 py-3">{credit.status}</td>
                    <td className="px-4 py-3">{credit.createdAt.toISOString().slice(0, 10)}</td>
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
