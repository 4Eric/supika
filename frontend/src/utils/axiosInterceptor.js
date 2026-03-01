import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

export const setupAxiosInterceptors = () => {
    // Response interceptor
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config

            // If the error is 401 and not a retry (avoid infinite loops)
            if (error.response?.status === 401 && !originalRequest._retry) {
                // If the error comes from the refresh-token endpoint itself, logout
                if (originalRequest.url.includes('/api/auth/refresh-token')) {
                    const authStore = useAuthStore()
                    authStore.logout()
                    return Promise.reject(error)
                }

                originalRequest._retry = true

                try {
                    const authStore = useAuthStore()
                    const newToken = await authStore.refreshAccessToken()

                    // Update the header and retry the original request
                    originalRequest.headers['x-auth-token'] = newToken
                    return axios(originalRequest)
                } catch (refreshError) {
                    // Refresh failed, authStore.refreshAccessToken already handles logout
                    return Promise.reject(refreshError)
                }
            }

            return Promise.reject(error)
        }
    )
}
