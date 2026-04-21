export type DispensationErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "OUT_OF_STOCK"
  | "LIMIT_EXCEEDED"
  | "MEMBER_BLOCKED"
  | "MEMBER_EXPIRED";

export class DispensationError extends Error {
  constructor(public readonly code: DispensationErrorCode, message: string) {
    super(message);
    this.name = "DispensationError";
  }
}
