import type { ConditionType, KedaCondition } from "./types";

// What ScaledObject and ScaledJob share: the conditions the controller writes
// into their status, the lists it writes as strings or arrays, and the pause
// annotation it reads. The models' statics delegate here.

/** Pauses a ScaledObject at its current replica count, or a ScaledJob, when "true" (KEDA 2.12 or newer). */
export const pausedAnnotation = "autoscaling.keda.sh/paused";

/** Pauses a ScaledObject at the given replica count; wins over `pausedAnnotation` when both are set. */
export const pausedReplicasAnnotation = "autoscaling.keda.sh/paused-replicas";

export function getCondition(conditions: KedaCondition[] | undefined, type: ConditionType): KedaCondition | undefined {
  return conditions?.find((condition) => condition.type === type);
}

/**
 * The status of a condition: true for True, false for False, and undefined
 * for Unknown or for a condition the controller has not written, such as
 * Paused while the object is not paused.
 */
export function getConditionStatus(conditions: KedaCondition[] | undefined, type: ConditionType): boolean | undefined {
  const status = getCondition(conditions, type)?.status;
  if (status === "True") return true;
  if (status === "False") return false;
  return undefined;
}

/**
 * The Status column, a summary of the conditions with the controller's
 * precedence: an error of the Ready condition wins, then Paused, Fallback,
 * Active and Ready. A ScaledJob has no Fallback condition.
 */
export function getStatusText(conditions: KedaCondition[] | undefined): string {
  if (getConditionStatus(conditions, "Ready") === false) {
    return getCondition(conditions, "Ready")?.reason ?? "Error";
  }
  if (getConditionStatus(conditions, "Paused")) return "Paused";
  if (getConditionStatus(conditions, "Fallback")) return "Fallback";
  if (getConditionStatus(conditions, "Active")) return "Active";
  if (getConditionStatus(conditions, "Ready")) return "Ready";
  return "Unknown";
}

export function getStatusClass(conditions: KedaCondition[] | undefined): string {
  if (getConditionStatus(conditions, "Ready") === false) return "error";
  if (getConditionStatus(conditions, "Fallback")) return "warning";
  if (getConditionStatus(conditions, "Paused")) return "info";
  if (getConditionStatus(conditions, "Active")) return "success";
  if (getConditionStatus(conditions, "Ready")) return "success";
  return "";
}

/**
 * Normalizes a status list field: KEDA versions differ on the JSON shape of
 * these fields, a comma-separated string ("cpu,memory") or an array. An array
 * passes through, a string is split, and a missing value yields the fallback
 * (the list from the spec, or empty).
 */
export function normalizeList(value: string | string[] | null | undefined, fallback: string[]): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

/**
 * Whether the value of the `paused` annotation pauses the object. The
 * controller parses it with Go's `strconv.ParseBool` and treats a value it
 * cannot parse as paused, so only its false spellings count as not paused.
 */
export function isPausedValue(value: string | undefined): boolean {
  return value !== undefined && !["0", "f", "false"].includes(value.toLowerCase());
}
