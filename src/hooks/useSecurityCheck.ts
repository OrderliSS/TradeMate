import { useUserRoles } from './useUserRoles';
import { useUserProfile, UserProfile } from './useUserProfile';

export const useSecurityCheck = () => {
  const { profile, loading: profileLoading } = useUserProfile();
  const { isAdmin, isSecurity, loading: rolesLoading } = useUserRoles();

  return {
    isSecurityOrAdmin: isAdmin || isSecurity,
    loading: profileLoading || rolesLoading,
    profile: profile as UserProfile | null
  };
};

export const useIsSecurityOrAdmin = () => {
  const { isSecurityOrAdmin, loading } = useSecurityCheck();
  return { isSecurityOrAdmin, loading };
};