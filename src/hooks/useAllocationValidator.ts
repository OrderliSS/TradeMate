import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validAssets: string[];
  invalidAssets: { id: string; reason: string; asset_tag?: string }[];
}

interface ValidateAllocationParams {
  asset_ids: string[];
  purchase_order_id?: string;
  product_id?: string;
}

export const useAllocationValidator = () => {
  
  const validatePreAllocation = async (params: ValidateAllocationParams): Promise<ValidationResult> => {
    const { asset_ids, purchase_order_id, product_id } = params;
    const errors: string[] = [];
    const warnings: string[] = [];
    const invalidAssets: { id: string; reason: string; asset_tag?: string }[] = [];

    // 1. Check if assets exist
    const { data: assets, error: assetError } = await supabase
      .from("asset_management")
      .select("id, asset_tag, status, product_id, purchase_order_id")
      .in("id", asset_ids);

    if (assetError) {
      errors.push(`Failed to verify assets: ${assetError.message}`);
      return { isValid: false, errors, warnings, validAssets: [], invalidAssets };
    }

    if (!assets || assets.length !== asset_ids.length) {
      const foundIds = assets?.map(a => a.id) || [];
      const missingIds = asset_ids.filter(id => !foundIds.includes(id));
      errors.push(`${missingIds.length} asset(s) not found in system`);
      missingIds.forEach(id => invalidAssets.push({ id, reason: 'Asset not found' }));
    }

    // 2. Check for existing allocations
    const { data: existingAllocations, error: allocError } = await supabase
      .from("allocations")
      .select("asset_id, purchase_order_id, status")
      .in("asset_id", asset_ids)
      .in("status", ["allocated", "pre_allocated"]);

    if (allocError) {
      errors.push(`Failed to check existing allocations: ${allocError.message}`);
    }

    // 3. Validate asset statuses and check for conflicts
    const validStatuses = ['available', 'instock', 'in_transit'];
    assets?.forEach(asset => {
      const existingAlloc = existingAllocations?.find(a => a.asset_id === asset.id);
      
      // Check if allocated to different purchase order
      if (existingAlloc && existingAlloc.purchase_order_id !== purchase_order_id) {
        invalidAssets.push({
          id: asset.id,
          asset_tag: asset.asset_tag,
          reason: `Already allocated to order ${existingAlloc.purchase_order_id?.slice(-6)}`
        });
      }
      
      // Check status validity
      if (!validStatuses.includes(asset.status) && asset.status !== 'allocated') {
        invalidAssets.push({
          id: asset.id,
          asset_tag: asset.asset_tag,
          reason: `Invalid status: ${asset.status}`
        });
      }

      // Detect orphaned allocated assets (allocated status but no allocation record)
      if (asset.status === 'allocated' && !existingAlloc) {
        warnings.push(`Asset ${asset.asset_tag || asset.id} is marked allocated but has no allocation record`);
      }

      // Check product mismatch
      if (product_id && asset.product_id !== product_id) {
        invalidAssets.push({
          id: asset.id,
          asset_tag: asset.asset_tag,
          reason: `Wrong product (expected ${product_id})`
        });
      }
    });

    const validAssetIds = assets
      ?.filter(a => !invalidAssets.some(inv => inv.id === a.id))
      .map(a => a.id) || [];

    return {
      isValid: errors.length === 0 && invalidAssets.length === 0,
      errors,
      warnings,
      validAssets: validAssetIds,
      invalidAssets
    };
  };

  const validatePostAllocation = async (params: {
    asset_ids: string[];
    purchase_order_id?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const { asset_ids, purchase_order_id } = params;

    // Verify allocation records were created
    const { data: allocations, error } = await supabase
      .from("allocations")
      .select("asset_id")
      .in("asset_id", asset_ids)
      .eq("status", "allocated");

    if (error) {
      return { success: false, message: `Post-validation failed: ${error.message}` };
    }

    const allocatedCount = allocations?.length || 0;
    const expectedCount = asset_ids.length;

    if (allocatedCount !== expectedCount) {
      return {
        success: false,
        message: `Allocation mismatch: Expected ${expectedCount}, got ${allocatedCount} records`
      };
    }

    // Verify asset_management table was updated
    const { data: assets } = await supabase
      .from("asset_management")
      .select("id, status, purchase_order_id")
      .in("id", asset_ids);

    const correctlyUpdated = assets?.filter(a => 
      a.status === 'allocated' && 
      (!purchase_order_id || a.purchase_order_id === purchase_order_id)
    ).length || 0;

    if (correctlyUpdated !== expectedCount) {
      return {
        success: false,
        message: `Asset status mismatch: ${correctlyUpdated}/${expectedCount} assets correctly updated`
      };
    }

    return { success: true, message: 'All allocations verified successfully' };
  };

  return {
    validatePreAllocation,
    validatePostAllocation,
  };
};
