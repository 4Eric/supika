<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  type: { type: String, default: 'card' }, // 'card', 'detail'
  count: { type: Number, default: 1 }
})
</script>

<template>
  <div v-if="type === 'card'" class="skeleton-grid">
    <div v-for="i in count" :key="i" class="skeleton-card shimmer">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    </div>
  </div>
  <div v-else-if="type === 'detail'" class="skeleton-detail shimmer">
    <div class="skeleton-hero"></div>
    <div class="skeleton-content">
      <div class="skeleton-title massive"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  width: 100%;
}

.skeleton-card {
  background: var(--card-bg);
  border-radius: 14px;
  overflow: hidden;
  height: 380px;
  border: 1px solid var(--border-light);
}

.skeleton-image {
  height: 200px;
  background: var(--border-light);
}

.skeleton-body {
  padding: 1.5rem;
}

.skeleton-title {
  height: 24px;
  background: var(--border-light);
  border-radius: 4px;
  margin-bottom: 12px;
  width: 80%;
}

.skeleton-text {
  height: 16px;
  background: var(--border-light);
  border-radius: 4px;
  margin-bottom: 8px;
  width: 100%;
}

.skeleton-text.short {
  width: 40%;
}

.skeleton-hero {
  height: 45vh;
  background: var(--border-light);
}

.skeleton-detail {
  width: 100%;
}

.skeleton-content {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.skeleton-title.massive {
  height: 48px;
  width: 60%;
  margin-bottom: 2rem;
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
