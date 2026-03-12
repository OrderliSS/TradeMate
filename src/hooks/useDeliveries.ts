import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Delivery {
  id: string;
  po_id?: string;
  expense_id?: string;
  carrier: string;
  tracking_number: string;
  eta?: string;
  status: 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DeliveryLine {
  id: string;
  delivery_id: string;
  product_id: string;
  qty_expected?: number;
  qty_received: number;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
}

export interface TrackingEvent {
  id: string;
  delivery_id: string;
  event_time: string;
  location?: string;
  code: string;
  description: string;
  raw_payload?: any;
  created_at: string;
}

export interface Receipt {
  id: string;
  delivery_id: string;
  product_id: string;
  qty_received: number;
  received_at: string;
  receiver_id?: string;
  asset_ids?: string[];
  notes?: string;
  created_at: string;
}

export interface DeliveryWithDetails extends Delivery {
  lines: DeliveryLine[];
  events: TrackingEvent[];
  receipts: Receipt[];
}

export const useDeliveries = (poId?: string) => {
  return useQuery({
    queryKey: ["deliveries", poId],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select(`
          *,
          lines:delivery_lines(
            *,
            product:products(id, name, sku)
          ),
          events:tracking_events(*),
          receipts(*)
        `)
        .order("created_at", { ascending: false });

      if (poId) {
        query = query.eq("po_id", poId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DeliveryWithDetails[];
    },
  });
};

export const useDelivery = (id: string) => {
  return useQuery({
    queryKey: ["delivery", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          lines:delivery_lines(
            *,
            product:products(id, name, sku)
          ),
          events:tracking_events(*),
          receipts(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as DeliveryWithDetails;
    },
    enabled: !!id,
  });
};

export const useCreateDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      po_id?: string;
      expense_id?: string;
      carrier: string;
      tracking_number: string;
      eta?: string;
      lines?: Array<{
        product_id: string;
        qty_expected?: number;
      }>;
    }) => {
      // First create the delivery
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert([{
          po_id: data.po_id,
          expense_id: data.expense_id,
          carrier: data.carrier,
          tracking_number: data.tracking_number,
          eta: data.eta,
        }])
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      // Then create delivery lines if provided
      if (data.lines && data.lines.length > 0) {
        const lines = data.lines.map(line => ({
          delivery_id: delivery.id,
          product_id: line.product_id,
          qty_expected: line.qty_expected,
        }));

        const { error: linesError } = await supabase
          .from("delivery_lines")
          .insert(lines);

        if (linesError) throw linesError;
      }

      return delivery as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Delivery tracking added successfully");
    },
    onError: (error) => {
      console.error("Error creating delivery:", error);
      toast.error("Failed to add delivery tracking");
    },
  });
};

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
      toast.success("Delivery status updated");
    },
    onError: (error) => {
      console.error("Error updating delivery status:", error);
      toast.error("Failed to update delivery status");
    },
  });
};

export const useCreateTrackingEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<TrackingEvent, "id" | "created_at">) => {
      const { data: event, error } = await supabase
        .from("tracking_events")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return event as TrackingEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
      toast.success("Tracking event added");
    },
    onError: (error) => {
      console.error("Error creating tracking event:", error);
      toast.error("Failed to add tracking event");
    },
  });
};

export const useCreateReceipt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      delivery_id: string;
      items: Array<{
        product_id: string;
        qty_received: number;
        asset_ids?: string[];
        notes?: string;
      }>;
    }) => {
      const receipts = data.items.map(item => ({
        delivery_id: data.delivery_id,
        product_id: item.product_id,
        qty_received: item.qty_received,
        asset_ids: item.asset_ids || [],
        notes: item.notes,
      }));

      const { data: createdReceipts, error } = await supabase
        .from("receipts")
        .insert(receipts)
        .select();

      if (error) throw error;

      // Update delivery lines received quantities
      for (const item of data.items) {
        // Get current qty_received and add to it
        const { data: currentLine } = await supabase
          .from("delivery_lines")
          .select("qty_received")
          .eq("delivery_id", data.delivery_id)
          .eq("product_id", item.product_id)
          .single();

        const newQtyReceived = (currentLine?.qty_received || 0) + item.qty_received;

        const { error: updateError } = await supabase
          .from("delivery_lines")
          .update({ qty_received: newQtyReceived })
          .eq("delivery_id", data.delivery_id)
          .eq("product_id", item.product_id);

        if (updateError) {
          console.error("Error updating delivery line:", updateError);
        }
      }

      // Update purchase order line received quantities if linked to PO
      const { data: delivery } = await supabase
        .from("deliveries")
        .select("po_id")
        .eq("id", data.delivery_id)
        .single();

      if (delivery?.po_id) {
        for (const item of data.items) {
          // Get current received_qty and add to it
          const { data: currentPOLine } = await supabase
            .from("purchase_order_lines")
            .select("received_qty")
            .eq("po_id", delivery.po_id)
            .eq("product_id", item.product_id)
            .single();

          const newReceivedQty = (currentPOLine?.received_qty || 0) + item.qty_received;

          const { error: updatePOError } = await supabase
            .from("purchase_order_lines")
            .update({ received_qty: newReceivedQty })
            .eq("po_id", delivery.po_id)
            .eq("product_id", item.product_id);

          if (updatePOError) {
            console.error("Error updating PO line:", updatePOError);
          }
        }
      }

      return createdReceipts as Receipt[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["po-progress"] });
      toast.success("Items received successfully");
    },
    onError: (error) => {
      console.error("Error creating receipt:", error);
      toast.error("Failed to receive items");
    },
  });
};