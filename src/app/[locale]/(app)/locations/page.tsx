import { getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { LocationManager } from "@/components/locations/LocationManager";

export default async function LocationsPage() {
  noStore(); // Avoid caching to ensure tree updates instantly on nav
  const t = await getTranslations("Navigation");

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            {t("locations")}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-500 sm:text-lg">
            Map out your physical warehouse hierarchy with native identity tags.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white p-1 shadow-sm">
          <LocationManager locations={locations} />
        </div>
      </div>
    </div>
  );
}
