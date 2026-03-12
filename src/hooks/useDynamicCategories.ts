import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrentEnvironment } from "@/lib/environment-utils";

export interface DynamicCategory {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface CreateCategoryData {
  name: string;
}

export const useDynamicCategories = (tableName: string) => {
  const queryClient = useQueryClient();
  const queryKey = [`dynamic-categories-${tableName}`];

  // Fetch categories
  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<DynamicCategory[]> => {
      try {
        const { data, error } = await (supabase as any)
          .from(tableName)
          .select("id, name, created_at, updated_at")
          .order("name");
        
        if (error) throw error;
        return (data || []) as DynamicCategory[];
      } catch (err) {
        console.error(`Error fetching categories from ${tableName}:`, err);
        return [];
      }
    },
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async (categoryData: CreateCategoryData): Promise<DynamicCategory> => {
      const { data, error } = await (supabase as any)
        .from(tableName)
        .insert([categoryData])
        .select("id, name, created_at, updated_at")
        .single();

      if (error) throw error;
      return data as DynamicCategory;
    },
    onSuccess: (newCategory: DynamicCategory) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`Category "${newCategory.name}" added successfully`);
    },
    onError: (error: any) => {
      console.error("Error creating category:", error);
      if (error.code === '23505') {
        toast.error("Category already exists");
      } else {
        toast.error("Failed to create category");
      }
    },
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Category deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategory.mutateAsync,
    deleteCategory: deleteCategory.mutateAsync,
    isCreating: createCategory.isPending,
    isDeleting: deleteCategory.isPending,
  };
};