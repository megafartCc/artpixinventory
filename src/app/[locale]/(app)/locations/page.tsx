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
    <div className="p-4 sm:p-6 lg:p-10 h-full flex flex-col">
      <div className="mx-auto w-full max-w-[1600px] flex flex-col flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">{t("locations")}</h1>
            <p className="text-slate-500 mt-2 text-lg">
              Map out your physical warehouse hierarchy with native identity tags.
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-1">
          <LocationManager locations={locations} />
        </div>
      </div>
    </div>
  );
}
