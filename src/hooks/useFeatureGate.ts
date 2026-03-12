import { useOrganization } from '@/contexts/OrganizationContext';

export function useFeatureGate() {
    const { currentOrganization } = useOrganization();

    // Guard against missing context or organization data
    const businessCategories = currentOrganization?.business_categories || [];

    /**
     * Check if a specific category slug is active for the current organization
     */
    const hasCategory = (slug: string): boolean => {
        return businessCategories.includes(slug);
    };

    /**
     * Check if ANY of the provided category slugs are active
     */
    const hasAnyCategory = (slugs: string[]): boolean => {
        return slugs.some((slug) => businessCategories.includes(slug));
    };

    /**
     * Check if ALL of the provided category slugs are active
     */
    const hasAllCategories = (slugs: string[]): boolean => {
        if (slugs.length === 0) return true;
        return slugs.every((slug) => businessCategories.includes(slug));
    };

    return {
        hasCategory,
        hasAnyCategory,
        hasAllCategories,
        activeCategories: businessCategories,
    };
}
