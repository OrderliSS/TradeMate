import { useUserRoles } from './useUserRoles';
import { useUserProfile } from './useUserProfile';

/**
 * Helper hook that provides both profile data and role checks
 * Useful for components that need both user profile info and role-based access control
 */
export const useUserWithRoles = () => {
  const { profile, loading: profileLoading } = useUserProfile();
  const { 
    roles,
    isAdmin, 
    isSales, 
    isMarketing, 
    isFinance, 
    isSecurity, 
    isEmployee,
    hasRole,
    loading: rolesLoading 
  } = useUserRoles();

  return {
    profile,
    roles,
    isAdmin,
    isSales,
    isMarketing,
    isFinance,
    isSecurity,
    isEmployee,
    hasRole,
    loading: profileLoading || rolesLoading
  };
};
