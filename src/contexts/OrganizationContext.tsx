import React, { createContext, useContext } from 'react';

const OrganizationContext = createContext<any>(null);

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const currentOrganization = {
    id: 'mock-org-id',
    name: 'TradeMate',
    access_code: 'TM-001',
    member_count: 5
  };

  return (
    <OrganizationContext.Provider value={{ currentOrganization, canManageMembers: true }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
