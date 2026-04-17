import { NextResponse } from "next/server";
import { Prisma, type LocationType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  LOCATION_HIERARCHY_RULES,
  buildLocationQrCode,
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

async function getUniqueQrCode(name: string) {
  let suffix = 0;

  while (suffix < 100) {
    const candidate = buildLocationQrCode(name, suffix);
    const existing = await prisma.location.findUnique({
      where: { qrCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error("Unable to generate a unique QR code.");
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: locations });
  } catch (error) {
    console.error("[LOCATIONS_GET]", error);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageLocations(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = locationMutationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 }
      );
    }

    const { name, type, parentId, description, active } = parsed.data;

    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent not found." }, { status: 404 });
      }

      const allowedChildren =
        LOCATION_HIERARCHY_RULES[parent.type as LocationType] ?? [];
      if (!allowedChildren.includes(type as LocationType)) {
        return NextResponse.json(
          { error: `Invalid hierarchy: cannot place ${type} inside ${parent.type}.` },
          { status: 400 }
        );
      }
    } else if (type !== "WAREHOUSE") {
      return NextResponse.json(
        { error: "Top-level locations must be of type WAREHOUSE." },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        name,
        type: type as LocationType,
        parentId,
        description,
        active,
        qrCode: await getUniqueQrCode(name),
      },
    });

    return NextResponse.json(
      { data: location, message: "Location created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("[LOCATIONS_POST]", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A sibling location with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
