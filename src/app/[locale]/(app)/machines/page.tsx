import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { MachinesClient } from "@/components/machines/MachinesClient";
import {
  collectDescendantIds,
  flattenLocationsForSelect,
} from "@/lib/location-utils";

export default async function MachinesPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const [machines, locations] = await Promise.all([
    prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: {
        location: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true, type: true },
    }),
  ]);

  const flattenedLocations = flattenLocationsForSelect(locations);
  const productionRootIds = locations
    .filter((location) => location.type === "PRODUCTION")
    .map((location) => location.id);
  const allowedLocationIds = new Set<string>(productionRootIds);

  for (const rootId of productionRootIds) {
    for (const descendantId of Array.from(
      collectDescendantIds(locations, rootId)
    )) {
      allowedLocationIds.add(descendantId);
    }
  }

  return (
    <MachinesClient
      locale={params.locale}
      initialMachines={machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        type: machine.type,
        erpixMachineId: machine.erpixMachineId,
        active: machine.active,
        notes: machine.notes,
        locationId: machine.location.id,
        locationName: machine.location.name,
      }))}
      locationOptions={flattenedLocations
        .filter((location) => allowedLocationIds.has(location.id))
        .map((location) => ({
          id: location.id,
          label: location.label,
          type: location.type,
        }))}
    />
  );
}
