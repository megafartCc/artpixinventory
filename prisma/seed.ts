import {
  PrismaClient,
  UserRole,
  LocationType,
  MachineType,
} from "@prisma/client";

const prisma = new PrismaClient();

function buildQrCode(name: string) {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `LOC-${compact.slice(0, 8) || "LOC"}`;
}

async function ensureLocation(input: {
  name: string;
  type: LocationType;
  parentId?: string | null;
  description?: string;
}) {
  const existing = await prisma.location.findFirst({
    where: {
      name: input.name,
      parentId: input.parentId ?? null,
    },
  });

  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: {
        type: input.type,
        description: input.description,
        active: true,
        qrCode: existing.qrCode ?? buildQrCode(input.name),
      },
    });
  }

  return prisma.location.create({
    data: {
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      description: input.description,
      active: true,
      qrCode: buildQrCode(input.name),
    },
  });
}

async function main() {
  console.log("Seeding database...");

  const users = [
    { email: "admin@artpix3d.com", name: "Admin User", role: UserRole.ADMIN },
    {
      email: "manager@artpix3d.com",
      name: "Manager User",
      role: UserRole.MANAGER,
    },
    {
      email: "purchasing@artpix3d.com",
      name: "Purchasing User",
      role: UserRole.PURCHASER,
    },
    {
      email: "warehouse@artpix3d.com",
      name: "Warehouse User",
      role: UserRole.WAREHOUSE,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        active: true,
      },
      create: user,
    });
  }

  const indexNames = [
    "3D Crystals",
    "2D Crystals",
    "Light Bases",
    "Glass Ornaments",
    "Metal Ornaments",
  ];

  const indexes = await Promise.all(
    indexNames.map((name) =>
      prisma.productIndex.upsert({
        where: { name },
        update: { active: true },
        create: { name, active: true },
      })
    )
  );
  const indexByName = new Map(indexes.map((index) => [index.name, index]));

  const containerTemplateSeeds = [
    {
      name: "20ft Container",
      maxWeightKg: "18000",
      maxPallets: 10,
      maxLooseBoxes: 80,
      description: "Standard 20-foot container capacity preset.",
    },
    {
      name: "40ft Container",
      maxWeightKg: "20000",
      maxPallets: 21,
      maxLooseBoxes: 189,
      description: "Standard 40-foot container capacity preset.",
    },
    {
      name: "40ft HC",
      maxWeightKg: "20000",
      maxPallets: 24,
      maxLooseBoxes: 220,
      description: "40-foot high-cube container capacity preset.",
    },
  ];

  for (const template of containerTemplateSeeds) {
    await prisma.containerTemplate.upsert({
      where: { name: template.name },
      update: {
        maxWeightKg: template.maxWeightKg,
        maxPallets: template.maxPallets,
        maxLooseBoxes: template.maxLooseBoxes,
        description: template.description,
        active: true,
      },
      create: {
        name: template.name,
        maxWeightKg: template.maxWeightKg,
        maxPallets: template.maxPallets,
        maxLooseBoxes: template.maxLooseBoxes,
        description: template.description,
        active: true,
      },
    });
  }

  const mainWarehouse = await ensureLocation({
    name: "Main Warehouse",
    type: LocationType.WAREHOUSE,
  });
  const receiving = await ensureLocation({
    name: "Receiving Area",
    type: LocationType.RECEIVING,
    parentId: mainWarehouse.id,
  });
  const zoneA = await ensureLocation({
    name: "Zone A-Crystals",
    type: LocationType.ZONE,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Shelf A1",
    type: LocationType.SHELF,
    parentId: zoneA.id,
  });
  await ensureLocation({
    name: "Shelf A2",
    type: LocationType.SHELF,
    parentId: zoneA.id,
  });
  await ensureLocation({
    name: "Shelf A3",
    type: LocationType.SHELF,
    parentId: zoneA.id,
  });

  const zoneB = await ensureLocation({
    name: "Zone B-Accessories",
    type: LocationType.ZONE,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Shelf B1",
    type: LocationType.SHELF,
    parentId: zoneB.id,
  });
  await ensureLocation({
    name: "Shelf B2",
    type: LocationType.SHELF,
    parentId: zoneB.id,
  });

  await ensureLocation({
    name: "Zone C-Light Bases",
    type: LocationType.ZONE,
    parentId: mainWarehouse.id,
  });
  const productionFloor = await ensureLocation({
    name: "Production Floor",
    type: LocationType.PRODUCTION,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Shipping Area",
    type: LocationType.SHIPPING,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Quarantine",
    type: LocationType.QUARANTINE,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Defective Tote",
    type: LocationType.DEFECTIVE,
    parentId: mainWarehouse.id,
  });
  await ensureLocation({
    name: "Overflow Storage",
    type: LocationType.OTHER,
    parentId: mainWarehouse.id,
  });

  await prisma.location.updateMany({
    where: {
      parentId: productionFloor.id,
      name: { in: ["STN Station", "Vitro Station"] },
    },
    data: { active: false },
  });

  const machineDefinitions = [
    ...Array.from({ length: 33 }, (_, index) => ({
      name: `STN-${String(index + 1).padStart(2, "0")}`,
      type: MachineType.STN,
    })),
    ...Array.from({ length: 11 }, (_, index) => ({
      name: `Vitro-${String(index + 1).padStart(2, "0")}`,
      type: MachineType.VITRO,
    })),
  ];

  for (const machine of machineDefinitions) {
    const station = await ensureLocation({
      name: `${machine.name} Station`,
      type: LocationType.PRODUCTION,
      parentId: productionFloor.id,
    });

    await prisma.machine.upsert({
      where: { name: machine.name },
      update: {
        type: machine.type,
        locationId: station.id,
        erpixMachineId: machine.name,
        active: true,
      },
      create: {
        name: machine.name,
        type: machine.type,
        locationId: station.id,
        erpixMachineId: machine.name,
        active: true,
      },
    });
  }

  const crystals = await prisma.category.upsert({
    where: { name: "Crystals" },
    update: { active: true },
    create: { name: "Crystals", active: true },
  });
  const hearts = await prisma.category.upsert({
    where: { name: "Hearts" },
    update: { parentId: crystals.id, active: true },
    create: { name: "Hearts", parentId: crystals.id, active: true },
  });
  const rectangles = await prisma.category.upsert({
    where: { name: "Rectangles" },
    update: { parentId: crystals.id, active: true },
    create: { name: "Rectangles", parentId: crystals.id, active: true },
  });
  const accessories = await prisma.category.upsert({
    where: { name: "Accessories" },
    update: { active: true },
    create: { name: "Accessories", active: true },
  });

  const productSeeds = [
    {
      compoundId: "3CRS",
      name: "3D Crystal Small Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
      avgCost: "9.50",
      itemsPerBox: 12,
      boxesPerPallet: 48,
      itemWeight: "1.10",
    },
    {
      compoundId: "3CRM",
      name: "3D Crystal Medium Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
      avgCost: "12.75",
      itemsPerBox: 10,
      boxesPerPallet: 42,
      itemWeight: "1.35",
    },
    {
      compoundId: "3CRL",
      name: "3D Crystal Large Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
      avgCost: "16.90",
      itemsPerBox: 8,
      boxesPerPallet: 36,
      itemWeight: "1.80",
    },
    {
      compoundId: "3CRXL",
      name: "3D Crystal XL Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
      avgCost: "22.40",
      itemsPerBox: 6,
      boxesPerPallet: 30,
      itemWeight: "2.40",
    },
    {
      compoundId: "3CHS",
      name: "3D Crystal Small Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
      avgCost: "10.10",
      itemsPerBox: 12,
      boxesPerPallet: 48,
      itemWeight: "1.05",
    },
    {
      compoundId: "3CHM",
      name: "3D Crystal Medium Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
      avgCost: "13.95",
      itemsPerBox: 10,
      boxesPerPallet: 42,
      itemWeight: "1.45",
    },
    {
      compoundId: "3CHL",
      name: "3D Crystal Large Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
      avgCost: "18.75",
      itemsPerBox: 8,
      boxesPerPallet: 36,
      itemWeight: "1.95",
    },
    {
      compoundId: "3CDS",
      name: "Crystal Dome Small",
      indexName: "2D Crystals",
      categories: [crystals.id],
      avgCost: "8.80",
      itemsPerBox: 16,
      boxesPerPallet: 54,
      itemWeight: "0.90",
    },
    {
      compoundId: "3CDM",
      name: "Crystal Dome Medium",
      indexName: "2D Crystals",
      categories: [crystals.id],
      avgCost: "11.60",
      itemsPerBox: 12,
      boxesPerPallet: 48,
      itemWeight: "1.20",
    },
    {
      compoundId: "3CIM",
      name: "LED Light Base Medium",
      indexName: "Light Bases",
      categories: [accessories.id],
      avgCost: "14.50",
      itemsPerBox: 8,
      boxesPerPallet: 36,
      itemWeight: "1.80",
    },
  ];

  for (const seed of productSeeds) {
    const index = indexByName.get(seed.indexName);
    if (!index) {
      continue;
    }

    const product = await prisma.product.upsert({
      where: { compoundId: seed.compoundId },
      update: {
        name: seed.name,
        indexId: index.id,
        uom: "pcs",
        avgCost: seed.avgCost,
        itemsPerBox: seed.itemsPerBox,
        boxesPerPallet: seed.boxesPerPallet,
        weight: seed.itemWeight,
        itemWeight: seed.itemWeight,
        weightUnit: "lb",
        active: true,
      },
      create: {
        compoundId: seed.compoundId,
        name: seed.name,
        indexId: index.id,
        uom: "pcs",
        avgCost: seed.avgCost,
        itemsPerBox: seed.itemsPerBox,
        boxesPerPallet: seed.boxesPerPallet,
        weight: seed.itemWeight,
        itemWeight: seed.itemWeight,
        weightUnit: "lb",
        active: true,
      },
    });

    await prisma.productCategory.deleteMany({
      where: { productId: product.id },
    });
    await prisma.productCategory.createMany({
      data: seed.categories.map((categoryId) => ({
        productId: product.id,
        categoryId,
      })),
      skipDuplicates: true,
    });
  }

  const [shelfA1, shelfA2, shelfA3, shelfB1, shelfB2] = await Promise.all([
    prisma.location.findFirst({
      where: { name: "Shelf A1", parentId: zoneA.id },
      select: { id: true },
    }),
    prisma.location.findFirst({
      where: { name: "Shelf A2", parentId: zoneA.id },
      select: { id: true },
    }),
    prisma.location.findFirst({
      where: { name: "Shelf A3", parentId: zoneA.id },
      select: { id: true },
    }),
    prisma.location.findFirst({
      where: { name: "Shelf B1", parentId: zoneB.id },
      select: { id: true },
    }),
    prisma.location.findFirst({
      where: { name: "Shelf B2", parentId: zoneB.id },
      select: { id: true },
    }),
  ]);

  const products = await prisma.product.findMany({
    where: {
      compoundId: {
        in: productSeeds.map((product) => product.compoundId),
      },
    },
    select: { id: true, compoundId: true },
  });
  const productByCompoundId = new Map(
    products.map((product) => [product.compoundId, product])
  );

  const [container20, container40] = await Promise.all([
    prisma.containerTemplate.findUnique({
      where: { name: "20ft Container" },
      select: { id: true },
    }),
    prisma.containerTemplate.findUnique({
      where: { name: "40ft Container" },
      select: { id: true },
    }),
  ]);

  const vendors = await Promise.all([
    prisma.vendor.upsert({
      where: { name: "Crystal Harbor Supply" },
      update: {
        contactName: "Alice Chen",
        email: "purchasing@crystalharbor.example",
        phone: "+86-21-5555-0140",
        address: "88 Harbor Industrial Rd, Shanghai",
        country: "China",
        paymentTerms: "Net 30",
        defaultLeadTimeDays: 28,
        enableContainerConstraints: true,
        containerTemplateId: container40?.id ?? null,
        notes: "Primary crystal vendor for container imports.",
        active: true,
      },
      create: {
        name: "Crystal Harbor Supply",
        contactName: "Alice Chen",
        email: "purchasing@crystalharbor.example",
        phone: "+86-21-5555-0140",
        address: "88 Harbor Industrial Rd, Shanghai",
        country: "China",
        paymentTerms: "Net 30",
        defaultLeadTimeDays: 28,
        enableContainerConstraints: true,
        containerTemplateId: container40?.id ?? null,
        notes: "Primary crystal vendor for container imports.",
        active: true,
      },
    }),
    prisma.vendor.upsert({
      where: { name: "Bright Base Manufacturing" },
      update: {
        contactName: "Marco Silva",
        email: "sales@brightbase.example",
        phone: "+1-480-555-0108",
        address: "1207 Mesa Commerce Pkwy, Phoenix, AZ",
        country: "USA",
        paymentTerms: "Net 15",
        defaultLeadTimeDays: 10,
        enableContainerConstraints: true,
        containerTemplateId: container20?.id ?? null,
        notes: "Domestic source for light bases and accessories.",
        active: true,
      },
      create: {
        name: "Bright Base Manufacturing",
        contactName: "Marco Silva",
        email: "sales@brightbase.example",
        phone: "+1-480-555-0108",
        address: "1207 Mesa Commerce Pkwy, Phoenix, AZ",
        country: "USA",
        paymentTerms: "Net 15",
        defaultLeadTimeDays: 10,
        enableContainerConstraints: true,
        containerTemplateId: container20?.id ?? null,
        notes: "Domestic source for light bases and accessories.",
        active: true,
      },
    }),
  ]);

  const vendorByName = new Map(vendors.map((vendor) => [vendor.name, vendor]));

  const vendorMappings = [
    ["Crystal Harbor Supply", "3CRS", true, 48, "9.50", 28, "CHS-3CRS"],
    ["Crystal Harbor Supply", "3CRM", true, 42, "12.75", 28, "CHS-3CRM"],
    ["Crystal Harbor Supply", "3CRL", true, 36, "16.90", 28, "CHS-3CRL"],
    ["Crystal Harbor Supply", "3CRXL", true, 30, "22.40", 28, "CHS-3CRXL"],
    ["Crystal Harbor Supply", "3CHS", true, 48, "10.10", 28, "CHS-3CHS"],
    ["Crystal Harbor Supply", "3CHM", true, 42, "13.95", 28, "CHS-3CHM"],
    ["Crystal Harbor Supply", "3CHL", true, 36, "18.75", 28, "CHS-3CHL"],
    ["Crystal Harbor Supply", "3CDS", true, 54, "8.80", 28, "CHS-3CDS"],
    ["Crystal Harbor Supply", "3CDM", true, 48, "11.60", 28, "CHS-3CDM"],
    ["Bright Base Manufacturing", "3CIM", true, 36, "14.50", 10, "BBM-3CIM"],
  ] as const;

  for (const mapping of vendorMappings) {
    const vendor = vendorByName.get(mapping[0]);
    const product = productByCompoundId.get(mapping[1]);

    if (!vendor?.id || !product?.id) {
      continue;
    }

    await prisma.productVendor.upsert({
      where: {
        productId_vendorId: {
          productId: product.id,
          vendorId: vendor.id,
        },
      },
      update: {
        isDefault: mapping[2],
        moq: mapping[3],
        unitCost: mapping[4],
        leadTimeDays: mapping[5],
        vendorSku: mapping[6],
      },
      create: {
        productId: product.id,
        vendorId: vendor.id,
        isDefault: mapping[2],
        moq: mapping[3],
        unitCost: mapping[4],
        leadTimeDays: mapping[5],
        vendorSku: mapping[6],
      },
    });
  }

  const purchasingUser = await prisma.user.findUnique({
    where: { email: "purchasing@artpix3d.com" },
    select: { id: true },
  });

  const sampleVendor = vendorByName.get("Crystal Harbor Supply");
  const sampleProductSmall = productByCompoundId.get("3CRS");
  const sampleProductMedium = productByCompoundId.get("3CRM");

  if (
    purchasingUser?.id &&
    sampleVendor?.id &&
    sampleProductSmall?.id &&
    sampleProductMedium?.id
  ) {
    const samplePo = await prisma.purchaseOrder.upsert({
      where: { poNumber: "PO-DEMO-ORDERED-1" },
      update: {
        vendorId: sampleVendor.id,
        vendorOrderId: "CHS-APR-ORDER-1",
        status: "ORDERED",
        orderDate: new Date("2026-04-10T00:00:00.000Z"),
        expectedDate: new Date("2026-05-08T00:00:00.000Z"),
        containerTemplateId: sampleVendor.containerTemplateId,
        subtotal: "1983.00",
        shippingCost: "240.00",
        otherCosts: "60.00",
        totalCost: "2283.00",
        totalWeightKg: "99.34",
        totalPallets: 1,
        totalLooseBoxes: 8,
        constraintWarnings: [],
        notes: "Seeded ordered PO for receiving and pallet workflow tests.",
        createdById: purchasingUser.id,
        approvedById: purchasingUser.id,
        approvedAt: new Date("2026-04-11T00:00:00.000Z"),
      },
      create: {
        poNumber: "PO-DEMO-ORDERED-1",
        vendorId: sampleVendor.id,
        vendorOrderId: "CHS-APR-ORDER-1",
        status: "ORDERED",
        orderDate: new Date("2026-04-10T00:00:00.000Z"),
        expectedDate: new Date("2026-05-08T00:00:00.000Z"),
        containerTemplateId: sampleVendor.containerTemplateId,
        subtotal: "1983.00",
        shippingCost: "240.00",
        otherCosts: "60.00",
        totalCost: "2283.00",
        totalWeightKg: "99.34",
        totalPallets: 1,
        totalLooseBoxes: 8,
        constraintWarnings: [],
        notes: "Seeded ordered PO for receiving and pallet workflow tests.",
        createdById: purchasingUser.id,
        approvedById: purchasingUser.id,
        approvedAt: new Date("2026-04-11T00:00:00.000Z"),
      },
      select: { id: true },
    });

    await prisma.pOItem.deleteMany({
      where: { purchaseOrderId: samplePo.id },
    });

    await prisma.pOItem.createMany({
      data: [
        {
          purchaseOrderId: samplePo.id,
          productId: sampleProductSmall.id,
          orderedQty: 96,
          receivedQty: 0,
          unitCost: "9.50",
          totalCost: "912.00",
          notes: "Front-face crystal batch",
        },
        {
          purchaseOrderId: samplePo.id,
          productId: sampleProductMedium.id,
          orderedQty: 84,
          receivedQty: 0,
          unitCost: "12.75",
          totalCost: "1071.00",
          notes: "Mixed portrait assortment",
        },
      ],
      skipDuplicates: true,
    });
  }

  const stockSeedEntries = [
    { compoundId: "3CRS", locationId: shelfA1?.id, quantity: 100 },
    { compoundId: "3CRM", locationId: shelfA2?.id, quantity: 50 },
    { compoundId: "3CRL", locationId: shelfA3?.id, quantity: 30 },
    { compoundId: "3CHS", locationId: shelfA1?.id, quantity: 24 },
    { compoundId: "3CHM", locationId: shelfA2?.id, quantity: 18 },
    { compoundId: "3CIM", locationId: shelfB1?.id, quantity: 60 },
    { compoundId: "3CDM", locationId: shelfB2?.id, quantity: 15 },
  ];

  for (const entry of stockSeedEntries) {
    const product = productByCompoundId.get(entry.compoundId);
    if (!product?.id || !entry.locationId) {
      continue;
    }

    await prisma.stockLevel.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: entry.locationId,
        },
      },
      update: { quantity: entry.quantity },
      create: {
        productId: product.id,
        locationId: entry.locationId,
        quantity: entry.quantity,
      },
    });
  }

  await prisma.stockReservation.deleteMany({
    where: {
      erpixOrderId: {
        in: ["ERPIX-DEMO-RES-1", "ERPIX-DEMO-RES-2"],
      },
    },
  });

  const sampleReservations = [
    { compoundId: "3CRS", quantity: 8, erpixOrderId: "ERPIX-DEMO-RES-1" },
    { compoundId: "3CIM", quantity: 5, erpixOrderId: "ERPIX-DEMO-RES-2" },
  ];

  for (const reservation of sampleReservations) {
    const product = productByCompoundId.get(reservation.compoundId);
    if (!product?.id) {
      continue;
    }

    await prisma.stockReservation.create({
      data: {
        productId: product.id,
        quantity: reservation.quantity,
        erpixOrderId: reservation.erpixOrderId,
      },
    });
  }

  await prisma.setting.upsert({
    where: { key: "default_receiving_location" },
    update: { value: receiving.id },
    create: { key: "default_receiving_location", value: receiving.id },
  });
  await prisma.setting.upsert({
    where: { key: "po_number_prefix" },
    update: { value: "PO" },
    create: { key: "po_number_prefix", value: "PO" },
  });

  console.log("Seeding completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
