import { PrismaClient, UserRole, LocationType, MachineType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // Users
  await prisma.user.upsert({
    where: { email: 'admin@artpix3d.com' },
    update: {},
    create: { email: 'admin@artpix3d.com', name: 'Admin User', role: UserRole.ADMIN }
  });
  await prisma.user.upsert({
    where: { email: 'manager@artpix3d.com' },
    update: {},
    create: { email: 'manager@artpix3d.com', name: 'Manager User', role: UserRole.MANAGER }
  });
  await prisma.user.upsert({
    where: { email: 'purchasing@artpix3d.com' },
    update: {},
    create: { email: 'purchasing@artpix3d.com', name: 'Purchasing User', role: UserRole.PURCHASER }
  });
  await prisma.user.upsert({
    where: { email: 'warehouse@artpix3d.com' },
    update: {},
    create: { email: 'warehouse@artpix3d.com', name: 'Warehouse User', role: UserRole.WAREHOUSE }
  });

  // Indexes
  const indexes = ['3D Crystals', '2D Crystals', 'Light Bases', 'Glass Ornaments', 'Metal Ornaments'];
  const dbIndexes = [];
  for (const name of indexes) {
    const idx = await prisma.productIndex.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    dbIndexes.push(idx);
  }

  // Locations
  const mainWarehouse = await prisma.location.create({
    data: { name: 'Main Warehouse', type: LocationType.WAREHOUSE, qrCode: 'LOC-MW' }
  });

  const receiving = await prisma.location.create({
    data: { name: 'Receiving Area', type: LocationType.RECEIVING, parentId: mainWarehouse.id, qrCode: 'LOC-RECA' }
  });

  // Default Setting
  await prisma.setting.upsert({
    where: { key: 'default_receiving_location' },
    update: { value: receiving.id },
    create: { key: 'default_receiving_location', value: receiving.id }
  });
  await prisma.setting.upsert({
    where: { key: 'po_number_prefix' },
    update: { value: 'PO' },
    create: { key: 'po_number_prefix', value: 'PO' }
  });

  const zoneA = await prisma.location.create({
    data: { name: 'Zone A-Crystals', type: LocationType.ZONE, parentId: mainWarehouse.id, qrCode: 'LOC-ZA' }
  });
  await prisma.location.create({ data: { name: 'Shelf A1', type: LocationType.SHELF, parentId: zoneA.id, qrCode: 'LOC-ZA1' }});
  await prisma.location.create({ data: { name: 'Shelf A2', type: LocationType.SHELF, parentId: zoneA.id, qrCode: 'LOC-ZA2' }});
  await prisma.location.create({ data: { name: 'Shelf A3', type: LocationType.SHELF, parentId: zoneA.id, qrCode: 'LOC-ZA3' }});

  const zoneB = await prisma.location.create({
    data: { name: 'Zone B-Accessories', type: LocationType.ZONE, parentId: mainWarehouse.id, qrCode: 'LOC-ZB' }
  });
  await prisma.location.create({ data: { name: 'Shelf B1', type: LocationType.SHELF, parentId: zoneB.id, qrCode: 'LOC-ZB1' }});
  await prisma.location.create({ data: { name: 'Shelf B2', type: LocationType.SHELF, parentId: zoneB.id, qrCode: 'LOC-ZB2' }});
  
  const zoneC = await prisma.location.create({
    data: { name: 'Zone C-Light Bases', type: LocationType.ZONE, parentId: mainWarehouse.id, qrCode: 'LOC-ZC' }
  });

  const prodDir = await prisma.location.create({
    data: { name: 'Production Floor', type: LocationType.PRODUCTION, parentId: mainWarehouse.id, qrCode: 'LOC-PROD' }
  });
  await prisma.location.create({ data: { name: 'Shipping Area', type: LocationType.SHIPPING, parentId: mainWarehouse.id, qrCode: 'LOC-SHIP' }});
  await prisma.location.create({ data: { name: 'Quarantine', type: LocationType.QUARANTINE, parentId: mainWarehouse.id, qrCode: 'LOC-QUAR' }});
  await prisma.location.create({ data: { name: 'Defective Tote', type: LocationType.DEFECTIVE, parentId: mainWarehouse.id, qrCode: 'LOC-DEF' }});
  await prisma.location.create({ data: { name: 'Overflow Storage', type: LocationType.OTHER, parentId: mainWarehouse.id, qrCode: 'LOC-OVER' }});

  // Prod sublocations and machines
  const stnLocation = await prisma.location.create({ data: { name: 'STN Station', type: LocationType.PRODUCTION, parentId: prodDir.id, qrCode: 'LOC-STN-S' }});
  for (let i = 1; i <= 33; i++) {
    const mName = `STN-${i.toString().padStart(2, '0')}`;
    await prisma.machine.upsert({
      where: { name: mName },
      update: {},
      create: { name: mName, type: MachineType.STN, locationId: stnLocation.id, erpixMachineId: mName }
    });
  }

  const vitroLocation = await prisma.location.create({ data: { name: 'Vitro Station', type: LocationType.PRODUCTION, parentId: prodDir.id, qrCode: 'LOC-VITRO-S' }});
  for (let i = 1; i <= 11; i++) {
    const mName = `Vitro-${i.toString().padStart(2, '0')}`;
    await prisma.machine.upsert({
      where: { name: mName },
      update: {},
      create: { name: mName, type: MachineType.VITRO, locationId: vitroLocation.id, erpixMachineId: mName }
    });
  }

  // 10 Products
  const compIds = ['3CRS', '3CRM', '3CRL', '3CRXL', '3CHS', '3CHM', '3CHL', '3CDS', '3CDM', '3CIM'];
  for (const cId of compIds) {
    await prisma.product.upsert({
      where: { compoundId: cId },
      update: {},
      create: {
        compoundId: cId,
        name: `${cId} Product`,
        indexId: dbIndexes[0].id,
        uom: 'pcs'
      }
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
