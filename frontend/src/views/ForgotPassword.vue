<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { API_URL } from '@/config/api'

const email = ref('')
const message = ref('')
const errorMsg = ref('')
const loading = ref(false)
const isSubmitted = ref(false)

const handleSubmit = async () => {
  message.value = ''
  errorMsg.value = ''
  loading.value = true

  try {
    const response = await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.value })
    message.value = response.data.message
    isSubmitted.value = true
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to send reset email.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div v-if="!isSubmitted">
        <div class="auth-header">
          <h1 class="auth-logo">Supika</h1>
          <p class="auth-subtitle">Enter your email to receive a password reset link.</p>
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input id="email" v-model="email" type="email" placeholder="you@example.com" required />
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Sending...' : 'Send Reset Link' }}
          </button>
        </form>

        <p class="toggle-text">
          Suddenly remembered?
          <router-link to="/login" class="toggle-link">Sign In</router-link>
        </p>
      </div>

      <!-- Success State -->
      <div v-else class="success-state">
        <div class="success-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" class="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="success-title">Check your email</h2>
        <p class="success-text">{{ message }}</p>
        <p class="success-hint">Don't see it? Check your spam folder or try again in a few minutes.</p>
        
        <button @click="isSubmitted = false; message = ''" class="btn btn-outline resend-btn">
          Try another email
        </button>

        <p class="toggle-text">
          <router-link to="/login" class="toggle-link">Back to Sign In</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 2rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 1.5rem;
  padding: 2.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-logo {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
}

.auth-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
}

.form-group input {
  width: 100%;
  padding: 0.8rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  color: var(--text-main);
  font-size: 1rem;
  outline: none;
  transition: all 0.25s ease;
}

.form-group input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
}

.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  text-align: center;
  padding: 0.6rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 0.5rem;
}

.submit-btn {
  width: 100%;
  padding: 0.85rem;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.toggle-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 1.5rem;
}

.toggle-link {
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.toggle-link:hover {
  color: var(--secondary-color);
}

/* Success State */
.success-state {
  text-align: center;
}

.success-icon-container {
  width: 64px;
  height: 64px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: #10b981;
}

.success-icon {
  width: 32px;
  height: 32px;
}

.success-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-main);
}

.success-text {
  color: var(--text-main);
  font-size: 1rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.success-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 2rem;
}

.resend-btn {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-main);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--primary-color);
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
