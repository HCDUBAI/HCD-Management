// HC Dubai V11
// Configuration

window.APP_VERSION = "11.0.0";

const SUPABASE_URL =
"https://tmumqexadofvktsqwlnu.supabase.co";

const SUPABASE_KEY =
"sb_publishable_GJUesAyLLq_qzokIFY-1Bg_f09qpNWq";

window.sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);