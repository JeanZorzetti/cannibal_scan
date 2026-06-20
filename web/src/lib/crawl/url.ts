const ASSET_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "avif",
  "mp4", "mp3", "webm", "ogg", "wav",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "gz", "tar",
  "woff", "woff2", "ttf", "eot",
  "css", "js", "map", "json", "xml", "rss", "atom",
]);

/** Remove fragment, lowercase host, strip trailing slash (except root). */
export function normalizeUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  u.host = u.host.toLowerCase();
  const path = u.pathname.endsWith("/") && u.pathname !== "/"
    ? u.pathname.slice(0, -1)
    : u.pathname;
  u.pathname = path;
  return u.toString();
}

export function isSameSite(origin: string, candidate: string): boolean {
  try {
    const o = new URL(origin);
    const c = new URL(candidate);
    return c.host.toLowerCase() === o.host.toLowerCase();
  } catch {
    return false;
  }
}

/** Returns false for mailto/tel, assets, and non-http(s) schemes. */
export function isCrawlable(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const ext = u.pathname.split(".").pop()?.toLowerCase() ?? "";
  if (ASSET_EXT.has(ext)) return false;
  return true;
}
