<script setup lang="ts">
import type { CmsFieldSchema, CmsImage, CmsImagePreset } from '#shared/cms/types'

defineOptions({ name: 'AdminCmsField' })

const props = defineProps<{
  modelValue: unknown
  schema: CmsFieldSchema
  name?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const uploadState = reactive({ pending: false, error: '' })

const optionalComplex = computed(
  () => !props.schema.required && ['image', 'object'].includes(props.schema.kind),
)
const optionalComplexPresent = computed(
  () => props.modelValue !== undefined && props.modelValue !== null,
)

const scalarValue = computed({
  get: () => props.modelValue as string | number | boolean | undefined,
  set: (value) => emit('update:modelValue', value),
})

const inputValue = computed(() => (typeof scalarValue.value === 'boolean' ? '' : scalarValue.value))

const objectValue = computed<Record<string, unknown>>(() =>
  props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)
    ? (props.modelValue as Record<string, unknown>)
    : {},
)

const listValue = computed<unknown[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
)

const imageValue = computed<CmsImage>(() => {
  const value = objectValue.value
  return {
    mediaId: typeof value.mediaId === 'string' ? value.mediaId : undefined,
    src: typeof value.src === 'string' ? value.src : '',
    alt: typeof value.alt === 'string' ? value.alt : '',
    width: typeof value.width === 'number' ? value.width : undefined,
    height: typeof value.height === 'number' ? value.height : undefined,
    focalX: typeof value.focalX === 'number' ? value.focalX : undefined,
    focalY: typeof value.focalY === 'number' ? value.focalY : undefined,
    decorative: value.decorative === true,
  }
})

function defaultValue(schema: CmsFieldSchema): unknown {
  if (schema.kind === 'list') return []
  if (schema.kind === 'object') {
    return Object.fromEntries(
      Object.entries(schema.fields).map(([key, field]) => [key, defaultValue(field)]),
    )
  }
  if (schema.kind === 'boolean') return false
  if (schema.kind === 'number') return schema.min ?? 0
  if (schema.kind === 'image') return { src: '', alt: '' }
  if (schema.kind === 'select') return schema.options?.[0]?.value ?? ''
  return ''
}

function updateObjectField(key: string, value: unknown) {
  emit('update:modelValue', { ...objectValue.value, [key]: value })
}

function updateImageField(key: keyof CmsImage, value: unknown) {
  emit('update:modelValue', { ...imageValue.value, [key]: value })
}

function enableOptionalComplex() {
  emit('update:modelValue', defaultValue(props.schema))
}

function removeOptionalComplex() {
  emit('update:modelValue', undefined)
}

function updateListItem(index: number, value: unknown) {
  const next = [...listValue.value]
  next[index] = value
  emit('update:modelValue', next)
}

function addListItem() {
  if (props.schema.kind !== 'list') return
  emit('update:modelValue', [...listValue.value, defaultValue(props.schema.item)])
}

function removeListItem(index: number) {
  emit(
    'update:modelValue',
    listValue.value.filter((_, itemIndex) => itemIndex !== index),
  )
}

function moveListItem(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= listValue.value.length) return
  const next = [...listValue.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  emit('update:modelValue', next)
}

function onTextInput(event: Event) {
  scalarValue.value = (event.target as HTMLInputElement).value
}

function onNumberInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  scalarValue.value = raw === '' ? 0 : Number(raw)
}

function onBooleanInput(event: Event) {
  scalarValue.value = (event.target as HTMLInputElement).checked
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadState.pending = true
  uploadState.error = ''
  try {
    const body = new FormData()
    body.append('image', file)
    const response = await $fetch<{
      image: CmsImage
      variants: Record<CmsImagePreset, CmsImage>
    }>('/api/admin/media', {
      method: 'POST',
      body,
    })
    const preset = props.schema.kind === 'image' ? props.schema.imagePreset || 'card' : 'card'
    const selectedImage = response.variants[preset] || response.image
    emit('update:modelValue', {
      ...selectedImage,
      alt: imageValue.value.alt,
      decorative: imageValue.value.decorative,
      focalX: imageValue.value.focalX,
      focalY: imageValue.value.focalY,
    })
  } catch (error) {
    uploadState.error =
      error instanceof Error ? error.message : 'Le téléversement de l’image a échoué.'
  } finally {
    uploadState.pending = false
    input.value = ''
  }
}
</script>

