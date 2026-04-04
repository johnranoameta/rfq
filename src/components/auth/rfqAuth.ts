const AUTH_STORAGE_KEY = "rfq-authenticated";

const HARD_USERNAME = "RFQ1";
const HARD_PASSWORD = "Manu1a!";

export function verifyHardcodedLogin(username: string, password: string) {
  return username === HARD_USERNAME && password === HARD_PASSWORD;
}

export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(AUTH_STORAGE_KEY) === "1" ||
      window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/** Persist on this device (localStorage) or until browser session ends (sessionStorage). */
export function completeSignIn(rememberDevice: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (rememberDevice) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function logout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}
