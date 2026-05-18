import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { setupAxiosInterceptors } from '@/utils/axiosInterceptor'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error Boundary]', err, info)
    // You can show a generic toast here or report to Sentry
    // Since we don't have a toast component globally imported in main.js, we just log.
}

// Initialize axios interceptors
setupAxiosInterceptors()

// Initialize auth state (headers)
const authStore = useAuthStore()
authStore.init()

app.mount('#app')

