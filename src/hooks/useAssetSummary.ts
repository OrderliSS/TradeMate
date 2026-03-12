import { useUnifiedAssetMetricsForProducts } from "@/hooks/useUnifiedAssetMetrics";

export interface AssetSummaryByProduct {
  [productId: string]: {
    assetCount: number;
    missingAssets: number;
  };
}

// Legacy hook - use useUnifiedAssetMetrics instead
export const useAssetSummary = () => {
  const { data: metricsData } = useUnifiedAssetMetricsForProducts([]);
  
  const assetCountByProduct: { [key: string]: number } = {};
  
  if (metricsData) {
    Object.entries(metricsData).forEach(([productId, metrics]) => {
      assetCountByProduct[productId] = metrics.total;
    });
  }
  
  return { data: assetCountByProduct };
};

export const useAssetSummaryForProducts = (products: any[]) => {
  const { data: metricsData, isLoading } = useUnifiedAssetMetricsForProducts(products);
  
  const summaryByProduct: AssetSummaryByProduct = {};
  
  if (metricsData) {
    Object.entries(metricsData).forEach(([productId, metrics]) => {
      const product = products.find(p => p.id === productId);
      const missingAssets = Math.max(0, (product?.stock_quantity || 0) - metrics.total);
      
      summaryByProduct[productId] = {
        assetCount: metrics.total,
        missingAssets
      };
    });
  }

  return { summaryByProduct, isLoading };
};