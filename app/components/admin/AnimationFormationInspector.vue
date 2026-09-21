<script setup lang="ts">
import type {
  AnimationEventFormationAnnotation,
  AnimationEventFormationPoint,
  AnimationEventFormationSurface,
} from '#shared/types/animation-events'
import {
  ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS,
  ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH,
  ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH,
} from '#shared/animation-events/validation'

interface AnnotationPatch {
  count?: string
  figure?: string
  start?: AnimationEventFormationPoint
  end?: AnimationEventFormationPoint | null
}

interface FormationZone extends AnimationEventFormationPoint {
  value: string
  label: string
}

defineProps<{
  surface: AnimationEventFormationSurface
  annotations: AnimationEventFormationAnnotation[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'surface-change': [surface: AnimationEventFormationSurface]
  'add-annotation': [kind: AnimationEventFormationAnnotation['kind']]
  'update-annotation': [id: string, patch: AnnotationPatch]
  'remove-annotation': [id: string]
}>()
const inspectorId = useId()
const inspectorTitleId = `${inspectorId}-title`
const markersTitleId = `${inspectorId}-markers-title`

const surfaceOptions: Array<{ value: AnimationEventFormationSurface; label: string }> = [
  { value: 'square', label: 'Carré' },
  { value: 'landscape', label: 'Rectangle horizontal' },
  { value: 'portrait', label: 'Rectangle vertical' },
]

const formationZones: FormationZone[] = [
  { value: 'back-left', label: 'Fond gauche', x: 2000, y: 2000 },
  { value: 'back-center', label: 'Fond centre', x: 5000, y: 2000 },
  { value: 'back-right', label: 'Fond droit', x: 8000, y: 2000 },
  { value: 'center-left', label: 'Centre gauche', x: 2000, y: 5000 },
  { value: 'center', label: 'Centre', x: 5000, y: 5000 },
  { value: 'center-right', label: 'Centre droit', x: 8000, y: 5000 },
  { value: 'front-left', label: 'Avant gauche', x: 2000, y: 8000 },
  { value: 'front-center', label: 'Avant centre', x: 5000, y: 8000 },
  { value: 'front-right', label: 'Avant droit', x: 8000, y: 8000 },
]

function surfaceFromEvent(event: Event) {
  emit('surface-change', (event.target as HTMLInputElement).value as AnimationEventFormationSurface)
}

function textFromEvent(event: Event) {
  return (event.target as HTMLInputElement).value
}

function selectedZone(point: AnimationEventFormationPoint) {
  return (
    formationZones.find((candidate) => candidate.x === point.x && candidate.y === point.y)?.value ||
    ''
  )
}

function annotationFieldErrorId(annotationId: string, field: 'count' | 'figure') {
  return `${inspectorId}-${annotationId}-${field}-error`
}

function annotationLineErrorId(annotationId: string) {
  return `${inspectorId}-${annotationId}-line-error`
}

function updateZone(
  annotation: AnimationEventFormationAnnotation,
  endpoint: 'start' | 'end',
  event: Event,
) {
  const zone = formationZones.find(
    (candidate) => candidate.value === (event.target as HTMLSelectElement).value,
  )
  if (!zone) return
  const point = { x: zone.x, y: zone.y }
  emit('update-annotation', annotation.id, endpoint === 'start' ? { start: point } : { end: point })
}

function lineHasLength(annotation: AnimationEventFormationAnnotation) {
  return (
    annotation.kind !== 'line' ||
    annotation.start.x !== annotation.end.x ||
    annotation.start.y !== annotation.end.y
  )
}
</script>

<template>
  <aside class="formation-inspector" :aria-labelledby="inspectorTitleId">
    <div>
      <p class="admin-eyebrow">Mise en place</p>
      <h5 :id="inspectorTitleId">Réglages de la formation</h5>
    </div>

    <fieldset class="formation-inspector__surface" :disabled="disabled">
      <legend>Format du terrain</legend>
      <label v-for="option in surfaceOptions" :key="option.value">
        <input
          type="radio"
          :name="`${inspectorId}-surface`"
          :value="option.value"
          :checked="surface === option.value"
          @change="surfaceFromEvent"
        />
        <span>{{ option.label }}</span>
      </label>
    </fieldset>

    <section class="formation-inspector__annotations" :aria-labelledby="markersTitleId">
      <header>
        <div>
          <h6 :id="markersTitleId">Comptes et figures</h6>
          <p>Ajoute un point ou une ligne, puis indique le compte et la figure.</p>
        </div>
        <div class="formation-inspector__actions">
          <button
            type="button"
            class="admin-button"
            :disabled="disabled || annotations.length >= ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS"
            @click="emit('add-annotation', 'point')"
          >
            + Point
          </button>
          <button
            type="button"
            class="admin-button"
            :disabled="disabled || annotations.length >= ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS"
            @click="emit('add-annotation', 'line')"
          >
            + Ligne
          </button>
        </div>
      </header>

      <p v-if="annotations.length === 0" class="formation-inspector__empty">
        Aucun repère pour cette étape.
      </p>

      <ol v-else class="formation-inspector__list">
        <li
          v-for="(annotation, annotationIndex) in annotations"
          :key="annotation.id"
          :data-formation-annotation-id="annotation.id"
        >
          <header>
            <strong>
              {{ annotation.kind === 'point' ? 'Point' : 'Ligne' }} {{ annotationIndex + 1 }}
            </strong>
            <button
              type="button"
              :disabled="disabled"
              :aria-label="`Supprimer le repère ${annotationIndex + 1}`"
              @click="emit('remove-annotation', annotation.id)"
            >
              Supprimer
            </button>
          </header>

          <div class="formation-inspector__fields">
            <label>
              <span>Compte</span>
              <input
                type="text"
                required
                :value="annotation.count"
                :maxlength="ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH"
                :disabled="disabled"
                :aria-invalid="!annotation.count.trim()"
                :aria-describedby="
                  !annotation.count.trim()
                    ? annotationFieldErrorId(annotation.id, 'count')
                    : undefined
                "
                placeholder="Ex. 5–6"
                @input="emit('update-annotation', annotation.id, { count: textFromEvent($event) })"
              />
              <small
                v-if="!annotation.count.trim()"
                :id="annotationFieldErrorId(annotation.id, 'count')"
                class="formation-inspector__field-error"
              >
                Le compte est obligatoire.
              </small>
            </label>
            <label>
              <span>Figure</span>
              <input
                type="text"
                required
                :value="annotation.figure"
                :maxlength="ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH"
                :disabled="disabled"
                :aria-invalid="!annotation.figure.trim()"
                :aria-describedby="
                  !annotation.figure.trim()
                    ? annotationFieldErrorId(annotation.id, 'figure')
                    : undefined
                "
                placeholder="Ex. Extension"
                @input="emit('update-annotation', annotation.id, { figure: textFromEvent($event) })"
              />
              <small
                v-if="!annotation.figure.trim()"
                :id="annotationFieldErrorId(annotation.id, 'figure')"
                class="formation-inspector__field-error"
              >
                La figure est obligatoire.
              </small>
            </label>
            <label>
              <span>{{ annotation.kind === 'line' ? 'Début de la ligne' : 'Position' }}</span>
              <select
                :value="selectedZone(annotation.start)"
                :disabled="disabled"
                @change="updateZone(annotation, 'start', $event)"
              >
                <option value="" disabled>Position libre sur le plan</option>
                <option v-for="zone in formationZones" :key="zone.value" :value="zone.value">
                  {{ zone.label }}
                </option>
              </select>
            </label>
            <label v-if="annotation.kind === 'line'">
              <span>Fin de la ligne</span>
              <select
                :value="selectedZone(annotation.end)"
                :disabled="disabled"
                :aria-invalid="!lineHasLength(annotation)"
                :aria-describedby="
                  !lineHasLength(annotation) ? annotationLineErrorId(annotation.id) : undefined
                "
                @change="updateZone(annotation, 'end', $event)"
              >
                <option value="" disabled>Position libre sur le plan</option>
                <option v-for="zone in formationZones" :key="zone.value" :value="zone.value">
                  {{ zone.label }}
                </option>
              </select>
            </label>
            <p
              v-if="!lineHasLength(annotation)"
              :id="annotationLineErrorId(annotation.id)"
              class="formation-inspector__error"
              role="alert"
            >
              Les deux extrémités de la ligne doivent être différentes.
            </p>
          </div>
        </li>
      </ol>
    </section>
  </aside>
</template>

<style scoped>
.formation-inspector {
  display: grid;
  align-content: start;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: #f8f9fd;
}

.formation-inspector h5,
.formation-inspector h6,
.formation-inspector p {
  margin: 0;
}

.formation-inspector h5 {
  margin-top: 0.2rem;
  font-size: 1rem;
}

.formation-inspector__surface {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.formation-inspector__surface legend {
  margin-bottom: 0.45rem;
  color: #505b80;
  font-size: 0.8rem;
  font-weight: 800;
}

.formation-inspector__surface label {
  position: relative;
  display: grid;
  min-width: 0;
}

.formation-inspector__surface input {
  position: absolute;
  opacity: 0;
}

.formation-inspector__surface span {
  display: grid;
  min-height: 3rem;
  padding: 0.6rem;
  place-items: center;
  border: 1px solid #cfd5e6;
  border-radius: 0.55rem;
  color: #505b80;
  background: white;
  font-size: 0.75rem;
  font-weight: 800;
  text-align: center;
  cursor: pointer;
}

.formation-inspector__surface input:focus-visible + span {
  outline: 0.2rem solid #f29a38;
  outline-offset: 0.15rem;
}

.formation-inspector__surface input:checked + span {
  border-color: #5967b3;
  color: #25368c;
  background: #eef0fb;
  box-shadow: 0 0 0 1px #5967b3;
}

.formation-inspector__surface:disabled span {
  cursor: not-allowed;
  opacity: 0.55;
}

.formation-inspector__annotations {
  display: grid;
  gap: 0.8rem;
}

.formation-inspector__annotations > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.formation-inspector__annotations > header p,
.formation-inspector__empty {
  margin-top: 0.25rem;
  color: #6c7597;
  font-size: 0.78rem;
}

.formation-inspector__actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.formation-inspector__list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.formation-inspector__list > li {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.7rem;
  background: white;
}

.formation-inspector__list > li > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.formation-inspector__list > li > header button {
  border: 0;
  color: #8f2535;
  background: transparent;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
}

.formation-inspector__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.formation-inspector__fields label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  color: #505b80;
  font-size: 0.75rem;
  font-weight: 800;
}

.formation-inspector__fields input,
.formation-inspector__fields select {
  width: 100%;
  min-height: 2.65rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid #cfd5e6;
  border-radius: 0.5rem;
  color: #17214f;
  background: white;
  font: inherit;
}

.formation-inspector__error,
.formation-inspector__field-error {
  color: #8f2535;
  font-size: 0.75rem;
  font-weight: 800;
}

.formation-inspector__error {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .formation-inspector__surface,
  .formation-inspector__fields {
    grid-template-columns: 1fr;
  }

  .formation-inspector__annotations > header {
    display: grid;
  }

  .formation-inspector__actions {
    justify-content: flex-start;
  }
}
</style>
