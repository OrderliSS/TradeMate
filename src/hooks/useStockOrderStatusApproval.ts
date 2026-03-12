import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useStockOrderStatusApproval = () => {
  const queryClient = useQueryClient();

  const approveStatus = useMutation({
    mutationFn: async ({ stockOrderId, statusField }: { stockOrderId: string; statusField: string }) => {
      console.log("Approving stock order status", { stockOrderId, statusField });
      
      const updateData: any = {
        status_approved_at: new Date().toISOString(),
        status_approved_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from("stock_orders")
        .update(updateData)
        .eq("id", stockOrderId)
        .select()
        .single();

      if (error) {
        console.error("Error approving stock order status:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders", data.id] });
      
      toast({
        title: "Status Approved",
        description: "The stock order status has been approved successfully.",
      });
    },
    onError: (error) => {
      console.error("Stock order status approval error:", error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve the stock order status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearApproval = useMutation({
    mutationFn: async ({ stockOrderId }: { stockOrderId: string }) => {
      console.log("Clearing stock order status approval", { stockOrderId });

      const { data, error } = await supabase
        .from("stock_orders")
        .update({
          status_approved_at: null,
          status_approved_by: null
        })
        .eq("id", stockOrderId)
        .select()
        .single();

      if (error) {
        console.error("Error clearing stock order status approval:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders", data.id] });
      
      toast({
        title: "Approval Cleared",
        description: "The stock order status approval has been cleared.",
      });
    },
    onError: (error) => {
      console.error("Stock order approval clear error:", error);
      toast({
        title: "Clear Approval Failed",
        description: "Failed to clear the stock order status approval. Please try again.",
        variant: "destructive",
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