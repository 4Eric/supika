import { API_URL } from '@/config/api'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        token: localStorage.getItem('token') || null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
    },
    actions: {
        async login(email, password) {
            try {
                const response = await axios.post(`${API_URL}/api/auth/login`, { email, password })
                this.token = response.data.token
                this.user = response.data.user
                localStorage.setItem('token', this.token)
                localStorage.setItem('user', JSON.stringify(this.user))
                axios.defaults.headers.common['x-auth-token'] = this.token
                return true
            } catch (error) {
                console.error('Login error', error)
                return false
            }
        },
        async register(username, email, password) {
            try {
                await axios.post(`${API_URL}/api/auth/register`, { username, email, password })
                return await this.login(email, password)
            } catch (error) {
                console.error('Registration error', error)
                return false
            }
        },
        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            delete axios.defaults.headers.common['x-auth-token']
        },
        updateUser(userData) {
            this.user = { ...this.user, ...userData }
            localStorage.setItem('user', JSON.stringify(this.user))
        },
        init() {
            if (this.token) {
                axios.defaults.headers.common['x-auth-token'] = this.token
            }
        }
    }
})

