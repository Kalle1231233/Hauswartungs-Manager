export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assertCondition(
  condition: unknown,
  statusCode: number,
  message: string,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new AppError(statusCode, message, details);
  }
}
