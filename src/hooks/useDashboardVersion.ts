import { create } from "zustand";
import { persist } from "zustand/middleware";
export type DashboardVersion = "CLASSIC" | "MODERN";
export const DASHBOARD_VERSION_KEY = "orderli_dash_pref_v3";

interface DashboardVersionState {
  version: DashboardVersion;
  setVersion: (v: DashboardVersion) => void;
  toggleVersion: () => void;
}

const useStore = create<DashboardVersionState>()(
  persist(
    (set, get) => ({
      version: "MODERN",
      setVersion: (v) => set({ version: v }),
      toggleVersion: () =>
        set({ version: get().version === "CLASSIC" ? "MODERN" : "CLASSIC" }),
    }),
    { name: DASHBOARD_VERSION_KEY }
  )
);

export const useDashboardVersion = () => {
  const { version, setVersion, toggleVersion } = useStore();

  return {
    version,
    setVersion,
    toggleVersion,
    canToggle: true,
  };
};
