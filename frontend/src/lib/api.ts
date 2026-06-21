const publicApi = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const serverApi = process.env.BACKEND_URL
  ? `${process.env.BACKEND_URL}/api/v1`
  : publicApi;

export type ApiError = { detail?: string | Array<{ msg: string }> };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${publicApi}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    const message = Array.isArray(error.detail) ? error.detail[0]?.msg : error.detail;
    throw new Error(message ?? "Something went wrong");
  }
  return response.json() as Promise<T>;
}

