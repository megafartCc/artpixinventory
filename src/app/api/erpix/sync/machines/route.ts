import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateErpixApiKey } from "@/lib/erpix-client";
import { erpixSyncMachinesSchema } from "@/lib/erpix-schemas";

export async function POST(request: Request) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const parsed = erpixSyncMachinesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid machine sync payload." },
      { status: 400 }
    );
  }

  const machineLocations = await prisma.location.findMany({
    where: { name: { in: parsed.data.map((item) => `${item.name} Station`) } },
    select: { id: true, name: true },
  });
  const locationByName = new Map(machineLocations.map((location) => [location.name, location.id]));

  const results = [] as Array<{ name: string; action: "created" | "updated"; id: string }>;

  for (const item of parsed.data) {
    const existing = await prisma.machine.findFirst({ where: { name: item.name }, select: { id: true } });
    const locationId = locationByName.get(`${item.name} Station`) ?? null;

    if (existing) {
      const updated = await prisma.machine.update({
        where: { id: existing.id },
        data: {
          type: item.type,
          erpixMachineId: item.erpixMachineId,
          ...(locationId ? { locationId } : {}),
          active: true,
        },
        select: { id: true, name: true },
      });
      results.push({ name: updated.name, action: "updated", id: updated.id });
      continue;
    }

    if (!locationId) {
      return NextResponse.json(
        { error: `No station location found for machine ${item.name}.` },
        { status: 400 }
      );
    }

    const created = await prisma.machine.create({
      data: {
        name: item.name,
        type: item.type,
        erpixMachineId: item.erpixMachineId,
        locationId,
        active: true,
      },
      select: { id: true, name: true },
    });
    results.push({ name: created.name, action: "created", id: created.id });
  }

  return NextResponse.json({ data: results, message: "Machine sync completed." });
}
