import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ReceivingClient } from "@/components/receiving/ReceivingClient";

export default async function ReceivingPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const [vendors, recentSessions] = await Promise.all([
    prisma.vendor.findMany({
      where: {
        purchaseOrders: {
          some: {
            status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
          },
        },
      },
      orderBy: { name: "asc" },
      include: {
        purchaseOrders: {
          where: {
            status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
          },
          orderBy: { orderDate: "desc" },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    compoundId: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.receivingSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: {
        purchaseOrder: {
          select: { poNumber: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                compoundId: true,
                name: true,
              },
            },
          },
        },
        pallets: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    compoundId: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <ReceivingClient
      locale={params.locale}
      vendors={vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        purchaseOrders: vendor.purchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          orderDate: po.orderDate.toISOString().slice(0, 10),
          items: po.items.map((item) => ({
            poItemId: item.id,
            productId: item.productId,
            compoundId: item.product.compoundId,
            productName: item.product.name,
            orderedQty: item.orderedQty,
            receivedQty: item.receivedQty,
            remainingQty: item.orderedQty - item.receivedQty,
          })),
        })),
      }))}
      recentSessions={recentSessions.map((session) => ({
        id: session.id,
        poNumber: session.purchaseOrder.poNumber,
        startedAt: session.startedAt.toISOString().slice(0, 10),
        status: session.status,
        items: session.items.map((item) => ({
          productId: item.productId,
          compoundId: item.product.compoundId,
          productName: item.product.name,
          receivedQty: item.receivedQty,
          damagedQty: item.damagedQty,
        })),
        pallets: session.pallets.map((pallet) => ({
          id: pallet.id,
          palletNumber: pallet.palletNumber,
          status: pallet.status,
          items: pallet.items.map((item) => ({
            productId: item.productId,
            compoundId: item.product.compoundId,
            quantity: item.quantity,
          })),
        })),
      }))}
    />
  );
}
