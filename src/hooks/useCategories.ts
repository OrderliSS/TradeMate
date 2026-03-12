import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enhancedToast } from '@/components/ui/enhanced-toast';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
  environment?: string;
  productCount?: number;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (category: Omit<ProductCategory, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert([category])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      enhancedToast.success("Success", `Category "${data.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to create category");
      console.error('Category creation error:', error);
    }
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      enhancedToast.success("Success", `Category "${data.name}" updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to update category");
      console.error('Category update error:', error);
    }
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      enhancedToast.success("Success", "Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to delete category");
      console.error('Category deletion error:', error);
    }
  });
};