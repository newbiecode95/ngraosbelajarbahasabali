export class RequestError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const body = await res
    .json()
    .catch(() => ({ error: "Respons tidak dapat dibaca. Coba lagi." }));
  if (!res.ok)
    throw new RequestError(
      body.error?.message ||
        body.error ||
        body.message ||
        "Permintaan gagal. Coba lagi.",
      body.code,
      res.status,
    );
  return body as T;
}
export const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});
