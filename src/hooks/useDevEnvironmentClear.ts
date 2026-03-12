import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export const useDevEnvironmentClear = () => {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearDevEnvironmentData = async (): Promise<boolean> => {
    setIsClearing(true);
    
    try {
      // Call the database function to clear development data
      const { data, error } = await supabase.rpc('clear_test_environment_data');
      
      if (error) {
        console.error('Error clearing development environment data:', error);
        toast({
          title: "Error",
          description: "Failed to clear development environment data. Please check your permissions.",
          variant: "destructive",
        });
        return false;
      }

      // Process results
      const results = data as Array<{
        table_name: string;
        rows_deleted: number;
        status: string;
        error_message: string | null;
      }>;

      const totalRow = results.find(r => r.table_name === 'TOTAL');
      const errors = results.filter(r => r.status === 'error' && r.table_name !== 'TOTAL');
      
      console.log('Clear results:', results);

      if (errors.length > 0) {
        console.error('Some tables failed to clear:', errors);
        toast({
          title: "Partial Success",
          description: `Cleared most data, but ${errors.length} table(s) had errors. Check console for details.`,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Development Environment Reset",
        description: `Successfully cleared ${totalRow?.rows_deleted || 0} rows across all tables.`,
        variant: "default",
      });

      // Invalidate all relevant queries to update UI immediately
      queryClient.invalidateQueries({ queryKey: ["vendor-stores"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-shops"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-categories"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });

      return true;
      
    } catch (error) {
      console.error('Unexpected error clearing development data:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while clearing development data.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsClearing(false);
    }
  };

  return {
    clearDevEnvironmentData,
    isClearing
  };
};
