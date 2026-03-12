import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useStockOrderStatusApprovalLegacy = () => {
  const queryClient = useQueryClient();

  const approveStatus = useMutation({
    mutationFn: async (stockOrderId: string) => {
      const { data, error } = await supabase
        .from("stock_orders")
        .update({
          status_approved_at: new Date().toISOString(),
          status_approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", stockOrderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-order", data.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", data.id] });
      
      toast({
        title: "Status Approved",
        description: "Mixed shipment status approved as normal behavior.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to approve status:", error);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Failed to approve mixed status.",
      });
    },
  });

  const clearApproval = useMutation({
    mutationFn: async (stockOrderId: string) => {
      const { data, error } = await supabase
        .from("stock_orders")
        .update({
          status_approved_at: null,
          status_approved_by: null
        })
        .eq("id", stockOrderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-order", data.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", data.id] });
      
      toast({
        title: "Approval Cleared",
        description: "Status approval has been removed.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to clear approval:", error);
      toast({
        variant: "destructive",
        title: "Clear Failed",
        description: "Failed to clear status approval.",
      });
    },
  });

  return {
    approveStatus,
    clearApproval,
    isApproving: approveStatus.isPending,
    isClearing: clearApproval.isPending,
  };
};