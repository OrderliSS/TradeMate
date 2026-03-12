import { useQuery } from '@tanstack/react-query';
import { productionClient } from '@/lib/production-client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { SecureEnvironment } from '@/lib/secure-environment';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  employee_id?: string;
  subscription_tier: 'free' | 'starter';
  stripe_customer_id?: string;
  subscription_end?: string;
  profession_category?: string;
  default_sidebar_pinned?: boolean;
  default_dashboard_version?: 'CLASSIC' | 'MODERN';
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const targetUserId = impersonatedUser?.id || user?.id;

  const { data: profile, isLoading: loading } = useQuery<UserProfile | null>({
    queryKey: ['user-profile', targetUserId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!targetUserId) return null;

      try {
        // Query profiles table from PRODUCTION - profiles are unified with auth
        const { data, error } = await productionClient
          .from('profiles')
          .select('id, email, full_name, employee_id, subscription_tier, stripe_customer_id, subscription_end, profession_category, default_sidebar_pinned, default_dashboard_version')
          .eq('id', targetUserId)
          .maybeSingle();

        if (error) {
          SecureEnvironment.error('Error fetching profile:', error);
          // Handle schema errors gracefully (common in unconfigured environments)
          // 42703 = column does not exist, 42P01 = table does not exist
          if (error.code === '42703' || error.code === '42P01') {
            console.warn('[useUserProfile] Database schema incomplete, returning null profile');
            return null;
          }
          throw error;
        }

        return data as UserProfile;
      } catch (error: any) {
        SecureEnvironment.error('Error fetching profile:', error);
        // Also catch schema errors in case they bubble up differently
        if (error?.code === '42703' || error?.code === '42P01') {
          console.warn('[useUserProfile] Database schema incomplete, returning null profile');
          return null;
        }
        throw error;
      }
    },
    enabled: !!targetUserId,
    staleTime: 60 * 1000, // 1 minute for better reactivity
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on schema errors - they won't resolve themselves
      if (error?.code === '42703' || error?.code === '42P01') return false;
      return failureCount < 3;
    },
  });

  return { profile, loading };
};