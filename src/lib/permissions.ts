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

export function canAdjustStock(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canManageVendors(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "PURCHASER"]);
}

export function canManagePurchaseOrders(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "PURCHASER"]);
}

export function canApprovePurchaseOrders(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canManageReceiving(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "WAREHOUSE"]);
}

export function canManageTransfers(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "WAREHOUSE"]);
}

export function canAccessSettings(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN"]);
}

export function canManageDefects(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canReviewDefects(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER"]);
}

export function canManageVendorCredits(role: string | undefined) {
  return hasAnyRole(role, ["ADMIN", "MANAGER", "PURCHASER"]);
}
