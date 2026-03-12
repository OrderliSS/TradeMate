import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productionClient } from '@/lib/production-client';
import { toast } from 'sonner';

interface UpdateProfileData {
  full_name?: string;
  employee_id?: string;
  default_sidebar_pinned?: boolean;
  default_dashboard_version?: 'CLASSIC' | 'MODERN';
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateProfileData }) => {
      const { error } = await productionClient
        .from('profiles')
        .update(data)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
};
