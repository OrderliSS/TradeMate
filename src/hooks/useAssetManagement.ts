import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { detectAssetCategory } from "@/lib/asset-categories";
import { useEffect } from "react";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

export interface AssetManagement {
  id: string;
  product_id?: string;
  serial_number?: string;
  mac_address?: string;
  ip_address?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  location?: string;
  status: string;
  purchase_id?: string;
  assigned_to?: string;
  notes?: string;
  asset_tag?: string;
  manufacturer?: string;
  model_number?: string;
  firmware_version?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  parent_asset_id?: string;
  asset_type: string;
  pack_position?: number;
  is_consumable: boolean;
  category: string;
  sold_price?: number;
  pricing_notes?: string;
  purchase_order_id?: string;
  asset_priority?: 'primary' | 'secondary';
  primary_asset_id?: string;
  transit_status?: 'available' | 'pending_transit' | 'in_transit' | 'being_configured' | 'delivered' | 'completed';
  transit_date?: string;
  expected_delivery_date?: string;
  pre_allocated_in_transit?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetManagementWithDetails extends AssetManagement {
  product?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    connectivity?: string;
    quantity_per_pack?: number;
    is_multi_unit?: boolean;
    asset_priority?: 'primary' | 'secondary';
  };
  purchase?: {
    id: string;
    purchase_date: string;
    total_amount: number;
  };
  parent_asset?: {
    id: string;
    asset_tag: string;
    asset_type: string;
  };
  primary_asset?: {
    id: string;
    asset_tag: string;
    asset_type: string;
    product?: {
      name: string;
    };
  };
  allocations?: Array<{
    id: string;
    status: string;
    allocated_at: string;
    notes?: string;
    purchase_order?: {
      id: string;
      ticket_number?: string;
      receipt_number?: string;
      total_amount?: number;
      order_status?: string;
      pickup_date?: string;
      customer?: {
        name: string;
      };
    };
    expense?: {
      id: string;
      name: string;
      order_number?: string;
    };
  }>;
  child_assets?: AssetManagement[];
  secondary_assets?: AssetManagement[];
}

