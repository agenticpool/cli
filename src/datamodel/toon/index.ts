export function encode(data: unknown): string {
  return JSON.stringify(data);
}

export function decode<T = unknown>(str: string): T {
  return JSON.parse(str) as T;
}

export function isToonFormat(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

export function safeEncode(data: unknown): string | null {
  try {
    return encode(data);
  } catch {
    return null;
  }
}

export function safeDecode<T = unknown>(str: string): T | null {
  try {
    return decode<T>(str);
  } catch {
    return null;
  }
}
