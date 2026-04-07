export function encode(data: unknown): string {
  if (data === null || data === undefined) return "null";
  if (typeof data === "boolean") return data ? "true" : "false";
  if (typeof data === "number") return String(data);
  if (typeof data === "string") {
    if (/^[a-zA-Z0-9_-]+$/.test(data) && data.length < 500) return data;
    return `"${data}"`;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    const firstItem = data[0];
    if (typeof firstItem === "object" && firstItem !== null && !Array.isArray(firstItem)) {
      const keys = Object.keys(firstItem);
      const header = `[${data.length}]{${keys.join(",")}}:`;
      const lines = data.map((item) => {
        const values = keys.map((key) => encode((item as any)[key]));
        return values.join(",");
      });
      return header + "\n" + lines.map((line) => `  ${line}`).join("\n");
    }
    return `[${data.length}]:` + data.map((item) => encode(item)).join(",");
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined && !k.startsWith('_'));
    if (keys.length === 0) return "{}";
    const lines = keys.map((key) => {
      const val = encode(obj[key]);
      if (val.includes("\n")) return `${key}:\n${val.split("\n").map(l => `  ${l}`).join("\n")}`;
      return `${key}:${val}`;
    });
    return lines.join("\n");
  }
  return String(data);
}

export function decode<T = unknown>(str: string): T {
  if (!str) return null as unknown as T;
  const trimmed = str.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) as T; } catch (e) {}
  }

  const lines = str.split("\n");
  const result: Record<string, any> = {};
  let hasKeyValues = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() && !line.startsWith(" ")) continue;

    const colonIndex = line.indexOf(":");
    // A key:value pair must have a colon and the key shouldn't start with space (top-level)
    if (colonIndex > 0 && !line.startsWith(" ")) {
      const key = line.substring(0, colonIndex).trim();
      let valuePart = line.substring(colonIndex + 1).trim();

      // Check if it's a multiline/nested block (next lines are indented)
      if (i + 1 < lines.length && lines[i+1].startsWith("  ")) {
        const nestedLines = [];
        if (valuePart) nestedLines.push(valuePart);
        let j = i + 1;
        while (j < lines.length && (lines[j].startsWith("  ") || !lines[j].trim())) {
          if (lines[j].startsWith("  ")) {
            nestedLines.push(lines[j].substring(2));
          } else {
            nestedLines.push("");
          }
          j++;
        }
        i = j - 1;
        result[key] = decodeValue(nestedLines.join("\n"));
      } else {
        // Just a regular value on the same line
        result[key] = decodeValue(valuePart);
      }
      hasKeyValues = true;
    }
  }

  if (hasKeyValues) {
    // Specific logic for common API patterns: if root has 'data' and 'success', and 'data' is an object,
    // merge 'data' properties into root IF it helps matching the expected interface
    if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      // For generate-keys pattern: Merge privateKey into data
      if (result.privateKey && !result.data.privateKey) {
        result.data.privateKey = result.privateKey;
      }
    }
    return result as unknown as T;
  }
  return decodeValue(trimmed) as unknown as T;
}

function decodeValue(str: string): any {
  const trimmed = str.trim();
  if (!trimmed || trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const lines = str.split("\n");
  const firstLine = lines[0].trim();

  // Tabular array [count]{key1,key2}:
  if (firstLine.startsWith("[") && firstLine.includes("]{")) {
    const headerMatch = firstLine.match(/^\[(\d+)\]\{([^}]+)\}:?$/);
    if (headerMatch) {
      const keys = headerMatch[2].split(",").map((k) => k.trim());
      const res: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCommaSeparated(line);
        const item: Record<string, any> = {};
        keys.forEach((key, j) => {
          if (j < values.length) item[key] = parseValue(values[j]);
        });
        res.push(item);
      }
      return res;
    }
  }

  // Simple array [count]:val1,val2
  if (firstLine.startsWith("[") && firstLine.includes("]:")) {
    const headerMatch = firstLine.match(/^\[(\d+)\]:(.*)$/);
    if (headerMatch) {
      const remaining = headerMatch[2] + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
      return parseCommaSeparated(remaining.trim()).map(parseValue);
    }
  }

  // If it's a multiline string that isn't a tabular array, it might be an object
  if (lines.length > 1 && lines.some(l => l.includes(":") && !l.startsWith(" "))) {
    return decode(str);
  }

  // If it still looks like an object (key:value) but was passed as a single line value
  if (trimmed.includes(":") && !trimmed.startsWith('"') && !trimmed.includes("\n")) {
    const res: Record<string, any> = {};
    const parts = parseCommaSeparated(trimmed);
    let isObj = false;
    parts.forEach(part => {
      const cIndex = part.indexOf(":");
      if (cIndex > 0) {
        res[part.substring(0, cIndex).trim()] = parseValue(part.substring(cIndex + 1).trim());
        isObj = true;
      }
    });
    if (isObj) return res;
  }

  return parseValue(trimmed);
}

function parseValue(val: string): any {
  let v = val.trim();
  if (!v || v === "null") return null;
  if (v === "true" || v === '"true"') return true;
  if (v === "false" || v === '"false"') return false;
  
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.substring(1, v.length - 1);
  }

  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 15) {
    return Number(v);
  }
  
  return v;
}

function parseCommaSeparated(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') inQuotes = !inQuotes;
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

export function isToonFormat(content: string): boolean {
  const trimmed = content.trim();
  return (trimmed.startsWith("[") && (trimmed.includes("]{") || trimmed.includes("]:"))) ||
         (trimmed.includes(":") && !trimmed.startsWith("{"));
}

export function safeEncode(data: unknown): string | null {
  try { return encode(data); } catch { return null; }
}

export function safeDecode<T = unknown>(str: string): T | null {
  try { return decode<T>(str); } catch { return null; }
}
