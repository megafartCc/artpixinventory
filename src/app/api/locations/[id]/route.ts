import { NextResponse } from "next/server";
import { Prisma, type LocationType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  LOCATION_HIERARCHY_RULES,
  buildLocationQrCode,
  collectDescendantIds,
} from "@/lib/location-utils";
import { canManageLocations } from "@/lib/permissions";

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

const locationMutationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(191),
  type: z.string().trim().min(1, "Type is required"),
  parentId: z.preprocess(emptyToNull, z.string().trim().nullable()),
  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000).nullable()
  ),
  active: z.boolean().default(true),
});

type RouteContext = {
  params: {
    id: string;
  };
};

async function getUniqueQrCode(name: string, excludeId?: string) {
  let suffix = 0;

  while (suffix < 100) {
    const candidate = buildLocationQrCode(name, suffix);
    const existing = await prisma.location.findFirst({
      where: {
        qrCode: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error("Unable to generate a unique QR code.");
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageLocations(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = locationMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const allLocations = await prisma.location.findMany({
    select: { id: true, name: true, parentId: true, type: true, qrCode: true },
  });

  if (payload.parentId === params.id) {
    return NextResponse.json(
      { error: "A location cannot be its own parent." },
      { status: 400 }
    );
  }

  const currentLocation = allLocations.find((location) => location.id === params.id);
  if (!currentLocation) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  if (payload.parentId) {
    const parent = allLocations.find((location) => location.id === payload.parentId);
    if (!parent) {
      return NextResponse.json(
        { error: "Selected parent location does not exist." },
        { status: 400 }
      );
    }

    const descendants = collectDescendantIds(allLocations, params.id);
    if (descendants.has(payload.parentId)) {
      return NextResponse.json(
        { error: "A location cannot be moved under its own descendant." },
        { status: 400 }
      );
    }

    const allowedChildren =
      LOCATION_HIERARCHY_RULES[parent.type as LocationType] ?? [];
    if (!allowedChildren.includes(payload.type as LocationType)) {
      return NextResponse.json(
        {
          error: `Invalid hierarchy: ${payload.type} cannot be placed under ${parent.type}.`,
        },
        { status: 400 }
      );
    }
  } else if (payload.type !== "WAREHOUSE") {
    return NextResponse.json(
      { error: "Top-level locations must be of type WAREHOUSE." },
      { status: 400 }
    );
  }

  try {
    const location = await prisma.location.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        type: payload.type as LocationType,
        parentId: payload.parentId,
        description: payload.description,
        active: payload.active,
        qrCode:
          currentLocation.name === payload.name
            ? currentLocation.qrCode
            : await getUniqueQrCode(payload.name, params.id),
      },
    });

    return NextResponse.json({ data: location, message: "Location updated." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A location with this name already exists at the selected level." },
        { status: 409 }
      );
    }

    console.error("PATCH /api/locations/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update location." },
      { status: 500 }
    );
  }
}
