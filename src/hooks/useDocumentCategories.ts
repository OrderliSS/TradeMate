import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentCategory } from "@/types/documents";

export const useDocumentCategories = () => {
  return useQuery({
    queryKey: ["document-categories"],
    queryFn: async (): Promise<DocumentCategory[]> => {
      const { data, error } = await supabase
        .from("document_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
};