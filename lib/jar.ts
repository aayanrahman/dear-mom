export type Scent = "lavender" | "vanilla" | "rose" | "honey" | "ocean";
export type Ribbon = "blush" | "sage" | "butter" | "lilac" | "terracotta";

/**
 * A memory note. Stored as a [prompt, text] tuple to keep URLs short.
 * The prompt is the question the writer answered; text is their answer.
 */
export type Memory = [string, string];

export type JarData = {
  m: string;
  f: string;
  r: Ribbon;
  s: Scent;
  n: Memory[];
};

export const SCENTS: Record<Scent, { label: string; bg: string; accent: string; text: string }> = {
  lavender: {
    label: "Lavender",
    bg: "linear-gradient(180deg, #f3eefb 0%, #e8def4 60%, #d8c8ec 100%)",
    accent: "#9a7bc8",
    text: "#3f2d5a",
  },
  vanilla: {
    label: "Vanilla",
    bg: "linear-gradient(180deg, #fff8ec 0%, #fceed0 60%, #f4dcab 100%)",
    accent: "#c79653",
    text: "#5a3f1d",
  },
  rose: {
    label: "Rose",
    bg: "linear-gradient(180deg, #fdeef0 0%, #f8d7df 60%, #efb6c5 100%)",
    accent: "#c46079",
    text: "#5a2031",
  },
  honey: {
    label: "Honey",
    bg: "linear-gradient(180deg, #fff5d9 0%, #fbe39c 60%, #f1c873 100%)",
    accent: "#b3801f",
    text: "#553c0c",
  },
  ocean: {
    label: "Ocean",
    bg: "linear-gradient(180deg, #e7f1f8 0%, #c8def0 60%, #a3c4e2 100%)",
    accent: "#3f78ac",
    text: "#1f3a5a",
  },
};

export const RIBBONS: Record<Ribbon, { label: string; color: string; shadow: string }> = {
  blush: { label: "Blush pink", color: "#e89cae", shadow: "#c66f85" },
  sage: { label: "Sage green", color: "#a4bf9d", shadow: "#7a9572" },
  butter: { label: "Butter yellow", color: "#f0d27a", shadow: "#c4a64f" },
  lilac: { label: "Lilac", color: "#bda4d8", shadow: "#8d72a8" },
  terracotta: { label: "Terracotta", color: "#d18968", shadow: "#a45d3e" },
};

function toBase64Url(str: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(str, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof window === "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeJar(data: JarData): string {
  const minified: JarData = {
    m: data.m.trim().slice(0, 60),
    f: data.f.trim().slice(0, 60),
    r: data.r,
    s: data.s,
    n: data.n
      .map(
        ([p, t]) =>
          [p.trim().slice(0, 80), t.trim().slice(0, 220)] as Memory,
      )
      .filter(([, t]) => t.length > 0)
      .slice(0, 12),
  };
  return toBase64Url(JSON.stringify(minified));
}

function isMemory(x: unknown): x is Memory {
  // accept legacy string entries by upgrading to ["", text]
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === "string" &&
    typeof x[1] === "string"
  );
}

export function decodeJar(slug: string): JarData | null {
  try {
    const json = fromBase64Url(slug);
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.m !== "string" ||
      typeof parsed?.f !== "string" ||
      typeof parsed?.r !== "string" ||
      typeof parsed?.s !== "string" ||
      !Array.isArray(parsed?.n)
    ) {
      return null;
    }
    if (!(parsed.s in SCENTS) || !(parsed.r in RIBBONS)) return null;
    const notes: Memory[] = parsed.n
      .map((x: unknown): Memory | null => {
        if (typeof x === "string") return ["", x];
        if (isMemory(x)) return [x[0], x[1]];
        return null;
      })
      .filter((x: Memory | null): x is Memory => x !== null);
    return {
      m: parsed.m,
      f: parsed.f,
      r: parsed.r,
      s: parsed.s,
      n: notes,
    };
  } catch {
    return null;
  }
}
