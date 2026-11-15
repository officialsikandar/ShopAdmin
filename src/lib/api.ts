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

export async function uploadImageToServerDrive(params: {
  file: File;
  folder: 'profile_image' | 'category_image' | 'product_image' | 'store_logo' | 'other_images';
  accessToken: string;
}): Promise<{ url: string; fileId: string; folderPath: string; webViewLink: string }> {
  const formData = new FormData();
  formData.append('folder', params.folder);
  formData.append('file', params.file);
  return apiRequest<{ url: string; fileId: string; folderPath: string; webViewLink: string }>(
    '/api/upload',
    {
      method: 'POST',
      headers: {
        'X-Google-Access-Token': params.accessToken,
      },
      body: formData,
    }
  );
}
