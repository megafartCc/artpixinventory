type PurchaseOrderProductInput = {
  id: string;
  compoundId: string;
  name: string;
  uom: string;
  itemsPerBox: number | null;
  boxesPerPallet: number | null;
  weight: string | number | null;
  itemWeight: string | number | null;
  weightUnit: string | null;
};

type PurchaseOrderItemInput = {
  productId: string;
  orderedQty: number;
  unitCost: number;
  notes: string | null;
  product: PurchaseOrderProductInput;
};

type ContainerTemplateInput = {
  id: string;
  name: string;
  maxWeightKg: number;
  maxPallets: number;
  maxLooseBoxes: number;
} | null;

export type PurchaseOrderCalculation = {
  subtotal: number;
  totalCost: number;
  totalWeightKg: number;
  totalPallets: number;
  totalLooseBoxes: number;
  constraintWarnings: string[];
  lineItems: Array<{
    productId: string;
    orderedQty: number;
    unitCost: number;
    totalCost: number;
    notes: string | null;
  }>;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: string | number | null) {
  if (value === null) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatPoStatus(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_APPROVAL":
      return "Pending Approval";
    case "APPROVED":
      return "Approved";
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Receiving";
    case "RECEIVED":
      return "Received";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function getPoStatusTone(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700";
    case "PENDING_APPROVAL":
      return "bg-amber-100 text-amber-700";
    case "APPROVED":
      return "bg-sky-100 text-sky-700";
    case "ORDERED":
      return "bg-indigo-100 text-indigo-700";
    case "PARTIALLY_RECEIVED":
      return "bg-violet-100 text-violet-700";
    case "RECEIVED":
    case "CLOSED":
      return "bg-emerald-100 text-emerald-700";
    case "CANCELLED":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function calculatePurchaseOrder(
  items: PurchaseOrderItemInput[],
  shippingCost: number,
  otherCosts: number,
  template: ContainerTemplateInput
): PurchaseOrderCalculation {
  let subtotal = 0;
  let totalWeightKg = 0;
  let fullPallets = 0;
  let looseBoxes = 0;

  const lineItems = items.map((item) => {
    const lineTotal = roundCurrency(item.orderedQty * item.unitCost);
    subtotal += lineTotal;

    const perItemWeight = toNumber(item.product.itemWeight) || toNumber(item.product.weight);
    const weightUnit = (item.product.weightUnit ?? "lb").toLowerCase();
    const unitWeightKg =
      weightUnit === "kg" ? perItemWeight : perItemWeight * 0.45359237;
    totalWeightKg += unitWeightKg * item.orderedQty;

    const itemsPerBox = item.product.itemsPerBox && item.product.itemsPerBox > 0
      ? item.product.itemsPerBox
      : 1;
    const boxesNeeded = Math.ceil(item.orderedQty / itemsPerBox);
    const boxesPerPallet = item.product.boxesPerPallet ?? 0;

    if (boxesPerPallet > 0) {
      fullPallets += Math.floor(boxesNeeded / boxesPerPallet);
      looseBoxes += boxesNeeded % boxesPerPallet;
    } else {
      looseBoxes += boxesNeeded;
    }

    return {
      productId: item.productId,
      orderedQty: item.orderedQty,
      unitCost: roundCurrency(item.unitCost),
      totalCost: lineTotal,
      notes: item.notes,
    };
  });

  let totalPallets = fullPallets;
  let totalLooseBoxes = looseBoxes;
  const warnings: string[] = [];

  if (template) {
    const looseBoxesPerSharedPallet =
      template.maxPallets > 0 && template.maxLooseBoxes > 0
        ? Math.max(1, Math.floor(template.maxLooseBoxes / template.maxPallets))
        : 0;

    if (looseBoxesPerSharedPallet > 0) {
      totalPallets += Math.floor(looseBoxes / looseBoxesPerSharedPallet);
      totalLooseBoxes = looseBoxes % looseBoxesPerSharedPallet;
    }

    if (roundMetric(totalWeightKg) > template.maxWeightKg) {
      warnings.push(
        `Weight exceeds ${template.name} capacity (${roundMetric(totalWeightKg)}/${template.maxWeightKg} kg).`
      );
    }

    if (totalPallets > template.maxPallets) {
      warnings.push(
        `Pallet count exceeds ${template.name} capacity (${totalPallets}/${template.maxPallets}).`
      );
    }

    if (totalLooseBoxes > template.maxLooseBoxes) {
      warnings.push(
        `Loose boxes exceed ${template.name} capacity (${totalLooseBoxes}/${template.maxLooseBoxes}).`
      );
    }
  }

  return {
    subtotal: roundCurrency(subtotal),
    totalCost: roundCurrency(subtotal + shippingCost + otherCosts),
    totalWeightKg: roundMetric(totalWeightKg),
    totalPallets,
    totalLooseBoxes,
    constraintWarnings: warnings,
    lineItems,
  };
}

export async function generateNextPoNumber(findLatest: (prefix: string) => Promise<string | null>) {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const latest = await findLatest(prefix);
  const nextSequence = latest
    ? Number.parseInt(latest.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(Number.isFinite(nextSequence) ? nextSequence : 1).padStart(4, "0")}`;
}
