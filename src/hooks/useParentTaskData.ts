import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParentTaskData {
  parentTask: {
    id: string;
    title: string;
    task_number: string | null;
    purchase_id: string | null;
    linked_product_id: string | null;
    customer_id: string | null;
  } | null;
  purchase: {
    id: string;
    product: { id: string; name: string };
    receipt_number: string | null;
    ticket_number: string | null;
    order_status: string;
    total_amount: number;
    purchase_date: string;
  } | null;
  appointments: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
    appointment_type: string;
    location: string | null;
    customer?: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
    };
  }>;
  linkedProduct: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
}

export const useParentTaskData = (parentTaskId: string | null | undefined) => {
  return useQuery({
    queryKey: ["parent-task-data", parentTaskId],
    enabled: !!parentTaskId,
    queryFn: async (): Promise<ParentTaskData> => {
      if (!parentTaskId) {
        return { parentTask: null, purchase: null, appointments: [], linkedProduct: null };
      }

      // Fetch parent task
      const { data: parentTask, error: taskError } = await supabase
        .from("tasks")
        .select("id, title, task_number, purchase_id, linked_product_id, customer_id")
        .eq("id", parentTaskId)
        .single();

      if (taskError || !parentTask) {
        console.error("Error fetching parent task:", taskError);
        return { parentTask: null, purchase: null, appointments: [], linkedProduct: null };
      }

      // Fetch purchase if parent has one
      let purchase = null;
      if (parentTask.purchase_id) {
        const { data: purchaseData } = await supabase
          .from("purchases")
          .select(`
            id,
            receipt_number,
            ticket_number,
            order_status,
            total_amount,
            purchase_date,
            product:products(id, name)
          `)
          .eq("id", parentTask.purchase_id)
          .single();
        
        if (purchaseData) {
          purchase = {
            id: purchaseData.id,
            product: purchaseData.product as { id: string; name: string },
            receipt_number: purchaseData.receipt_number,
            ticket_number: purchaseData.ticket_number,
            order_status: purchaseData.order_status || 'pending',
            total_amount: purchaseData.total_amount,
            purchase_date: purchaseData.purchase_date,
          };
        }
      }

      // Fetch linked product if parent has one
      let linkedProduct = null;
      if (parentTask.linked_product_id) {
        const { data: productData } = await supabase
          .from("products")
          .select("id, name, sku")
          .eq("id", parentTask.linked_product_id)
          .single();
        
        if (productData) {
          linkedProduct = productData;
        }
      }

      // Fetch appointments linked to parent case
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          appointment_type,
          location,
          customer:customers(id, name, email, phone)
        `)
        .eq("task_id", parentTaskId);

      const appointments = (appointmentsData || []).map(apt => ({
        id: apt.id,
        title: apt.title,
        start_time: apt.start_time,
        end_time: apt.end_time,
        status: apt.status,
        appointment_type: apt.appointment_type,
        location: apt.location,
        customer: apt.customer as { id: string; name: string; email?: string; phone?: string } | undefined,
      }));

      return {
        parentTask,
        purchase,
        appointments,
        linkedProduct,
      };
    },
  });
};
