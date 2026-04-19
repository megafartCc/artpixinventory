import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCounts } from "@/lib/permissions";
import { CountSessionsClient } from "@/components/counts/CountSessionsClient";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default async function CountsPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const session = await getServerSession(authOptions);
  const rows = await prisma.countSession.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      location: { select: { name: true } },
      assignedTo: { select: { name: true } },
      entries: { select: { variance: true } },
    },
  });

  return (
    <CountSessionsClient
      locale={params.locale}
      canCreate={canManageCounts(session?.user?.role)}
      rows={rows.map((row) => ({
        id: row.id,
        name: row.name,
        locationName: row.location.name,
        type: row.type,
        status: row.status,
        assignedToName: row.assignedTo?.name ?? null,
        startedAt: formatDate(row.startedAt),
        varianceCount: row.entries.filter((entry) => entry.variance !== 0).length,
      }))}
    />
  );
}
