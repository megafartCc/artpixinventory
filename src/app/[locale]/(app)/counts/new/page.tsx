import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCounts } from "@/lib/permissions";
import { CountSessionFormClient } from "@/components/counts/CountSessionFormClient";

export default async function NewCountPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageCounts(session.user.role)) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          You need manager permissions to create count sessions.
        </div>
      </div>
    );
  }

  const [locations, users] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <CountSessionFormClient
      locale={params.locale}
      locations={locations}
      users={users}
    />
  );
}
