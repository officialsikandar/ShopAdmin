export const ADMIN_TOKEN_KEY = 'shopadmin_admin_token';

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onAdminUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const adminToken = getAdminToken();
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  if (adminToken) {
    baseHeaders.Authorization = `Bearer ${adminToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const rawText = await res.text();
      if (rawText) {
        try {
          const data = JSON.parse(rawText) as { error?: string; code?: string };
          if (data?.error) errMsg = data.error;
          if (data?.code) code = data.code;
        } catch {
          const preMatch = rawText.match(/<pre>([\s\S]*?)<\/pre>/i);
          const clean = (preMatch ? preMatch[1] : rawText).replace(/<[^>]+>/g, ' ').trim();
          if (clean) errMsg = clean.slice(0, 180);
        }
      }
    } catch {
      // ignore response read failure
    }
    if (res.status === 401 && code === 'ADMIN_SESSION_EXPIRED') {
      setAdminToken(null);
      unauthorizedListeners.forEach((fn) => fn());
    }
    throw new ApiError(errMsg, res.status, code);
  }

  return res.json() as Promise<T>;
}

export async function downloadProtectedFile(url: string, fallbackFilename: string): Promise<void> {
  const adminToken = getAdminToken();
  const res = await fetch(url, {
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401) {
      setAdminToken(null);
      unauthorizedListeners.forEach((fn) => fn());
    }
    throw new ApiError(`Download failed (${res.status})`, res.status);
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

const VERCEL_SAFE_UPLOAD_BYTES = Math.floor(3.8 * 1024 * 1024);

async function uploadDirectlyToGoogleDrive(params: {
  file: File;
  folder: 'profile_image' | 'category_image' | 'product_image' | 'store_logo' | 'other_images';
  accessToken: string;
}): Promise<{ url: string; fileId: string; folderPath: string; webViewLink: string }> {
  const folderInfo = await apiRequest<{
    rootFolderId: string;
    subfolderId: string;
    folderPath: string;
  }>(`/api/drive/folder-id?folder=${encodeURIComponent(params.folder)}`, {
    headers: { 'X-Google-Access-Token': params.accessToken },
  });

  const cleanOriginal = (params.file.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${cleanOriginal}`;
  const boundary = `-------shopadmin-client-drive-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const mimeType = params.file.type || 'application/octet-stream';

  const metadataPart = JSON.stringify({
    name: fileName,
    parents: [folderInfo.subfolderId],
  });

  const multipartBlob = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    params.file,
    `\r\n--${boundary}--`,
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    }
  );

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      throw new ApiError(
        'Google Drive session expired. Please sign in with Google again.',
        401,
        'GOOGLE_AUTH_EXPIRED'
      );
    }
    const errText = await uploadRes.text().catch(() => '');
    throw new ApiError(
      `Direct Google Drive upload failed (${uploadRes.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`,
      uploadRes.status
    );
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };

  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }
    );
  } catch {
    // Non-fatal if Google Workspace policy restricts public permissions
  }

  return {
    fileId: uploaded.id,
    folderPath: folderInfo.folderPath,
    url: `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1000`,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
  };
}

export async function uploadImageToServerDrive(params: {
  file: File;
  folder: 'profile_image' | 'category_image' | 'product_image' | 'store_logo' | 'other_images';
  accessToken: string;
}): Promise<{ url: string; fileId: string; folderPath: string; webViewLink: string }> {
  // Files larger than Vercel's serverless body cap upload directly from browser to Google Drive
  if (params.file.size > VERCEL_SAFE_UPLOAD_BYTES) {
    return uploadDirectlyToGoogleDrive(params);
  }

  const formData = new FormData();
  formData.append('folder', params.folder);
  formData.append('file', params.file);
  try {
    return await apiRequest<{ url: string; fileId: string; folderPath: string; webViewLink: string }>(
      '/api/upload',
      {
        method: 'POST',
        headers: {
          'X-Google-Access-Token': params.accessToken,
        },
        body: formData,
      }
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 413) {
      return uploadDirectlyToGoogleDrive(params);
    }
    throw err;
  }
}
