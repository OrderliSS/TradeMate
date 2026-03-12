import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useScopedSupabase } from "@/hooks/useScopedSupabase";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface PackageRecord {
  id: string;
  package_record_number: string;
  source_stock_order_id: string;
  is_package_parent: boolean;
  consolidated_status: string;
  total_shipments: number;
  carriers_used: string[];
  delivery_status: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  source_stock_order?: {
    id: string;
    name: string;
    stock_record_number: string;
    quantity_needed?: number;
    product_id?: string;
  };
  // Alias for compatibility
  stock_order_id?: string;
  individual_shipments?: Array<{
    id: string;
    stock_order_id: string;
    shipment_number: number;
    delivery_status?: string;
    tracking_number?: string;
    carrier?: string;
    estimated_delivery_date?: string;
    actual_delivery_date?: string;
    vendor_tracking_number?: string;
    vendor_carrier?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
  }>;
}

// Get package records for stock orders
export const usePackageRecords = (stockOrderId?: string) => {
  const organizationId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();
  const scopedSupabase = useScopedSupabase();

  return useQuery({
    queryKey: ["package-records", stockOrderId, organizationId, dataEnvironment],
    queryFn: async (): Promise<PackageRecord[]> => {
      if (!organizationId) return [];

      let query = scopedSupabase
        .from("shipment_records")
        .select(`
          *,
          source_stock_order:stock_orders (
            id,
            name,
            stock_record_number,
            quantity_needed,
            product_id
          )
        `)
        .eq("is_package_parent", true)
        .order("created_at", { ascending: false });

      if (stockOrderId) {
        query = query.eq("source_stock_order_id", stockOrderId);
      }

      const { data: packageRecords, error } = await query;

      if (error) {
        console.error("usePackageRecords - Error:", error);
        throw error;
      }

      // Get individual shipments from stock_order_shipments for each package record
      const enrichedRecords = await Promise.all(
        (packageRecords || []).map(async (packageRecord) => {
          const { data: individualShipments } = await scopedSupabase
            .from("stock_order_shipments")
            .select("*")
            .eq("stock_order_id", packageRecord.source_stock_order_id)
            .order("shipment_number", { ascending: true });

          // Aggregate carriers from individual shipments (include both carrier and vendor_carrier)
          const carriersFromShipments = (individualShipments || [])
            .flatMap(s => [s.carrier, s.vendor_carrier])
            .filter((carrier): carrier is string => 
              carrier !== null && carrier !== undefined && carrier !== ''
            );
          
          // Combine with any existing carriers_used, remove duplicates
          const allCarriers = [...new Set([
            ...(packageRecord.carriers_used || []),
            ...carriersFromShipments
          ])];

          return {
            ...packageRecord,
            stock_order_id: packageRecord.source_stock_order_id,
            individual_shipments: individualShipments || [],
            carriers_used: allCarriers,
          };
        })
      );

      return enrichedRecords;
    },
    enabled: !!organizationId && (!stockOrderId || !!stockOrderId),
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Create package records for existing stock orders
export const useCreatePackageRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stockOrderId: string) => {
      const { data, error } = await supabase.rpc('create_package_record_for_stock_order', {
        p_stock_order_id: stockOrderId
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          return { id: null, message: 'Package record already exists for this stock order', alreadyExists: true };
        }
        console.error("useCreatePackageRecords - Error:", error);
        throw error;
      }

      if (!data) {
        throw new Error("Failed to create package record - no ID returned");
      }

      return { id: data, message: 'Package record created successfully', alreadyExists: false };
    },
    onMutate: async (stockOrderId: string) => {
      await queryClient.cancelQueries({ queryKey: ["package-records"] });
      await queryClient.cancelQueries({ queryKey: ["package-records", stockOrderId] });

      const previousPackageRecords = queryClient.getQueryData<PackageRecord[]>(["package-records"]);
      const previousStockOrderPackages = queryClient.getQueryData<PackageRecord[]>(["package-records", stockOrderId]);

      const optimisticPackage: PackageRecord = {
        id: `temp-${stockOrderId}`,
        package_record_number: "PKG-PENDING",
        source_stock_order_id: stockOrderId,
        is_package_parent: true,
        consolidated_status: "in_transit",
        total_shipments: 0,
        carriers_used: [],
        delivery_status: "ordered",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        individual_shipments: [],
      };

      queryClient.setQueryData<PackageRecord[]>(["package-records"], (old) => {
        return old ? [optimisticPackage, ...old] : [optimisticPackage];
      });

      queryClient.setQueryData<PackageRecord[]>(["package-records", stockOrderId], (old) => {
        return old ? [optimisticPackage, ...old] : [optimisticPackage];
      });

      return { previousPackageRecords, previousStockOrderPackages, stockOrderId };
    },
    onSuccess: async (result, stockOrderId) => {
      await queryClient.refetchQueries({ 
        queryKey: ["package-records", stockOrderId],
        type: 'active'
      });
      await queryClient.refetchQueries({ 
        queryKey: ["package-records"],
        type: 'active'
      });

      const isExisting = result?.alreadyExists;
      toast({
        title: isExisting ? "Package Record Exists" : "Package Record Created",
        description: result?.message || "Package record ready for stock order",
      });
    },
    onError: (error: Error, stockOrderId: string, context) => {
      if (context?.previousPackageRecords !== undefined) {
        queryClient.setQueryData(["package-records"], context.previousPackageRecords);
      }
      if (context?.previousStockOrderPackages !== undefined) {
        queryClient.setQueryData(["package-records", context.stockOrderId], context.previousStockOrderPackages);
      }

      console.error("useCreatePackageRecords - Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create package record",
        variant: "destructive",
      });
    },
  });
};

