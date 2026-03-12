import { useSandbox as useSandboxContext } from '@/contexts/SandboxContext';

/**
 * Hook to access sandbox context
 * Re-export from context for convenience
 */
export function useSandbox() {
  return useSandboxContext();
}

/**
 * Hook to get the current data environment
 * Returns 'production' or 'sandbox'
 */
export function useDataEnvironment() {
  const { dataEnvironment } = useSandboxContext();
  return dataEnvironment;
}

/**
 * Hook to check if currently in sandbox mode
 */
export function useIsSandboxMode() {
  const { isSandboxMode } = useSandboxContext();
  return isSandboxMode;
}
