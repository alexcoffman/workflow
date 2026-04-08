const fallbackHash = (input: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
};

export const hashPassword = async (value: string): Promise<string> => {
  const normalized = value.normalize('NFKC');
  if (!globalThis.crypto?.subtle) {
    return fallbackHash(normalized);
  }

  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `sha256:${hex}`;
};
