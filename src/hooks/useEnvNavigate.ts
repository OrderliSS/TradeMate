import { useNavigate } from "react-router-dom";

/**
 * Passthrough to react-router-dom's useNavigate.
 * Previously added ?env= parameters; now simplified since
 * environment is determined at build time.
 */
export const useEnvNavigate = () => useNavigate();
