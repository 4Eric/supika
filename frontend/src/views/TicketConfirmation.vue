<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const transaction = ref(null)
const error = ref('')

onMounted(async () => {
    const sessionId = route.query.session_id
    if (!sessionId) {
        error.value = 'No session ID found'
        loading.value = false
        return
    }

    try {
        const res = await axios.get(`${API_URL}/api/payments/status/${sessionId}`, {
            headers: { 'x-auth-token': authStore.token }
        })
        transaction.value = res.data
    } catch (err) {
        console.error('Failed to fetch status', err)
        error.value = 'Failed to verify transaction. Please check your email or contact support.'
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div class="confirmation-page">
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Verifying your ticket...</p>
        </div>

        <div v-else-if="error" class="error-card">
            <div class="icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>{{ error }}</p>
            <button @click="router.push('/')" class="btn btn-primary">Go to Home</button>
        </div>

        <div v-else class="success-card">
            <div class="confetti">🎉</div>
            <h1 class="gradient-text">You're in!</h1>
            <p class="subtitle">Your ticket for <strong>{{ transaction.eventTitle || transaction.event_title }}</strong> is confirmed.</p>
            
            <div class="transaction-details">
                <div class="detail-row">
                    <span>Amount Paid:</span>
                    <strong>${{ ((transaction.amountTotal || transaction.amount_total) / 100).toFixed(2) }} {{ transaction.currency }}</strong>
                </div>
                <div class="detail-row">
                    <span>Status:</span>
                    <span class="status-badge" :class="transaction.status">{{ transaction.status?.toUpperCase() }}</span>
                </div>
                <div class="detail-row">
                    <span>Order ID:</span>
                    <code>{{ (transaction.stripeSessionId || transaction.stripe_session_id)?.substring(0, 15) }}...</code>
                </div>
            </div>

            <div class="actions">
                <button @click="router.push(`/event/${transaction.eventId || transaction.event_id}`)" class="btn btn-primary">View Event Details</button>
                <button @click="router.push('/my-events')" class="btn btn-secondary">My Calendar</button>
            </div>
            
            <p class="email-hint">A digital receipt has been sent to your email.</p>
        </div>
    </div>
</template>

<style scoped>
.confirmation-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: 2rem;
}

.loading-state {
    text-align: center;
}

.spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(56, 189, 248, 0.1);
    border-top-color: #38bdf8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

.success-card, .error-card {
    background: var(--card-bg);
    border: 1px solid var(--border-light);
    border-radius: 2rem;
    padding: 3rem;
    max-width: 500px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
}

.confetti {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.gradient-text {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(to right, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
}

.subtitle {
    font-size: 1.1rem;
    color: var(--text-muted);
    margin-bottom: 2rem;
}

.transaction-details {
    background: var(--input-bg);
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    text-align: left;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
}

.detail-row:last-child { margin-bottom: 0; }

.status-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
}

.status-badge.paid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-badge.pending { background: rgba(234, 179, 8, 0.1); color: #eab308; }

.actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.btn {
    padding: 1rem;
    border-radius: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.btn-primary { background: var(--primary-color); color: var(--btn-text-on-primary); }
.btn-primary:hover { background: #7dd3fc; transform: translateY(-2px); }

.btn-secondary { background: var(--input-bg); color: var(--text-main); border: 1px solid var(--border-light); }
.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

.email-hint {
    margin-top: 2rem;
    font-size: 0.85rem;
    color: var(--text-muted);
}
</style>
