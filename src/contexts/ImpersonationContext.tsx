import React, { createContext, useContext } from 'react';

const ImpersonationContext = createContext<any>(null);

export const ImpersonationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ImpersonationContext.Provider value={{ isImpersonating: false, stopImpersonation: async () => {} }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);
