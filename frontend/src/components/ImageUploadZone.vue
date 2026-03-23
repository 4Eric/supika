<script setup>
import { ref, defineProps, defineEmits } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  previews: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'update:previews', 'error'])

const handleImageUpload = (event) => {
  const files = Array.from(event.target.files)
  if (files.length > 10) {
    emit('error', 'You can only upload a maximum of 10 files.')
    event.target.value = ''
    emit('update:modelValue', [])
    emit('update:previews', [])
    return
  }
  
  emit('update:modelValue', files)
  const newPreviews = []
  let processed = 0
  
  if (files.length === 0) {
    emit('update:previews', [])
    return
  }

  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      newPreviews.push(e.target.result)
      processed++
      if (processed === files.length) {
        emit('update:previews', newPreviews)
      }
    }
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <div class="upload-container">
    <div class="upload-zone" :class="{ 'has-files': modelValue.length > 0 }">
      <input type="file" id="media-upload" multiple @change="handleImageUpload" accept="image/*" />
      <label for="media-upload" class="upload-content">
        <span class="upload-icon">📤</span>
        <span class="upload-text">
          {{ modelValue.length > 0 ? `${modelValue.length} images selected` : 'Tap to upload images' }}
        </span>
      </label>
    </div>
    <div v-if="previews.length > 0" class="preview-grid">
      <div v-for="(src, i) in previews" :key="i" class="preview-item">
        <img :src="src" alt="Preview" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-zone {
  border: 2px dashed var(--border-light);
  border-radius: 1rem;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--input-bg);
}

.upload-zone:hover {
  border-color: var(--primary-color);
  background: var(--border-light);
}

.upload-zone.has-files {
  border-style: solid;
  border-color: var(--secondary-color);
}

.upload-zone input {
  display: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  width: 100%;
}

.upload-icon {
  font-size: 1.8rem;
}

.upload-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.preview-grid {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.preview-item {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
