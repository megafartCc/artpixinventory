"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function VendorCreditsClient({
  locale,
  credits,
}: {
  locale: string;
  credits: Array<{
    id: string;
    creditNumber: string;
    vendorName: string;
    poNumber: string;
    reason: string;
    totalAmount: string;
    status: string;
    createdAt: string;
  }>;
}) {
  const t = useTranslations("Credits");

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          <Link href={`/${locale}/credits/new`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">
            {t("new")}
          </Link>
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
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/${locale}/credits/${credit.id}`}>{credit.creditNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{credit.vendorName}</td>
                    <td className="px-4 py-3">{credit.poNumber}</td>
                    <td className="px-4 py-3">{credit.reason}</td>
                    <td className="px-4 py-3">${credit.totalAmount}</td>
                    <td className="px-4 py-3">{credit.status}</td>
                    <td className="px-4 py-3">{credit.createdAt}</td>
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
