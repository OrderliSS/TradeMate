import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState({
    id: 'mock-user-id',
    email: 'demo@orderli.classic',
    user_metadata: { full_name: 'Demo User' }
  });

  const signOut = async () => console.log('Sign out');

  return (
    <AuthContext.Provider value={{ user, signOut, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
