import { useState } from 'react';

export const useDashboardVersion = () => {
    const [version, setVersion] = useState("CLASSIC");
    return {
        version,
        setVersion,
        canToggle: true
    };
};
