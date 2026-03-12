import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

import { useScopedSupabase } from "@/hooks/useScopedSupabase";

export const useProducts = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["products", dataEnvironment, orgId],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await scopedSupabase
        .from("products")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any as Product[];
    },
    staleTime: 60000, // 60 seconds - products change infrequently
    refetchOnWindowFocus: false, // Prevent flicker on tab switch
    enabled: !!orgId,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      description?: string;
      brand?: string;
      price?: number;
      stock_quantity?: number;
      stock_in_transit?: number;
      category?: string;
      website?: string;
      status?: string;
      reorder_level?: number;
      specifications?: any;
      features?: string[];
      images?: string[];
      supplier_info?: any;
      dimensions?: any;
      sku?: string;
      weight?: number;
    }) => {
      // Set defaults for new fields
      const productData = {
        ...product,
        data_environment: dataEnvironment,
        // organization_id is injected by scopedSupabase
        stock_quantity: product.stock_quantity ?? 1,
        stock_in_transit: product.stock_in_transit ?? 0,
        category: product.category ?? 'Hardware',
        status: product.status ?? 'active',
        reorder_level: product.reorder_level ?? 10,
        specifications: product.specifications ?? {},
        features: product.features ?? [],
        images: product.images ?? [],
        supplier_info: product.supplier_info ?? {},
        dimensions: product.dimensions ?? {},
      };

      const { data, error } = await scopedSupabase
        .from("products")
        .insert([productData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async (product: {
      id: string;
      name?: string;
      description?: string;
      brand?: string;
      price?: number;
      stock_quantity?: number;
      stock_in_transit?: number;
      sku?: string;
      category?: string;
      website?: string;
      status?: string;
      reorder_level?: number;
      specifications?: any;
      features?: string[];
      images?: string[];
      supplier_info?: any;
      weight?: number;
      dimensions?: any;
    }) => {
      const { data, error } = await scopedSupabase
        .from("products")
        .update(product)
        .eq("id", product.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await scopedSupabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });
};
