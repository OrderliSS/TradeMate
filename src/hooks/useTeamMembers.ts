import { useQuery } from '@tanstack/react-query';
import { productionClient } from '@/lib/production-client';
import { useEnvironment } from '@/hooks/useEnvironment';

export interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  employee_id?: string;
}

/**
 * Hook to fetch team members (all profiles) for assigning to tasks
 */
export const useTeamMembers = () => {
  const environment = useEnvironment();

  return useQuery({
    queryKey: ['team-members', environment],
    queryFn: async () => {
      const { data, error } = await productionClient
        .from('profiles')
        .select('id, email, full_name, employee_id')
        .order('full_name');

      if (error) throw error;
      return data as TeamMember[];
    },
  });
};
