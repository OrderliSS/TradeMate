import { Environment, getCurrentEnvironment } from '@/lib/environment-utils';

/**
 * React hook that returns the current environment.
 * Simplified: environment is now build-time only (VITE_APP_ENV).
 * The legacy ?env= URL parameter override has been removed.
 */
export const useEnvironment = (): Environment => {
  return getCurrentEnvironment();
};
