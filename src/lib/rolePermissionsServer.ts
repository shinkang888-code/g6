import { getAppSetting } from "@/lib/appSettingsServer";
import {
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_DEPUTY_ROLE_ID,
} from "@/lib/adminRoles";
import { ADMIN_ROLE_ID, SETTINGS_KEYS } from "@/lib/rolesSchema";

const FULL_ACCESS_ROLE_IDS = new Set([
  ADMIN_ROLE_ID,
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_DEPUTY_ROLE_ID,
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
]);

export async function getMenuPermissionsForRole(roleId: string): Promise<string[]> {
  if (FULL_ACCESS_ROLE_IDS.has(roleId)) return ["*"];
  const raw = await getAppSetting<Record<string, string[]>>(SETTINGS_KEYS.rolePermissions);
  if (!raw || typeof raw !== "object") return [];
  const perms = raw[roleId];
  return Array.isArray(perms) ? perms : [];
}

export function canAccessMenu(menuId: string, permissions: string[]): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(menuId);
}
