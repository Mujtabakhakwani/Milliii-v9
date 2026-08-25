// Dynamic backend URL configuration that works with custom domains
const getBackendUrl = () => {
  // Always use REACT_APP_BACKEND_URL from environment
  const envBackendUrl = process.env.REACT_APP_BACKEND_URL;

  // Return environment variable or fallback to correct backend port
  return envBackendUrl || "http://localhost:8000";
};

export const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;
