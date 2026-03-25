import { API_URL } from '@/config/api'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        token: localStorage.getItem('token') || null,
        refreshToken: localStorage.getItem('refreshToken') || null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
    },
    actions: {
        async login(email, password) {
            try {
                const response = await axios.post(`${API_URL}/api/auth/login`, { email, password })
                const { token, refreshToken, user } = response.data

                this.token = token
                this.refreshToken = refreshToken
                this.user = user

                localStorage.setItem('token', this.token)
                localStorage.setItem('refreshToken', this.refreshToken)
                localStorage.setItem('user', JSON.stringify(this.user))

                axios.defaults.headers.common['x-auth-token'] = this.token
                return true
            } catch (error) {
                console.error('Login error', error)
                return false
            }
        },
        async refreshAccessToken() {
            try {
                if (!this.refreshToken) throw new Error('No refresh token')

                const response = await axios.post(`${API_URL}/api/auth/refresh-token`, {
                    refreshToken: this.refreshToken
                })

                this.token = response.data.token
                localStorage.setItem('token', this.token)
                axios.defaults.headers.common['x-auth-token'] = this.token

                return this.token
            } catch (error) {
                console.error('Token refresh failed', error)
                this.logout()
                throw error
            }
        },
        async register(username, email, password, avatarFile = null, avatarUrl = null) {
            try {
                const formData = new FormData()
                formData.append('username', username)
                formData.append('email', email)
                formData.append('password', password)
                if (avatarFile) {
                    formData.append('avatar', avatarFile)
                } else if (avatarUrl) {
                    formData.append('avatarUrl', avatarUrl)
                }
                
                await axios.post(`${API_URL}/api/auth/register`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                return await this.login(email, password)
            } catch (error) {
                console.error('Registration error', error)
                const message = error.response?.data?.message || 'Registration failed'
                throw new Error(message)
            }
        },
        async updateProfile(userData, avatarFile = null, avatarUrl = null) {
            try {
                const formData = new FormData()
                Object.keys(userData).forEach(key => {
                    if (userData[key] !== undefined && userData[key] !== null) {
                        formData.append(key, userData[key])
                    }
                })
                if (avatarFile) {
                    formData.append('avatar', avatarFile)
                } else if (avatarUrl) {
                    formData.append('avatarUrl', avatarUrl)
                }

                const response = await axios.put(`${API_URL}/api/auth/me`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                
                this.updateUser(response.data)
                return response.data
            } catch (error) {
                console.error('Profile update failed', error)
                throw error
            }
        },
        async logout() {
            try {
                if (this.token && this.refreshToken) {
                    await axios.post(`${API_URL}/api/auth/logout`, {
                        refreshToken: this.refreshToken
                    }, {
                        headers: { 'x-auth-token': this.token }
                    })
                }
            } catch (error) {
                console.error('Logout error', error)
            } finally {
                this.token = null
                this.refreshToken = null
                this.user = null
                localStorage.removeItem('token')
                localStorage.removeItem('refreshToken')
                localStorage.removeItem('user')
                delete axios.defaults.headers.common['x-auth-token']
            }
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
