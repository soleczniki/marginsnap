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
export const MAX_FILES = 3;
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
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: `${url}/storage/v1`, key };
}

export function storageConfigured(): boolean {
  return config() !== null;
}

function authHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  // Legacy service_role keys are JWTs and go in Authorization too; the newer
  // sb_secret_ keys are not JWTs and only go in the apikey header.
  const headers: Record<string, string> = { apikey: key, ...extra };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
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
  const res = await fetch(`${cfg.base}/bucket`, {
    method: "POST",
    headers: authHeaders(cfg.key, { "Content-Type": "application/json" }),
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

// One-time URL the browser PUTs the file to.
export async function createUploadUrl(path: string): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("storage not configured");
  await ensureBucket(cfg);
  const res = await fetch(`${cfg.base}/object/upload/sign/${FEEDBACK_BUCKET}/${path}`, {
    method: "POST",
    headers: authHeaders(cfg.key, { "Content-Type": "application/json", "x-upsert": "false" }),
    body: "{}",
  });
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
    const res = await fetch(`${cfg.base}/object/sign/${FEEDBACK_BUCKET}`, {
      method: "POST",
      headers: authHeaders(cfg.key, { "Content-Type": "application/json" }),
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