<template>
  <div v-if="optionalComplex && !optionalComplexPresent" class="cms-field cms-field--optional">
    <span class="cms-field__label">{{ schema.label }}</span>
    <button type="button" class="cms-field__add" @click="enableOptionalComplex">+ Ajouter</button>
  </div>

  <fieldset v-else-if="schema.kind === 'object'" class="cms-field cms-field--group">
    <legend>{{ schema.label }}</legend>
    <button
      v-if="optionalComplex"
      type="button"
      class="cms-field__remove-optional"
      @click="removeOptionalComplex"
    >
      Retirer {{ schema.label.toLowerCase() }}
    </button>
    <p v-if="schema.description" class="cms-field__help">{{ schema.description }}</p>
    <AdminCmsField
      v-for="(field, key) in schema.fields"
      :key="key"
      :model-value="objectValue[key]"
      :schema="field"
      :name="`${name || 'field'}.${key}`"
      @update:model-value="updateObjectField(String(key), $event)"
    />
  </fieldset>

  <fieldset v-else-if="schema.kind === 'list'" class="cms-field cms-field--group">
    <legend>{{ schema.label }}</legend>
    <p v-if="schema.description" class="cms-field__help">{{ schema.description }}</p>
    <div v-if="listValue.length" class="cms-field__list">
      <div v-for="(item, index) in listValue" :key="index" class="cms-field__list-item">
        <div class="cms-field__list-toolbar">
          <span>Élément {{ index + 1 }}</span>
          <div>
            <button
              type="button"
              :disabled="index === 0"
              aria-label="Monter l’élément"
              @click="moveListItem(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="index === listValue.length - 1"
              aria-label="Descendre l’élément"
              @click="moveListItem(index, 1)"
            >
              ↓
            </button>
            <button type="button" @click="removeListItem(index)">Supprimer</button>
          </div>
        </div>
        <AdminCmsField
          :model-value="item"
          :schema="schema.item"
          :name="`${name || 'field'}.${index}`"
          @update:model-value="updateListItem(index, $event)"
        />
      </div>
    </div>
    <button
      type="button"
      class="cms-field__add"
      :disabled="listValue.length >= (schema.maxItems ?? 100)"
      @click="addListItem"
    >
      + Ajouter un élément
    </button>
  </fieldset>

  <div v-else-if="schema.kind === 'image'" class="cms-field cms-field--image">
    <span class="cms-field__label">{{ schema.label }}</span>
    <button
      v-if="optionalComplex"
      type="button"
      class="cms-field__remove-optional"
      @click="removeOptionalComplex"
    >
      Retirer l’image
    </button>
    <img v-if="imageValue.src" :src="imageValue.src" :alt="imageValue.alt" />
    <label>
      <span>Fichier JPEG, PNG ou WebP (10 Mio max.)</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="uploadState.pending"
        @change="uploadImage"
      />
    </label>
    <label>
      <span>Adresse interne de l’image</span>
      <input type="text" :value="imageValue.src" placeholder="/images/exemple.webp" readonly />
    </label>
    <label>
      <span>Texte alternatif</span>
      <input
        type="text"
        :value="imageValue.alt"
        :required="schema.imageAltRequired !== false && !imageValue.decorative"
        @input="updateImageField('alt', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="cms-field--check">
      <input
        type="checkbox"
        :checked="Boolean(imageValue.decorative)"
        @change="updateImageField('decorative', ($event.target as HTMLInputElement).checked)"
      />
      <span>Image décorative (texte alternatif non requis)</span>
    </label>
    <div class="cms-field__focal-grid">
      <label>
        <span>Point focal horizontal (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          :value="imageValue.focalX ?? 50"
          @input="updateImageField('focalX', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        <span>Point focal vertical (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          :value="imageValue.focalY ?? 50"
          @input="updateImageField('focalY', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>
    <p v-if="uploadState.pending" class="cms-field__help">Optimisation WebP en cours…</p>
    <p v-if="uploadState.error" class="cms-field__error">{{ uploadState.error }}</p>
  </div>

  <label v-else-if="schema.kind === 'textarea'" class="cms-field">
    <span class="cms-field__label">{{ schema.label }}</span>
    <textarea
      :value="inputValue"
      :required="schema.required"
      :maxlength="schema.maxLength"
      rows="4"
      @input="onTextInput"
    />
    <span v-if="schema.description" class="cms-field__help">{{ schema.description }}</span>
  </label>

  <label v-else-if="schema.kind === 'boolean'" class="cms-field cms-field--check">
    <input type="checkbox" :checked="Boolean(scalarValue)" @change="onBooleanInput" />
    <span class="cms-field__label">{{ schema.label }}</span>
  </label>

  <label v-else-if="schema.kind === 'select'" class="cms-field">
    <span class="cms-field__label">{{ schema.label }}</span>
    <select :value="inputValue" :required="schema.required" @change="onTextInput">
      <option v-if="!schema.required" value="">—</option>
      <option v-for="option in schema.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>

  <label v-else-if="schema.kind === 'number'" class="cms-field">
    <span class="cms-field__label">{{ schema.label }}</span>
    <input
      type="number"
      :value="inputValue"
      :required="schema.required"
      :min="schema.min"
      :max="schema.max"
      @input="onNumberInput"
    />
  </label>

  <label v-else class="cms-field">
    <span class="cms-field__label">{{ schema.label }}</span>
    <input
      :type="schema.kind === 'url' ? 'url' : 'text'"
      :value="inputValue"
      :required="schema.required"
      :maxlength="schema.maxLength"
      @input="onTextInput"
    />
    <span v-if="schema.description" class="cms-field__help">{{ schema.description }}</span>
  </label>
</template>

<style scoped>
.cms-field {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.cms-field + .cms-field {
  margin-top: 1rem;
}

.cms-field__label,
.cms-field legend {
  color: #2b355f;
  font-size: 0.82rem;
  font-weight: 800;
}

.cms-field input:not([type='checkbox'], [type='file']),
.cms-field textarea,
.cms-field select {
  width: 100%;
  padding: 0.72rem 0.8rem;
  border: 1px solid #cfd5e7;
  border-radius: 0.55rem;
  color: #17214f;
  background: white;
  font: inherit;
}

.cms-field textarea {
  resize: vertical;
}

.cms-field--group {
  padding: 1rem;
  border: 1px solid #dde1ee;
  border-radius: 0.75rem;
  background: #f9faff;
}

.cms-field--group > legend {
  padding: 0 0.4rem;
}

.cms-field--check {
  display: flex;
  align-items: center;
}

.cms-field__help {
  margin: 0;
  color: #6b7391;
  font-size: 0.78rem;
}

.cms-field__error {
  margin: 0;
  color: #a21f39;
  font-size: 0.82rem;
  font-weight: 700;
}

.cms-field__list {
  display: grid;
  gap: 0.8rem;
}

.cms-field__list-item {
  padding: 0.85rem;
  border: 1px solid #dfe3ef;
  border-radius: 0.6rem;
  background: white;
}

.cms-field__list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  color: #66708f;
  font-size: 0.75rem;
  font-weight: 800;
}

.cms-field__list-toolbar div {
  display: flex;
  gap: 0.3rem;
}

.cms-field__list-toolbar button,
.cms-field__add,
.cms-field__remove-optional {
  padding: 0.35rem 0.55rem;
  border: 1px solid #cfd5e7;
  border-radius: 0.4rem;
  color: #334071;
  background: white;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}

.cms-field__remove-optional {
  justify-self: start;
  color: #9a2840;
  border-color: #e8c3cc;
}

.cms-field--optional {
  padding: 0.85rem;
  border: 1px dashed #cfd5e7;
  border-radius: 0.65rem;
}

.cms-field__add {
  justify-self: start;
  margin-top: 0.75rem;
  padding: 0.55rem 0.8rem;
}

.cms-field--image img {
  width: min(260px, 100%);
  aspect-ratio: 16 / 10;
  border-radius: 0.55rem;
  object-fit: cover;
}

.cms-field--image label {
  display: grid;
  gap: 0.35rem;
  color: #5b6485;
  font-size: 0.78rem;
  font-weight: 700;
}

.cms-field--image label.cms-field--check {
  display: flex;
}

.cms-field__focal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
