import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Check for product dependencies before deletion
export const useProductDependencies = (productId: string) => {
  return useQuery({
    queryKey: ["product-dependencies", productId],
    queryFn: async () => {
      const [purchasesResult, allocationsResult] = await Promise.all([
        supabase
          .from("purchases")
          .select("id")
          .eq("product_id", productId)
          .limit(1),
        supabase
          .from("stock_allocations")
          .select("id")
          .eq("product_id", productId)
          .limit(1)
      ]);

      return {
        hasPurchases: (purchasesResult.data?.length || 0) > 0,
        hasAllocations: (allocationsResult.data?.length || 0) > 0,
        canDelete: (purchasesResult.data?.length || 0) === 0 && (allocationsResult.data?.length || 0) === 0
      };
    },
    enabled: !!productId
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productId: string | string[]) => {
      // Handle both single and bulk deletion
      const productIds = Array.isArray(productId) ? productId : [productId];
      
      for (const id of productIds) {
        // Check for active business dependencies only (not historical audit records)
        const [
          purchasesResult, 
          allocationsResult, 
          assetsResult
        ] = await Promise.all([
          supabase
            .from("purchases")
            .select("id")
            .eq("product_id", id)
            .limit(1),
          supabase
            .from("stock_allocations")
            .select("id")
            .eq("product_id", id)
            .limit(1),
          supabase
            .from("asset_management")
            .select("id")
            .eq("product_id", id)
            .limit(1)
        ]);

        // Build detailed dependency message for active records
        const dependencies = [];
        if ((purchasesResult.data?.length || 0) > 0) dependencies.push("purchases");
        if ((allocationsResult.data?.length || 0) > 0) dependencies.push("allocations");
        if ((assetsResult.data?.length || 0) > 0) dependencies.push("assets");

        if (dependencies.length > 0) {
          throw new Error(
            `Cannot delete product: it has associated ${dependencies.join(", ")}. ` +
            `Consider setting the product status to "Discontinued" instead.`
          );
        }

        // Delete the product if no dependencies
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
      }
      
      return productIds;
    },
    onSuccess: (deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      
      const count = Array.isArray(deletedIds) ? deletedIds.length : 1;
      toast({
        title: "Success",
        description: `${count} product${count !== 1 ? 's' : ''} deleted successfully`,
      });
    },
    onError: (error) => {
      console.error("Delete product error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete product. It may have associated records.",
        variant: "destructive",
      });
    },
  });
};