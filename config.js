// Supabase configuration
const SUPABASE_URL = "https://xdjiskvnetnxsiazadzm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkamlza3ZuZXRueHNpYXphZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDgzMTEsImV4cCI6MjEwNjYyNDMxMX0.tdStr4yyOzzX-OFwamz8iBCeoEvSW4WxKOSedDuUF5k";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);