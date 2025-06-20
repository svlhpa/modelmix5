import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// For production deployment, provide fallback behavior
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Some features may not work.');
}

// Create a mock client if environment variables are missing (for demo purposes)
const createMockClient = () => ({
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Demo mode - authentication disabled' } }),
    signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Demo mode - authentication disabled' } }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    resend: () => Promise.resolve({ error: { message: 'Demo mode - email disabled' } }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: { message: 'Demo mode - database disabled' } }),
    update: () => ({ data: null, error: { message: 'Demo mode - database disabled' } }),
    delete: () => ({ data: null, error: { message: 'Demo mode - database disabled' } }),
    upsert: () => ({ data: null, error: { message: 'Demo mode - database disabled' } }),
    eq: function() { return this; },
    neq: function() { return this; },
    order: function() { return this; },
    limit: function() { return this; },
    single: function() { return this; },
    maybeSingle: function() { return this; },
  }),
  rpc: () => Promise.resolve({ data: null, error: { message: 'Demo mode - RPC disabled' } }),
});

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createMockClient() as any;