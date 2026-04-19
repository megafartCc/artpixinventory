import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";

export default async function QboExportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsQbo" });

  const adjustments = await prisma.stockAdjustment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { compoundId: true, name: true } },
      location: { select: { name: true } },
    },
    take: 200,
  });

  const csvHeader = "date,compound_id,product,location,reason,previous_qty,new_qty";
  const csvRows = adjustments.map((row) =>
    [
      row.createdAt.toISOString(),
      row.product.compoundId,
      row.product.name,
      row.location.name,
      row.reason,
      row.previousQty,
      row.newQty,
    ]
      .map((value) => `\"${String(value).replaceAll('"', '""')}\"`)
      .join(",")
  );

  const csvPreview = [csvHeader, ...csvRows].join("\n");

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{t("copyHint")}</p>
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{csvPreview}</pre>
        </div>
      </div>
    </div>
  );
}
