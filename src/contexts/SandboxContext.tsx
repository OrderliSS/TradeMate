import React, { createContext, useContext } from 'react';

const SandboxContext = createContext<any>(null);

export const SandboxProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SandboxContext.Provider value={{ 
        isSandboxMode: false, 
        toggleSandboxMode: async () => {}, 
        loading: false, 
        sandboxEnabled: false 
    }}>
      {children}
    </SandboxContext.Provider>
  );
};

export const useSandbox = () => useContext(SandboxContext);
