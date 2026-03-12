import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentStats } from "@/types/documents";
import { useDataEnvironment } from "@/hooks/useSandbox";

export const useDocumentStats = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["document-stats", dataEnvironment],
    queryFn: async (): Promise<DocumentStats> => {
      const [documentsResult, categoriesResult] = await Promise.all([
        supabase.from("documents").select("download_count, created_at").eq("data_environment", dataEnvironment),
        supabase.from("document_categories").select("id", { count: "exact" })
      ]);

      if (documentsResult.error) throw documentsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const documents = documentsResult.data || [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUploads = documents.filter(
        doc => new Date(doc.created_at) > thirtyDaysAgo
      ).length;

      const totalDownloads = documents.reduce(
        (sum, doc) => sum + (doc.download_count || 0), 
        0
      );

      return {
        total_documents: documents.length,
        total_downloads: totalDownloads,
        categories_count: categoriesResult.count || 0,
        recent_uploads: recentUploads,
      };
    },
  });
};