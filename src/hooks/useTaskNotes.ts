import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskNote } from "@/types/database";
import { toast } from "@/hooks/use-toast";

export const useTaskNotes = (taskId?: string) => {
  return useQuery({
    queryKey: ["task-notes", taskId],
    queryFn: async (): Promise<TaskNote[]> => {
      if (!taskId) return [];
      
      // Fetch notes WITHOUT the broken author join (created_by references auth.users, not profiles)
      const { data: notes, error } = await supabase
        .from("task_notes")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      if (!notes || notes.length === 0) return [];
      
      // Get unique created_by user IDs
      const userIds = [...new Set(notes.map(n => n.created_by).filter(Boolean))];
      
      // Batch fetch profiles for all authors
      let profilesMap: Record<string, { full_name: string | null; email: string | null; employee_id: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, employee_id")
          .in("id", userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email, employee_id: p.employee_id };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null; employee_id: string | null }>);
        }
      }
      
      // Map author data to each note
      return notes.map(note => ({
        ...note,
        author: note.created_by ? profilesMap[note.created_by] || null : null,
      })) as TaskNote[];
    },
    enabled: !!taskId,
  });
};

export const useCreateTaskNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note: Omit<TaskNote, "id" | "created_at" | "updated_at" | "author">) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert note WITHOUT the broken author join
      const { data, error } = await supabase
        .from("task_notes")
        .insert([{ ...note, created_by: user?.id } as any])
        .select("*")
        .single();
      
      if (error) throw error;
      
      // Fetch the author's profile separately
      let author = null;
      if (user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, employee_id")
          .eq("id", user.id)
          .maybeSingle();
        author = profileData;
      }
      
      return { ...data, author } as TaskNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-notes", data.task_id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTaskNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...note }: Partial<TaskNote> & { id: string }) => {
      const { data, error } = await supabase
        .from("task_notes")
        .update(note)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-notes", data.task_id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTaskNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_notes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-notes"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });
};