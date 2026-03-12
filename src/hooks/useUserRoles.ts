export const useUserRoles = () => {
    return {
        roles: ['admin'],
        loading: false,
        hasRole: (role: string) => role === 'admin',
        isAdmin: true,
        isSales: false,
        isMarketing: false,
        isFinance: false,
        isSecurity: false,
        isEmployee: true,
        refetch: () => Promise.resolve()
    };
};
