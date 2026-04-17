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
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${params.locale}/machines`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              ← Back to Machines
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{machine.name}</h1>
            <p className="mt-1 text-slate-500">
              Assigned to {machine.location.name} • ERPIX ID {machine.erpixMachineId || "not set"}
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              machine.type === "STN"
                ? "bg-blue-100 text-blue-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {machine.type}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Machine Info</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sublocation
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-900">
                  {machine.location.name}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location Type
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-900">
                  {machine.location.type}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Active
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-900">
                  {machine.active ? "Yes" : "No"}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ERPIX Machine ID
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-900">
                  {machine.erpixMachineId || "Not configured"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {machine.notes || "No machine notes yet."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Stock at Assigned Sublocation
            </h2>
            {stockLevels.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                No stock is currently tracked at this station.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Compound ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {stockLevels.map((stockLevel) => (
                      <tr key={stockLevel.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {stockLevel.product.compoundId}
                        </td>
                        <td className="px-4 py-3">{stockLevel.product.name}</td>
                        <td className="px-4 py-3">{stockLevel.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Consumption History</h2>
            {machine.consumptions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No consumption history yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {machine.consumptions.map((consumption) => (
                  <li key={consumption.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    Qty {consumption.quantity} •{" "}
                    {new Date(consumption.consumedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Defect History</h2>
            {machine.defectReports.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No defect reports yet.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {machine.defectReports.map((report) => (
                  <li key={report.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {report.reportNumber} • {report.status}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
