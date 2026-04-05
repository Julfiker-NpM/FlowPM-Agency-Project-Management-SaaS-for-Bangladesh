import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
} from "firebase/auth";

function errCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

/** Popup first; falls back to full-page redirect if the browser blocks the pop-up. */
export async function signInWithGooglePopupOrRedirect(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e: unknown) {
    const code = errCode(e);
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}
