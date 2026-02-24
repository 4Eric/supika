<script setup>
import { API_URL } from '@/config/api'
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const users = ref([])
const loading = ref(true)
const searchQuery = ref('')
const error = ref('')
const success = ref('')

// Modal state
const showEditModal = ref(false)
const selectedUser = ref(null)
const editForm = ref({
    username: '',
    email: '',
    role: 'user',
    password: ''
})

const fetchUsers = async () => {
    loading.value = true
    error.value = ''
    try {
        const response = await axios.get(`${API_URL}/api/auth/admin/users?search=${searchQuery.value}`, {
            headers: { 'x-auth-token': authStore.token }
        })
        users.value = response.data
    } catch (err) {
        error.value = 'Failed to fetch users'
        console.error(err)
    } finally {
        loading.value = false
    }
}

const filteredUsers = computed(() => {
    return users.value // Backend already filters via search query, but we could add further frontend filtering here if needed
})

const openEditModal = (user) => {
    selectedUser.value = user
    editForm.value = {
        username: user.username,
        email: user.email,
        role: user.role,
        password: '' // Don't show existing hash
    }
    showEditModal.value = true
}

const closeEditModal = () => {
    showEditModal.value = false
    selectedUser.value = null
}

const handleUpdateUser = async () => {
    error.value = ''
    success.value = ''
    try {
        await axios.put(`${API_URL}/api/auth/admin/users/${selectedUser.value.id}`, editForm.value, {
            headers: { 'x-auth-token': authStore.token }
        })
        success.value = `User ${editForm.value.username} updated successfully!`
        closeEditModal()
        fetchUsers() // Refresh list
        setTimeout(() => success.value = '', 3000)
    } catch (err) {
        error.value = err.response?.data?.message || 'Failed to update user'
    }
}

const confirmDelete = async (user) => {
    if (confirm(`Are you sure you want to delete user "${user.username}"? All their events and data will be permanently removed.`)) {
        try {
            await axios.delete(`${API_URL}/api/auth/admin/users/${user.id}`, {
                headers: { 'x-auth-token': authStore.token }
            })
            success.value = 'User deleted successfully'
            fetchUsers()
            setTimeout(() => success.value = '', 3000)
        } catch (err) {
            error.value = 'Failed to delete user'
        }
    }
}

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

onMounted(fetchUsers)
</script>

<template>
    <div class="admin-container">
        <header class="admin-header">
            <div class="stats-cards">
                <div class="stat-card glass-card">
                    <span class="stat-icon">👥</span>
                    <div class="stat-info">
                        <p class="stat-label">Total Users</p>
                        <p class="stat-value">{{ users.length }}</p>
                    </div>
                </div>
                <div class="stat-card glass-card">
                    <span class="stat-icon">🛡️</span>
                    <div class="stat-info">
                        <p class="stat-label">Admins</p>
                        <p class="stat-value">{{ users.filter(u => u.role === 'admin').length }}</p>
                    </div>
                </div>
            </div>

            <div class="search-box glass-card">
                <span class="search-icon">🔍</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="Search by username or email..." 
                    @input="fetchUsers"
                    class="search-input"
                >
            </div>
        </header>

        <div v-if="success" class="alert success">{{ success }}</div>
        <div v-if="error" class="alert error">{{ error }}</div>

        <div class="users-table-container glass-card">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="6" class="text-center">Loading users...</td>
                    </tr>
                    <tr v-else-if="users.length === 0">
                        <td colspan="6" class="text-center">No users found.</td>
                    </tr>
                    <tr v-for="user in users" :key="user.id">
                        <td>#{{ user.id }}</td>
                        <td>
                            <div class="user-cell">
                                <div class="mini-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
                                <span>{{ user.username }}</span>
                            </div>
                        </td>
                        <td>{{ user.email }}</td>
                        <td>
                            <span :class="['role-badge', user.role]">
                                {{ user.role }}
                            </span>
                        </td>
                        <td>{{ formatDate(user.created_at) }}</td>
                        <td>
                            <div class="actions">
                                <button class="btn-icon" @click="openEditModal(user)" title="Edit User">✏️</button>
                                <button class="btn-icon delete" @click="confirmDelete(user)" title="Delete User">🗑️</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Edit Modal -->
        <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
            <div class="modal-content glass-card">
                <h3>Edit User: {{ selectedUser.username }}</h3>
                <form @submit.prevent="handleUpdateUser" class="edit-form">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" v-model="editForm.username" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" v-model="editForm.email" required>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select v-model="editForm.role">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Reset Password (leave blank to keep current)</label>
                        <input type="password" v-model="editForm.password" placeholder="New password...">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" @click="closeEditModal">Cancel</button>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style scoped>
.admin-container {
    max-width: 1200px;
    margin: 0 auto;
}

.admin-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    gap: 2rem;
}

.stats-cards {
    display: flex;
    gap: 1.5rem;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 2rem;
    min-width: 200px;
}

.stat-icon {
    font-size: 2rem;
}

.stat-label {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stat-value {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
}

.search-box {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    flex: 1;
}

.search-icon {
    margin-right: 1rem;
    opacity: 0.6;
}

.search-input {
    background: transparent;
    border: none;
    color: white;
    width: 100%;
    font-size: 1rem;
    outline: none;
}

.users-table-container {
    padding: 1.5rem;
    overflow-x: auto;
}

.users-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
}

.users-table th {
    padding: 1rem;
    font-size: 0.85rem;
    opacity: 0.6;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.users-table td {
    padding: 1.25rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.user-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.mini-avatar {
    width: 32px;
    height: 32px;
    background: var(--primary-color);
    color: black;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
}

.role-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.role-badge.admin {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.role-badge.user {
    background-color: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
}

.actions {
    display: flex;
    gap: 0.5rem;
}

.btn-icon {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-icon:hover {
    background: rgba(255, 255, 255, 0.15);
}

.btn-icon.delete:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
}

/* Modal Stylings */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    width: 100%;
    max-width: 500px;
    padding: 2.5rem;
}

.edit-form .form-group {
    margin-bottom: 1.5rem;
}

.edit-form label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    opacity: 0.8;
}

.edit-form input, .edit-form select {
    width: 100%;
    padding: 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    outline: none;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
}

.alert {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
}

.alert.success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.alert.error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

@media (max-width: 900px) {
    .admin-header {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>

