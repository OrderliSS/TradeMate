import { useUserRoles } from './useUserRoles';
import { useUserProfile, UserProfile } from './useUserProfile';

export const useAdminCheck = () => {
  const { profile, loading: profileLoading } = useUserProfile();
  const { isAdmin, loading: rolesLoading } = useUserRoles();

  return {
    isAdmin,
    loading: profileLoading || rolesLoading,
    profile: profile as UserProfile | null
  };
};

export const useIsAdmin = () => {
  const { isAdmin, loading } = useAdminCheck();
  return { isAdmin, loading };
};