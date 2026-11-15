import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { FolderOpen, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DriveImageFolder, StoreSettingsDoc } from '../types';
import {
  clearAccessToken,
  extractDriveFileId,
  getAccessToken,
  googleSignIn,
  initDriveAuth,
  logoutGoogleDrive,
} from '../lib/googleDriveAuth';
import { ApiError, apiRequest, uploadImageToServerDrive } from '../lib/api';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface DriveFolderSummary {
  rootFolder: { id: string; name: string; webViewLink: string };
  folders: Array<{
    id: string;
    name: string;
    path: string;
    webViewLink: string;
    fileCount: number;
  }>;
}

interface PendingUpload {
  file: File;
  folder: DriveImageFolder;
  resolve: (result: { url: string; fileId: string; folderPath: string; webViewLink: string }) => void;
  reject: (err: Error) => void;
}

interface GoogleDriveContextValue {
  connected: boolean;
  hasActiveToken: boolean;
  connecting: boolean;
  googleUser: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null;
  driveFolders: DriveFolderSummary | null;
  connectDrive: () => Promise<string | null>;
  disconnectDrive: () => Promise<void>;
  uploadImageToDrive: (
    file: File,
    folder: DriveImageFolder
  ) => Promise<{ url: string; fileId: string; folderPath: string; webViewLink: string }>;
  confirmAndDeleteDriveImage: (imageUrl: string, itemLabel: string) => Promise<boolean>;
  fetchFolderSummary: () => Promise<DriveFolderSummary | null>;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | null>(null);

export function GoogleSignInButton({
  onClick,
  disabled,
  label = 'Sign in with Google',
  className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`gsi-material-button ${className}`}
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ display: 'block' }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        <span className="gsi-material-button-contents">{label}</span>
        <span style={{ display: 'none' }}>{label}</span>
      </div>
    </button>
  );
}

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
  const { showToast, confirm } = useToast();
  const [hasActiveToken, setHasActiveToken] = useState(Boolean(getAccessToken()));
  const [firebaseSignedIn, setFirebaseSignedIn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [googleUser, setGoogleUser] = useState<{
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveFolderSummary | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Restore saved Google Drive account & ecom_store folder links from MongoDB on page load/refresh
  useEffect(() => {
    apiRequest<StoreSettingsDoc>('/api/settings')
      .then((res) => {
        const gd = res.integrations?.googleDrive;
        if (gd?.connected) {
          setFirebaseSignedIn(true);
          setGoogleUser((prev) =>
            prev || {
              displayName: gd.displayName || null,
              email: gd.email || null,
              photoURL: gd.photoURL || null,
            }
          );
          if (gd.rootFolder?.id) {
            setDriveFolders({
              rootFolder: gd.rootFolder,
              folders: gd.folders || [],
            });
          }
        }
      })
      .catch(() => {
        // ignore initial settings load failure
      });
  }, []);

  const syncUserState = useCallback((user: User | null, hasToken: boolean) => {
    setHasActiveToken(hasToken);
    if (user) {
      setFirebaseSignedIn(true);
      setGoogleUser({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
    } else if (!hasToken) {
      setHasActiveToken(false);
    }
  }, []);

  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => syncUserState(user, true),
      (user) => syncUserState(user, false)
    );
    return unsub;
  }, [syncUserState]);

  const syncFoldersWithToken = useCallback(
    async (
      accessToken: string,
      userInfo?: { email?: string | null; displayName?: string | null; photoURL?: string | null }
    ) => {
      const params = new URLSearchParams();
      if (userInfo?.email) params.set('email', userInfo.email);
      if (userInfo?.displayName) params.set('displayName', userInfo.displayName);
      if (userInfo?.photoURL) params.set('photoURL', userInfo.photoURL);

      const summary = await apiRequest<DriveFolderSummary>(
        `/api/drive/folders?${params.toString()}`,
        {
          headers: { 'X-Google-Access-Token': accessToken },
        }
      );
      setDriveFolders(summary);
      return summary;
    },
    []
  );

  const connectDrive = useCallback(async (): Promise<string | null> => {
    setConnecting(true);
    try {
      const hint = googleUser?.email || undefined;
      const { user, accessToken } = await googleSignIn(hint);
      syncUserState(user, true);

      // Immediately create/verify ecom_store + subfolders in Google Drive & save to MongoDB
      try {
        await syncFoldersWithToken(accessToken, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
        showToast(`Google Drive connected & ecom_store folders created (${user.email})`);
      } catch (folderErr) {
        console.error('Failed to initialize Drive folders:', folderErr);
        showToast(
          folderErr instanceof Error
            ? `Connected, but folder setup failed: ${folderErr.message}`
            : 'Connected to Google Drive, could not verify folders yet',
          'error'
        );
      }

      if (pendingUpload) {
        const current = pendingUpload;
        setPendingUpload(null);
        setAuthModalOpen(false);
        try {
          const uploaded = await uploadImageToServerDrive({
            file: current.file,
            folder: current.folder,
            accessToken,
          });
          // Refresh folder file counts in background
          syncFoldersWithToken(accessToken).catch(() => {});
          current.resolve(uploaded);
        } catch (uploadErr) {
          current.reject(
            uploadErr instanceof Error ? uploadErr : new Error('Drive upload failed')
          );
        }
      } else {
        setAuthModalOpen(false);
      }

      return accessToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in cancelled';
      showToast(message, 'error');
      return null;
    } finally {
      setConnecting(false);
    }
  }, [googleUser?.email, pendingUpload, showToast, syncFoldersWithToken, syncUserState]);

  const disconnectDrive = useCallback(async () => {
    await logoutGoogleDrive();
    setHasActiveToken(false);
    setFirebaseSignedIn(false);
    setGoogleUser(null);
    setDriveFolders(null);
    try {
      await apiRequest('/api/settings/google-drive', {
        method: 'PUT',
        body: JSON.stringify({
          connected: false,
          email: '',
          displayName: '',
          photoURL: '',
          rootFolder: { id: '', name: 'ecom_store', webViewLink: '' },
          folders: [],
          lastSyncedAt: null,
        }),
      });
    } catch {
      // ignore settings clear failure
    }
    showToast('Disconnected from Google Drive');
  }, [showToast]);

  const uploadImageToDrive = useCallback(
    async (file: File, folder: DriveImageFolder) => {
      const maxBytes = 25 * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error('Image file is too large. Maximum allowed size is 25 MB.');
      }

      const token = getAccessToken();
      if (token) {
        try {
          const res = await uploadImageToServerDrive({ file, folder, accessToken: token });
          syncFoldersWithToken(token).catch(() => {});
          return res;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            clearAccessToken();
            setHasActiveToken(false);
          } else {
            throw err;
          }
        }
      }

      // Prompt user with Google Sign-In modal (safe click gesture for signInWithPopup)
      return new Promise<{ url: string; fileId: string; folderPath: string; webViewLink: string }>(
        (resolve, reject) => {
          setPendingUpload({ file, folder, resolve, reject });
          setAuthModalOpen(true);
        }
      );
    },
    [syncFoldersWithToken]
  );

  const confirmAndDeleteDriveImage = useCallback(
    async (imageUrl: string, itemLabel: string): Promise<boolean> => {
      const fileId = extractDriveFileId(imageUrl);
      if (!fileId) return true; // Not a Google Drive file

      const ok = await confirm({
        title: 'Delete Photo from Google Drive',
        message: `Are you sure you want to delete the uploaded photo for "${itemLabel}" from Google Drive? This action cannot be undone.`,
        confirmLabel: 'Delete from Drive',
        danger: true,
      });
      if (!ok) return false;

      const token = getAccessToken();
      if (!token) {
        setAuthModalOpen(true);
        showToast('Please resume your Google Drive session to delete files from Drive', 'error');
        return false;
      }

      try {
        await apiRequest(`/api/drive/files/${encodeURIComponent(fileId)}`, {
          method: 'DELETE',
          headers: { 'X-Google-Access-Token': token },
        });
        syncFoldersWithToken(token).catch(() => {});
        showToast('Photo deleted from Google Drive');
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearAccessToken();
          setHasActiveToken(false);
          setAuthModalOpen(true);
          showToast('Google Drive session expired. Please resume your session.', 'error');
        } else {
          showToast(err instanceof Error ? err.message : 'Failed to delete from Drive', 'error');
        }
        return false;
      }
    },
    [confirm, showToast, syncFoldersWithToken]
  );

  const fetchFolderSummary = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return driveFolders;
    try {
      return await syncFoldersWithToken(token, googleUser || undefined);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAccessToken();
        setHasActiveToken(false);
      }
      throw err;
    }
  }, [driveFolders, googleUser, syncFoldersWithToken]);

  const handleCloseAuthModal = () => {
    if (pendingUpload) {
      pendingUpload.reject(new Error('Google Drive sign-in cancelled before upload'));
      setPendingUpload(null);
    }
    setAuthModalOpen(false);
  };

  const connected = firebaseSignedIn || hasActiveToken;

  return (
    <GoogleDriveContext.Provider
      value={{
        connected,
        hasActiveToken,
        connecting,
        googleUser,
        driveFolders,
        connectDrive,
        disconnectDrive,
        uploadImageToDrive,
        confirmAndDeleteDriveImage,
        fetchFolderSummary,
      }}
    >
      {children}

      <Modal
        open={authModalOpen}
        onClose={handleCloseAuthModal}
        title={connected ? 'Resume Google Drive Session' : 'Connect Google Drive Storage'}
        subtitle="Photos are organized inside ecom_store in your Google Drive"
        size="sm"
      >
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-violet-50/70 border border-violet-100 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <HardDrive className="w-4 h-4 text-[#6D28D9]" />
              <span>Target Google Drive Folder</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#5B21B6] bg-white px-3 py-2 rounded-lg border border-violet-100">
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>ecom_store/{pendingUpload?.folder || 'product_image'}</span>
            </div>
            {pendingUpload && (
              <p className="text-xs text-slate-600">
                Pending photo: <strong className="text-slate-900">{pendingUpload.file.name}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Uploads go directly into:{' '}
                <code className="font-mono text-slate-800">ecom_store/profile_image</code>,{' '}
                <code className="font-mono text-slate-800">category_image</code>,{' '}
                <code className="font-mono text-slate-800">product_image</code>,{' '}
                <code className="font-mono text-slate-800">store_logo</code>.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {connected
                  ? `Confirm once for ${googleUser?.email || 'your Google account'} after page refresh to activate uploads in this tab.`
                  : 'With your permission, ShopAdmin creates the ecom_store folders in Drive and saves image URLs in MongoDB.'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseAuthModal}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <GoogleSignInButton
              onClick={connectDrive}
              disabled={connecting}
              label={
                connecting
                  ? 'Connecting…'
                  : connected
                  ? 'Resume Google Drive'
                  : 'Sign in with Google'
              }
            />
          </div>
        </div>
      </Modal>
    </GoogleDriveContext.Provider>
  );
}

export function useGoogleDrive() {
  const ctx = useContext(GoogleDriveContext);
  if (!ctx) throw new Error('useGoogleDrive must be used within GoogleDriveProvider');
  return ctx;
}
