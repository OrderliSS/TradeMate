import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useTrackingUsage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['tracking-usage', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('monthly_tracking_usage, tracking_tier_limit')
        .eq('id', orgId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const usage = query.data?.monthly_tracking_usage ?? 0;
  const limit = query.data?.tracking_tier_limit ?? 50;
  const percentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
  const isAtLimit = usage >= limit;

  return { ...query, usage, limit, percentage, isAtLimit };
}
