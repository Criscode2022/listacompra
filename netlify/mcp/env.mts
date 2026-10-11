import { readFileSync } from "node:fs";

interface NetlifyEnvHost {
  Netlify?: { env?: { get: (name: string) => string | undefined } };
}

export function readEnv(name: string): string | undefined {
  const host = globalThis as NetlifyEnvHost;
  let fromPlatform: string | undefined;
  try {
    fromPlatform = host.Netlify?.env?.get(name);
  } catch {
    fromPlatform = undefined;
  }
  const value = (fromPlatform ?? process.env[name])?.trim();
  return value ? value : undefined;
}

export function loadDotEnv(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
