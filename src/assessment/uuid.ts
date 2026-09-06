interface UuidCryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => void;
}

let fallbackSequence = 0;

function browserCrypto(): UuidCryptoSource | null {
  if (typeof globalThis.crypto === "undefined") return null;
  const source = globalThis.crypto;
  return {
    randomUUID:
      typeof source.randomUUID === "function"
        ? () => source.randomUUID()
        : undefined,
    getRandomValues:
      typeof source.getRandomValues === "function"
        ? (values) => {
            source.getRandomValues(values);
          }
        : undefined,
  };
}

/**
 * Generates an RFC 4122 UUID v4 in HTTPS, HTTP S3 website endpoints and older
 * browsers. These IDs deduplicate local UI commands; they are not credentials.
 */
export function createUuid(
  source: UuidCryptoSource | null = browserCrypto(),
  random: () => number = Math.random,
  now: () => number = Date.now,
): string {
  if (source?.randomUUID) {
    try {
      return source.randomUUID();
    } catch {
      // Some browsers expose the method but reject it outside a secure context.
    }
  }

  const bytes = new Uint8Array(16);
  let securelyFilled = false;
  if (source?.getRandomValues) {
    try {
      source.getRandomValues(bytes);
      securelyFilled = true;
    } catch {
      // Fall through for WebViews without a usable Web Crypto implementation.
    }
  }

  if (!securelyFilled) {
    const timestamp = now();
    const sequence = ++fallbackSequence;
    for (let index = 0; index < bytes.length; index += 1) {
      const timeByte = Math.floor(timestamp / 2 ** ((index % 6) * 8)) & 0xff;
      const sequenceByte = (sequence >>> ((index % 4) * 8)) & 0xff;
      bytes[index] =
        (Math.floor(random() * 256) ^ timeByte ^ sequenceByte) & 0xff;
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
