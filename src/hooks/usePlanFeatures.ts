import { useOrganization } from '@/contexts/OrganizationContext';
import { PlanFeatures, TIER_FEATURES, PlanTier } from '@/types/billing';

export function usePlanFeatures() {
    const { currentOrganization } = useOrganization();

    const tier: PlanTier = (currentOrganization?.subscription_tier as PlanTier) || 'free';

    const features: PlanFeatures = TIER_FEATURES[tier] || TIER_FEATURES['free'];

    // Debug/Dev override capability could be added here

    return {
        tier,
        features,
        // Helper to check a specific boolean feature quickly
        hasFeature: (feature: keyof Omit<PlanFeatures, 'role_configuration' | 'user_limit_soft'>) => {
            return !!features[feature];
        },
        // Role config check
        roleConfigMode: features.role_configuration,
    };
}
