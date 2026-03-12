import React, { createContext, useContext } from 'react';

const TierContext = createContext<any>(null);

export const TierProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <TierContext.Provider value={{ activeTier: 'CORE' }}>
      {children}
    </TierContext.Provider>
  );
};

export const useTier = () => useContext(TierContext);
