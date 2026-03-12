import { useQuery } from '@tanstack/react-query';
import { productionClient } from '@/lib/production-client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { logger } from '@/lib/logger';
import { getCurrentEnvironment } from '@/lib/environment-utils';

export type AppRole =
  | 'admin'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'security'
  | 'employee'
  | 'crew_member'
  | 'founder'
  | 'director'
  | 'foreman'
  | 'tradesperson'
  | 'apprentice'
  | 'labourer'
  | 'super_user'
  | 'support_l2'
  | 'support_l1'
  | 'technician';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export const useUserRoles = () => {
  const { user } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const targetUserId = impersonatedUser?.id || user?.id;

  const { data: roles, isLoading: loading, refetch } = useQuery<AppRole[]>({
    queryKey: ['user-roles', targetUserId],
    queryFn: async (): Promise<AppRole[]> => {
      if (!targetUserId) return [];

      const currentEnv = getCurrentEnvironment();
      console.log(`[USER_ROLES] Fetching roles for user: ${user.id} in ${currentEnv} environment`);
      const startTime = Date.now();

      try {
        // Query user_roles table from PRODUCTION - roles are unified with auth
        const { data, error } = await productionClient
          .from('user_roles')
          .select('role')
          .eq('user_id', targetUserId);

        const duration = Date.now() - startTime;
        console.log(`[USER_ROLES] Query completed in ${duration}ms`);

        if (error) {
          console.error('[USER_ROLES] Database error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          logger.error('Error fetching user roles:', error);
          throw error;
        }

        const fetchedRoles = data?.map(r => r.role as AppRole) || [];

        console.log('[USER_ROLES] Roles fetched successfully:', {
          roles: fetchedRoles,
          email: user.email,
          environment: currentEnv,
        });

        // Debug logging for multi-database troubleshooting
        logger.info(`[${currentEnv.toUpperCase()}] Roles for user ${targetUserId}:`, {
          roles: fetchedRoles,
          email: impersonatedUser?.email || user?.email,
          environment: currentEnv,
        }, 'USER_ROLES');

        // Sync admin role to auth metadata to power God Mode RLS
        if (targetUserId === user?.id) {
          const hasAdminRole = fetchedRoles.includes('admin');
          const metadataRole = user?.user_metadata?.role;

          if (hasAdminRole && metadataRole !== 'admin') {
            productionClient.auth.updateUser({ data: { role: 'admin' } })
              .catch(err => console.error('[USER_ROLES] Failed to add admin role to auth metadata:', err));
          } else if (!hasAdminRole && metadataRole === 'admin') {
            productionClient.auth.updateUser({ data: { role: null } })
              .catch(err => console.error('[USER_ROLES] Failed to remove admin role from auth metadata:', err));
          }
        }

        return fetchedRoles;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`[USER_ROLES] Fetch failed after ${duration}ms:`, {
          name: error?.name,
          message: error?.message,
          stack: error?.stack?.split('\n').slice(0, 3),
        });
        logger.error('Error fetching user roles:', error);
        throw error;
      }
    },
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  const hasRole = (role: AppRole) => {
    return roles?.includes(role) || false;
  };

  const isAdmin = hasRole('admin');
  const isSales = hasRole('sales');
  const isMarketing = hasRole('marketing');
  const isFinance = hasRole('finance');
  const isSecurity = hasRole('security');
  const isEmployee = hasRole('employee');

  return {
    roles: roles || [],
    loading,
    hasRole,
    isAdmin,
    isSales,
    isMarketing,
    isFinance,
    isSecurity,
    isEmployee,
    refetch
  };
};
