import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { PurchaseOrderFormClient } from "@/components/purchase-orders/PurchaseOrderFormClient";

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const [purchaseOrder, vendors, templates] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        items: {
          orderBy: { productId: "asc" },
          select: {
            productId: true,
            orderedQty: true,
            unitCost: true,
            notes: true,
          },
        },
      },
    }),
    prisma.vendor.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        products: {
          orderBy: { product: { compoundId: "asc" } },
          include: {
            product: {
              select: {
                id: true,
                compoundId: true,
                name: true,
                uom: true,
                itemsPerBox: true,
                boxesPerPallet: true,
                weight: true,
                itemWeight: true,
                weightUnit: true,
              },
            },
          },
        },
      },
    }),
    prisma.containerTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        maxWeightKg: true,
        maxPallets: true,
        maxLooseBoxes: true,
      },
    }),
  ]);

  if (!purchaseOrder) {
    notFound();
  }

  if (!["DRAFT", "PENDING_APPROVAL"].includes(purchaseOrder.status)) {
    redirect(`/${params.locale}/purchase-orders/${purchaseOrder.id}`);
  }

  return (
    <PurchaseOrderFormClient
      locale={params.locale}
      mode="edit"
      purchaseOrderId={purchaseOrder.id}
      initialValue={{
        vendorId: purchaseOrder.vendorId,
        vendorOrderId: purchaseOrder.vendorOrderId ?? "",
        orderDate: purchaseOrder.orderDate.toISOString().slice(0, 10),
        leadTimeDays:
          purchaseOrder.expectedDate === null
            ? ""
            : String(
                Math.max(
                  0,
                  Math.round(
                    (purchaseOrder.expectedDate.getTime() -
                      purchaseOrder.orderDate.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              ),
        containerTemplateId: purchaseOrder.containerTemplateId ?? "",
        shippingCost: purchaseOrder.shippingCost.toString(),
        otherCosts: purchaseOrder.otherCosts.toString(),
        notes: purchaseOrder.notes ?? "",
        items: purchaseOrder.items.map((item) => ({
          productId: item.productId,
          orderedQty: String(item.orderedQty),
          unitCost: item.unitCost.toString(),
          notes: item.notes ?? "",
        })),
      }}
      vendors={vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        defaultLeadTimeDays: vendor.defaultLeadTimeDays,
        enableContainerConstraints: vendor.enableContainerConstraints,
        containerTemplateId: vendor.containerTemplateId,
        products: vendor.products.map((mapping) => ({
          productId: mapping.product.id,
          compoundId: mapping.product.compoundId,
          productName: mapping.product.name,
          unitCost: mapping.unitCost?.toString() ?? null,
          moq: mapping.moq,
          vendorSku: mapping.vendorSku,
          itemsPerBox: mapping.product.itemsPerBox,
          boxesPerPallet: mapping.product.boxesPerPallet,
          weight: mapping.product.weight?.toString() ?? null,
          itemWeight: mapping.product.itemWeight?.toString() ?? null,
          weightUnit: mapping.product.weightUnit,
          uom: mapping.product.uom,
        })),
      }))}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        maxWeightKg: Number(template.maxWeightKg),
        maxPallets: template.maxPallets,
        maxLooseBoxes: template.maxLooseBoxes,
      }))}
    />
  );
}
