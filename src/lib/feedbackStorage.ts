// Supabase Storage helper for feedback attachments (2026-10-28).
//
// Files go straight from the user's browser to a PRIVATE Supabase Storage
// bucket through a one-time signed upload URL, because Vercel functions
// cannot receive request bodies over ~4.5 MB (videos can be 25 MB). The
// server only ever handles small JSON: it asks Supabase for the signed
// upload URL, and later for signed download URLs when an admin opens the
// feedback list. The bucket has no public access; Supabase's own RLS blocks
// everything except the server-side service key.
//
// Needs two server-only env vars in Vercel: SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Without them attachments are simply switched
// off (text feedback keeps working).

export const FEEDBACK_BUCKET = "feedback-attachments";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 5;
export const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export type FeedbackAttachment = { path: string; name: string; type: string; size: number };

function config(): { base: string; key: string } | null {
  const raw = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!raw || !key) return null;
  let origin: string;
  try {
    // Only the origin is used, so a pasted "https://x.supabase.co/rest/v1/"
    // or a trailing slash still works.
    origin = new URL(raw).origin;
  } catch {
    return null;
  }
  return { base: `${origin}/storage/v1`, key };
}

export function storageConfigured(): boolean {
  return config() !== null;
}

// Every Supabase call goes through here. Legacy service_role keys are JWTs
// and go in both headers; the newer sb_secret_ keys are not JWTs, so they go
// in apikey only - and if Supabase answers 401/403 to that, the same call is
// retried once with the key in Authorization too.
async function storageFetch(
  cfg: { base: string; key: string },
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<Response> {
  const isJwt = cfg.key.startsWith("eyJ");
  const send = (withBearer: boolean) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        apikey: cfg.key,
        ...(withBearer ? { Authorization: `Bearer ${cfg.key}` } : {}),
      },
    });
  let res = await send(isJwt);
  if (!isJwt && (res.status === 401 || res.status === 403)) res = await send(true);
  return res;
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-80);
  return cleaned || "file";
}

let bucketReady = false;

// Creates the private bucket the first time it is needed (a no-op if it
// already exists), so there is nothing to set up by hand in Supabase.
async function ensureBucket(cfg: { base: string; key: string }): Promise<void> {
  if (bucketReady) return;
  const res = await storageFetch(cfg, `${cfg.base}/bucket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: FEEDBACK_BUCKET,
      name: FEEDBACK_BUCKET,
      public: false,
      file_size_limit: MAX_FILE_BYTES,
      allowed_mime_types: ALLOWED_TYPES,
    }),
  });
  if (res.ok) {
    bucketReady = true;
    return;
  }
  const text = await res.text().catch(() => "");
  if (res.status === 409 || /already exists|duplicate/i.test(text)) {
    bucketReady = true;
    return;
  }
  throw new Error(`Could not create storage bucket (${res.status}): ${text.slice(0, 200)}`);
}

// One-time URL the browser PUTs the file to. Tries the signed upload first
// and only creates the bucket if Supabase says it does not exist yet.
export async function createUploadUrl(path: string): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("storage not configured");
  const signUrl = `${cfg.base}/object/upload/sign/${FEEDBACK_BUCKET}/${path}`;
  const sign = () =>
    storageFetch(cfg, signUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-upsert": "false" },
      body: "{}",
    });

  let res = await sign();
  if (!res.ok) {
    const text = await res.clone().text().catch(() => "");
    // Supabase reports a missing bucket as HTTP 400 with an inner
    // statusCode "404" ("The related resource does not exist"), not only as a
    // plain 404, so the body is checked as well.
    if (res.status === 404 || /"statusCode":\s*"?404"?|not found|does not exist/i.test(text)) {
      await ensureBucket(cfg);
      res = await sign();
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not create upload URL (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { url?: string; token?: string };
  const token = data.token ?? (data.url ? new URL(data.url, "http://x").searchParams.get("token") : null);
  if (!token) throw new Error("Upload URL response had no token");
  return `${cfg.base}/object/upload/sign/${FEEDBACK_BUCKET}/${path}?token=${encodeURIComponent(token)}`;
}

// Time-limited download links for the admin page and the notification email.
// Returns a map of path -> URL; paths that cannot be signed are left out.
export async function createDownloadUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
  const cfg = config();
  const out: Record<string, string> = {};
  if (!cfg || paths.length === 0) return out;
  try {
    const res = await storageFetch(cfg, `${cfg.base}/object/sign/${FEEDBACK_BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds, paths }),
    });
    if (!res.ok) return out;
    const data = (await res.json()) as { path?: string; signedURL?: string | null; error?: string | null }[];
    for (const item of data) {
      if (item.path && item.signedURL && !item.error) out[item.path] = `${cfg.base}${item.signedURL}`;
    }
  } catch {
    // links are a convenience; the list still renders without them
  }
  return out;
}
