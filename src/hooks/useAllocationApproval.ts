import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface AssetAvailability {
  available: number;
  ordered: number;
  inTransit: number;
  configuring: number;
  allocated: number;
}

export const useAllocationApproval = (purchaseId: string) => {
  const [availability, setAvailability] = useState<AssetAvailability | null>(null);
  const queryClient = useQueryClient();

  // Get purchase details
  const { data: purchase } = useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          customer:customers(*),
          product:products(*)
        `)
        .eq("id", purchaseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!purchaseId
  });

  // Check asset availability
  const checkAssetAvailability = async () => {
    if (!purchase?.product_id) return;

    try {
      const { data: assets, error } = await supabase
        .from("asset_management")
        .select("status, transit_status")
        .eq("product_id", purchase.product_id);

      if (error) throw error;

      const availability: AssetAvailability = {
        available: 0,
        ordered: 0,
        inTransit: 0,
        configuring: 0,
        allocated: 0,
      };

      assets?.forEach(asset => {
        switch (asset.status) {
          case 'available':
            availability.available++;
            break;
          case 'allocated':
            availability.allocated++;
            break;
          default:
            // Check transit status for other states
            switch (asset.transit_status) {
              case 'pending_transit':
                availability.ordered++;
                break;
              case 'in_transit':
                availability.inTransit++;
                break;
              case 'being_configured':
                availability.configuring++;
                break;
            }
        }
      });

      setAvailability(availability);
      return availability;
    } catch (error) {
      console.error("Error checking asset availability:", error);
      enhancedToast.error("Error", "Failed to check asset availability");
      return null;
    }
  };

  // Check availability mutation
  const checkAvailabilityMutation = useMutation({
    mutationFn: checkAssetAvailability,
    onSuccess: (data) => {
      enhancedToast.success("Availability Checked", `${data?.available || 0} assets available`);
    },
  });

  // Approve allocation mutation
  const approveAllocationMutation = useMutation({
    mutationFn: async () => {
      if (!availability || availability.available < (purchase?.quantity || 0)) {
        throw new Error("Insufficient assets available");
      }

      // Update purchase allocation status
      const { error: updateError } = await supabase
        .from("purchases")
        .update({
          allocation_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);

      if (updateError) throw updateError;

      // Implement actual asset allocation logic here
      // This would involve creating allocation records and updating asset statuses
      
      return true;
    },
    onSuccess: () => {
      enhancedToast.success("Allocation Approved", "Purchase allocation has been approved");
      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (error) => {
      enhancedToast.error("Approval Failed", error.message);
    },
  });

  return {
    availability,
    checkAssetAvailability: checkAvailabilityMutation.mutate,
    approveAllocation: approveAllocationMutation.mutate,
    isCheckingAvailability: checkAvailabilityMutation.isPending,
    isApproving: approveAllocationMutation.isPending,
  };
};