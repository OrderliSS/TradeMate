import { useUserProfile } from './useUserProfile';

export const useOnboardingStatus = () => {
  const { profile, loading } = useUserProfile();

  const isGhost = localStorage.getItem('orderli_ghost_active') === 'true';
  const needsOnboarding = !loading && profile && !profile.profession_category && !isGhost;

  return {
    needsOnboarding,
    loading,
    profile,
  };
};
