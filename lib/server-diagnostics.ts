type ErrorLike = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  status?: unknown;
  code?: unknown;
  type?: unknown;
  param?: unknown;
  request_id?: unknown;
  headers?: unknown;
  cause?: unknown;
  error?: unknown;
};

export function logGenerationError({
  route,
  stage,
  error,
  context = {}
}: {
  route: string;
  stage: string;
  error: unknown;
  context?: Record<string, unknown>;
}) {
  const details = normalizeError(error);

  console.error(
    JSON.stringify({
      event: "generation_error",
      route,
      stage,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
      },
      supabase: {
        urlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        anonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      },
      error: details,
      context
    })
  );
}

function normalizeError(error: unknown) {
  if (!(error instanceof Error) && (!error || typeof error !== "object")) {
    return { value: String(error) };
  }

  const candidate = error as ErrorLike;
  const headers = normalizeHeaders(candidate.headers);

  return {
    name: toStringValue(candidate.name),
    message: toStringValue(candidate.message),
    status: toNumberValue(candidate.status),
    code: toStringValue(candidate.code),
    type: toStringValue(candidate.type),
    param: toStringValue(candidate.param),
    requestId:
      toStringValue(candidate.request_id) ||
      headers?.["x-request-id"] ||
      headers?.["request-id"] ||
      null,
    cause: normalizeCause(candidate.cause),
    apiError: normalizeNestedError(candidate.error),
    stack: toStringValue(candidate.stack)
  };
}

function normalizeHeaders(value: unknown) {
  if (!value || typeof value !== "object") return null;

  if (value instanceof Headers) {
    return Object.fromEntries(
      ["x-request-id", "request-id", "retry-after"]
        .map((key) => [key, value.get(key)])
        .filter(([, headerValue]) => headerValue)
    );
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    ["x-request-id", "request-id", "retry-after"]
      .map((key) => [key, toStringValue(record[key])])
      .filter(([, headerValue]) => headerValue)
  );
}

function normalizeCause(value: unknown) {
  if (!value) return null;
  if (value instanceof Error || typeof value === "object") {
    const cause = value as ErrorLike;
    return {
      name: toStringValue(cause.name),
      message: toStringValue(cause.message),
      code: toStringValue(cause.code)
    };
  }
  return String(value);
}

function normalizeNestedError(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const nested = value as Record<string, unknown>;
  return {
    message: toStringValue(nested.message),
    type: toStringValue(nested.type),
    code: toStringValue(nested.code),
    param: toStringValue(nested.param)
  };
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toNumberValue(value: unknown) {
  return typeof value === "number" ? value : null;
}
