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
    },
    {
      compoundId: "3CRM",
      name: "3D Crystal Medium Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
    },
    {
      compoundId: "3CRL",
      name: "3D Crystal Large Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
    },
    {
      compoundId: "3CRXL",
      name: "3D Crystal XL Rectangle",
      indexName: "3D Crystals",
      categories: [crystals.id, rectangles.id],
    },
    {
      compoundId: "3CHS",
      name: "3D Crystal Small Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
    },
    {
      compoundId: "3CHM",
      name: "3D Crystal Medium Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
    },
    {
      compoundId: "3CHL",
      name: "3D Crystal Large Heart",
      indexName: "3D Crystals",
      categories: [crystals.id, hearts.id],
    },
    {
      compoundId: "3CDS",
      name: "Crystal Dome Small",
      indexName: "2D Crystals",
      categories: [crystals.id],
    },
    {
      compoundId: "3CDM",
      name: "Crystal Dome Medium",
      indexName: "2D Crystals",
      categories: [crystals.id],
    },
    {
      compoundId: "3CIM",
      name: "LED Light Base Medium",
      indexName: "Light Bases",
      categories: [accessories.id],
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
        active: true,
      },
      create: {
        compoundId: seed.compoundId,
        name: seed.name,
        indexId: index.id,
        uom: "pcs",
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
