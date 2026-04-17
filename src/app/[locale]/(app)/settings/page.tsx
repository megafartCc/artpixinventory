import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function SettingsPage() {
  noStore();

  const defectReasons = await prisma.defectReason.findMany({
    where: { active: true },
    orderBy: [{ faultType: "asc" }, { name: "asc" }],
    select: { id: true, name: true, faultType: true },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">System configuration and lookup tables.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Defect Reasons</h2>
          <p className="mt-1 text-sm text-slate-500">
            Synced/manual reasons used in Session 14 defect reporting and review.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Fault Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {defectReasons.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                      No active defect reasons found.
                    </td>
                  </tr>
                ) : (
                  defectReasons.map((reason) => (
                    <tr key={reason.id}>
                      <td className="px-4 py-3">{reason.name}</td>
                      <td className="px-4 py-3">{reason.faultType}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
