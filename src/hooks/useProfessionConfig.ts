import { useMemo } from 'react';
import { useUserProfile } from './useUserProfile';
import { 
  ProfessionCategory, 
  getProfessionConfig, 
  getRoleLabel, 
  isRoleRelevant,
  PROFESSION_CATEGORIES,
  DEFAULT_ROLE_LABELS
} from '@/lib/profession-config';
import { AppRole } from './useUserRoles';

export const useProfessionConfig = () => {
  const { profile, loading } = useUserProfile();

  const professionCategory = profile?.profession_category as ProfessionCategory | null;

  const config = useMemo(() => {
    return getProfessionConfig(professionCategory);
  }, [professionCategory]);

  const getLabel = (role: AppRole): string => {
    return getRoleLabel(role, professionCategory);
  };

  const isRelevant = (role: AppRole): boolean => {
    return isRoleRelevant(role, professionCategory);
  };

  const relevantRoles = useMemo(() => {
    return config.relevantRoles;
  }, [config]);

  return {
    professionCategory,
    config,
    relevantRoles,
    getRoleLabel: getLabel,
    isRoleRelevant: isRelevant,
    loading,
    allCategories: PROFESSION_CATEGORIES,
    defaultRoleLabels: DEFAULT_ROLE_LABELS,
  };
};
