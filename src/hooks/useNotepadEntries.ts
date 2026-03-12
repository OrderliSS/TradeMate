import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface NotepadEntry {
  id: string;
  content: string;
  tags: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
  show_on_calendar?: boolean;
  calendar_date?: string;
  calendar_time?: string;
}

export const useCalendarNotes = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["calendar_notes", dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notepad_entries")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .eq("show_on_calendar", true)
        .not("calendar_date", "is", null)
        .order("calendar_date", { ascending: true });
      
      if (error) throw error;
      return data as NotepadEntry[];
    },
  });
};

export const useNotepadEntries = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["notepad_entries", dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notepad_entries")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as NotepadEntry[];
    },
  });
};

export const useCreateNotepadEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (newEntry: Omit<NotepadEntry, "id" | "created_at" | "updated_at">) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      
      if (!orgId) {
        throw new Error('Unable to determine organization');
      }
      
      const { data, error } = await supabase
        .from("notepad_entries")
        .insert({
          ...newEntry,
          data_environment: dataEnvironment,
          created_by: userData.user?.id,
          organization_id: orgId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notepad_entries"] });
      toast({
        title: "Success",
        description: "Note created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create note",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateNotepadEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NotepadEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from("notepad_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notepad_entries"] });
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteNotepadEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notepad_entries")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notepad_entries"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });
};