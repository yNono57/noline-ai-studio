export type GatewayErrorCategory = "AUTHENTICATION" | "RATE_LIMIT" | "INVALID_REQUEST" | "MODEL_UNAVAILABLE" | "TIMEOUT" | "PROVIDER_ERROR" | "SAFETY" | "UNKNOWN";

export class GatewayError extends Error {
  constructor(
    readonly category: GatewayErrorCategory,
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly providerCode?: string,
    options?: ErrorOptions,
  ) { super(message, options); this.name = "GatewayError"; }
}

export function normalizeProviderError(error: unknown, provider: string): GatewayError {
  if (error instanceof GatewayError) return error;
  const value = error as { status?: number; code?: string; type?: string; message?: string; name?: string };
  const status = value?.status;
  const code = value?.code;
  const combined = `${code || ""} ${value?.type || ""} ${value?.name || ""}`.toLowerCase();
  const category: GatewayErrorCategory =
    status === 401 || status === 403 ? "AUTHENTICATION" :
    status === 429 ? "RATE_LIMIT" :
    status === 400 || status === 422 ? "INVALID_REQUEST" :
    status === 404 || combined.includes("model_not_found") ? "MODEL_UNAVAILABLE" :
    status === 408 || combined.includes("timeout") || combined.includes("abort") ? "TIMEOUT" :
    combined.includes("content_filter") || combined.includes("safety") ? "SAFETY" :
    typeof status === "number" && status >= 500 ? "PROVIDER_ERROR" : "UNKNOWN";
  return new GatewayError(category, `Model provider request failed (${category}).`, provider, status, code, { cause: error });
}
