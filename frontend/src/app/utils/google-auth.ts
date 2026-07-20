import { environment } from "../../environments/environment";

declare const google: any;

let gisScriptPromise: Promise<void> | null = null;

/**
 * Check if the Google Client ID is a placeholder (not yet configured).
 */
export function isGoogleClientIdPlaceholder(): boolean {
  return (
    !environment.googleClientId ||
    environment.googleClientId.includes("REPLACE_WITH_GOOGLE_CLIENT_ID")
  );
}

/**
 * Load the Google Identity Services script dynamically.
 * Uses a module-level promise to deduplicate concurrent calls.
 */
export function loadGoogleIdentityServicesScript(): Promise<void> {
  // If already available, resolve immediately
  if ((window as any).google?.accounts?.id) return Promise.resolve();

  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.gis = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null; // Allow retry on failure
      reject(new Error("Failed to load Google Identity Services script"));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

/**
 * Initialize the Google One Tap / Sign-In button.
 * Returns a cleanup function to call on destroy.
 */
export function initializeGoogleSignIn(
  callback: (credential: string) => void,
  onError?: (error: unknown) => void,
): () => void {
  let cancelled = false;

  loadGoogleIdentityServicesScript()
    .then(() => {
      if (cancelled) return;
      if (!google?.accounts?.id) {
        throw new Error("Google Identity Services SDK not available");
      }

      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => {
          const credential = response?.credential;
          if (credential) {
            callback(credential);
          }
        },
      });

      const btnEl = document.getElementById("googleBtn");
      if (btnEl) {
        google.accounts.id.renderButton(btnEl, {
          theme: "outline",
          size: "large",
        });
      }
    })
    .catch((err) => {
      if (onError) onError(err);
    });

  return () => {
    cancelled = true;
  };
}
