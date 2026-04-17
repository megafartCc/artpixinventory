import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { DefectsClient } from "@/components/defects/DefectsClient";

export default async function DefectsPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const defects = await prisma.defectReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { name: true },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          faultType: true,
        },
      },
    },
  });

  const pendingCount = defects.filter((defect) => defect.status === "PENDING_REVIEW").length;

  return (
    <DefectsClient
      locale={params.locale}
      pendingCount={pendingCount}
      defects={defects.map((defect) => ({
        id: defect.id,
        reportNumber: defect.reportNumber,
        source: defect.source,
        status: defect.status,
        createdBy: defect.createdBy.name,
        createdAt: defect.createdAt.toISOString().slice(0, 16).replace("T", " "),
        itemCount: defect.items.length,
        totalQuantity: defect.items.reduce((total, item) => total + item.quantity, 0),
        faultSummary: defect.items.reduce(
          (summary, item) => {
            summary[item.faultType] = (summary[item.faultType] ?? 0) + item.quantity;
            return summary;
          },
          {} as Record<string, number>
        ),
      }))}
    />
  );
}
