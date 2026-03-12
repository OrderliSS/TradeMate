import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  employee_id?: string;
  subscription_tier: 'free' | 'starter';
  stripe_customer_id?: string;
  subscription_end?: string;
  profession_category?: string;
  default_sidebar_pinned?: boolean;
  default_dashboard_version?: 'CLASSIC' | 'MODERN';
}

export const useUserProfile = () => {
  const { user } = useAuth();
  
  const profile: UserProfile = {
    id: user?.id || 'mock-id',
    email: user?.email || 'demo@classic.com',
    full_name: 'Demo User',
    subscription_tier: 'free',
  };

  return { profile, loading: false };
};