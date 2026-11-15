import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory only caching per Workspace Integration security rule (never localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
}

export async function googleSignIn(loginHint?: string): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    provider.setCustomParameters(
      loginHint ? { login_hint: loginHint } : { prompt: 'select_account' }
    );
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Drive access token from sign-in');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearAccessToken(): void {
  cachedAccessToken = null;
}

export async function logoutGoogleDrive(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export function getCurrentGoogleUser(): User | null {
  return auth.currentUser;
}

export function extractDriveFileId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('drive.google.com')) {
      const idParam = parsed.searchParams.get('id');
      if (idParam) return idParam;
      const match = parsed.pathname.match(/\/d\/([^/]+)/);
      if (match?.[1]) return match[1];
    }
    if (parsed.hostname.includes('googleusercontent.com')) {
      const match = parsed.pathname.match(/\/d\/([^/=]+)/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Not a full URL
  }
  return null;
}
