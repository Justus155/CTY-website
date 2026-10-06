import { supabase } from "./supabaseclient.js";

// Pages including this guard must hide <html> synchronously first to avoid a flash of protected content.
const root = document.documentElement;

function redirectToSignIn() {
  const signIn = new URL("../login/signin.html", import.meta.url);
  signIn.searchParams.set("redirect", location.pathname + location.search + location.hash);
  location.replace(signIn.href);
}

try {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    root.style.visibility = "";
  } else {
    redirectToSignIn();
  }
} catch {
  redirectToSignIn();
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) redirectToSignIn();
});
