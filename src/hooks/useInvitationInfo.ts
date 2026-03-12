import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface InvitationInfo {
  valid: boolean;
  email?: string;
  role?: string;
  organization_name?: string;
  inviter_name?: string;
  expired?: boolean;
  status?: string;
  error?: string;
}

/**
 * Hook to fetch invitation info for unauthenticated users
 * Uses the get_invitation_info RPC function which bypasses RLS
 */
export function useInvitationInfo(token: string | null) {
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvitationInfo(null);
      setLoading(false);
      return;
    }

    const fetchInvitationInfo = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: rpcError } = await supabase.rpc('get_invitation_info', {
          p_token: token
        });

        if (rpcError) {
          logger.error('Failed to fetch invitation info', rpcError);
          setError('Failed to load invitation details');
          setInvitationInfo({ valid: false, error: 'Failed to load invitation details' });
          return;
        }

        const result = data as unknown as InvitationInfo;
        setInvitationInfo(result);
        
        if (!result.valid) {
          setError(result.error || 'Invalid invitation');
        }
      } catch (err) {
        logger.error('Error fetching invitation info', err);
        setError('An unexpected error occurred');
        setInvitationInfo({ valid: false, error: 'An unexpected error occurred' });
      } finally {
        setLoading(false);
      }
    };

    fetchInvitationInfo();
  }, [token]);

  return {
    invitationInfo,
    loading,
    error,
    isValid: invitationInfo?.valid === true,
    isExpired: invitationInfo?.expired === true,
    isUsed: invitationInfo?.status !== 'pending' && invitationInfo?.valid === false
  };
}
