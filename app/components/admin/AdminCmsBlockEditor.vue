<script setup lang="ts">
import { getCmsBlockDefinition } from '#shared/cms/registry'
import type { CmsBlock, CmsBlockTheme } from '#shared/cms/types'

const props = defineProps<{
  modelValue: CmsBlock
  index: number
  count: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CmsBlock]
  move: [direction: -1 | 1]
  remove: []
}>()

const definition = computed(() => getCmsBlockDefinition(props.modelValue.type))

function updateBlock(patch: Record<string, unknown>) {
  emit('update:modelValue', { ...props.modelValue, ...patch } as unknown as CmsBlock)
}

function updateData(key: string, value: unknown) {
  const data = props.modelValue.data as unknown as Record<string, unknown>
  updateBlock({ data: { ...data, [key]: value } })
}

function onAnchorInput(event: Event) {
  updateBlock({ anchor: (event.target as HTMLInputElement).value || undefined })
}

function onThemeChange(event: Event) {
  updateBlock({ theme: (event.target as HTMLSelectElement).value as CmsBlockTheme })
}

function onVariantChange(event: Event) {
  updateBlock({ variant: (event.target as HTMLSelectElement).value || undefined })
}
</script>

<template>
  <details class="cms-block-editor" :open="index === 0">
    <summary>
      <span class="cms-block-editor__order">{{ String(index + 1).padStart(2, '0') }}</span>
      <span>
        <strong>{{ definition.label }}</strong>
        <small>{{ definition.description }}</small>
      </span>
      <span v-if="!modelValue.enabled" class="cms-block-editor__disabled">Masqué</span>
    </summary>

    <div class="cms-block-editor__body">
      <div class="cms-block-editor__toolbar">
        <button type="button" :disabled="index === 0" @click="emit('move', -1)">↑ Monter</button>
        <button type="button" :disabled="index === count - 1" @click="emit('move', 1)">
          ↓ Descendre
        </button>
        <label>
          <input
            type="checkbox"
            :checked="modelValue.enabled"
            @change="updateBlock({ enabled: ($event.target as HTMLInputElement).checked })"
          />
          Visible
        </label>
        <button type="button" class="cms-block-editor__danger" @click="emit('remove')">
          Supprimer
        </button>
      </div>

      <div class="cms-block-editor__meta">
        <label>
          <span>Ancre</span>
          <input :value="modelValue.anchor" placeholder="ex. palmares" @input="onAnchorInput" />
        </label>
        <label>
          <span>Thème</span>
          <select :value="modelValue.theme || 'default'" @change="onThemeChange">
            <option value="default">Défaut</option>
            <option value="light">Clair</option>
            <option value="raised">Surélevé</option>
          </select>
        </label>
        <label v-if="definition.variants.length">
          <span>Variante</span>
          <select :value="modelValue.variant" @change="onVariantChange">
            <option v-for="variant in definition.variants" :key="variant" :value="variant">
              {{ variant }}
            </option>
          </select>
        </label>
      </div>

      <div class="cms-block-editor__fields">
        <AdminCmsField
          v-for="(field, key) in definition.fields"
          :key="key"
          :model-value="(modelValue.data as unknown as Record<string, unknown>)[key]"
          :schema="field"
          :name="`${modelValue.id}.${String(key)}`"
          @update:model-value="updateData(String(key), $event)"
        />
      </div>
    </div>
  </details>
</template>

<style scoped>
.cms-block-editor {
  overflow: clip;
  border: 1px solid #d8ddec;
  border-radius: 0.8rem;
  background: white;
}

.cms-block-editor > summary {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem;
  cursor: pointer;
  list-style: none;
}

.cms-block-editor > summary::-webkit-details-marker {
  display: none;
}

.cms-block-editor > summary strong,
.cms-block-editor > summary small {
  display: block;
}

.cms-block-editor > summary small {
  margin-top: 0.2rem;
  color: #747c98;
  font-size: 0.75rem;
}

.cms-block-editor__order {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 50%;
  color: white;
  background: #26378f;
  font-size: 0.72rem;
  font-weight: 800;
}

.cms-block-editor__disabled {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  color: #7b3d00;
  background: #fff0d8;
  font-size: 0.7rem;
  font-weight: 800;
}

.cms-block-editor__body {
  padding: 1rem;
  border-top: 1px solid #e5e8f1;
}

.cms-block-editor__toolbar,
.cms-block-editor__meta {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.cms-block-editor__toolbar {
  margin-bottom: 1rem;
}

.cms-block-editor__toolbar button {
  padding: 0.45rem 0.65rem;
  border: 1px solid #ccd2e3;
  border-radius: 0.45rem;
  color: #35416f;
  background: white;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.cms-block-editor__toolbar label {
  display: flex;
  gap: 0.35rem;
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 700;
}

.cms-block-editor__toolbar .cms-block-editor__danger {
  color: #a51d3b;
  border-color: #ecc7cf;
}

.cms-block-editor__meta {
  padding: 0.8rem;
  border-radius: 0.65rem;
  background: #f5f7fc;
}

.cms-block-editor__meta label {
  display: grid;
  gap: 0.3rem;
  min-width: 11rem;
  color: #5c6688;
  font-size: 0.72rem;
  font-weight: 800;
}

.cms-block-editor__meta input,
.cms-block-editor__meta select {
  padding: 0.55rem 0.65rem;
  border: 1px solid #ccd2e3;
  border-radius: 0.4rem;
  background: white;
  font: inherit;
}

.cms-block-editor__fields {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
