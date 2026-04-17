import { unstable_noStore as noStore } from "next/cache";
import { LocationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DefectReportFormClient } from "@/components/defects/DefectReportFormClient";

export default async function NewDefectPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const [products, reasons, locations, machines, defectiveLocation] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ compoundId: "asc" }],
      select: { id: true, compoundId: true, name: true },
    }),
    prisma.defectReason.findMany({
      where: { active: true },
      orderBy: [{ faultType: "asc" }, { name: "asc" }],
      select: { id: true, name: true, faultType: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.machine.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, locationId: true },
    }),
    prisma.location.findFirst({
      where: { type: LocationType.DEFECTIVE, active: true },
      select: { id: true },
    }),
  ]);

  return (
    <DefectReportFormClient
      locale={params.locale}
      products={products}
      reasons={reasons.map((reason) => ({
        id: reason.id,
        name: reason.name,
        faultType: reason.faultType,
      }))}
      locations={locations}
      machines={machines}
      defaultDefectiveLocationId={defectiveLocation?.id ?? ""}
    />
  );
}
