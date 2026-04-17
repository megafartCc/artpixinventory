import { getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { LocationManager } from "@/components/locations/LocationManager";

export default async function LocationsPage() {
  noStore(); // Avoid caching to ensure tree updates instantly on nav
  const t = await getTranslations("Navigation");
  
  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("locations")}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Map out your physical warehouse hierarchy with native identity tags.
          </p>
        </div>
      </div>

      <LocationManager locations={locations} />
    </div>
  );
}
