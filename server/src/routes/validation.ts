/**
 * Milestone 18: lightweight, dependency-free runtime validation for the 8 new
 * feature route files. The original IPC channels were compile-time
 * type-checked end to end within Electron (preload's typed bridge -> main's
 * typed handler); an HTTP request body is just untyped JSON, so each route
 * re-validates required fields/types before calling into a service.
 *
 * Deliberately a hand-rolled "check-and-throw" approach rather than a schema
 * library (zod/yup/etc.) — the validation surface here is a few dozen flat,
 * shallow request shapes (no nesting, no unions beyond simple string enums),
 * so a library would add a new dependency + learning surface for something
 * these ~15 small helper functions cover just as clearly. Every helper throws
 * a plain `Error` on failure, which `handleRoute` (`./httpResult.ts`) maps to
 * an HTTP 400 automatically since it isn't one of the recognized service
 * error subclasses — so validation and business-rule failures both surface
 * as `400 {ok:false,error}` with no extra plumbing per route.
 */
import type { Request } from 'express';

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`"${field}" is required and must be a non-empty string`);
  }
  return value;
}

/** Like `requireString`, but `null` is a valid value (for nullable DB columns). */
export function requireStringOrNull(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, field);
}

/** Present-but-optional string field (undefined is fine; present must be a non-empty string). */
export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireString(value, field);
}

/** Present-but-optional nullable string field, e.g. an optional `reason`/`notes`. */
export function optionalStringOrNull(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return requireString(value, field);
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`"${field}" is required and must be a boolean`);
  }
  return value;
}

export function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`"${field}" is required and must be an integer`);
  }
  return value;
}

/** Present-but-optional integer field (undefined is fine; present must be an integer). */
export function optionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireInteger(value, field);
}

export function requireOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function requireOneOfOrNull<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | null {
  if (value === null) {
    return null;
  }
  return requireOneOf(value, field, allowed);
}

export function requireArrayOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`"${field}" is required and must be an array`);
  }
  value.forEach((item) => requireOneOf(item, `${field}[]`, allowed));
  return value as T[];
}

/** Like `requireArrayOf`, but for an array of plain integers (e.g. `orderedIds`) rather than a string enum. */
export function requireArrayOfIntegers(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`"${field}" is required and must be an array`);
  }
  value.forEach((item) => requireInteger(item, `${field}[]`));
  return value as number[];
}

/** Treats both `undefined` and `null` as "no value" -> `null`; otherwise validates a non-empty string. */
export function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return requireString(value, field);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a `YYYY-MM-DD` date string (format only — calendar validity is the DB/service's job). */
export function requireDateString(value: unknown, field: string): string {
  const str = requireString(value, field);
  if (!ISO_DATE_PATTERN.test(str)) {
    throw new Error(`"${field}" must be a date string in YYYY-MM-DD format`);
  }
  return str;
}

/** Treats both `undefined` and `null` as "no value" -> `null`; otherwise validates a `YYYY-MM-DD` date string. */
export function nullableDateString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return requireDateString(value, field);
}

/** Parses a positive-integer `:id`-style route param (or a caller-chosen param name). */
export function requireIdParam(req: Request, paramName = 'id'): number {
  const raw = req.params[paramName];
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`URL parameter "${paramName}" must be a positive integer`);
  }
  return id;
}

/** Parses a `:dayOfWeek`-style route param, an integer 0 (Sunday) - 6 (Saturday). */
export function requireDayOfWeekParam(req: Request, paramName = 'dayOfWeek'): number {
  const raw = req.params[paramName];
  const dayOfWeek = Number(raw);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(`URL parameter "${paramName}" must be an integer between 0 and 6`);
  }
  return dayOfWeek;
}

/** Parses a required, non-empty string query param. */
export function requireQueryString(req: Request, name: string): string {
  const raw = req.query[name];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`Query parameter "${name}" is required`);
  }
  return raw;
}

export function requireQueryOneOf<T extends string>(
  req: Request,
  name: string,
  allowed: readonly T[],
): T {
  return requireOneOf(req.query[name], `query.${name}`, allowed);
}

/** Validates a required `YYYY-MM-DD` query param. */
export function requireQueryDateString(req: Request, name: string): string {
  return requireDateString(req.query[name], `query.${name}`);
}

/** `req.body` typed as an unknown-valued record, defaulting to `{}` for a missing/empty body. */
export function bodyOf(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}
