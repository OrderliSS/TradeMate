import { useState, useMemo } from 'react';
import type { AssetManagementWithDetails } from './useAssetManagement';
import { getAssetAvailableForCustomer, getAvailableStatusCounts } from '@/lib/asset-ready-status';

export interface AssetFilters {
  selectedStatuses: string[];
  selectedTransitStatuses: string[];
  selectedAvailableStatuses: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const useAssetFilters = () => {
  const [filters, setFilters] = useState<AssetFilters>({
    selectedStatuses: [],
    selectedTransitStatuses: [],
    selectedAvailableStatuses: [],
    sortBy: 'asset_tag',
    sortOrder: 'asc'
  });

  const updateStatusFilters = (statuses: string[]) => {
    setFilters(prev => ({ ...prev, selectedStatuses: statuses }));
  };

  const updateTransitFilters = (transitStatuses: string[]) => {
    setFilters(prev => ({ ...prev, selectedTransitStatuses: transitStatuses }));
  };

  const updateAvailableFilters = (availableStatuses: string[]) => {
    setFilters(prev => ({ ...prev, selectedAvailableStatuses: availableStatuses }));
  };

  const updateSort = (sortBy: string, sortOrder?: 'asc' | 'desc') => {
    setFilters(prev => ({ 
      ...prev, 
      sortBy,
      sortOrder: sortOrder || prev.sortOrder
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      selectedStatuses: [],
      selectedTransitStatuses: [],
      selectedAvailableStatuses: [],
      sortBy: 'asset_tag',
      sortOrder: 'asc'
    });
  };

  const getFilteredAndSortedAssets = (
    assets: AssetManagementWithDetails[], 
    searchQuery: string = ''
  ) => {
    return useMemo(() => {
      let filtered = assets;

      // Apply search filter
      if (searchQuery) {
        filtered = filtered.filter(asset => 
          asset.asset_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asset.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asset.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asset.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Apply status filters
      if (filters.selectedStatuses.length > 0) {
        filtered = filtered.filter(asset => 
          filters.selectedStatuses.includes(asset.status)
        );
      }

      // Apply transit status filters
      if (filters.selectedTransitStatuses.length > 0) {
        filtered = filtered.filter(asset => 
          asset.transit_status && filters.selectedTransitStatuses.includes(asset.transit_status)
        );
      }

      // Apply available status filters
      if (filters.selectedAvailableStatuses.length > 0) {
        filtered = filtered.filter(asset => {
          const availableResult = getAssetAvailableForCustomer(asset);
          return filters.selectedAvailableStatuses.includes(availableResult.status);
        });
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sortBy) {
          case 'asset_tag':
            aValue = a.asset_tag || '';
            bValue = b.asset_tag || '';
            break;
          case 'status':
            // Custom status priority: ordered > instock > allocated > being_configured > ready > sold > gifted_in > gifted_out > other
            const statusPriority = { 
              'ordered': 0,
              'instock': 1, 
              'allocated': 2, 
              'being_configured': 3,
              'ready': 4,
              'sold': 5,
              'gifted_in': 6, 
              'gifted_out': 7
            };
            aValue = statusPriority[a.status as keyof typeof statusPriority] ?? 999;
            bValue = statusPriority[b.status as keyof typeof statusPriority] ?? 999;
            break;
          case 'created_at':
            aValue = new Date(a.created_at || 0);
            bValue = new Date(b.created_at || 0);
            break;
          case 'location':
            aValue = a.location || '';
            bValue = b.location || '';
            break;
          case 'assigned_to':
            aValue = a.assigned_to || '';
            bValue = b.assigned_to || '';
            break;
          case 'ready':
            // Sort by ready status: ready first, then configuring, then not-applicable
            const readyPriority = { 'available': 0, 'configuring': 1, 'not-applicable': 2 };
            aValue = readyPriority[getAssetAvailableForCustomer(a).status];
            bValue = readyPriority[getAssetAvailableForCustomer(b).status];
            break;
          default:
            aValue = '';
            bValue = '';
        }

        if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    }, [assets, searchQuery, filters]);
  };

  // Helper function to determine if an asset is secondary (auto-available when instock)
  const isSecondaryAsset = (asset: AssetManagementWithDetails) => {
    // Secondary assets are typically consumables like batteries, cables, etc.
    const secondaryCategories = ['battery', 'cable', 'accessory', 'consumable'];
    return secondaryCategories.some(cat => 
      asset.category?.toLowerCase().includes(cat) ||
      asset.product?.category?.toLowerCase().includes(cat) ||
      asset.product?.name?.toLowerCase().includes(cat)
    );
  };

  const getStatusCounts = (assets: AssetManagementWithDetails[]) => {
    return useMemo(() => {
      // Unified ready count: combines primary 'ready' + secondary 'instock' + 'active' assets
      const unifiedReady = assets.filter(a => {
        if (a.status === 'ready') return true;
        if (a.status === 'active') return true; // Handle 'active' as ready
        if (a.status === 'instock' && isSecondaryAsset(a)) return true;
        return false;
      }).length;

      // Primary instock count: excludes secondary assets that are auto-available
      const primaryInstock = assets.filter(a => 
        a.status === 'instock' && !isSecondaryAsset(a)
      ).length;

      // Inbound transit: ordered items that are in transit
      const inboundTransit = assets.filter(a => 
        a.status === 'ordered' && ['pending_transit', 'in_transit'].includes(a.transit_status || '')
      ).length;

        return {
          // Core business flow metrics (in order)
          ordered: assets.filter(a => a.status === 'ordered' && !['pending_transit', 'in_transit'].includes(a.transit_status || '')).length,
          inbound_transit: inboundTransit,
          instock: primaryInstock,
          being_configured: assets.filter(a => a.status === 'being_configured').length,
          ready: unifiedReady,
          allocated: assets.filter(a => a.status === 'allocated').length,
          sold: assets.filter(a => a.status === 'sold').length,
          // Additional statuses
          gifted_out: assets.filter(a => a.status === 'gifted_out').length,
          gifted_in: assets.filter(a => a.status === 'gifted_in').length,
          delivered: assets.filter(a => 
            ['delivered', 'completed'].includes(a.transit_status || '')
          ).length
        };
    }, [assets]);
  };

  return {
    filters,
    updateStatusFilters,
    updateTransitFilters,
    updateAvailableFilters,
    updateSort,
    clearAllFilters,
    getFilteredAndSortedAssets,
    getStatusCounts
  };
};