import React, { createContext, useContext } from 'react';

const OrganizationContext = createContext<any>(null);

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const currentOrganization = {
    id: 'mock-org-id',
    name: 'Orderli Classic',
    access_code: 'OR-CLASSIC',
    member_count: 5
  };

  return (
    <OrganizationContext.Provider value={{ currentOrganization, canManageMembers: true }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
