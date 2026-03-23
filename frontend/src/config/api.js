// Central API configuration
// Uses VITE_API_URL if set, otherwise dynamically matches the current host
const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    
    if (typeof window !== 'undefined') {
        const url = `${window.location.protocol}//${window.location.hostname}:5000`;
        return url;
    }
    
    return 'http://localhost:5000';
};

export const API_URL = getApiUrl();
