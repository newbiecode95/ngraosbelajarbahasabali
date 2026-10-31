export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}
export function requireValue<T>(value: T | null | undefined, code = 'NOT_FOUND'): T {
  if (value == null) throw new AppError(404, code, 'Data tidak ditemukan.');
  return value;
}
