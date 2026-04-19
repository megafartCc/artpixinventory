import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function MachineDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const machine = await prisma.machine.findUnique({
    where: { id: params.id },
    include: {
      location: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      consumptions: {
        orderBy: { consumedAt: "desc" },
        take: 10,
      },
      defectReports: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!machine) {
    notFound();
  }

  const stockLevels = await prisma.stockLevel.findMany({
    where: { locationId: machine.locationId },
    include: {
      product: {
        select: { id: true, compoundId: true, name: true },
      },
    },
    orderBy: { product: { compoundId: "asc" } },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/${params.locale}/machines`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 group-hover:bg-indigo-50">
                ←
              </span>
              Back to Machines
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                {machine.name}
              </h1>
              <span
                className={`rounded-2xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
                  machine.type === "STN"
                    ? "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200"
                    : "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200"
                }`}
              >
                {machine.type}
              </span>
            </div>
            <p className="mt-3 text-lg text-slate-500">
              Assigned to <span className="font-semibold text-slate-900">{machine.location.name}</span> • <span className="text-sm">ERPIX ID {machine.erpixMachineId || "not set"}</span>
            </p>
          </div>
          
          <div className="flex gap-3">
            {/* Action buttons could go here */}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Machine Profile</h2>
            </div>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Sublocation
                </dt>
                <dd className="mt-2 text-lg font-bold text-slate-900">
                  {machine.location.name}
                </dd>
              </div>
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Location Type
                </dt>
                <dd className="mt-2 text-lg font-bold text-slate-900">
                  {machine.location.type}
                </dd>
              </div>
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Status
                </dt>
                <dd className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${machine.active ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-slate-300"}`} />
                  {machine.active ? "Active" : "Inactive"}
                </dd>
              </div>
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  System Identifier
                </dt>
                <dd className="mt-2 text-lg font-bold text-slate-900">
                  {machine.erpixMachineId || "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Engineering Notes
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {machine.notes || "No operational notes recorded for this unit."}
              </p>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Live Sublocation Inventory
            </h2>
            {stockLevels.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  📦
                </div>
                <p className="mt-4 text-sm font-medium text-slate-400">
                  This station currently holds no traceable stock.
                </p>
              </div>
            ) : (
              <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-6 py-4 text-center">ID</th>
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {stockLevels.map((stockLevel) => (
                      <tr key={stockLevel.id} className="transition hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-6 py-5 text-center font-mono text-xs font-bold text-slate-900">
                          <span className="rounded-lg bg-slate-100 px-2 py-1">{stockLevel.product.compoundId}</span>
                        </td>
                        <td className="px-6 py-5 font-medium">{stockLevel.product.name}</td>
                        <td className="px-6 py-5 text-right font-bold text-slate-900">{stockLevel.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Operational Timeline</h2>
            {machine.consumptions.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-400">No recent production activity.</p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {machine.consumptions.map((consumption) => (
                  <div key={consumption.id} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-slate-50/30 px-6 py-4 transition hover:border-slate-200 hover:bg-white">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        ↓
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Consumption Recorded</p>
                        <p className="text-xs text-slate-500">{new Date(consumption.consumedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-lg font-extrabold text-slate-900">{consumption.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Quality Incidents</h2>
            {machine.defectReports.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-400">No quality issues reported.</p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {machine.defectReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-slate-50/30 px-6 py-4 transition hover:border-slate-200 hover:bg-white">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                        !
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{report.reportNumber}</p>
                        <p className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {report.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
