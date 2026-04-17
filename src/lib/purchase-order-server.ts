import { Prisma } from "@prisma/client";
import type { PurchaseOrderMutationInput } from "@/lib/purchase-order-schemas";
import {
  addDays,
  calculatePurchaseOrder,
  generateNextPoNumber,
} from "@/lib/purchase-order-utils";

type PrismaExecutor = Prisma.TransactionClient;

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function toNullableDecimal(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

export async function getTemplateForVendor(
  tx: PrismaExecutor,
  vendor: {
    enableContainerConstraints: boolean;
    containerTemplateId: string | null;
  },
  requestedTemplateId: string | null
) {
  if (!vendor.enableContainerConstraints) {
    return null;
  }

  const templateId = requestedTemplateId || vendor.containerTemplateId;
  if (!templateId) {
    return null;
  }

  return tx.containerTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      maxWeightKg: true,
      maxPallets: true,
      maxLooseBoxes: true,
    },
  });
}

export async function preparePurchaseOrderWrite(
  tx: PrismaExecutor,
  payload: PurchaseOrderMutationInput
) {
  const vendor = await tx.vendor.findUnique({
    where: { id: payload.vendorId },
    select: {
      id: true,
      name: true,
      defaultLeadTimeDays: true,
      enableContainerConstraints: true,
      containerTemplateId: true,
    },
  });

  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  const template = await getTemplateForVendor(
    tx,
    vendor,
    payload.containerTemplateId
  );

  if (payload.containerTemplateId && !template) {
    throw new Error("Selected container template was not found.");
  }

  const products = await tx.product.findMany({
    where: {
      id: {
        in: payload.items.map((item) => item.productId),
      },
    },
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
  });

  if (products.length !== payload.items.length) {
    throw new Error("One or more PO products were not found.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const itemsWithProducts = payload.items.map((item) => ({
    ...item,
    product: productMap.get(item.productId)!,
  }));

  const shippingCost = payload.shippingCost;
  const otherCosts = payload.otherCosts;

  const calculation = calculatePurchaseOrder(
    itemsWithProducts.map((item) => ({
      productId: item.productId,
      orderedQty: item.orderedQty,
      unitCost: item.unitCost,
      notes: item.notes,
      product: {
        ...item.product,
        weight: item.product.weight?.toString() ?? null,
        itemWeight: item.product.itemWeight?.toString() ?? null,
      },
    })),
    shippingCost,
    otherCosts,
    template
      ? {
          id: template.id,
          name: template.name,
          maxWeightKg: Number(template.maxWeightKg),
          maxPallets: template.maxPallets,
          maxLooseBoxes: template.maxLooseBoxes,
        }
      : null
  );

  const leadTimeDays = payload.leadTimeDays ?? vendor.defaultLeadTimeDays ?? 0;
  const orderDate = new Date(`${payload.orderDate}T00:00:00`);
  const expectedDate = addDays(orderDate, leadTimeDays);

  return {
    vendor,
    template,
    calculation,
    orderDate,
    expectedDate,
    leadTimeDays,
  };
}

export async function nextPoNumber(tx: PrismaExecutor) {
  return generateNextPoNumber(async (prefix) => {
    const latest = await tx.purchaseOrder.findFirst({
      where: { poNumber: { startsWith: prefix } },
      orderBy: { poNumber: "desc" },
      select: { poNumber: true },
    });

    return latest?.poNumber ?? null;
  });
}

export function mapPurchaseOrderWriteData(input: {
  payload: PurchaseOrderMutationInput;
  userId: string;
  status: "DRAFT" | "PENDING_APPROVAL";
  templateId: string | null;
  orderDate: Date;
  expectedDate: Date;
  calculation: ReturnType<typeof calculatePurchaseOrder>;
}) {
  return {
    vendorId: input.payload.vendorId,
    vendorOrderId: input.payload.vendorOrderId,
    status: input.status,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate,
    containerTemplateId: input.templateId,
    subtotal: toDecimal(input.calculation.subtotal),
    shippingCost: toDecimal(input.payload.shippingCost),
    otherCosts: toDecimal(input.payload.otherCosts),
    totalCost: toDecimal(input.calculation.totalCost),
    totalWeightKg: toNullableDecimal(input.calculation.totalWeightKg),
    totalPallets: input.calculation.totalPallets,
    totalLooseBoxes: input.calculation.totalLooseBoxes,
    constraintWarnings: input.calculation.constraintWarnings,
    notes: input.payload.notes,
    createdById: input.userId,
  };
}
