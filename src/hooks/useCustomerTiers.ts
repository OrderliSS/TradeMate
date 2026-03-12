import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Customer, CustomerTier } from "@/types/database";

interface UpdateCustomerTierRequest {
  customerId: string;
  tier: CustomerTier;
  override: boolean;
  notes?: string;
}

export const useUpdateCustomerTier = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ customerId, tier, override, notes }: UpdateCustomerTierRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("customers")
        .update({
          customer_tier: tier,
          tier_override: override,
          tier_assigned_by: user.id,
          tier_assigned_at: new Date().toISOString(),
          tier_notes: notes || null,
        })
        .eq("id", customerId);

      if (error) throw error;
    },
    onSuccess: (_, { tier }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Tier Updated",
        description: `Customer tier has been updated to ${tier.replace('_', ' ')}.`,
      });
    },
    onError: (error) => {
      console.error("Error updating customer tier:", error);
      toast({
        title: "Error",
        description: "Failed to update customer tier. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useBulkUpdateCustomerTiers = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ customerIds, tier, override, notes }: {
      customerIds: string[];
      tier: CustomerTier;
      override: boolean;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("customers")
        .update({
          customer_tier: tier,
          tier_override: override,
          tier_assigned_by: user.id,
          tier_assigned_at: new Date().toISOString(),
          tier_notes: notes || null,
        })
        .in("id", customerIds);

      if (error) throw error;
      
      return customerIds.length;
    },
    onSuccess: (count, { tier }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Bulk Tier Update Complete",
        description: `Updated ${count} customers to ${tier.replace('_', ' ')} tier.`,
      });
    },
    onError: (error) => {
      console.error("Error updating customer tiers:", error);
      toast({
        title: "Error",
        description: "Failed to update customer tiers. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useRecalculateCustomerTiers = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("recalculate_all_customer_tiers");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Tier Recalculation Complete",
        description: "All customer tier suggestions have been updated based on current data.",
      });
    },
    onError: (error) => {
      console.error("Error recalculating customer tiers:", error);
      toast({
        title: "Error",
        description: "Failed to recalculate customer tiers. Please try again.",
        variant: "destructive",
      });
    },
  });
};