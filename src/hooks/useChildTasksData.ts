import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChildTaskOrder {
  order: {
    id: string;
    product: { id: string; name: string } | null;
    receipt_number: string | null;
    ticket_number: string | null;
    order_status: string | null;
    total_amount: number;
    purchase_date: string;
    quantity: number;
  };
  fromTask: {
    id: string;
    title: string;
    task_number: string | null;
  };
}

export interface ChildTaskAppointment {
  appointment: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
    appointment_type: string;
    location: string | null;
    customer_id: string | null;
    customer?: { id: string; name: string } | null;
    purchase_id?: string | null;
    purchase?: {
      id: string;
      receipt_number: string | null;
      ticket_number: string | null;
      order_status: string | null;
      total_amount: number;
      purchase_date: string;
      quantity: number;
      product: {
        id: string;
        name: string;
        sku?: string | null;
        images?: string[] | null;
        is_bundle?: boolean | null;
        bundle_components?: any;
      } | null;
    } | null;
    // Additional fields needed by AppointmentViewDialog
    created_at: string;
    updated_at: string;
    notes: string | null;
    description: string | null;
    meeting_url: string | null;
    duration: number | null;
    attendees: any | null;
    reminder_settings: any | null;
    outcome_notes: string | null;
    confirmed_at: string | null;
    confirmed_by: string | null;
    rescheduled_from: string | null;
    created_by: string | null;
    assigned_to: string | null;
    task_id: string | null;
    task?: {
      id: string;
      title: string;
      task_number: string | null;
      parent_task_id: string | null;
      parent_task?: {
        id: string;
        title: string;
        task_number: string | null;
      } | null;
    } | null;
  };
  fromTask: {
    id: string;
    title: string;
    task_number: string | null;
  };
}

export interface ChildTasksData {
  childOrders: ChildTaskOrder[];
  childAppointments: ChildTaskAppointment[];
}

export function useChildTasksData(parentTaskId: string | null | undefined) {
  return useQuery({
    queryKey: ["child-tasks-data", parentTaskId],
    enabled: !!parentTaskId,
    queryFn: async (): Promise<ChildTasksData> => {
      if (!parentTaskId) {
        return { childOrders: [], childAppointments: [] };
      }

      // Fetch child tasks with their purchase_id
      const { data: childTasks, error: childTasksError } = await supabase
        .from("tasks")
        .select("id, title, task_number, purchase_id")
        .eq("parent_task_id", parentTaskId);

      if (childTasksError) throw childTasksError;

      const childOrders: ChildTaskOrder[] = [];
      const childAppointments: ChildTaskAppointment[] = [];

      if (!childTasks || childTasks.length === 0) {
        return { childOrders, childAppointments };
      }

      const childTaskIds = childTasks.map(t => t.id);
      const purchaseIds = childTasks
        .filter(t => t.purchase_id)
        .map(t => t.purchase_id as string);

      // Fetch orders linked to child tasks
      if (purchaseIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from("purchases")
          .select(`
            id,
            receipt_number,
            ticket_number,
            order_status,
            total_amount,
            purchase_date,
            quantity,
            product:products(id, name)
          `)
          .in("id", purchaseIds);

        if (ordersError) throw ordersError;

        if (orders) {
          for (const order of orders) {
            const fromTask = childTasks.find(t => t.purchase_id === order.id);
            if (fromTask) {
              childOrders.push({
                order: {
                  id: order.id,
                  product: order.product as { id: string; name: string } | null,
                  receipt_number: order.receipt_number,
                  ticket_number: order.ticket_number,
                  order_status: order.order_status,
                  total_amount: order.total_amount,
                  purchase_date: order.purchase_date,
                  quantity: order.quantity,
                },
                fromTask: {
                  id: fromTask.id,
                  title: fromTask.title,
                  task_number: fromTask.task_number,
                },
              });
            }
          }
        }
      }

      // Fetch appointments linked to child tasks with purchase data
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          appointment_type,
          location,
          customer_id,
          task_id,
          purchase_id,
          created_at,
          updated_at,
          notes,
          description,
          meeting_url,
          duration,
          attendees,
          reminder_settings,
          outcome_notes,
          confirmed_at,
          confirmed_by,
          rescheduled_from,
          created_by,
          assigned_to,
          customer:customers(id, name),
          purchase:purchases(
            id,
            receipt_number,
            ticket_number,
            order_status,
            total_amount,
            purchase_date,
            quantity,
            product:products(id, name, sku, images, is_bundle, bundle_components)
          ),
          task:tasks(
            id,
            title,
            task_number,
            parent_task_id,
            parent_task:tasks!tasks_parent_task_id_fkey(id, title, task_number)
          )
        `)
        .in("task_id", childTaskIds);

      if (appointmentsError) throw appointmentsError;

      if (appointments) {
        for (const apt of appointments) {
          const fromTask = childTasks.find(t => t.id === apt.task_id);
          if (fromTask) {
            childAppointments.push({
              appointment: {
                id: apt.id,
                title: apt.title,
                start_time: apt.start_time,
                end_time: apt.end_time,
                status: apt.status,
                appointment_type: apt.appointment_type,
                location: apt.location,
                customer_id: apt.customer_id,
                customer: apt.customer as { id: string; name: string } | null,
                purchase_id: apt.purchase_id,
                purchase: apt.purchase as ChildTaskAppointment['appointment']['purchase'],
                created_at: apt.created_at,
                updated_at: apt.updated_at,
                notes: apt.notes,
                description: apt.description,
                meeting_url: apt.meeting_url,
                duration: apt.duration,
                attendees: apt.attendees,
                reminder_settings: apt.reminder_settings,
                outcome_notes: apt.outcome_notes,
                confirmed_at: apt.confirmed_at,
                confirmed_by: apt.confirmed_by,
                rescheduled_from: apt.rescheduled_from,
                created_by: apt.created_by,
                assigned_to: apt.assigned_to,
                task_id: apt.task_id,
                task: apt.task ? {
                  ...apt.task,
                  parent_task: Array.isArray(apt.task.parent_task) ? apt.task.parent_task[0] : apt.task.parent_task
                } as ChildTaskAppointment['appointment']['task'] : null,
              },
              fromTask: {
                id: fromTask.id,
                title: fromTask.title,
                task_number: fromTask.task_number,
              },
            });
          }
        }
      }

      return { childOrders, childAppointments };
    },
  });
}
