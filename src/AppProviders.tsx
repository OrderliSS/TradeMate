import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { SandboxProvider } from './contexts/SandboxContext';
import { TierProvider } from './contexts/TierContext';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <OrganizationProvider>
                    <SubscriptionProvider>
                        <ImpersonationProvider>
                            <SandboxProvider>
                                <TierProvider>
                                    {children}
                                </TierProvider>
                            </SandboxProvider>
                        </ImpersonationProvider>
                    </SubscriptionProvider>
                </OrganizationProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
};

