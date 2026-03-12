import { useIsAdmin } from './useAdminCheck';
import { useUserRoles } from './useUserRoles';

export interface FieldPermissions {
  canEditBasicInfo: boolean;
  canEditPricing: boolean;
  canEditStock: boolean;
  canEditSpecifications: boolean;
  canEditAdvanced: boolean;
}

export const useFieldPermissions = (): FieldPermissions => {
  const { isAdmin } = useIsAdmin();
  const { isFinance, isSecurity } = useUserRoles();
  
  return {
    canEditBasicInfo: isAdmin || isSecurity,
    canEditPricing: isAdmin || isFinance,
    canEditStock: isAdmin || isSecurity,
    canEditSpecifications: isAdmin,
    canEditAdvanced: isAdmin,
  };
};

export const useCanEditField = (fieldType: keyof FieldPermissions): boolean => {
  const permissions = useFieldPermissions();
  return permissions[fieldType];
};