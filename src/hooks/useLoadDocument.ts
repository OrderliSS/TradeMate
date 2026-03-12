import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentWithCategory } from "@/types/documents";

export const useLoadDocument = (documentId?: string) => {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: async (): Promise<{ document: DocumentWithCategory; content: string } | null> => {
      if (!documentId) return null;

      // First get document metadata
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(*)
        `)
        .eq('id', documentId)
        .maybeSingle();

      if (docError) throw docError;
      if (!document) return null;

      // If document has a file_path, fetch content from storage
      let content = '';
      if (document.file_path) {
        const { data: fileData, error: fileError } = await supabase.storage
          .from('documents')
          .download(document.file_path);

        if (!fileError && fileData) {
          content = await fileData.text();
        }
      }

      return {
        document: document as DocumentWithCategory,
        content
      };
    },
    enabled: !!documentId,
  });
};