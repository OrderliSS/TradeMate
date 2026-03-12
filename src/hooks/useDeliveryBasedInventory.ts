import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryBasedInventoryData {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  delivered_stock: number; // Only delivered items count as available
  ordered_stock: number; // Items ordered but not delivered (in transit)
  allocated_stock: number; // Items allocated to customers
  available_stock: number; // delivered_stock - allocated_stock
  total_stock: number; // delivered + ordered
  unit_price: number | null;
  reorder_level: number;
  needs_reorder: boolean;
}

export const useDeliveryBasedInventory = () => {
  return useQuery({
    queryKey: ["delivery-based-inventory"],
    queryFn: async (): Promise<DeliveryBasedInventoryData[]> => {
      // Get all products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          category,
          price,
          reorder_level,
          is_multi_unit,
          quantity_per_pack
        `);

      if (productsError) throw productsError;

      // Get delivered stock orders  
      const { data: deliveredStockOrders, error: deliveredError } = await supabase
        .from("stock_orders")
        .select("product_id, quantity_needed")
        .eq("delivery_status", "delivered")
        .not("product_id", "is", null);

      if (deliveredError) throw deliveredError;

      // Get ordered (not delivered) stock orders
      const { data: orderedStockOrders, error: orderedError } = await supabase
        .from("stock_orders")
        .select("product_id, quantity_needed")
        .neq("delivery_status", "delivered")
        .not("product_id", "is", null);

      if (orderedError) throw orderedError;

      // Get allocations
      const [stockAllocations, assetAllocations] = await Promise.all([
        supabase
          .from("stock_allocations")
          .select("product_id, quantity_allocated"),
        supabase
          .from("allocations")
          .select("product_id")
          .eq("status", "allocated")
      ]);

      if (stockAllocations.error) throw stockAllocations.error;
      if (assetAllocations.error) throw assetAllocations.error;

      // Calculate stock allocations per product
      const stockAllocationsByProduct = stockAllocations.data.reduce((acc, allocation) => {
        acc[allocation.product_id] = (acc[allocation.product_id] || 0) + allocation.quantity_allocated;
        return acc;
      }, {} as Record<string, number>);

      // Calculate asset allocations per product
      const assetAllocationsByProduct = assetAllocations.data.reduce((acc, allocation) => {
        acc[allocation.product_id] = (acc[allocation.product_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate delivered stock per product
      const deliveredStockByProduct = deliveredStockOrders.reduce((acc, stockOrder) => {
        if (!stockOrder.product_id) return acc;
        
        // Get product info for multi-unit calculation
        const product = products.find(p => p.id === stockOrder.product_id);
        let actualUnits = stockOrder.quantity_needed || 0;
        
        // Convert to individual units if multi-unit product
        if (product?.is_multi_unit && product.quantity_per_pack) {
          actualUnits = actualUnits * product.quantity_per_pack;
        }
        
        acc[stockOrder.product_id] = (acc[stockOrder.product_id] || 0) + actualUnits;
        return acc;
      }, {} as Record<string, number>);

      // Calculate ordered (in transit) stock per product
      const orderedStockByProduct = orderedStockOrders.reduce((acc, stockOrder) => {
        if (!stockOrder.product_id) return acc;
        
        // Get product info for multi-unit calculation
        const product = products.find(p => p.id === stockOrder.product_id);
        let actualUnits = stockOrder.quantity_needed || 0;
        
        // Convert to individual units if multi-unit product
        if (product?.is_multi_unit && product.quantity_per_pack) {
          actualUnits = actualUnits * product.quantity_per_pack;
        }
        
        acc[stockOrder.product_id] = (acc[stockOrder.product_id] || 0) + actualUnits;
        return acc;
      }, {} as Record<string, number>);

      // Transform into inventory data
      return products.map(product => {
        const deliveredStock = deliveredStockByProduct[product.id] || 0;
        const orderedStock = orderedStockByProduct[product.id] || 0;
        const stockAllocated = stockAllocationsByProduct[product.id] || 0;
        const assetAllocated = assetAllocationsByProduct[product.id] || 0;
        const totalAllocated = stockAllocated + assetAllocated;
        const availableStock = Math.max(0, deliveredStock - totalAllocated);
        const totalStock = deliveredStock + orderedStock;

        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          category: product.category,
          delivered_stock: deliveredStock,
          ordered_stock: orderedStock,
          allocated_stock: totalAllocated,
          available_stock: availableStock,
          total_stock: totalStock,
          unit_price: product.price,
          reorder_level: product.reorder_level || 0,
          needs_reorder: deliveredStock <= (product.reorder_level || 0)
        };
      });
    },
    staleTime: 30000,
  });
};

export const useDeliveryBasedInventorySummary = () => {
  const { data: inventoryData = [] } = useDeliveryBasedInventory();
  
  return useQuery({
    queryKey: ["delivery-based-inventory-summary"],
    queryFn: async () => {
      return inventoryData.reduce((acc, item) => {
        const totalValue = (item.unit_price || 0) * item.available_stock;
        
        acc.totalProducts += 1;
        acc.totalValue += totalValue;
        acc.totalDeliveredStock += item.delivered_stock;
        acc.totalOrderedStock += item.ordered_stock;
        acc.totalAllocated += item.allocated_stock;
        acc.totalAvailable += item.available_stock;
        
        if (item.needs_reorder) acc.lowStockItems += 1;
        if (item.available_stock === 0) acc.outOfStockItems += 1;
        
        return acc;
      }, {
        totalProducts: 0,
        totalValue: 0,
        totalDeliveredStock: 0,
        totalOrderedStock: 0,
        totalAllocated: 0,
        totalAvailable: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      });
    },
    enabled: inventoryData.length > 0,
    staleTime: 30000,
  });
};