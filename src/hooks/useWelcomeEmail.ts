import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/lib/logger';

/**
 * Hook to send welcome email to new organization owners
 * This should be called once when a user completes onboarding
 */
export function useWelcomeEmail() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const sendWelcomeEmail = useCallback(async (): Promise<boolean> => {
    if (!user?.email || !currentOrganization) {
      logger.warn('Cannot send welcome email: missing user or organization', {
        hasUser: !!user,
        hasOrg: !!currentOrganization,
      });
      return false;
    }

    // Only send to organization owners
    if (!currentOrganization.is_owner) {
      logger.info('Skipping welcome email: user is not organization owner');
      return false;
    }

    try {
      logger.info('Sending welcome owner email', {
        email: user.email,
        organizationName: currentOrganization.name,
        workspaceId: currentOrganization.access_code,
      });

      // Get access token for authenticated edge function call
      const { data: { session } } = await supabase.auth.getSession();

      const response = await invokeEdgeFunction('send-invitation-email', {
        body: {
          type: 'welcome_owner',
          email: user.email,
          organizationName: currentOrganization.name,
          workspaceId: currentOrganization.access_code,
          ownerName: user.user_metadata?.full_name || user.email?.split('@')[0],
          dashboardUrl: `${window.location.origin}/`,
        },
        accessToken: session?.access_token,
      });

      if (response.error) {
        logger.error('Failed to send welcome email', { error: response.error });
        return false;
      }

      logger.info('Welcome email sent successfully');
      return true;
    } catch (err) {
      logger.error('Error sending welcome email', { error: err });
      return false;
    }
  }, [user, currentOrganization]);

  return { sendWelcomeEmail };
}
