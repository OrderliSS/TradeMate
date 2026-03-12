import React, { createContext, useContext } from 'react';

const SubscriptionContext = createContext<any>(null);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SubscriptionContext.Provider value={{ tier: 'pro' }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
