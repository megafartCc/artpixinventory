import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function ReportsHubPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsHub" });
  const reportLinks = [
    { href: "stock-levels", title: t("cards.stock.title"), description: t("cards.stock.description") },
    { href: "po-aging", title: t("cards.poAging.title"), description: t("cards.poAging.description") },
    { href: "defects", title: t("cards.defects.title"), description: t("cards.defects.description") },
    { href: "production", title: t("cards.production.title"), description: t("cards.production.description") },
    { href: "qbo-export", title: t("cards.qbo.title"), description: t("cards.qbo.description") },
  ];
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {reportLinks.map((report) => (
            <Link
              key={report.href}
              href={`/${params.locale}/reports/${report.href}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
            >
              <h2 className="text-lg font-semibold text-slate-900">{report.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{report.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