export const useAssetManagement = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  // Set up real-time subscriptions for asset changes
  useEffect(() => {
    const channel = supabase
      .channel('asset-management-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });
        queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });
        queryClient.invalidateQueries({ queryKey: ["allocations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["asset-management", dataEnvironment, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_management")
        .select(`
          *,
          product:products(id, name, sku, category, connectivity, quantity_per_pack, is_multi_unit, asset_priority),
          purchase:purchases(id, purchase_date, total_amount, ticket_number, receipt_number, order_status),
          parent_asset:asset_management!parent_asset_id(id, asset_tag, asset_type),
          primary_asset:asset_management!primary_asset_id(id, asset_tag, asset_type, product:products(name)),
          allocations!allocations_asset_id_fkey(
            id, status, allocated_at, notes,
            purchase_order:purchases!allocations_purchase_order_id_fkey(
              id, ticket_number, receipt_number, total_amount, order_status, pickup_date,
              customer:customers!purchases_customer_id_fkey(name)
            ),
            stock_order:stock_orders(id, name, stock_record_number)
          )
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group assets by priority and hierarchy
      const assetsMap = new Map<string, AssetManagementWithDetails>();
      const rootAssets: AssetManagementWithDetails[] = [];

      data?.forEach(asset => {
        const assetWithDetails = { ...asset } as any;
        // Clean up any SelectQueryError fields from failed joins
        if (assetWithDetails.allocations) {
          assetWithDetails.allocations = assetWithDetails.allocations.map((allocation: any) => {
            const { stock_order, ...cleanAllocation } = allocation;
            return {
              ...cleanAllocation,
              stock_order: stock_order?.error ? null : stock_order
            };
          });
        }
        const cleanAssetWithDetails = assetWithDetails as AssetManagementWithDetails;
        cleanAssetWithDetails.child_assets = [];
        cleanAssetWithDetails.secondary_assets = [];
        assetsMap.set(asset.id, cleanAssetWithDetails);

        if (asset.parent_asset_id) {
          // This is a child asset (multi-unit breakdown)
          const parent = assetsMap.get(asset.parent_asset_id);
          if (parent) {
            parent.child_assets?.push(assetWithDetails);
          }
        } else if (asset.primary_asset_id) {
          // This is a secondary asset linked to a primary asset
          const primaryAsset = assetsMap.get(asset.primary_asset_id);
          if (primaryAsset) {
            primaryAsset.secondary_assets?.push(assetWithDetails);
          }
        } else {
          // This is a root asset (primary or standalone)
          rootAssets.push(assetWithDetails);
        }
      });

      // Handle assets that were processed before their parents/primary assets
      data?.forEach(asset => {
        if (asset.parent_asset_id) {
          const parent = assetsMap.get(asset.parent_asset_id);
          const child = assetsMap.get(asset.id);
          if (parent && child && !parent.child_assets?.find(c => c.id === child.id)) {
            parent.child_assets?.push(child);
          }
        }

        if (asset.primary_asset_id) {
          const primaryAsset = assetsMap.get(asset.primary_asset_id);
          const secondaryAsset = assetsMap.get(asset.id);
          if (primaryAsset && secondaryAsset && !primaryAsset.secondary_assets?.find(s => s.id === secondaryAsset.id)) {
            primaryAsset.secondary_assets?.push(secondaryAsset);
          }
        }
      });

      return rootAssets;
    },
    enabled: !!orgId,
  });
};

export const useAllAssets = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  // Set up real-time subscriptions for asset changes
  useEffect(() => {
    const channel = supabase
      .channel('all-assets-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-assets"] });
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["all-assets", dataEnvironment, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_management")
        .select(`
          *,
          product:products(id, name, sku, category, connectivity, quantity_per_pack, is_multi_unit, asset_priority),
          purchase:purchases(id, purchase_date, total_amount, ticket_number, receipt_number, order_status),
          parent_asset:asset_management!parent_asset_id(id, asset_tag, asset_type),
          primary_asset:asset_management!primary_asset_id(id, asset_tag, asset_type, product:products(name)),
          allocations!allocations_asset_id_fkey(
            id, status, allocated_at, notes,
            purchase_order:purchases!allocations_purchase_order_id_fkey(
              id, ticket_number, receipt_number, total_amount, order_status, pickup_date,
              customer:customers!purchases_customer_id_fkey(name)
            ),
            stock_order:stock_orders(id, name, stock_record_number)
          )
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data?.map(asset => {
        // Clean up any SelectQueryError fields from failed joins
        const cleanAsset = { ...asset } as any;
        if (cleanAsset.allocations) {
          cleanAsset.allocations = cleanAsset.allocations.map((allocation: any) => {
            const { stock_order, ...cleanAllocation } = allocation;
            return {
              ...cleanAllocation,
              stock_order: stock_order?.error ? null : stock_order
            };
          });
        }
        return {
          ...cleanAsset as AssetManagementWithDetails,
          child_assets: [],
          secondary_assets: []
        };
      }) || [];
    },
    enabled: !!orgId,
  });
};

export const useCreateAsset = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (asset: Omit<AssetManagement, "id" | "created_at" | "updated_at">) => {
      // Auto-detect category if not provided and product_id exists
      const finalAsset = { ...asset, data_environment: dataEnvironment, organization_id: orgId };
      if (!asset.category && asset.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("name, category, connectivity")
          .eq("id", asset.product_id)
          .single();

        if (product) {
          finalAsset.category = detectAssetCategory(product);
        }
      }

      const { data, error } = await supabase
        .from("asset_management")
        .insert(finalAsset)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      enhancedToast.success("Asset created successfully", "The asset has been added to your inventory.");
    },
    onError: (error) => {
      enhancedToast.error("Error creating asset", error.message);
    },
  });
};

export const useUpdateAsset = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AssetManagement> & { id: string }) => {
      const { data, error } = await supabase
        .from("asset_management")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      enhancedToast.success("Asset updated successfully", "The asset information has been updated.");
    },
    onError: (error) => {
      enhancedToast.error("Error updating asset", error.message);
    },
  });
};

export const useDeleteAsset = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("asset_management")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      enhancedToast.success("Asset deleted successfully", "The asset has been removed from your inventory.");
    },
    onError: (error) => {
      enhancedToast.error("Error deleting asset", error.message);
    },
  });
};