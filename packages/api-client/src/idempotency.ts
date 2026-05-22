export interface IdempotencyHeaderConfig {
  readonly key: string;
  readonly headers: Readonly<Record<'Idempotency-Key', string>>;
}

export function createIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) {
    throw new Error('Idempotency-Key generation requires crypto.randomUUID()');
  }
  return key;
}

export function withIdempotencyHeader(
  key = createIdempotencyKey(),
): IdempotencyHeaderConfig {
  return {
    key,
    headers: {
      'Idempotency-Key': key,
    },
  };
}
