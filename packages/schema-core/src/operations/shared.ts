import type { SchemaProblem } from "../model/types";
import { createId } from "../model/utils";

export function createWarning(
  code: string,
  message: string,
  location?: SchemaProblem["location"]
): SchemaProblem {
  return {
    id: createId("warning"),
    severity: "warning",
    code,
    message,
    location
  };
}

export function createError(
  code: string,
  message: string,
  location?: SchemaProblem["location"]
): SchemaProblem {
  return {
    id: createId("error"),
    severity: "error",
    code,
    message,
    location
  };
}
