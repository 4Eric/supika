<script setup>
import { ref, defineProps } from 'vue'
import { useRouter } from 'vue-router'
import { getImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  event: { type: Object, required: true }
})

const router = useRouter()
const currentSlide = ref(0)

const nextSlide = () => {
  if (props.event?.media) {
    currentSlide.value = (currentSlide.value + 1) % props.event.media.length
  }
}

const prevSlide = () => {
  if (props.event?.media) {
    currentSlide.value = (currentSlide.value - 1 + props.event.media.length) % props.event.media.length
  }
}
</script>

<template>
  <div class="hero-section">
    <div v-if="event.media && event.media.length > 0" class="carousel-container">
      <div class="carousel-slide" v-for="(media, index) in event.media" :key="media.id" v-show="index === currentSlide">
        <img v-if="media.mediaType === 'image'" :src="getImageUrl(media.mediaUrl)" class="carousel-media" />
        <video v-else-if="media.mediaType === 'video'" :src="getImageUrl(media.mediaUrl)" controls class="carousel-media autoplay-video"></video>
      </div>
      <button v-if="event.media.length > 1" @click="prevSlide" class="carousel-btn prev-btn">❮</button>
      <button v-if="event.media.length > 1" @click="nextSlide" class="carousel-btn next-btn">❯</button>
      <div v-if="event.media.length > 1" class="carousel-indicators">
        <span v-for="(media, index) in event.media" :key="'ind-'+media.id" 
              :class="['indicator', { active: index === currentSlide }]" 
              @click="currentSlide = index">
        </span>
      </div>
    </div>
    <div v-else class="event-hero-banner" :style="{ backgroundImage: 'url(' + getImageUrl(event.imageUrl) + ')' }"></div>
    
    <!-- Back Button Overlay -->
    <button class="back-btn" @click="router.back()">
      ← Back
    </button>
  </div>

  <div class="body-header">
    <h1 class="event-title">{{ event.title }}</h1>
    <div class="meta-badges">
      <router-link :to="`/host/${event.createdBy}`" class="badge creator-badge clickable">
        <span class="badge-icon">👤</span> By {{ event.creatorName || 'unknown' }}
      </router-link>
      <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`" target="_blank" class="badge location-badge">
        <span class="badge-icon">📍</span> {{ event.locationName }}
      </a>
      <span v-if="event.creatorName === 'eFinder.ai'" class="badge ai-source-badge">🤖 AI Discovered</span>
      <a v-if="event.sourceUrl" :href="event.sourceUrl" target="_blank" class="badge source-badge">
        <span class="badge-icon">🔗</span> View Original Source
      </a>
    </div>
  </div>
</template>

<style scoped>
.hero-section {
  position: relative;
  width: 100%;
  height: 45vh;
  min-height: 300px;
  background-color: #000;
  overflow: hidden;
}
.hero-section::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 100px;
  background: linear-gradient(to top, var(--bg-color), transparent);
  pointer-events: none;
}

.carousel-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.carousel-slide { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
.carousel-media { width: 100%; height: 100%; object-fit: cover; }
.event-hero-banner { width: 100%; height: 100%; background-size: cover; background-position: center; }

.back-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  z-index: 10;
}
.back-btn:hover { background: rgba(0,0,0,0.8); }

.carousel-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: 0.2s; z-index: 10; }
.carousel-btn:hover { background: var(--primary-color); }
.prev-btn { left: 15px; }
.next-btn { right: 15px; }

.carousel-indicators {
  position: absolute;
  bottom: 20px;
  display: flex;
  gap: 8px;
  z-index: 10;
}
.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s;
}
.indicator.active {
  background: var(--primary-color);
  transform: scale(1.2);
}

.body-header { margin-bottom: 2rem; }
.event-title {
  font-family: 'Outfit', sans-serif;
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--text-main), var(--primary-color));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.meta-badges { display: flex; flex-wrap: wrap; gap: 0.8rem; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  font-size: 0.85rem;
  color: var(--text-muted);
  text-decoration: none;
}
.badge.clickable {
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-main);
}
.badge.clickable:hover {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--primary-color);
  transform: translateY(-1px);
}
.badge-icon { margin-right: 4px; }

.location-badge { color: var(--primary-color); transition: all 0.2s; }
.location-badge:hover { background: rgba(56, 189, 248, 0.1); border-color: var(--primary-color); transform: translateY(-1px); }

.ai-source-badge { background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2)); border-color: rgba(168, 85, 247, 0.4); color: #c4b5fd; }
.source-badge { color: #34d399; transition: all 0.2s; }
.source-badge:hover { background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.4); transform: translateY(-1px); }
</style>
