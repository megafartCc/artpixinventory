import { NextResponse } from "next/server";
import { FaultType } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageDefects } from "@/lib/permissions";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageDefects(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const samples = [
    { erpixReasonId: "R-001", name: "Cracked crystal", faultType: FaultType.VENDOR },
    { erpixReasonId: "R-002", name: "Surface defect", faultType: FaultType.VENDOR },
    { erpixReasonId: "R-003", name: "Wrong dimensions", faultType: FaultType.VENDOR },
    { erpixReasonId: "R-004", name: "Engraving error", faultType: FaultType.INTERNAL },
    { erpixReasonId: "R-005", name: "Handling damage", faultType: FaultType.INTERNAL },
  ];

  for (const sample of samples) {
    await prisma.defectReason.upsert({
      where: { erpixReasonId: sample.erpixReasonId },
      update: {
        name: sample.name,
        faultType: sample.faultType,
        active: true,
        syncedAt: new Date(),
      },
      create: {
        erpixReasonId: sample.erpixReasonId,
        name: sample.name,
        faultType: sample.faultType,
        active: true,
        syncedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ message: "Sample ERPIX defect reasons synced." });
}
