import { unstable_noStore as noStore } from "next/cache";
import { POStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

function daysBetween(date: Date, from = new Date()) {
  return Math.floor((from.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function PoAgingReportPage() {
  noStore();

  const openPoStatuses: POStatus[] = ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"];

  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { in: openPoStatuses } },
    orderBy: { orderDate: "asc" },
  });

  const vendorIds = Array.from(new Set(orders.map((order) => order.vendorId)));
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  const rows = orders
    .map((order) => {
      const daysInStatus = daysBetween(order.updatedAt);
      const overdueDays = order.expectedDate ? Math.max(0, daysBetween(order.expectedDate)) : 0;
      return {
        id: order.id,
        poNumber: order.poNumber,
        vendorName: vendorById.get(order.vendorId) ?? order.vendorId,
        status: order.status,
        orderDate: order.orderDate.toISOString().slice(0, 10),
        expectedDate: order.expectedDate?.toISOString().slice(0, 10) ?? "-",
        daysInStatus,
        overdueDays,
      };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PO Aging Report</h1>
          <p className="mt-1 text-slate-500">Open purchase orders sorted by overdue days.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO#</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Expected Date</th>
                  <th className="px-4 py-3">Days In Status</th>
                  <th className="px-4 py-3">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.poNumber}</td>
                    <td className="px-4 py-3">{row.vendorName}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.orderDate}</td>
                    <td className="px-4 py-3">{row.expectedDate}</td>
                    <td className="px-4 py-3">{row.daysInStatus}</td>
                    <td className={`px-4 py-3 font-medium ${row.overdueDays > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {row.overdueDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
