/**
 * Builds absolute URLs for files served at GET /uploads/...
 * Static files live at the server root, not under /api — never append API_URL with a /api path.
 *
 * Production: set API_URL or BACKEND_URL to the public API origin (e.g. https://lapip.net or https://api.example.com).
 * Optional override: PUBLIC_UPLOAD_BASE_URL or ASSET_PUBLIC_URL (same host as uploads).
 */
function trimUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function originFromUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(trimUrl(raw));
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Public origin (protocol + host + port) where /uploads is mounted. */
export function getUploadsPublicOrigin(): string | null {
  const dedicated =
    process.env.PUBLIC_UPLOAD_BASE_URL || process.env.ASSET_PUBLIC_URL;
  if (dedicated) {
    const o = originFromUrl(dedicated);
    if (o) return o;
  }
  const fromApi = originFromUrl(process.env.API_URL);
  if (fromApi) return fromApi;
  const fromBackend = originFromUrl(process.env.BACKEND_URL);
  if (fromBackend) return fromBackend;
  return null;
}

type ReqLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

function headerOne(
  headers: ReqLike["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const v = headers[name];
  if (typeof v === "string") return v.split(",")[0]?.trim();
  if (Array.isArray(v) && v[0]) return String(v[0]).split(",")[0]?.trim();
  return undefined;
}

/**
 * @param filePath e.g. "products/uuid.jpg" (slashes only, no leading "uploads/")
 */
export function buildPublicUploadUrl(filePath: string, req?: ReqLike): string {
  const rel = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^uploads\/?/i, "");

  const envOrigin = getUploadsPublicOrigin();
  if (envOrigin) {
    return `${envOrigin.replace(/\/+$/, "")}/uploads/${rel}`;
  }

  if (req) {
    const proto =
      headerOne(req.headers, "x-forwarded-proto") ||
      (typeof req.protocol === "string" ? req.protocol : "http");
    const host =
      headerOne(req.headers, "x-forwarded-host") ||
      (typeof req.get === "function" ? req.get("host") : undefined);
    if (host) {
      const p = String(proto).split(",")[0].trim() || "http";
      return `${p}://${host}/uploads/${rel}`;
    }
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}/uploads/${rel}`;
}
