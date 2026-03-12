import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TaskWithAutoCaseData {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  task_type?: string;
  customer_id?: string;
  due_date?: string;
  follow_up_date?: string;
  location?: string;
}

interface CreateResult {
  parentCase: { id: string; task_number: string };
  task: { id: string; task_number: string };
}

export const useCreateTaskWithAutoCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: TaskWithAutoCaseData): Promise<CreateResult> => {
      // Generate a title for the auto-created parent case
      const dateStr = format(new Date(), 'dd MMM yyyy');
      const caseTitle = `Quick Task - ${dateStr}`;

      // Step 1: Create the parent Case (task with parent_task_id = null)
      const { data: parentCase, error: caseError } = await supabase
        .from("tasks")
        .insert({
          title: caseTitle,
          description: `Auto-generated case for quick task: ${taskData.title}`,
          status: 'pending',
          priority: taskData.priority || 'medium',
          task_type: taskData.task_type || 'general',
          customer_id: taskData.customer_id || null,
          parent_task_id: null, // This makes it a Case
        })
        .select("id, task_number")
        .single();

      if (caseError) {
        console.error("Error creating parent case:", caseError);
        throw new Error(`Failed to create parent case: ${caseError.message}`);
      }

      // Step 2: Create the actual Task with parent_task_id pointing to the Case
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: taskData.title,
          description: taskData.description || null,
          status: 'pending',
          priority: taskData.priority || 'medium',
          task_type: taskData.task_type || 'general',
          customer_id: taskData.customer_id || null,
          due_date: taskData.due_date || null,
          follow_up_date: taskData.follow_up_date || null,
          location: taskData.location || null,
          parent_task_id: parentCase.id, // This makes it a Task under the Case
        })
        .select("id, task_number")
        .single();

      if (taskError) {
        console.error("Error creating task:", taskError);
        // Attempt to clean up the orphaned case
        await supabase.from("tasks").delete().eq("id", parentCase.id);
        throw new Error(`Failed to create task: ${taskError.message}`);
      }

      return { parentCase, task };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      toast.success(
        `Task created! A case (${result.parentCase.task_number}) was auto-created to organize it.`
      );
    },
    onError: (error) => {
      console.error("Error in createTaskWithAutoCase:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    },
  });
};
