import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";

export default async function DashboardPage() {
  noStore();

  const [
    totalProducts,
    allStockRows,
    openPoCount,
    pendingDefects,
    overduePos,
    wrongLocationEvents,
    recentActivity,
    activeCounts,
    activeTransfers,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.stockLevel.findMany({
      where: { product: { active: true } },
      include: {
        product: { select: { compoundId: true, name: true, minStock: true } },
        location: { select: { name: true } },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
    }),
    prisma.defectReport.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.purchaseOrder.findMany({
      where: {
        expectedDate: { not: null, lt: new Date() },
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: { expectedDate: "asc" },
      take: 8,
    }),
    prisma.machineConsumption.findMany({
      where: { isCorrectLocation: false },
      include: {
        machine: { select: { name: true } },
        product: { select: { compoundId: true } },
      },
      orderBy: { consumedAt: "desc" },
      take: 8,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
      take: 20,
    }),
    prisma.countSession.count({ where: { status: { in: ["IN_PROGRESS", "SUBMITTED", "REVIEWING"] } } }),
    prisma.transfer.count({ where: { status: { in: ["COLLECTING", "DROPPING"] } } }),
  ]);

  const lowStockAlerts = allStockRows
    .filter((row) => row.quantity <= row.product.minStock)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-500">Operational summary and active alerts.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Products" value={String(totalProducts)} />
          <StatCard title="Low Stock Alerts" value={String(lowStockAlerts.length)} />
          <StatCard title="Open POs" value={String(openPoCount)} />
          <StatCard title="Pending Defects" value={String(pendingDefects)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <AlertCard title="Low stock items">
            {lowStockAlerts.length === 0 ? (
              <p className="text-sm text-slate-400">No low stock alerts.</p>
            ) : (
              lowStockAlerts.map((row) => (
                <p key={row.id} className="text-sm text-slate-700">
                  {row.product.compoundId} @ {row.location.name}: {row.quantity} (min {row.product.minStock})
                </p>
              ))
            )}
          </AlertCard>

          <AlertCard title="Overdue purchase orders">
            {overduePos.length === 0 ? (
              <p className="text-sm text-slate-400">No overdue POs.</p>
            ) : (
              overduePos.map((po) => (
                <p key={po.id} className="text-sm text-slate-700">
                  {po.poNumber} — {po.vendor.name} (expected {po.expectedDate?.toISOString().slice(0, 10)})
                </p>
              ))
            )}
          </AlertCard>

          <AlertCard title="Wrong-location events">
            {wrongLocationEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No recent wrong-location events.</p>
            ) : (
              wrongLocationEvents.map((event) => (
                <p key={event.id} className="text-sm text-slate-700">
                  {event.machine.name}: {event.product.compoundId} qty {event.quantity}
                </p>
              ))
            )}
          </AlertCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <div className="mt-3 space-y-2">
              {recentActivity.map((entry) => (
                <p key={entry.id} className="text-sm text-slate-700">
                  <span className="font-medium">{entry.action}</span> — {entry.entityType} by {entry.user?.name ?? "System"} at {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Active Operations</h2>
            <p className="mt-3 text-sm text-slate-700">Active count sessions: {activeCounts}</p>
            <p className="mt-1 text-sm text-slate-700">Active transfers: {activeTransfers}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AlertCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}
