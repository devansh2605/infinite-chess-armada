// Supabase is loaded via CDN script tag in index.html (window.supabase)
// This avoids bundling the modern ES module through Webpack 3 / Babel 6
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = window.supabase.createClient(supabaseUrl || '', supabaseAnonKey || '');

export default supabase;
