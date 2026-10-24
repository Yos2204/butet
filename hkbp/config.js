// HKBP Singapore app settings. Fill these in once the free Supabase project is set up
// (see README.md). Both keys below are public by design and safe to commit.
// While supabaseUrl is empty, the app runs in "this phone only" demo mode.
window.HKBP_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcd1234.supabase.co"
  supabaseKey: "",      // the "anon public" key from Supabase > Project Settings > API
  vapidPublicKey: "",   // from `npx web-push generate-vapid-keys` (public half only)
  churchName: "HKBP Singapore",
  timeZone: "Asia/Singapore",
};
