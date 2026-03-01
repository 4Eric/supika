<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_URL } from '@/config/api'

const route = useRoute()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const message = ref('')
const errorMsg = ref('')
const loading = ref(false)
const token = ref('')

onMounted(() => {
  token.value = route.query.token
  if (!token.value) {
    errorMsg.value = 'Invalid or missing reset token.'
  }
})

const handleSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match.'
    return
  }

  errorMsg.value = ''
  loading.value = true

  try {
    const response = await axios.post(`${API_URL}/api/auth/reset-password`, {
      token: token.value,
      password: password.value
    })
    message.value = response.data.message
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to reset password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-logo">Supika</h1>
        <p class="auth-subtitle">Create a new, strong password.</p>
      </div>

      <form v-if="token && !message" @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label for="password">New Password</label>
          <input id="password" v-model="password" type="password" placeholder="••••••••" required />
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" placeholder="••••••••" required />
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Saving...' : 'Reset Password' }}
        </button>
      </form>

      <div v-if="message" class="success-state">
        <p class="success-msg">{{ message }}</p>
        <p class="redirect-text">Redirecting to login...</p>
      </div>

      <div v-if="!token" class="error-state">
        <p class="error-msg">{{ errorMsg }}</p>
        <router-link to="/login" class="toggle-link block-link">Back to Login</router-link>
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
}

.success-msg {
  color: #10b981;
  font-size: 0.85rem;
  text-align: center;
  padding: 0.6rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.redirect-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
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

.toggle-link {
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
}

.block-link {
  display: block;
  text-align: center;
  margin-top: 1.5rem;
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
