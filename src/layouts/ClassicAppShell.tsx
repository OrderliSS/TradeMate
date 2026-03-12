import React, { useState } from 'react';
import { ModernSidebar } from "@/components/navigation/ModernSidebar";
import { UniversalNavBar } from "@/components/navigation/UniversalNavBar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect } from "react";

interface ClassicAppShellProps {
    children: React.ReactNode;
    onVersionToggle?: (version: "CLASSIC" | "MODERN") => void;
}

export const ClassicAppShell = ({ children, onVersionToggle }: ClassicAppShellProps) => {
    const { profile } = useUserProfile();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [sidebarPinned, setSidebarPinned] = useState(true);

    // Sync sidebar state with profile preference once loaded
    useEffect(() => {
        if (profile) {
            const defaultValue = profile.default_sidebar_pinned ?? true;
            setIsSidebarExpanded(defaultValue);
            setSidebarPinned(defaultValue);
        }
    }, [profile]);

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <ModernSidebar
                isExpanded={isSidebarExpanded}
                onExpandedChange={(expanded) => {
                    if (!sidebarPinned) setIsSidebarExpanded(expanded);
                }}
                isPinned={sidebarPinned}
                onTogglePin={() => {
                    setSidebarPinned(!sidebarPinned);
                    if (!sidebarPinned) setIsSidebarExpanded(true);
                }}
                expandableMode={true}
                onVersionToggle={onVersionToggle ? () => onVersionToggle("MODERN") : undefined}
            />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
                <div className="sticky top-0 z-30 flex-shrink-0">
                    <UniversalNavBar hideDropdownTabs={true} />
                </div>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};
