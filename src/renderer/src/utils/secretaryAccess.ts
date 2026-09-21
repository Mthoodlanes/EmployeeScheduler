import type { Employee } from '@shared/types/domain';

/**
 * Whether `employee` belongs in the Secretary area — used identically by
 * `RequireSecretaryAuth` (the route guard), `SecretaryLoginPage` (accept or
 * reject a login attempt), and `SecretaryLoginRoute` (where an
 * already-signed-in visitor lands). Centralized after a real bug: the
 * manager-inclusive check was added to two of those three spots but missed
 * the third, letting a stale redirect race a manager's login and bounce
 * them to the wrong place. Three ways in, deliberately not mutually
 * exclusive: `role === 'secretary'` (no other responsibilities), a manager
 * (already has authority over everything else in the app), or an explicit
 * `isSecretaryTagged` grant on someone whose primary role is something
 * else entirely (e.g. a Coordinator who also handles league dues).
 */
export function canAccessSecretaryArea(employee: Pick<Employee, 'role' | 'isSecretaryTagged'>): boolean {
  return employee.role === 'secretary' || employee.role === 'manager' || employee.isSecretaryTagged;
}
