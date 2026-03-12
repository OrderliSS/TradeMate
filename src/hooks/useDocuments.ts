import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentWithCategory, Document } from "@/types/documents";
import { useToast } from "@/hooks/use-toast";
import { SecureEnvironment } from "@/lib/secure-environment";
import { useDataEnvironment } from "@/hooks/useSandbox";

export const useDocuments = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["documents", dataEnvironment],
    queryFn: async (): Promise<DocumentWithCategory[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          category:document_categories(*)
        `)
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useDocumentsByCategory = (categoryId: string) => {
  return useQuery({
    queryKey: ["documents", "category", categoryId],
    queryFn: async (): Promise<DocumentWithCategory[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          category:document_categories(*)
        `)
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (document: Omit<Document, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("documents")
        .insert([{ ...document, data_environment: dataEnvironment }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-stats"] });
      toast({
        title: "Success",
        description: "Document created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create document",
        variant: "destructive",
      });
      SecureEnvironment.error("Error creating document:", error);
    },
  });
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Document> & { id: string }) => {
      const { data, error } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update document",
        variant: "destructive",
      });
      SecureEnvironment.error("Error updating document:", error);
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-stats"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
      SecureEnvironment.error("Error deleting document:", error);
    },
  });
};

export const useIncrementDownloadCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the current document
      const { data: currentDoc, error: fetchError } = await supabase
        .from('documents')
        .select('download_count')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Then update with incremented count
      const { error } = await supabase
        .from('documents')
        .update({ download_count: (currentDoc.download_count || 0) + 1 })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-stats"] });
    },
  });
};