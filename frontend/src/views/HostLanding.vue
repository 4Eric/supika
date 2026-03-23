<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const startHosting = () => {
  router.push('/create')
}

const features = [
  {
    title: '🎯 Targeted Discovery',
    description: 'Our AI "Vibe Match" puts your event in front of the people most likely to attend.',
    icon: '✨'
  },
  {
    title: '📸 Memory Boards',
    description: 'Attendees share their best shots directly on your event page after it ends.',
    icon: '🖼️'
  },
  {
    title: '💬 Automated Group Chats',
    description: 'Every event gets a private group chat for approved attendees to connect.',
    icon: '🗨️'
  },
  {
    title: '📊 Easy Management',
    description: 'Approve registrations, manage waitlists, and message attendees with one tap.',
    icon: '📱'
  }
]

const steps = [
  { title: 'Create', desc: 'Set your vibe, date, and location in minutes.' },
  { title: 'Share', desc: 'Spread the word with premium, mobile-optimized event cards.' },
  { title: 'Vibe', desc: 'Host your event and let the memories build themselves.' }
]
</script>

<template>
  <div class="landing-container">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <h1 class="gradient-text">The All-in-One Platform to Grow Your Tribe.</h1>
        <p class="hero-subtitle">
          Hosting shouldn't be a chore. Supika gives you the tools to create, manage, and scale your niche communities effortlessly.
        </p>
        <div class="hero-actions">
          <button @click="startHosting" class="btn btn-primary hero-btn">Start Hosting for Free</button>
          <button @click="router.push('/')" class="btn btn-secondary hero-btn">Explore Events</button>
        </div>
      </div>
      <div class="hero-visual">
          <!-- Glassmorphic Card Mockup -->
          <div class="mock-card">
              <div class="mock-header"></div>
              <div class="mock-body">
                  <div class="mock-line"></div>
                  <div class="mock-line short"></div>
                  <div class="mock-stats">
                      <div class="mock-dot"></div>
                      <div class="mock-dot"></div>
                      <div class="mock-dot"></div>
                  </div>
              </div>
          </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="stats-strip">
      <div class="stat-item">
        <span class="stat-value">Free</span>
        <span class="stat-label">Hosting Costs</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">AI-Driven</span>
        <span class="stat-label">Discovery Engine</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">Instant</span>
        <span class="stat-label">Group Chats</span>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features">
      <h2 class="section-title">Built for modern creators.</h2>
      <div class="features-grid">
        <div v-for="f in features" :key="f.title" class="feature-card">
          <div class="feature-icon">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.description }}</p>
        </div>
      </div>
    </section>

    <!-- How it Works -->
    <section class="how-it-works">
      <h2 class="section-title">Host your first event in 3 steps.</h2>
      <div class="steps-container">
          <div v-for="(s, idx) in steps" :key="s.title" class="step-card">
              <div class="step-num">{{ idx + 1 }}</div>
              <h3>{{ s.title }}</h3>
              <p>{{ s.desc }}</p>
          </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="final-cta">
      <div class="cta-card">
        <h2>Ready to vibe?</h2>
        <p>Join hundreds of hosts building vibrant communities on Supika.</p>
        <button @click="startHosting" class="btn btn-primary cta-btn">Create Your Event Now</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
  color: var(--text-main);
  overflow-x: hidden;
  max-width: 100%;
  box-sizing: border-box;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 3rem;
  letter-spacing: -1px;
}

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 4rem;
  align-items: center;
  margin-bottom: 8rem;
}

.gradient-text {
  font-size: 4rem;
  font-weight: 900;
  line-height: 1.1;
  background: linear-gradient(to right, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1.5rem;
  letter-spacing: -2px;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 2.5rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
}

.hero-btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 12px;
}

.hero-visual {
    position: relative;
    display: flex;
    justify-content: center;
}

.mock-card {
    width: 280px;
    height: 380px;
    background: var(--card-bg);
    border: 1px solid var(--border-light);
    border-radius: 24px;
    padding: 20px;
    backdrop-filter: blur(20px);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: float 6s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
}

.mock-header {
    height: 140px;
    background: linear-gradient(45deg, #1e293b, #334155);
    border-radius: 16px;
    margin-bottom: 20px;
}

.mock-line {
    height: 10px;
    background: var(--border-light);
    border-radius: 5px;
    margin-bottom: 12px;
}

.mock-line.short { width: 60%; }

.mock-stats {
    display: flex;
    gap: 8px;
    margin-top: 30px;
}

.mock-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.2);
    border: 1px solid rgba(56, 189, 248, 0.4);
}

/* Stats */
.stats-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  gap: 1.5rem;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  padding: 2rem 1.5rem;
  margin-bottom: 8rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2.5rem;
  font-weight: 800;
  color: #38bdf8;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 0.8rem;
}

/* Features */
.features {
  margin-bottom: 8rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: var(--input-bg);
  transform: translateY(-5px);
  border-color: var(--primary-color);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.feature-card h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.feature-card p {
  color: var(--text-muted);
  line-height: 1.6;
}

/* How it works */
.how-it-works {
    margin-bottom: 8rem;
}

.steps-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
}

.step-card {
    text-align: center;
    position: relative;
    padding: 2rem;
}

.step-num {
    width: 50px;
    height: 50px;
    background: var(--primary-color);
    color: var(--btn-text-on-primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 900;
    margin: 0 auto 1.5rem;
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
}

/* Final CTA */
.final-cta {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(129, 140, 248, 0.1));
  border-radius: 32px;
  padding: 5rem 2rem;
  text-align: center;
}

.cta-card h2 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.cta-card p {
  font-size: 1.25rem;
  color: var(--text-muted);
  margin-bottom: 3rem;
}

.cta-btn {
  padding: 1.2rem 3rem;
  font-size: 1.2rem;
  border-radius: 12px;
  background: var(--primary-color);
  color: var(--btn-text-on-primary);
  border: none;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.cta-btn:hover {
    transform: scale(1.05);
    background: #38bdf8;
}

/* Mobile */
@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 3rem;
  }
  .hero-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  .hero-btn {
    width: 100%;
  }
  .gradient-text {
    font-size: 2.2rem;
  }
  .steps-container {
    grid-template-columns: 1fr;
  }
  .landing-container {
    padding: 2rem 1rem;
  }
  .cta-card h2 {
    font-size: 2rem;
  }
  .hero-visual {
    display: none;
  }
}
</style>
