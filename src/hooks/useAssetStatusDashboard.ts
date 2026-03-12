import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";

export interface AssetStatusMetrics {
  product_id: string;
  product_name: string;
  sku: string;
  stock_quantity: number;
  total_assets: number;
  available_assets: number;
  allocated_assets: number;
  sold_assets: number;
  in_transit_assets: number;
  being_configured_assets: number;
  is_configurable: boolean;
}

export const useAssetStatusDashboard = () => {
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["asset-status-dashboard", dataEnvironment, organizationId],
    queryFn: async (): Promise<AssetStatusMetrics[]> => {
      // Get all products with their basic info including category
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, category')
        .eq('status', 'active')
        .eq('organization_id', organizationId);

      if (productsError) throw productsError;

      // Get asset counts by product and status
      const { data: assetCounts, error: assetsError } = await supabase
        .from('asset_management')
        .select('product_id, status, transit_status')
        .not('product_id', 'is', null)
        .eq('data_environment', dataEnvironment)
        .eq('organization_id', organizationId);

      if (assetsError) throw assetsError;

      // Define configurable product categories
      const configurableCategories = ['TV Streaming Device', 'Hardware', 'Electronics'];

      // Process the data
      const results: AssetStatusMetrics[] = products.map(product => {
        const productAssets = assetCounts.filter(asset => asset.product_id === product.id);
        const isConfigurable = configurableCategories.includes(product.category || '');

        const total_assets = productAssets.length;
        const instock_assets = productAssets.filter(asset => asset.status === 'instock' || asset.status === 'available' || asset.status === 'ready').length;
        const allocated_assets = productAssets.filter(asset => asset.status === 'allocated').length;
        const sold_assets = productAssets.filter(asset => asset.status === 'sold').length;
        const in_transit_assets = productAssets.filter(asset => asset.transit_status === 'in_transit').length;
        const being_configured_assets = isConfigurable
          ? productAssets.filter(asset => asset.status === 'being_configured').length
          : 0;

        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || 'No SKU',
          stock_quantity: product.stock_quantity || 0,
          total_assets,
          available_assets: instock_assets,
          allocated_assets,
          sold_assets,
          in_transit_assets,
          being_configured_assets,
          is_configurable: isConfigurable
        };
      });

      return results.sort((a, b) => a.product_name.localeCompare(b.product_name));
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    enabled: !!organizationId,
  });
};