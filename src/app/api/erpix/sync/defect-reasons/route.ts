import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateErpixApiKey } from "@/lib/erpix-client";
import { erpixSyncDefectReasonsSchema } from "@/lib/erpix-schemas";

export async function POST(request: Request) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const parsed = erpixSyncDefectReasonsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid defect reason sync payload." },
      { status: 400 }
    );
  }

  const synced = [] as Array<{ id: string; erpixReasonId: string; name: string }>;

  for (const item of parsed.data) {
    const reason = await prisma.defectReason.upsert({
      where: { erpixReasonId: item.erpixReasonId },
      update: {
        name: item.name,
        faultType: item.faultType,
        active: true,
        syncedAt: new Date(),
      },
      create: {
        erpixReasonId: item.erpixReasonId,
        name: item.name,
        faultType: item.faultType,
        active: true,
        syncedAt: new Date(),
      },
      select: {
        id: true,
        erpixReasonId: true,
        name: true,
      },
    });

    synced.push({ id: reason.id, erpixReasonId: reason.erpixReasonId ?? "", name: reason.name });
  }

  return NextResponse.json({ data: synced, message: "Defect reasons synced." });
}
