export type DriveImageFolder =
  | 'profile_image'
  | 'category_image'
  | 'product_image'
  | 'store_logo'
  | 'other_images';

const ALLOWED_FOLDERS = new Set<DriveImageFolder>([
  'profile_image',
  'category_image',
  'product_image',
  'store_logo',
  'other_images',
]);

export function normalizeDriveFolder(input?: string): DriveImageFolder {
  const cleaned = String(input || 'other_images')
    .trim()
    .toLowerCase();
  if (ALLOWED_FOLDERS.has(cleaned as DriveImageFolder)) {
    return cleaned as DriveImageFolder;
  }
  return 'other_images';
}

export class DriveApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveJsonRequest<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    throw new DriveApiError(
      `Network error contacting Google Drive: ${err instanceof Error ? err.message : 'Unknown error'}`,
      502
    );
  }

  if (!res.ok) {
    let message = `Google Drive request failed (${res.status})`;
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const data = JSON.parse(raw) as {
            error?: { message?: string } | string;
            error_description?: string;
          };
          if (typeof data?.error === 'object' && data.error?.message) {
            message = data.error.message;
          } else if (typeof data?.error === 'string') {
            message = data.error_description || data.error;
          } else if (data?.error_description) {
            message = data.error_description;
          }
        } catch {
          message = `${message}: ${raw.slice(0, 200)}`;
        }
      }
    } catch {
      // ignore body read failure
    }
    throw new DriveApiError(message, res.status);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export async function findOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const parentClause = parentId
    ? `'${escapeDriveQueryValue(parentId)}' in parents`
    : `'root' in parents`;
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${escapeDriveQueryValue(
    folderName
  )}' and ${parentClause} and trashed = false`;

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&spaces=drive`;

  const found = await driveJsonRequest<{
    files?: Array<{ id: string; name: string; webViewLink?: string }>;
  }>(searchUrl, accessToken);

  if (found.files && found.files.length > 0) {
    return found.files[0];
  }

  const created = await driveJsonRequest<{ id: string; name: string; webViewLink?: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : ['root'],
      }),
    }
  );

  return created;
}

export async function ensureEcomStoreSubfolder(
  accessToken: string,
  folder: DriveImageFolder
): Promise<{
  rootFolderId: string;
  subfolderId: string;
  folderPath: string;
}> {
  const rootFolder = await findOrCreateDriveFolder(accessToken, 'ecom_store');
  const subFolder = await findOrCreateDriveFolder(accessToken, folder, rootFolder.id);
  return {
    rootFolderId: rootFolder.id,
    subfolderId: subFolder.id,
    folderPath: `ecom_store/${folder}`,
  };
}

export async function uploadBufferToDrive(params: {
  accessToken: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: DriveImageFolder;
}): Promise<{
  fileId: string;
  name: string;
  folderPath: string;
  url: string;
  webViewLink: string;
}> {
  const { accessToken, buffer, originalName, mimeType, folder } = params;
  const { subfolderId, folderPath } = await ensureEcomStoreSubfolder(accessToken, folder);

  const cleanOriginal = (originalName || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${cleanOriginal}`;
  const boundary = `-------shopadmin-drive-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const safeMimeType = (mimeType || 'application/octet-stream').replace(/[\r\n]/g, '').trim() || 'application/octet-stream';

  const metadataPart = JSON.stringify({
    name: fileName,
    parents: [subfolderId],
  });

  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${safeMimeType}\r\n\r\n`,
    'utf8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipartBody = Buffer.concat([head, buffer, tail]);

  let uploadRes: Response;
  try {
    uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: new Uint8Array(multipartBody),
      }
    );
  } catch (err) {
    throw new DriveApiError(
      `Network error uploading image to Google Drive: ${err instanceof Error ? err.message : 'Unknown error'}`,
      502
    );
  }

  if (!uploadRes.ok) {
    let msg = `Google Drive upload failed (${uploadRes.status})`;
    try {
      const raw = await uploadRes.text();
      if (raw) {
        try {
          const errData = JSON.parse(raw) as {
            error?: { message?: string } | string;
            error_description?: string;
          };
          if (typeof errData?.error === 'object' && errData.error?.message) {
            msg = errData.error.message;
          } else if (typeof errData?.error === 'string') {
            msg = errData.error_description || errData.error;
          } else if (errData?.error_description) {
            msg = errData.error_description;
          }
        } catch {
          msg = `${msg}: ${raw.slice(0, 200)}`;
        }
      }
    } catch {
      // ignore body read error
    }
    throw new DriveApiError(msg, uploadRes.status);
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };

  // Allow Anyone with link (Reader) so images render reliably inside Admin & Storefront <img> tags
  try {
    await driveJsonRequest(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }
    );
  } catch (permErr) {
    // Non-fatal if Workspace policy disallows public permissions
    console.warn('Could not set anyone-reader permission on Drive file:', permErr);
  }

  return {
    fileId: uploaded.id,
    name: uploaded.name,
    folderPath,
    url: `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1000`,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
  };
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  await driveJsonRequest(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

export async function getEcomStoreFolderSummary(accessToken: string) {
  const rootFolder = await findOrCreateDriveFolder(accessToken, 'ecom_store');
  const coreFolders: DriveImageFolder[] = [
    'profile_image',
    'category_image',
    'product_image',
    'store_logo',
  ];

  const folders = [];
  for (const folderName of coreFolders) {
    const sub = await findOrCreateDriveFolder(accessToken, folderName, rootFolder.id);
    const countQuery = `'${escapeDriveQueryValue(sub.id)}' in parents and trashed = false`;
    const listRes = await driveJsonRequest<{ files?: Array<{ id: string }> }>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        countQuery
      )}&fields=files(id)&pageSize=100`,
      accessToken
    );
    folders.push({
      id: sub.id,
      name: folderName,
      path: `ecom_store/${folderName}`,
      webViewLink: sub.webViewLink || `https://drive.google.com/drive/folders/${sub.id}`,
      fileCount: listRes.files?.length || 0,
    });
  }

  return {
    rootFolder: {
      id: rootFolder.id,
      name: 'ecom_store',
      webViewLink: rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`,
    },
    folders,
  };
}
