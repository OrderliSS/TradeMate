import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface RpcResponse {
  success: boolean;
  error?: string;
  organization_id?: string;
  role?: string;
}

interface AcceptInvitationResult {
  success: boolean;
  organizationId?: string;
  role?: string;
  error?: string;
}

export function useAcceptInvitation() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AcceptInvitationResult | null>(null);

  const acceptInvitation = useCallback(async (token: string): Promise<AcceptInvitationResult> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('accept_org_invitation', {
        p_token: token
      });

      if (error) {
        logger.error('Failed to accept invitation', error);
        const result = { success: false, error: error.message };
        setResult(result);
        return result;
      }

      const response = data as unknown as RpcResponse | null;

      if (!response?.success) {
        const result = { success: false, error: response?.error || 'Failed to accept invitation' };
        setResult(result);
        return result;
      }

      const successResult: AcceptInvitationResult = {
        success: true,
        organizationId: response.organization_id,
        role: response.role
      };
      
      setResult(successResult);
      return successResult;
    } catch (err) {
      logger.error('Error accepting invitation', err);
      const result = { success: false, error: 'An unexpected error occurred' };
      setResult(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    acceptInvitation,
    loading,
    result
  };
}
