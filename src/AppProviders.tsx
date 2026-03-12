import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { SandboxProvider } from './contexts/SandboxContext';
import { TierProvider } from './contexts/TierContext';
import { DashboardCustomizationProvider } from './contexts/DashboardCustomizationContext';

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
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
    );
};
