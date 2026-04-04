<script setup>
import { ref, onMounted, onUnmounted, defineProps } from 'vue'
import { useRouter } from 'vue-router'
import { getImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  event: { type: Object, required: true }
})

const router = useRouter()
const currentSlide = ref(0)
const heroRef = ref(null)
const glowX = ref(50)
const glowY = ref(50)
const tiltX = ref(0)
const tiltY = ref(0)
const scrollY = ref(0)
let rafId = null

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

const onMouseMove = (e) => {
  const rect = heroRef.value?.getBoundingClientRect()
  if (!rect) return
  
  // Handle both mouse and touch events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY

  const cx = (clientX - rect.left) / rect.width
  const cy = (clientY - rect.top) / rect.height
  glowX.value = cx * 100
  glowY.value = cy * 100
  
  // Intensified tilt: -10 to +10 degrees
  tiltX.value = (cy - 0.5) * -15
  tiltY.value = (cx - 0.5) * 20
}

const onMouseLeave = () => {
  tiltX.value = 0
  tiltY.value = 0
  glowX.value = 50
  glowY.value = 50
}

const onScroll = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    scrollY.value = window.scrollY
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    class="hero-section"
    ref="heroRef"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @touchmove="onMouseMove"
    @touchend="onMouseLeave"
    :style="{ transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }"
  >
    <!-- Ambient glow that tracks mouse -->
    <div
      class="hero-glow"
      :style="{ background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(56,189,248,0.25) 0%, transparent 65%)` }"
    ></div>

    <!-- Parallax image layer (scrolls at 0.35× speed) -->
    <div
      class="hero-parallax-layer"
      :style="{ transform: `translateY(${scrollY * 0.35}px)` }"
    >
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
    </div>

    <!-- Bottom gradient fade -->
    <div class="hero-fade-bottom"></div>

    <!-- Back Button -->
    <button class="back-btn" @click="router.back()">← Back</button>

    <!-- Floating title that pops out in 3D -->
    <div class="hero-title-float" :style="{ transform: `translateZ(40px) translateY(${-scrollY * 0.1}px)` }">
      <h1 class="hero-event-title">{{ event.title }}</h1>
      <div class="hero-meta-badges">
        <a :href="`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`"
           target="_blank" class="hero-badge location-badge">
          <span>📍</span> {{ event.locationName }}
        </a>
        <span v-if="event.creatorName === 'eFinder.ai'" class="hero-badge ai-badge">🤖 AI Discovered</span>
        <a v-if="event.sourceUrl" :href="event.sourceUrl" target="_blank" class="hero-badge source-badge">
          <span>🔗</span> Source
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-section {
  position: relative;
  width: 100%;
  height: 52vh;
  min-height: 340px;
  background-color: #000;
  overflow: hidden;
  transform-style: preserve-3d;
  transition: transform 0.12s ease-out;
  will-change: transform;
}

.hero-parallax-layer {
  position: absolute;
  inset: -10% 0 -10% 0;
  will-change: transform;
}

.hero-glow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  transition: background 0.15s ease;
}

.hero-fade-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 200px;
  background: linear-gradient(to top, var(--bg-color) 0%, transparent 100%);
  pointer-events: none;
  z-index: 3;
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

/* Floating 3D title overlay */
.hero-title-float {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  padding: 0 1.5rem;
  z-index: 10;
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out;
  will-change: transform;
}
.hero-event-title {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(1.5rem, 4vw, 2.8rem);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 4px 24px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6);
  margin-bottom: 0.5rem;
  line-height: 1.1;
}
.hero-meta-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.15);
  color: #e2e8f0;
  text-decoration: none;
  transition: all 0.2s;
}
.hero-badge:hover { background: rgba(0,0,0,0.75); border-color: rgba(255,255,255,0.35); }
.location-badge { color: #38bdf8; border-color: rgba(56,189,248,0.3); }
.ai-badge { background: linear-gradient(135deg, rgba(168,85,247,0.4), rgba(56,189,248,0.4)); color: #e9d5ff; }
.source-badge { color: #34d399; border-color: rgba(52,211,153,0.3); }

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

/* Reduce motion */
@media (prefers-reduced-motion: reduce) {
  .hero-section { transition: none; }
  .hero-parallax-layer { transform: none !important; }
  .hero-title-float { transform: none !important; }
}
</style>
