import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AuthErrors } from "@auth-module/core";

// ---------------------------------------------------------------------------
// validate — Express middleware factory that validates req.body against a
// Zod schema. Throws a formatted AuthError on failure.
// ---------------------------------------------------------------------------

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return next(AuthErrors.validationError(message));
    }
    req.body = result.data; // replace with coerced/default-filled data
    next();
  };
}
