import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { LocationType } from '@prisma/client';

const HIERARCHY_RULES: Record<LocationType, LocationType[]> = {
  WAREHOUSE: ['ZONE', 'PRODUCTION', 'SHIPPING', 'QUARANTINE', 'DEFECTIVE', 'RECEIVING', 'OTHER'],
  ZONE: ['SHELF', 'BIN', 'OTHER'],
  SHELF: ['BIN'],
  BIN: [],
  PRODUCTION: ['BIN'], // E.g., machine buffer bins
  SHIPPING: ['BIN'],
  QUARANTINE: ['BIN'],
  DEFECTIVE: ['BIN'],
  RECEIVING: ['BIN'],
  OTHER: ['OTHER', 'BIN'],
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error("[LOCATIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as { role?: string })?.role !== 'ADMIN' && (session.user as { role?: string })?.role !== 'MANAGER')) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { name, type, parentId, description } = body;

    if (!name || !type) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Validate Hierarchy
    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } });
      if (!parent) return new NextResponse("Parent not found", { status: 404 });

      const allowedChildren = HIERARCHY_RULES[parent.type as LocationType] || [];
      if (!allowedChildren.includes(type as LocationType)) {
        return new NextResponse(`Invalid hierarchy: Cannot place ${type} inside ${parent.type}`, { status: 400 });
      }
    } else {
      // Must be a top-level WAREHOUSE if there's no parent, though we could allow isolated zones if needed.
      if (type !== 'WAREHOUSE') {
         return new NextResponse("Top-level locations must be of type WAREHOUSE", { status: 400 });
      }
    }

    // Generate unique generic QR code prefix string (usually we would generate this, e.g. LOC-XYZ)
    const qrCodeString = `LOC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const location = await prisma.location.create({
      data: {
        name,
        type: type as LocationType,
        parentId,
        description,
        qrCode: qrCodeString,
      }
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("[LOCATIONS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
