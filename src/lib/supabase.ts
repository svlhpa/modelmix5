import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Get environment variables with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dhodiovlbczrdxawuorv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRob2Rpb3ZsYmN6cmR4YXd1b3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMjk0MDQsImV4cCI6MjA2NTgwNTQwNH0.O9jrnzQpem8YkyP-4079Hd0AQm_l-a6b3MgRtsETZGU';

// Validate that we have the required values
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase configuration:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing',
    env: import.meta.env
  });
  throw new Error('Missing Supabase environment variables. Please check your configuration.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);