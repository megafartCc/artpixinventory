import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { DefectReviewClient } from "@/components/defects/DefectReviewClient";

export default async function DefectReviewPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const reports = await prisma.defectReport.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { name: true } },
      machine: { select: { name: true } },
      fromLocation: { select: { name: true } },
      items: {
        include: {
          product: { select: { compoundId: true, name: true } },
          reason: { select: { name: true } },
        },
      },
    },
  });

  return (
    <DefectReviewClient
      locale={params.locale}
      reports={reports.map((report) => ({
        id: report.id,
        reportNumber: report.reportNumber,
        source: report.source,
        createdBy: report.createdBy.name,
        createdAt: report.createdAt.toISOString().slice(0, 16).replace("T", " "),
        fromLocation: report.fromLocation?.name ?? "-",
        machineName: report.machine?.name ?? "",
        items: report.items.map((item) => ({
          id: item.id,
          productLabel: `${item.product.compoundId} — ${item.product.name}`,
          reason: item.reason.name,
          quantity: item.quantity,
          faultType: item.faultType,
        })),
      }))}
    />
  );
}
