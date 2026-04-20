import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function summarizeDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return "-";
  }

  const entries = Object.entries(details as Record<string, unknown>)
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return false;
      }
      return !key.toLowerCase().endsWith("id");
    })
    .slice(0, 4)
    .map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" | ") : "-";
}

export default async function ActivityReportPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: {
    q?: string;
    action?: string;
    module?: string;
    userId?: string;
    from?: string;
    to?: string;
  };
}) {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const q = searchParams?.q?.trim() ?? "";
  const action = searchParams?.action?.trim() ?? "";
  const moduleType = searchParams?.module?.trim() ?? "";
  const userId = searchParams?.userId?.trim() ?? "";
  const from = searchParams?.from?.trim() ?? "";
  const to = searchParams?.to?.trim() ?? "";

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      createdAtFilter.gte = fromDate;
    }
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setDate(toDate.getDate() + 1);
      createdAtFilter.lte = toDate;
    }
  }

  const [logs, users, actions, modules] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { action: { contains: q, mode: "insensitive" } },
                { entityType: { contains: q, mode: "insensitive" } },
                { entityId: { contains: q, mode: "insensitive" } },
                {
                  user: {
                    OR: [
                      { name: { contains: q, mode: "insensitive" } },
                      { email: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
        ...(action ? { action } : {}),
        ...(moduleType ? { entityType: moduleType } : {}),
        ...(userId ? { userId } : {}),
        ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.activityLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.activityLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const filterBase = `/${params.locale}/reports/activity`;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Audit Log
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Activity browser</h1>
              <p className="mt-1 text-slate-500">
                Filter every tracked action by user, module, action, and date.
              </p>
            </div>
            <Link
              href={`/${params.locale}/reports`}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to reports
            </Link>
          </div>
        </div>

        <form className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-6" method="get">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Search
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Action, module, entity, or user"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Action
            </span>
            <select
              name="action"
              defaultValue={action}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            >
              <option value="">All</option>
              {actions.map((entry) => (
                <option key={entry.action} value={entry.action ?? ""}>
                  {entry.action}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Module
            </span>
            <select
              name="module"
              defaultValue={moduleType}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            >
              <option value="">All</option>
              {modules.map((entry) => (
                <option key={entry.entityType} value={entry.entityType ?? ""}>
                  {entry.entityType}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              User
            </span>
            <select
              name="userId"
              defaultValue={userId}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            >
              <option value="">All</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <div className="flex items-end gap-3 lg:col-span-6">
            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply filters
            </button>
            <Link
              href={filterBase}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Time</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Module</th>
                  <th className="px-5 py-4">Entity</th>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-20 text-center text-slate-400">
                      No matching activity found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {log.action}
                      </td>
                      <td className="px-5 py-4">{log.entityType}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{log.entityId}</span>
                          {log.entityType === "PurchaseOrder" && (
                            <span className="text-xs text-slate-400">PO activity</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{log.user?.name ?? "-"}</span>
                          <span className="text-xs text-slate-400">{log.user?.role ?? ""}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {summarizeDetails(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
