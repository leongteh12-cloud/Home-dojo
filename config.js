// Connects the app to your family's database.
// Both values come from Supabase > Project Settings > API. They are designed to be public:
// your data is protected by the sign-in and access rules in supabase/schema.sql.
window.HOME_DOJO_CONFIG = {
  supabaseUrl: "https://vlalduxgkxumndlqvktk.supabase.co",      // e.g. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "sb_publishable__6K4rZLKp7_Dy7YGU6LdpQ_fVDnn_NA"   // the publishable (or legacy "anon public") key
};
