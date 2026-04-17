import { LocationType } from "@prisma/client";

export const LOCATION_HIERARCHY_RULES: Record<LocationType, LocationType[]> = {
  WAREHOUSE: [
    "ZONE",
    "PRODUCTION",
    "SHIPPING",
    "QUARANTINE",
    "DEFECTIVE",
    "RECEIVING",
    "OTHER",
  ],
  ZONE: ["SHELF", "BIN", "OTHER"],
  SHELF: ["BIN"],
  BIN: [],
  PRODUCTION: ["PRODUCTION", "BIN", "OTHER"],
  SHIPPING: ["BIN", "OTHER"],
  QUARANTINE: ["BIN", "OTHER"],
  DEFECTIVE: ["BIN", "OTHER"],
  RECEIVING: ["BIN", "OTHER"],
  OTHER: ["OTHER", "BIN"],
};

export const locationTypeLabels: Record<LocationType, string> = {
  WAREHOUSE: "Warehouse",
  ZONE: "Zone",
  SHELF: "Shelf",
  BIN: "Bin",
  PRODUCTION: "Production",
  SHIPPING: "Shipping",
  QUARANTINE: "Quarantine",
  DEFECTIVE: "Defective",
  RECEIVING: "Receiving",
  OTHER: "Other",
};

export function buildLocationQrBase(name: string) {
  const tokens = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return "LOC";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 8);
  }

  const initials = tokens
    .map((token) => `${token[0]}${token.match(/\d+/)?.[0] ?? ""}`)
    .join("")
    .slice(0, 8);

  return initials || tokens.join("").slice(0, 8);
}

export function buildLocationQrCode(name: string, suffix = 0) {
  return suffix > 0
    ? `LOC-${buildLocationQrBase(name)}-${suffix + 1}`
    : `LOC-${buildLocationQrBase(name)}`;
}

export type FlatLocationOption = {
  id: string;
  parentId: string | null;
  name: string;
  type: LocationType;
  depth: number;
  label: string;
};

export function flattenLocationsForSelect<
  T extends { id: string; parentId: string | null; name: string; type: LocationType }
>(locations: T[]) {
  const byParent = new Map<string | null, T[]>();

  for (const location of locations) {
    const current = byParent.get(location.parentId) ?? [];
    current.push(location);
    byParent.set(location.parentId, current);
  }

  for (const siblings of Array.from(byParent.values())) {
    siblings.sort((left, right) => left.name.localeCompare(right.name));
  }

  const flattened: FlatLocationOption[] = [];

  const visit = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      flattened.push({
        id: child.id,
        parentId: child.parentId,
        name: child.name,
        type: child.type,
        depth,
        label: `${"  ".repeat(depth)}${child.name}`,
      });
      visit(child.id, depth + 1);
    }
  };

  visit(null, 0);

  return flattened;
}

export function collectDescendantIds<
  T extends { id: string; parentId: string | null }
>(items: T[], rootId: string) {
  const descendants = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    for (const item of items) {
      if (item.parentId === currentId && !descendants.has(item.id)) {
        descendants.add(item.id);
        queue.push(item.id);
      }
    }
  }

  return descendants;
}
