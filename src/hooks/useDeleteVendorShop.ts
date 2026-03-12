import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentOrganizationId } from "./useOrganization";

export const useDeleteVendorShop = () => {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendor_shops")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["vendor-stores"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-shops"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });

      toast.success("Shop deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting shop:", error);
      toast.error("Failed to delete shop");
    },
  });
};