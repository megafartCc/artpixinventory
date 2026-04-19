import { unstable_noStore as noStore } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  noStore();

  const [
    pendingApprovals,
    pendingDefects,
    overduePos,
    syncFailures,
    recentNotifications,
    t,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.defectReport.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.purchaseOrder.count({
      where: {
        expectedDate: { not: null, lt: new Date() },
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
    }),
    prisma.notification.count({
      where: {
        type: "ERPIX_SYNC_FAILURE",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getTranslations({ locale: params.locale, namespace: "Notifications" }),
  ]);

  const notificationItems = [
    ...(pendingApprovals > 0
      ? [
          {
            id: "pending-approvals",
            title: t("pendingApprovals.title"),
            detail: t("pendingApprovals.detail", { count: pendingApprovals }),
            href: "/purchase-orders",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(pendingDefects > 0
      ? [
          {
            id: "pending-defects",
            title: t("pendingDefects.title"),
            detail: t("pendingDefects.detail", { count: pendingDefects }),
            href: "/defects/review",
            tone: "rose" as const,
          },
        ]
      : []),
    ...(overduePos > 0
      ? [
          {
            id: "overdue-pos",
            title: t("overduePos.title"),
            detail: t("overduePos.detail", { count: overduePos }),
            href: "/reports/po-aging",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(syncFailures > 0
      ? [
          {
            id: "sync-failures",
            title: t("syncFailures.title"),
            detail: t("syncFailures.detail", { count: syncFailures }),
            href: "/settings",
            tone: "rose" as const,
          },
        ]
      : []),
    ...recentNotifications.map((notification) => ({
      id: notification.id,
      title: notification.type.replaceAll("_", " "),
      detail: notification.message,
      href:
        notification.type === "PO_PENDING_APPROVAL"
          ? "/purchase-orders"
          : notification.type === "PRODUCTION_RESTOCK_NEEDED"
            ? "/production"
            : notification.type === "ERPIX_SYNC_FAILURE"
              ? "/settings"
              : notification.type === "DEFECT_REPORTED"
                ? "/defects"
                : "/",
      tone: notification.failCount > 0 ? ("rose" as const) : ("slate" as const),
    })),
  ].slice(0, 6);

  return (
    <AppShell locale={params.locale} notificationItems={notificationItems}>
      {children}
    </AppShell>
  );
}
