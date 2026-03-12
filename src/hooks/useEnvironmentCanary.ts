import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentEnvironment } from '@/lib/environment-utils';

export type CanaryStatus = 'ok' | 'mismatch' | 'missing' | 'loading' | 'error';

export interface CanaryResult {
  status: CanaryStatus;
  expectedCanary: string;
  foundCanary: string | null;
  message: string;
}

const CANARY_PREFIX = 'ENV-';
const CANARY_PATTERNS = {
  development: 'ENV-DEV',
  test: 'ENV-TEST',
  staging: 'ENV-STAGING',
  production: 'ENV-PROD',
} as const;

export const useEnvironmentCanary = () => {
  const currentEnv = getCurrentEnvironment();
  const expectedCanary = CANARY_PATTERNS[currentEnv] || CANARY_PATTERNS.development;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['environment-canary', currentEnv],
    queryFn: async (): Promise<CanaryResult> => {
      // Look for any vendor shop starting with ENV-
      const { data: canaryVendors, error: queryError } = await supabase
        .from('vendor_shops')
        .select('shop_name')
        .ilike('shop_name', `${CANARY_PREFIX}%`)
        .limit(5);

      if (queryError) {
        console.error('Canary check failed:', queryError);
        return {
          status: 'error',
          expectedCanary,
          foundCanary: null,
          message: `Failed to check environment canary: ${queryError.message}`,
        };
      }

      // No canary found
      if (!canaryVendors || canaryVendors.length === 0) {
        return {
          status: 'missing',
          expectedCanary,
          foundCanary: null,
          message: `No environment canary found. Expected: ${expectedCanary}`,
        };
      }

      // Check if any found canary matches expected
      const foundCanaries = canaryVendors.map(v => v.shop_name);
      const hasCorrectCanary = foundCanaries.some(name => 
        name.toUpperCase().includes(expectedCanary)
      );

      // Check for wrong environment canaries
      const wrongCanaries = foundCanaries.filter(name => {
        const upperName = name.toUpperCase();
        return upperName.includes(CANARY_PREFIX) && !upperName.includes(expectedCanary);
      });

      if (wrongCanaries.length > 0) {
        const wrongEnv = wrongCanaries[0];
        return {
          status: 'mismatch',
          expectedCanary,
          foundCanary: wrongEnv,
          message: `⚠️ ENVIRONMENT MISMATCH: Found "${wrongEnv}" but expected "${expectedCanary}". Data may be cross-wired!`,
        };
      }

      if (hasCorrectCanary) {
        return {
          status: 'ok',
          expectedCanary,
          foundCanary: foundCanaries[0],
          message: `Environment verified: ${expectedCanary}`,
        };
      }

      return {
        status: 'missing',
        expectedCanary,
        foundCanary: null,
        message: `No matching canary found. Expected: ${expectedCanary}`,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    canaryResult: data,
    isLoading,
    error,
    refetch,
    status: isLoading ? 'loading' : (data?.status || 'error'),
  };
};
