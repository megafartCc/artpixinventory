import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  FileText,
  Package,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivityPanel";
import { DefectsGraph } from "@/components/dashboard/DefectsGraph";
import prisma from "@/lib/prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}


function getLowStockSeverity(minStock: number, quantity: number) {
  if (quantity <= 0) return "critical";
  if (minStock > 0 && quantity <= Math.ceil(minStock * 0.5)) return "high";
  return "watch";
}

function daysOverdue(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "Dashboard" });
  const today = startOfToday();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    totalProducts,
    allStockRows,
    openPoCount,
    pendingApprovals,
    pendingDefects,
    overduePos,
    wrongLocationEvents,
    recentActivity,
    activeCounts,
    activeTransfers,
    todayReceipts,
    defectReports,
    mappedMachines,
    erpixFailures,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.stockLevel.findMany({
      where: { product: { active: true } },
      include: {
        product: { select: { id: true, compoundId: true, name: true, minStock: true } },
        location: { select: { id: true, name: true, qrCode: true } },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
    }),
    prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
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
    prisma.receivingItem.aggregate({
      where: { receivingSession: { completedAt: { gte: today } } },
      _sum: { receivedQty: true },
      _count: { id: true },
    }),
    prisma.defectReport.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.machine.count({ where: { erpixMachineId: { not: null } } }),
    prisma.notification.count({
      where: {
        type: "ERPIX_SYNC_FAILURE",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const defectData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const count = defectReports.filter(
      (def) => def.createdAt.toISOString().split("T")[0] === dateStr
    ).length;
    return { date: dateStr, count };
  }).reverse();

  const localeMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    ua: "uk-UA",
  };

  const dateFormatter = new Intl.DateTimeFormat(localeMap[params.locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dateTimeFormatter = new Intl.DateTimeFormat(localeMap[params.locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lowStockRows = allStockRows
    .filter((row) => row.quantity <= row.product.minStock)
    .sort((a, b) => a.quantity - b.quantity);
  const lowStockAlerts = lowStockRows.slice(0, 8);
  const lowStockSeverity = lowStockRows.reduce(
    (acc, row) => {
      acc[getLowStockSeverity(row.product.minStock, row.quantity)] += 1;
      return acc;
    },
    { critical: 0, high: 0, watch: 0 }
  );

  const poAgingBuckets = overduePos.reduce(
    (acc, po) => {
      if (!po.expectedDate) return acc;
      const overdueDays = daysOverdue(po.expectedDate);
      if (overdueDays <= 3) {
        acc.short += 1;
      } else if (overdueDays <= 7) {
        acc.medium += 1;
      } else {
        acc.long += 1;
      }
      return acc;
    },
    { short: 0, medium: 0, long: 0 }
  );

  const recentActivityItems = recentActivity.slice(0, 10);
  const todayReceiptQty = todayReceipts._sum.receivedQty ?? 0;
  const todayReceiptLines = todayReceipts._count.id;

  return (
    <div className="p-0">
      <div className="w-full space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-500 sm:text-lg">
              {t("description")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t("totalProducts")}
            value={String(totalProducts)}
            icon={Package}
            iconClassName="bg-slate-900 text-white"
          />
          <StatCard
            title={t("lowStock")}
            value={String(lowStockRows.length)}
            icon={Boxes}
            iconClassName="bg-amber-100 text-amber-700"
          />
          <StatCard
            title={t("openPos")}
            value={String(openPoCount)}
            icon={FileText}
            iconClassName="bg-sky-100 text-sky-700"
          />
          <StatCard
            title={t("pendingDefects")}
            value={String(pendingDefects)}
            icon={AlertTriangle}
            iconClassName="bg-rose-100 text-rose-700"
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <InsightCard
            title={t("lowStockSeverityTitle")}
            subtitle={t("lowStockSeveritySubtitle")}
            icon={ShieldAlert}
            iconClassName="bg-rose-100 text-rose-700"
            metrics={[
              { label: t("critical"), value: String(lowStockSeverity.critical) },
              { label: t("high"), value: String(lowStockSeverity.high) },
              { label: t("watch"), value: String(lowStockSeverity.watch) },
            ]}
          />
          <InsightCard
            title={t("overduePoAgingTitle")}
            subtitle={t("overduePoAgingSubtitle")}
            icon={ClipboardCheck}
            iconClassName="bg-amber-100 text-amber-700"
            metrics={[
              { label: t("days1to3"), value: String(poAgingBuckets.short) },
              { label: t("days4to7"), value: String(poAgingBuckets.medium) },
              { label: t("days8plus"), value: String(poAgingBuckets.long) },
            ]}
          />
          <InsightCard
            title={t("todayAndApprovalsTitle")}
            subtitle={t("todayAndApprovalsSubtitle")}
            icon={Truck}
            iconClassName="bg-emerald-100 text-emerald-700"
            metrics={[
              { label: t("receivedQty"), value: String(todayReceiptQty) },
              { label: t("receiptLines"), value: String(todayReceiptLines) },
              { label: t("pendingApprovals"), value: String(pendingApprovals) },
            ]}
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
          <DashboardPanel title={t("defectReasons")}>
            <DefectsGraph data={defectData} />
          </DashboardPanel>

          <section className="self-start rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("approvalsAndReceipts")}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ActiveMetricCard title={t("pendingApprovals")} value={String(pendingApprovals)} icon={ClipboardCheck} />
              <ActiveMetricCard title={t("todayReceipts")} value={String(todayReceiptQty)} icon={Truck} />
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                <SummaryRow label={t("openPos")} value={String(openPoCount)} />
                <SummaryRow label={t("pendingDefects")} value={String(pendingDefects)} />
                <SummaryRow label={t("overduePo")} value={String(overduePos.length)} />
                <SummaryRow label={t("wrongLocationEvents")} value={String(wrongLocationEvents.length)} />
              </div>
            </div>
          </section>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-3">
          <DashboardPanel title={t("lowStockItems")}>
            {lowStockAlerts.length === 0 ? (
              <EmptyState message={t("noLowStockAlerts")} />
            ) : (
              lowStockAlerts.map((row) => (
              <DashboardListItem
                key={row.id}
                title={`${row.product.compoundId} / ${row.location.name}`}
                detail={`${t("qty")} ${row.quantity} / ${t("min")} ${row.product.minStock}`}
                actionHref={
                  row.location.qrCode
                    ? `/${params.locale}/transfers/new?source=${encodeURIComponent(
                        row.location.qrCode
                      )}&product=${encodeURIComponent(row.product.id)}`
                    : undefined
                }
              />
            ))
          )}
          </DashboardPanel>

          <DashboardPanel title={t("overduePo")}>
            {overduePos.length === 0 ? (
              <EmptyState message={t("noOverduePo")} />
            ) : (
              overduePos.map((po) => (
                <DashboardListItem
                  key={po.id}
                  title={`${po.poNumber} / ${po.vendor.name}`}
                  detail={`${t("expected")} ${po.expectedDate ? dateFormatter.format(po.expectedDate) : "-"}`}
                />
              ))
            )}
          </DashboardPanel>

          <DashboardPanel title={t("wrongLocationEvents")}>
            {wrongLocationEvents.length === 0 ? (
              <EmptyState message={t("noWrongLocationEvents")} />
            ) : (
              wrongLocationEvents.map((event) => (
                <DashboardListItem
                  key={event.id}
                  title={`${event.machine.name} / ${event.product.compoundId}`}
                  detail={`${t("qty")} ${event.quantity}`}
                />
              ))
            )}
          </DashboardPanel>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
          <RecentActivityPanel
            title={t("recentActivity")}
            description={t("description")}
            searchPlaceholder={t("recentActivitySearch")}
            emptyMessage={t("noRecentActivityMatch")}
            items={recentActivityItems.map((entry) => ({
              id: entry.id,
              action: entry.action,
              entityType: entry.entityType,
              actor: `${t("by")} ${entry.user?.name ?? t("system")}`,
              timestamp: `${t("at")} ${dateTimeFormatter.format(entry.createdAt)}`,
            }))}
          />

          <section className="self-start rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("activeOps")}</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ActiveMetricCard
                title={t("activeCountSessions")}
                value={String(activeCounts)}
                icon={Boxes}
              />
              <ActiveMetricCard
                title={t("activeTransfers")}
                value={String(activeTransfers)}
                icon={ArrowLeftRight}
              />
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                <SummaryRow label={t("pendingApprovals")} value={String(pendingApprovals)} />
                <SummaryRow label={t("todayReceiptLines")} value={String(todayReceiptLines)} />
                <SummaryRow label={t("mappedMachines")} value={String(mappedMachines)} />
                <SummaryRow label={t("erpixFailures7d")} value={String(erpixFailures)} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconClassName: string;
}) {
  return (
    <div className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </p>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition group-hover:scale-110 ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:mt-8 sm:text-4xl">{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  subtitle,
  metrics,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string }>;
  icon: React.ElementType;
  iconClassName: string;
}) {
  return (
    <section className="self-start rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:mt-7 sm:grid-cols-3 sm:gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[22px] border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:mt-3 sm:text-3xl">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="self-start rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold text-slate-950 sm:text-xl">{title}</h2>
      <div className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">{children}</div>
    </section>
  );
}

function DashboardListItem({
  title,
  detail,
  actionHref,
}: {
  title: string;
  detail: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50/50 px-4 py-3.5 transition hover:bg-white hover:shadow-sm sm:px-6 sm:py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-950">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        {actionHref && (
          <Link
            href={actionHref}
            aria-label={`Transfer ${title}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function ActiveMetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50/50 p-5 transition hover:bg-white hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-bold text-slate-600">{title}</p>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-700 shadow-sm sm:h-12 sm:w-12">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:mt-8 sm:text-4xl">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-100 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900 sm:text-lg">{value}</p>
    </div>
  );
}