// Update package record
export const useUpdatePackageRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PackageRecord>) => {
      const { data, error } = await supabase
        .from("shipment_records")
        .update(updates)
        .eq("id", id)
        .eq("is_package_parent", true)
        .select()
        .single();

      if (error) {
        console.error("useUpdatePackageRecord - Error:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["package-records"] });
      queryClient.invalidateQueries({ queryKey: ["package-records", data.source_stock_order_id] });
      toast({
        title: "Package Record Updated",
        description: "Package record updated successfully",
      });
    },
    onError: (error) => {
      console.error("useUpdatePackageRecord - Error:", error);
      toast({
        title: "Error",
        description: "Failed to update package record",
        variant: "destructive",
      });
    },
  });
};

// Manual status update with optional backdate notes
export const useManualPackageStatusUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      packageRecordId, 
      newStatus, 
      completionDate,
      existingNotes
    }: { 
      packageRecordId: string; 
      newStatus: string; 
      completionDate?: Date;
      existingNotes?: string;
    }) => {
      const updateDate = format(new Date(), 'MMM d, yyyy');
      const statusNote = completionDate 
        ? `Status manually set to "${newStatus}" on ${updateDate}. Original completion date: ${format(completionDate, 'MMM d, yyyy')}`
        : `Status manually set to "${newStatus}" on ${updateDate}`;
      
      const finalNotes = existingNotes 
        ? `${existingNotes}\n\n${statusNote}`
        : statusNote;

      const { data, error } = await supabase
        .from("shipment_records")
        .update({ 
          consolidated_status: newStatus,
          notes: finalNotes
        })
        .eq("id", packageRecordId)
        .eq("is_package_parent", true)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["package-records"] });
      queryClient.invalidateQueries({ queryKey: ["package-records", data.source_stock_order_id] });
      toast({ 
        title: "Status Updated", 
        description: "Package record status updated successfully" 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to update package status", 
        variant: "destructive" 
      });
    }
  });
};

// Bulk create package records for stock orders that don't have them
export const useBulkCreatePackageRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: existingPackages } = await supabase
        .from("shipment_records")
        .select("source_stock_order_id")
        .eq("is_package_parent", true)
        .not("source_stock_order_id", "is", null);

      const existingIds = new Set(
        (existingPackages || []).map(p => p.source_stock_order_id)
      );

      const { data: stockOrders, error } = await supabase
        .from("stock_orders")
        .select("id, name, stock_record_number")
        .eq("delivery_status", "delivered");

      if (error) throw error;

      const eligible = (stockOrders || []).filter(so => !existingIds.has(so.id));

      const results = await Promise.all(
        eligible.map(async (stockOrder) => {
          try {
            const { data, error } = await supabase.rpc('create_package_record_for_stock_order', {
              p_stock_order_id: stockOrder.id
            });
            if (error) throw error;
            return { stockOrder, success: true, packageRecordId: data };
          } catch (err) {
            console.error(`Failed to create package record for ${stockOrder.name}:`, err);
            return { stockOrder, success: false, error: err };
          }
        })
      );

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return { successful, failed, total: results.length };
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["package-records"] });
      toast({
        title: "Bulk Package Record Creation",
        description: `Created ${results.successful.length} package records. ${results.failed.length} failed.`,
      });
    },
    onError: (error) => {
      console.error("useBulkCreatePackageRecords - Error:", error);
      toast({
        title: "Error",
        description: "Failed to create package records in bulk",
        variant: "destructive",
      });
    },
  });
};

// Proactive auto-consolidation: if all individual shipments are delivered
// but the package record isn't, auto-fix on render
export const useAutoConsolidatePackageStatus = (
  packageRecord: PackageRecord | null | undefined,
  individualShipments: Array<{ delivery_status?: string }> | undefined
) => {
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!packageRecord || !individualShipments || individualShipments.length === 0) return;
    if (packageRecord.consolidated_status === 'delivered') return;
    if (hasRunRef.current) return;

    const allDelivered = individualShipments.every(s => s.delivery_status === 'delivered');

    if (allDelivered) {
      hasRunRef.current = true;
      supabase
        .from('shipment_records')
        .update({ consolidated_status: 'delivered' } as any)
        .eq('id', packageRecord.id)
        .eq('is_package_parent', true)
        .then(({ error }) => {
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ['package-records'] });
            queryClient.invalidateQueries({ queryKey: ['shipment-records'] });
            toast({
              title: 'Package Auto-Updated',
              description: `${packageRecord.package_record_number} marked as delivered — all shipments complete.`,
            });
          } else {
            console.error('Auto-consolidation failed:', error);
            hasRunRef.current = false;
          }
        });
    }
  }, [packageRecord?.id, packageRecord?.consolidated_status, individualShipments]);
};
