import { z } from 'zod';

/**
 * Call sites ask whether a Role holds a permission, never which Role an Actor has, so more Roles
 * can be added later without touching them. v1 has one Role, Owner, holding every permission.
 */
export const permissions = [
  'record:read',
  'record:write',
  'project:read',
  'project:write',
  'client:read',
  'client:write',
  'workspace:read',
  'workspace:write',
  'settings:read',
  'settings:write',
] as const;
export type Permission = (typeof permissions)[number];

export const roles = ['owner'] as const;
export const roleSchema = z.enum(roles);
export type Role = (typeof roles)[number];

const grants: Readonly<globalThis.Record<Role, ReadonlySet<Permission>>> = {
  owner: new Set(permissions),
};

export function can(role: Role, permission: Permission): boolean {
  return grants[role].has(permission);
}
