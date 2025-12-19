
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.0';

// --- CONFIGURATION ---
// Since we cannot use .env files in this environment, we paste the credentials directly here.
const supabaseUrl = 'https://gggzfbcprraubeffsohc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZ3pmYmNwcnJhdWJlZmZzb2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjQyNjksImV4cCI6MjA4MTc0MDI2OX0.ryknxfaYnjv_gLhAgDQ-tCzHbmuDaNMLJsLTtS28xSI';
// ---------------------

export const isMockMode = false;

// Initialize the Supabase client directly
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
