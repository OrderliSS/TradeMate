/**
 * Supabase Client - Unified Environment-Aware Export
 * 
 * This file re-exports the environment-aware client to ensure all imports
 * use the correct Supabase project based on build-time environment variables.
 * 
 * DEV builds (Lovable): Uses hardcoded DEV fallbacks
 * PROD builds (Vercel): Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 */

export { 
  supabase, 
  rawSupabase, 
  getSupabaseClient,
  getEnvironmentInfo,
  validateEnvironmentConnection 
} from '@/lib/environment-client';

// Re-export Database type for convenience
export type { Database } from './types';
