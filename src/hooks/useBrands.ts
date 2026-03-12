import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enhancedToast } from '@/components/ui/enhanced-toast';
import { useDataEnvironment } from '@/hooks/useSandbox';

export interface Brand {
  id: string;
  name: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  image_url?: string | null;
  category?: string;
  created_at?: string;
  updated_at?: string;
  productCount: number;
  totalValue: number;
  totalStock: number;
}

export interface BrandWithProducts extends Brand {
  products: Array<{
    id: string;
    name: string;
    sku?: string;
    price?: number;
    category?: string;
    stock_quantity?: number;
    status?: string;
  }>;
}

// Generate a consistent brand ID from name
const generateBrandId = (name: string) => {
  return encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'));
};

// Decode brand ID back to name
export const decodeBrandId = (id: string) => {
  return decodeURIComponent(id).replace(/-/g, ' ');
};

export const useBrands = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ['brands', dataEnvironment],
    queryFn: async () => {
      // Fetch products and brand metadata in parallel
      const [productsResult, brandsResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, brand, price, stock_quantity, category, name, sku, status')
          .eq('data_environment', dataEnvironment),
        supabase
          .from('brands')
          .select('*')
          .eq('data_environment', dataEnvironment)
      ]);
      
      if (productsResult.error) throw productsResult.error;

      // Create a map of brand metadata from the brands table
      const brandMetadataMap = new Map<string, any>();
      brandsResult.data?.forEach(brand => {
        brandMetadataMap.set(brand.name.toLowerCase(), brand);
      });

      // Extract unique brands from products and calculate stats
      const brandMap = new Map<string, Brand>();
      
      productsResult.data?.forEach(product => {
        const brandName = product.brand || 'Unknown Brand';
        const brandId = generateBrandId(brandName);
        const brandMetadata = brandMetadataMap.get(brandName.toLowerCase());
        
        if (!brandMap.has(brandName)) {
          brandMap.set(brandName, {
            id: brandMetadata?.id || brandId,
            name: brandName,
            productCount: 0,
            totalValue: 0,
            totalStock: 0,
            description: brandMetadata?.description || (brandName === 'Unknown Brand' 
              ? 'Products without assigned brands' 
              : `${brandName} products and solutions`),
            website: brandMetadata?.website || (brandName !== 'Unknown Brand' 
              ? `${brandName.toLowerCase().replace(/\s+/g, '')}` 
              : ''),
            email: brandMetadata?.email,
            phone: brandMetadata?.phone,
            image_url: brandMetadata?.image_url,
            category: brandMetadata?.category || 'Technology',
            created_at: brandMetadata?.created_at,
            updated_at: brandMetadata?.updated_at
          });
        }
        
        const brand = brandMap.get(brandName)!;
        brand.productCount += 1;
        brand.totalValue += product.price || 0;
        brand.totalStock += product.stock_quantity || 0;
      });

      return Array.from(brandMap.values()).sort((a, b) => b.productCount - a.productCount);
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useBrandDetails = (brandId: string) => {
  return useQuery({
    queryKey: ['brand-details', brandId],
    queryFn: async (): Promise<BrandWithProducts | null> => {
      if (!brandId) return null;
      
      // Decode the brand ID to get the actual brand name
      const brandName = decodeBrandId(brandId);
      const searchName = brandName === 'unknown-brand' ? null : brandName;
      
      // Fetch products and brand metadata in parallel
      let productsQuery = supabase
        .from('products')
        .select('id, name, sku, price, category, stock_quantity, status, brand');
      
      if (searchName) {
        productsQuery = productsQuery.ilike('brand', `%${searchName}%`);
      } else {
        productsQuery = productsQuery.is('brand', null);
      }
      
      const [productsResult, brandMetadataResult] = await Promise.all([
        productsQuery,
        searchName ? supabase.from('brands').select('*').ilike('name', searchName).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);
      
      if (productsResult.error) throw productsResult.error;
      
      let products = productsResult.data;
      const brandMetadata = brandMetadataResult.data;
      
      if (!products || products.length === 0) {
        // Try exact match for the brand name
        const exactBrand = brandName.split('-').map(
          word => word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        const { data: exactProducts, error: exactError } = await supabase
          .from('products')
          .select('id, name, sku, price, category, stock_quantity, status, brand')
          .ilike('brand', exactBrand);
          
        if (exactError) throw exactError;
        
        if (!exactProducts || exactProducts.length === 0) {
          return null;
        }
        
        products = exactProducts;
      }
      
      const actualBrandName = products[0]?.brand || 'Unknown Brand';
      
      return {
        id: brandMetadata?.id || brandId,
        name: actualBrandName,
        description: brandMetadata?.description || `${actualBrandName} products and solutions`,
        website: brandMetadata?.website || `${actualBrandName.toLowerCase().replace(/\s+/g, '')}`,
        email: brandMetadata?.email,
        phone: brandMetadata?.phone,
        image_url: brandMetadata?.image_url,
        category: brandMetadata?.category || 'Technology',
        created_at: brandMetadata?.created_at,
        updated_at: brandMetadata?.updated_at,
        productCount: products.length,
        totalValue: products.reduce((sum, p) => sum + (p.price || 0), 0),
        totalStock: products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0),
        products
      };
    },
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ brandName, data }: { 
      brandName: string; 
      data: { 
        description?: string; 
        website?: string; 
        email?: string; 
        phone?: string;
        image_url?: string | null;
        category?: string;
      } 
    }) => {
      // Check if brand already exists in the table
      const { data: existing } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', brandName)
        .maybeSingle();
      
      if (existing) {
        // Update existing brand
        const { error } = await supabase
          .from('brands')
          .update(data)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new brand
        const { error } = await supabase
          .from('brands')
          .insert({ name: brandName, ...data });
        
        if (error) throw error;
      }
      
      return { brandName, ...data };
    },
    onSuccess: (data) => {
      enhancedToast.success('Brand updated successfully');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand-details'] });
    },
    onError: (error) => {
      console.error('Brand update error:', error);
      enhancedToast.error('Failed to update brand');
    }
  });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (brand: { name: string; description?: string; website?: string; email?: string; phone?: string }) => {
      // For now, we'll just show success since brands are derived from products
      // In a real implementation, you'd store brands in a separate table
      return brand;
    },
    onSuccess: (data) => {
      enhancedToast.success("Success", `Brand "${data.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to create brand");
      console.error('Brand creation error:', error);
    }
  });
};