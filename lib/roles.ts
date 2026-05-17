export const MANAGEABLE_USER_ROLES = ["user", "moderator", "admin", "banned"] as const;

export type ManageableUserRole = (typeof MANAGEABLE_USER_ROLES)[number];

export function canAccessModeration(role?: string | null) {
  return role === "admin" || role === "moderator";
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isManageableUserRole(role: string): role is ManageableUserRole {
  return (MANAGEABLE_USER_ROLES as readonly string[]).includes(role);
}
