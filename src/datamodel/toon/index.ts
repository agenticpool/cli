export function encode(data: unknown): string {
  if (data === null || data === undefined) {
    return "null";
  }

  if (typeof data === "boolean") {
    return data ? "true" : "false";
  }

  if (typeof data === "number") {
    return String(data);
  }

  if (typeof data === "string") {
    if (/^[a-zA-Z0-9_-]+$/.test(data) && data.length < 50) {
      return data;
    }
    return `"${data}"`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return "[]";
    }

    const firstItem = data[0];
    if (typeof firstItem === "object" && firstItem !== null && !Array.isArray(firstItem)) {
      const keys = Object.keys(firstItem);
      const header = `[${data.length}]{${keys.join(",")}}:`;
      const lines = data.map((item) => {
        const values = keys.map((key) => encode(item[key]));
        return values.join(",");
      });
      return header + "\n" + lines.map((line) => `  ${line}`).join("\n");
    } else {
      return `[${data.length}]:` + data.map((item) => encode(item)).join(",");
    }
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return "{}";
    }

    const lines = keys.map((key) => {
      const val = encode(obj[key]);
      return `${key}:${val}`;
    });
    return lines.join("\n");
  }

  return String(data);
}

export function decode<T = unknown>(str: string): T {
  if (!str) return null as unknown as T;
  
  const trimmed = str.trim();
  
  // Try JSON first if it looks like JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch (e) {
      // Not JSON, continue to TOON
    }
  }

  const lines = trimmed.split("\n");
  const firstLine = lines[0].trim();

  // Tabular array [count]{key1,key2}:
  if (firstLine.startsWith("[") && firstLine.includes("]{")) {
    const headerMatch = firstLine.match(/^\[(\d+)\]\{([^}]+)\}:$/);
    if (headerMatch) {
      const keys = headerMatch[2].split(",").map((k) => k.trim());
      const result: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCommaSeparated(line);
        const item: Record<string, any> = {};
        keys.forEach((key, j) => {
          if (j < values.length) {
            item[key] = parseValue(values[j]);
          }
        });
        result.push(item);
      }
      return result as unknown as T;
    }
  }

  // Simple array [count]:val1,val2
  if (firstLine.startsWith("[") && firstLine.includes("]:")) {
    const headerMatch = firstLine.match(/^\[(\d+)\]:(.*)$/);
    if (headerMatch) {
      const remaining = headerMatch[2] + (lines.length > 1 ? lines.slice(1).join("\n") : "");
      const values = parseCommaSeparated(remaining.trim());
      return values.map(parseValue) as unknown as T;
    }
  }

  // Object key:value
  if (lines.some(l => l.includes(':'))) {
    const result: Record<string, any> = {};
    let hasKeys = false;
    
    for (const line of lines) {
      const part = line.trim();
      if (!part) continue;
      
      const colonIndex = part.indexOf(":");
      if (colonIndex > 0) {
        const key = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();
        result[key] = parseValue(value);
        hasKeys = true;
      }
    }
    
    if (hasKeys) return result as unknown as T;
  }

  return parseValue(trimmed) as unknown as T;
}

function parseValue(val: string): any {
  const v = val.trim();
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  
  if (!isNaN(Number(v)) && v !== "") return Number(v);
  
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.substring(1, v.length - 1);
  }
  
  return v;
}

function parseCommaSeparated(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function isToonFormat(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.startsWith("[") && (trimmed.includes("]{") || trimmed.includes("]:"))) {
    return true;
  }
  if (trimmed.includes(":") && !trimmed.startsWith("{")) {
    return true;
  }
  return false;
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
