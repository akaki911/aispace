export type HeadersLike = HeadersInit | undefined;

const appendFromHeadersInstance = (
  target: Record<string, string>,
  headers: Headers,
): void => {
  headers.forEach((value, key) => {
    target[key] = value;
  });
};

const appendFromIterable = (
  target: Record<string, string>,
  entries: readonly (readonly [string, string])[] | Iterable<[string, string]>,
): void => {
  for (const [key, value] of entries) {
    if (key && value !== undefined && value !== null) {
      target[key] = String(value);
    }
  }
};

const appendFromRecord = (target: Record<string, string>, record: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(record)) {
    if (key && value !== undefined && value !== null) {
      target[key] = String(value);
    }
  }
};

export const toHeaderRecord = (headers?: HeadersInit): Record<string, string> => {
  const record: Record<string, string> = {};

  if (!headers) {
    return record;
  }

  if (headers instanceof Headers) {
    appendFromHeadersInstance(record, headers);
    return record;
  }

  if (Array.isArray(headers)) {
    appendFromIterable(record, headers);
    return record;
  }

  if (typeof headers === 'object') {
    appendFromRecord(record, headers as Record<string, unknown>);
  }

  return record;
};

export const mergeHeaders = (...sources: HeadersLike[]): Record<string, string> => {
  return sources.reduce<Record<string, string>>((acc, source) => {
    if (!source) {
      return acc;
    }

    if (source instanceof Headers) {
      appendFromHeadersInstance(acc, source);
      return acc;
    }

    if (Array.isArray(source)) {
      appendFromIterable(acc, source);
      return acc;
    }

    if (typeof source === 'object') {
      appendFromRecord(acc, source as Record<string, unknown>);
    }

    return acc;
  }, {});
};
