import { supabase } from "@/integrations/supabase/client";

interface AutoCreateShopData {
  vendor_store_name: string;
  vendor?: string;
  category?: string;
  organization_id: string;
}

export const autoCreateVendorShop = async (data: AutoCreateShopData) => {
  const { vendor_store_name, vendor, category, organization_id } = data;

  if (!vendor_store_name || vendor_store_name.trim() === "" || !organization_id) {
    return null;
  }

  // Check if shop already exists for this organization
  const { data: existingShop, error: checkError } = await supabase
    .from("vendor_shops")
    .select("id")
    .eq("shop_name", vendor_store_name)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking existing shop:", checkError);
    return null;
  }

  // If shop already exists, return early
  if (existingShop) {
    return existingShop;
  }

  // Auto-populate platform based on vendor if available
  let platform = vendor;
  if (vendor) {
    const platformMap: Record<string, string> = {
      "ebay": "eBay",
      "amazon": "Amazon",
      "aliexpress": "AliExpress",
      "alibaba": "Alibaba",
      "local_supplier": "Local Store",
      "other": "Other"
    };
    platform = platformMap[vendor.toLowerCase()] || vendor;
  }

  // Create new shop record
  const { data: newShop, error: createError } = await supabase
    .from("vendor_shops")
    .insert([{
      shop_name: vendor_store_name,
      platform: platform,
      primary_category: category,
      notes: "Auto-created from stock order entry",
      organization_id: organization_id
    }])
    .select()
    .single();

  if (createError) {
    console.error("Error creating vendor shop:", createError);
    return null;
  }

  return newShop;
};

export const createOrphanedShops = async (organizationId: string) => {
  if (!organizationId) throw new Error("Organization ID is required for createOrphanedShops");

  try {
    // Get all stock orders with vendor_store_name for this organization
    const { data: stockOrders, error: stockOrdersError } = await supabase
      .from("stock_orders")
      .select("vendor_store_name, vendor, category")
      .eq("organization_id", organizationId)
      .not("vendor_store_name", "is", null)
      .neq("vendor_store_name", "");

    if (stockOrdersError) throw stockOrdersError;

    // Get all existing shop names for this organization
    const { data: existingShops, error: shopsError } = await supabase
      .from("vendor_shops")
      .select("shop_name")
      .eq("organization_id", organizationId);

    if (shopsError) throw shopsError;

    const existingShopNames = new Set(
      (existingShops || []).map(shop => shop.shop_name)
    );

    // Find unique orphaned store names
    const orphanedStores = new Map<string, { vendor?: string; category?: string }>();

    (stockOrders || []).forEach(stockOrder => {
      if (stockOrder.vendor_store_name && !existingShopNames.has(stockOrder.vendor_store_name)) {
        if (!orphanedStores.has(stockOrder.vendor_store_name)) {
          orphanedStores.set(stockOrder.vendor_store_name, {
            vendor: stockOrder.vendor,
            category: stockOrder.category
          });
        }
      }
    });

    // Create shop records for orphaned stores
    const shopPromises = Array.from(orphanedStores.entries()).map(
      ([storeName, data]) =>
        autoCreateVendorShop({
          vendor_store_name: storeName,
          vendor: data.vendor,
          category: data.category,
          organization_id: organizationId
        })
    );

    const results = await Promise.all(shopPromises);
    const successCount = results.filter(Boolean).length;

    return {
      processed: orphanedStores.size,
      created: successCount
    };
  } catch (error) {
    console.error("Error creating orphaned shops:", error);
    throw error;
  }
};