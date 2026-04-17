import type { UserRole } from "@prisma/client";

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  PURCHASER: "Purchaser",
  WAREHOUSE: "Warehouse",
};

export function hasAnyRole(
  role: string | undefined,
  allowed: readonly UserRole[]
): role is UserRole {
  return !!role && allowed.includes(role as UserRole);
}

export function canManageCatalog(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "PURCHASER"]);
}

export function canImportCatalog(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "PURCHASER"]);
}

export function canManageLocations(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canManageMachines(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canAccessSettings(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN"]);
}
