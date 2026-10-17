// Connects the app to your family's database.
// Both values come from Supabase > Project Settings > API. They are designed to be public:
// your data is protected by the sign-in and access rules in supabase/schema.sql.
window.HOME_DOJO_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcdefgh.supabase.co"
  supabaseAnonKey: ""   // the "anon public" key
};
