import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error)
        } else {
            prom.resolve(token)
        }
    })
    failedQueue = []
}

export const setupAxiosInterceptors = () => {
    // Response interceptor
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config

            // If the error is 401 and not a retry
            if (error.response?.status === 401 && !originalRequest._retry) {
                // If the error comes from auth endpoints, don't retry — just logout
                if (originalRequest.url?.includes('/api/auth/refresh-token') ||
                    originalRequest.url?.includes('/api/auth/login')) {
                    return Promise.reject(error)
                }

                // If already refreshing, queue this request to retry after refresh completes
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject })
                    }).then((token) => {
                        originalRequest.headers['x-auth-token'] = token
                        return axios(originalRequest)
                    }).catch((err) => Promise.reject(err))
                }

                originalRequest._retry = true
                isRefreshing = true

                try {
                    const authStore = useAuthStore()
                    const newToken = await authStore.refreshAccessToken()

                    processQueue(null, newToken)
                    isRefreshing = false

                    // Retry original request with new token
                    originalRequest.headers['x-auth-token'] = newToken
                    return axios(originalRequest)
                } catch (refreshError) {
                    processQueue(refreshError, null)
                    isRefreshing = false

                    // Refresh failed — session is dead. Logout + redirect.
                    const authStore = useAuthStore()
                    await authStore.logout()

                    // Store a flag so the login page can show a message
                    sessionStorage.setItem('session_expired', 'true')

                    router.push('/login')
                    return Promise.reject(refreshError)
                }
            }

            return Promise.reject(error)
        }
    )
}
