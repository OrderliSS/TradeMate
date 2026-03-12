import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BusinessCategory = 'Starter' | 'Service Ops' | 'IT Tech Services' | 'Logistics' | 'Enterprise';

export interface Permissions {
    intelligence_hub: boolean;
    advanced_analytics: boolean;
    service_ops_tools: boolean;
}

const DEFAULT_PERMISSIONS: Record<BusinessCategory, Permissions> = {
    'Starter': { intelligence_hub: false, advanced_analytics: false, service_ops_tools: false },
    'Service Ops': { intelligence_hub: true, advanced_analytics: true, service_ops_tools: true },
    'IT Tech Services': { intelligence_hub: true, advanced_analytics: true, service_ops_tools: true },
    'Logistics': { intelligence_hub: true, advanced_analytics: true, service_ops_tools: false },
    'Enterprise': { intelligence_hub: true, advanced_analytics: true, service_ops_tools: true },
};

const mergePermissions = (categories: BusinessCategory[]): Permissions => {
    const merged: Permissions = {
        intelligence_hub: false,
        advanced_analytics: false,
        service_ops_tools: false,
    };

    categories.forEach(cat => {
        const perms = DEFAULT_PERMISSIONS[cat];
        if (perms) {
            merged.intelligence_hub = merged.intelligence_hub || perms.intelligence_hub;
            merged.advanced_analytics = merged.advanced_analytics || perms.advanced_analytics;
            merged.service_ops_tools = merged.service_ops_tools || perms.service_ops_tools;
        }
    });

    return merged;
};

interface TierState {
    businessCategories: BusinessCategory[];
    permissions: Permissions;
    setCategories: (categories: BusinessCategory[]) => void;
    syncPermissions: (data: { categories: BusinessCategory[]; dashboard_access?: Permissions }) => void;
    hasCategory: (category: BusinessCategory) => boolean;
    hasIT: () => boolean;
    hasLogistics: () => boolean;
}

/** * 📝 HANDOVER NOTE: ORDERLI TIER STORE
 * Centralized permissions management for feature gating.
 * Uses granular flags to allow for modular connectivity (e.g., Trades Pro).
 */
export const useTierStore = create<TierState>()(
    persist(
        (set, get) => ({
            businessCategories: ['Starter'], // Default categories
            permissions: DEFAULT_PERMISSIONS['Starter'],

            setCategories: (categories: BusinessCategory[]) => set({
                businessCategories: categories,
                permissions: mergePermissions(categories)
            }),

            syncPermissions: (data) => set({
                businessCategories: data.categories,
                permissions: data.dashboard_access || mergePermissions(data.categories)
            }),

            hasCategory: (category) => get().businessCategories.includes(category),
            hasIT: () => get().businessCategories.includes('IT Tech Services') || get().businessCategories.includes('Service Ops'),
            hasLogistics: () => get().businessCategories.includes('Logistics'),
        }),
        {
            name: 'orderli-tier-storage',
            migrate: (persistedState: any, version) => {
                // If it's an old state with `userTier` string, convert it to array
                const state = persistedState as any;
                if (state && 'userTier' in state && typeof state.userTier === 'string') {
                    return {
                        ...state,
                        businessCategories: [state.userTier],
                        permissions: mergePermissions(state.userTier ? [state.userTier as BusinessCategory] : ['Starter']),
                    } as unknown as TierState;
                }
                return state as TierState;
            }
        }
    )
);
