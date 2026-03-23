<script setup>
import { defineProps, defineEmits } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { useThemeStore } from '@/stores/themeStore'

const props = defineProps({
  modelValue: { type: Array, default: () => [{ startTime: null, maxAttendees: 5 }] }
})

const emit = defineEmits(['update:modelValue'])
const themeStore = useThemeStore()

const addTimeSlot = () => {
  const newValue = [...props.modelValue, { startTime: null, maxAttendees: 5 }]
  emit('update:modelValue', newValue)
}

const removeTimeSlot = (index) => {
  if (props.modelValue.length > 1) {
    const newValue = [...props.modelValue]
    newValue.splice(index, 1)
    emit('update:modelValue', newValue)
  }
}
</script>

<template>
  <div class="time-slots-container">
    <div class="section-header">
      <h3 class="section-title"><span class="icon">📅</span> Date & Time</h3>
      <button type="button" @click="addTimeSlot" class="btn btn-sm btn-secondary">Add Slot</button>
    </div>
    
    <div class="time-slots-list">
      <div v-for="(slot, index) in modelValue" :key="index" class="time-slot-item">
        <div class="slot-inputs">
          <div class="slot-field">
            <label>When</label>
            <VueDatePicker v-model="slot.startTime" placeholder="Select time" :dark="themeStore.activeTheme === 'dark'" teleport="body" />
          </div>
          <div class="slot-field small">
            <label>Capacity</label>
            <input type="number" v-model="slot.maxAttendees" class="form-control" min="1" required />
          </div>
          <button type="button" v-if="modelValue.length > 1" @click="removeTimeSlot(index)" class="btn-delete" title="Remove">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.25rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon {
  font-size: 1.4rem;
}

.time-slots-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-slot-item {
  background: var(--input-bg);
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-light);
}

.slot-inputs {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.slot-field {
  flex: 1;
}

.slot-field.small {
  width: 80px;
  flex: none;
}

.slot-field label {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
  display: block;
}

.btn-delete {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.2rem;
  cursor: pointer;
  padding-bottom: 0.5rem;
}

@media (max-width: 480px) {
  .slot-inputs {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  .slot-field.small {
    width: 100%;
  }
  .btn-delete {
    align-self: flex-end;
    padding: 0;
  }
}
</style>
