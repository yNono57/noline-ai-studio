export type Instant = string & { readonly __instant: unique symbol };

export function instant(value: string | Date): Instant {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Instant must be a valid timestamp.");
  return date.toISOString() as Instant;
}
