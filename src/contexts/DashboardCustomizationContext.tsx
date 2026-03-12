import { useState } from 'react';

export const useDashboardCustomization = () => {
    const [isOpen, setOpen] = useState(false);
    return {
        isOpen,
        setOpen,
        closeDialog: () => setOpen(false)
    };
};
