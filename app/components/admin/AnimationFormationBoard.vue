<script setup lang="ts">
import type {
  AnimationEventFormationAnnotation,
  AnimationEventFormationPoint,
  AnimationEventFormationSurface,
} from '#shared/types/animation-events'
import { ANIMATION_EVENT_FORMATION_COORDINATE_MAX as FORMATION_COORDINATE_MAX } from '#shared/animation-events/validation'

interface FormationBoardGroup {
  id: string
  label: string
  members: readonly string[]
  placement: AnimationEventFormationPoint
}

type AnnotationEndpoint = 'start' | 'end'

type DragTarget =
  { kind: 'group'; id: string } | { kind: 'annotation'; id: string; endpoint: AnnotationEndpoint }

interface PointerDragState {
  pointerId: number
  target: DragTarget
  origin: AnimationEventFormationPoint
  preview: AnimationEventFormationPoint
  offset: AnimationEventFormationPoint
  contextKey: string
  surface: AnimationEventFormationSurface
  source: HTMLElement
}

const KEYBOARD_STEP = 100
const KEYBOARD_LARGE_STEP = 500
const HORIZONTAL_EDGE_ZONE = 3000
const VERTICAL_EDGE_ZONE = 1500

const props = withDefaults(
  defineProps<{
    contextKey: string
    surface: AnimationEventFormationSurface
    groups: readonly FormationBoardGroup[]
    annotations: readonly AnimationEventFormationAnnotation[]
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'move-group': [groupId: string, placement: AnimationEventFormationPoint]
  'move-annotation': [
    annotationId: string,
    endpoint: AnnotationEndpoint,
    placement: AnimationEventFormationPoint,
  ]
}>()

const boardId = useId()
const titleId = `${boardId}-title`
const instructionsId = `${boardId}-instructions`
const surfaceElement = ref<HTMLElement | null>(null)
const pointerDrag = shallowRef<PointerDragState | null>(null)
const liveMessage = ref('')

const surfaceLabel = computed(() => {
  const labels: Record<AnimationEventFormationSurface, string> = {
    square: 'Surface carrée',
    landscape: 'Rectangle horizontal',
    portrait: 'Rectangle vertical',
  }

  return labels[props.surface]
})

watch(
  () => props.contextKey,
  (contextKey, previousContextKey) => {
    if (contextKey !== previousContextKey && pointerDrag.value) {
      cancelPointerDrag('Déplacement annulé après le changement d’étape ou de créneau.')
    }
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) cancelPointerDrag('Déplacement annulé : le plan est temporairement verrouillé.')
  },
)

watch(
  () => props.surface,
  (surface, previousSurface) => {
    if (surface !== previousSurface && pointerDrag.value) {
      cancelPointerDrag('Déplacement annulé après le changement de surface.')
    }
  },
)

onBeforeUnmount(() => {
  cancelPointerDrag()
})

function clampCoordinate(value: number) {
  return Math.min(FORMATION_COORDINATE_MAX, Math.max(0, Math.round(value)))
}

function normalizePoint(point: AnimationEventFormationPoint): AnimationEventFormationPoint {
  return {
    x: clampCoordinate(point.x),
    y: clampCoordinate(point.y),
  }
}

function pointsEqual(first: AnimationEventFormationPoint, second: AnimationEventFormationPoint) {
  return first.x === second.x && first.y === second.y
}

function coordinatePercent(value: number) {
  return `${(clampCoordinate(value) / FORMATION_COORDINATE_MAX) * 100}%`
}

function svgCoordinate(value: number) {
  return (clampCoordinate(value) / FORMATION_COORDINATE_MAX) * 100
}

function pointStyle(point: AnimationEventFormationPoint) {
  return {
    left: coordinatePercent(point.x),
    top: coordinatePercent(point.y),
  }
}

function edgeTranslation(value: number, edgeZone: number) {
  const coordinate = clampCoordinate(value)
  if (coordinate < edgeZone) return -50 * (coordinate / edgeZone)
  if (coordinate > FORMATION_COORDINATE_MAX - edgeZone) {
    const edgeProgress = (coordinate - (FORMATION_COORDINATE_MAX - edgeZone)) / edgeZone
    return -50 - 50 * edgeProgress
  }
  return -50
}

function controlPointStyle(point: AnimationEventFormationPoint) {
  const normalizedPoint = normalizePoint(point)
  return {
    ...pointStyle(normalizedPoint),
    transform: `translate(${edgeTranslation(normalizedPoint.x, HORIZONTAL_EDGE_ZONE)}%, ${edgeTranslation(normalizedPoint.y, VERTICAL_EDGE_ZONE)}%)`,
  }
}

function midpointStyle(annotation: AnimationEventFormationAnnotation) {
  const end = annotationEnd(annotation)

  return pointStyle({
    x: Math.round((annotationStart(annotation).x + end.x) / 2),
    y: Math.round((annotationStart(annotation).y + end.y) / 2),
  })
}

function groupPlacement(group: FormationBoardGroup) {
  const drag = pointerDrag.value
  return drag?.target.kind === 'group' && drag.target.id === group.id
    ? drag.preview
    : normalizePoint(group.placement)
}

function annotationStart(annotation: AnimationEventFormationAnnotation) {
  const drag = pointerDrag.value
  return drag?.target.kind === 'annotation' &&
    drag.target.id === annotation.id &&
    drag.target.endpoint === 'start'
    ? drag.preview
    : normalizePoint(annotation.start)
}

function annotationEnd(annotation: AnimationEventFormationAnnotation) {
  if (annotation.kind === 'point') return annotationStart(annotation)
  const drag = pointerDrag.value
  return drag?.target.kind === 'annotation' &&
    drag.target.id === annotation.id &&
    drag.target.endpoint === 'end'
    ? drag.preview
    : normalizePoint(annotation.end)
}

function annotationCaption(annotation: AnimationEventFormationAnnotation) {
  const details = [
    annotation.count.trim() ? `Compte ${annotation.count.trim()}` : '',
    annotation.figure.trim(),
  ].filter(Boolean)

  return details.join(' · ') || `Repère ${annotation.position + 1}`
}

function memberSummary(group: FormationBoardGroup) {
  const count = group.members.length
  if (count === 0) return 'Aucun membre'
  const people = group.members.filter(Boolean).join(', ')
  return `${count} membre${count > 1 ? 's' : ''}${people ? ` : ${people}` : ''}`
}

function groupLabel(group: FormationBoardGroup) {
  return group.label.trim() || 'Groupe sans nom'
}

function horizontalPosition(value: number) {
  if (value < FORMATION_COORDINATE_MAX / 3) return 'gauche'
  if (value > (FORMATION_COORDINATE_MAX * 2) / 3) return 'droite'
  return 'centre'
}

function verticalPosition(value: number) {
  if (value < FORMATION_COORDINATE_MAX / 3) return 'fond'
  if (value > (FORMATION_COORDINATE_MAX * 2) / 3) return 'avant'
  return 'centre'
}

function positionDescription(point: AnimationEventFormationPoint) {
  const vertical = verticalPosition(point.y)
  const horizontal = horizontalPosition(point.x)
  if (vertical === 'centre' && horizontal === 'centre') return 'au centre'
  if (vertical === 'centre') return `au centre ${horizontal}`
  if (horizontal === 'centre') return `${vertical} centre`
  return `${vertical} ${horizontal}`
}

function positionPercentage(value: number) {
  const basisPoints = clampCoordinate(value)
  const whole = Math.trunc(basisPoints / 100)
  const fraction = basisPoints % 100
  if (fraction === 0) return `${whole}`
  return `${whole},${String(fraction).padStart(2, '0').replace(/0$/u, '')}`
}

function precisePositionDescription(point: AnimationEventFormationPoint) {
  const normalizedPoint = normalizePoint(point)
  return `${positionDescription(normalizedPoint)} (x ${positionPercentage(normalizedPoint.x)} %, y ${positionPercentage(normalizedPoint.y)} %)`
}

function groupAccessibleLabel(group: FormationBoardGroup) {
  return `${groupLabel(group)}. ${memberSummary(group)}. Position ${precisePositionDescription(groupPlacement(group))}.`
}

function endpointAccessibleLabel(
  annotation: AnimationEventFormationAnnotation,
  endpoint: AnnotationEndpoint,
) {
  const endpointLabel =
    annotation.kind === 'line' ? (endpoint === 'start' ? 'début' : 'fin') : 'point'
  const point = endpoint === 'start' ? annotationStart(annotation) : annotationEnd(annotation)
  return `${annotationCaption(annotation)}, ${endpointLabel}, position ${precisePositionDescription(point)}.`
}

function pointFromClient(clientX: number, clientY: number) {
  const bounds = surfaceElement.value?.getBoundingClientRect()
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null

  return {
    x: ((clientX - bounds.left) / bounds.width) * FORMATION_COORDINATE_MAX,
    y: ((clientY - bounds.top) / bounds.height) * FORMATION_COORDINATE_MAX,
  }
}

function startPointerDrag(
  target: DragTarget,
  origin: AnimationEventFormationPoint,
  event: PointerEvent,
) {
  if (props.disabled || pointerDrag.value || event.button !== 0 || !event.isPrimary) return
  const pointer = pointFromClient(event.clientX, event.clientY)
  const source = event.currentTarget as HTMLElement | null
  if (!pointer || !source) return

  source.focus({ preventScroll: true })
  source.setPointerCapture(event.pointerId)
  event.preventDefault()
  const normalizedOrigin = normalizePoint(origin)
  pointerDrag.value = {
    pointerId: event.pointerId,
    target,
    origin: normalizedOrigin,
    preview: normalizedOrigin,
    offset: {
      x: normalizedOrigin.x - pointer.x,
      y: normalizedOrigin.y - pointer.y,
    },
    contextKey: props.contextKey,
    surface: props.surface,
    source,
  }
  liveMessage.value = 'Déplacement commencé. Relâche pour valider ou appuie sur Échap pour annuler.'
}

function startGroupPointerDrag(group: FormationBoardGroup, event: PointerEvent) {
  startPointerDrag({ kind: 'group', id: group.id }, groupPlacement(group), event)
}

function startAnnotationPointerDrag(
  annotation: AnimationEventFormationAnnotation,
  endpoint: AnnotationEndpoint,
  event: PointerEvent,
) {
  if (annotation.kind === 'point' && endpoint === 'end') return
  const origin = endpoint === 'start' ? annotationStart(annotation) : annotationEnd(annotation)
  startPointerDrag({ kind: 'annotation', id: annotation.id, endpoint }, origin, event)
}

function updatePointerDrag(event: PointerEvent) {
  const drag = pointerDrag.value
  if (
    !drag ||
    drag.pointerId !== event.pointerId ||
    drag.contextKey !== props.contextKey ||
    drag.surface !== props.surface
  ) {
    return
  }
  const pointer = pointFromClient(event.clientX, event.clientY)
  if (!pointer) return

  pointerDrag.value = {
    ...drag,
    preview: normalizePoint({
      x: pointer.x + drag.offset.x,
      y: pointer.y + drag.offset.y,
    }),
  }
  event.preventDefault()
}

function draggedTargetStillExists(target: DragTarget) {
  return target.kind === 'group'
    ? props.groups.some((group) => group.id === target.id)
    : props.annotations.some((annotation) => annotation.id === target.id)
}

function finishPointerDrag(event: PointerEvent) {
  const currentDrag = pointerDrag.value
  if (!currentDrag || currentDrag.pointerId !== event.pointerId) return
  if (currentDrag.contextKey !== props.contextKey) {
    event.preventDefault()
    cancelPointerDrag('Déplacement annulé après le changement d’étape ou de créneau.')
    return
  }
  updatePointerDrag(event)
  const drag = pointerDrag.value || currentDrag
  if (drag.source.hasPointerCapture(event.pointerId))
    drag.source.releasePointerCapture(event.pointerId)
  pointerDrag.value = null
  event.preventDefault()

  if (!draggedTargetStillExists(drag.target) || pointsEqual(drag.origin, drag.preview)) {
    liveMessage.value = 'Position inchangée.'
    return
  }

  commitMove(drag.target, drag.preview)
}

function cancelPointerDrag(message = 'Déplacement annulé.') {
  const drag = pointerDrag.value
  if (!drag) return
  if (drag.source.hasPointerCapture(drag.pointerId))
    drag.source.releasePointerCapture(drag.pointerId)
  pointerDrag.value = null
  liveMessage.value = message
}

function onPointerCancel(event: PointerEvent) {
  const drag = pointerDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  cancelPointerDrag()
}

function onDragKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !pointerDrag.value) return
  event.preventDefault()
  cancelPointerDrag()
}

function keyboardDestination(point: AnimationEventFormationPoint, event: KeyboardEvent) {
  const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP
  const deltas: Partial<Record<string, AnimationEventFormationPoint>> = {
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
  }
  const delta = deltas[event.key]
  if (!delta) return null

  event.preventDefault()
  return normalizePoint({ x: point.x + delta.x, y: point.y + delta.y })
}

function moveGroupWithKeyboard(group: FormationBoardGroup, event: KeyboardEvent) {
  if (props.disabled || pointerDrag.value) return
  const destination = keyboardDestination(groupPlacement(group), event)
  if (!destination || pointsEqual(destination, groupPlacement(group))) return
  commitMove({ kind: 'group', id: group.id }, destination)
}

function moveAnnotationWithKeyboard(
  annotation: AnimationEventFormationAnnotation,
  endpoint: AnnotationEndpoint,
  event: KeyboardEvent,
) {
  if (props.disabled || pointerDrag.value || (annotation.kind === 'point' && endpoint === 'end')) {
    return
  }
  const origin = endpoint === 'start' ? annotationStart(annotation) : annotationEnd(annotation)
  const destination = keyboardDestination(origin, event)
  if (!destination || pointsEqual(destination, origin)) return
  commitMove({ kind: 'annotation', id: annotation.id, endpoint }, destination)
}

function commitMove(target: DragTarget, placement: AnimationEventFormationPoint) {
  const normalizedPlacement = normalizePoint(placement)
  if (target.kind === 'group') {
    const group = props.groups.find((candidate) => candidate.id === target.id)
    if (!group) return
    emit('move-group', target.id, normalizedPlacement)
    liveMessage.value = `${groupLabel(group)} déplacé ${precisePositionDescription(normalizedPlacement)}.`
    return
  }

  const annotation = props.annotations.find((candidate) => candidate.id === target.id)
  if (!annotation) return
  emit('move-annotation', target.id, target.endpoint, normalizedPlacement)
  const endpoint =
    annotation.kind === 'line' ? (target.endpoint === 'start' ? 'Début' : 'Fin') : 'Point'
  liveMessage.value = `${endpoint} de « ${annotationCaption(annotation)} » déplacé ${precisePositionDescription(normalizedPlacement)}.`
}
</script>

<template>
  <section
    class="formation-board"
    :class="{ 'is-disabled': disabled, 'is-dragging': pointerDrag }"
    :aria-labelledby="titleId"
    @keydown="onDragKeydown"
  >
    <header class="formation-board__header">
      <div>
        <h5 :id="titleId">Plan de formation</h5>
        <p>
          {{ surfaceLabel }} · {{ groups.length }} groupe(s) · {{ annotations.length }} repère(s)
        </p>
      </div>
      <span class="formation-board__surface-label">{{ surfaceLabel }}</span>
    </header>

    <p :id="instructionsId" class="formation-board__instructions">
      Fais glisser un groupe, un point ou l’extrémité d’une ligne. Au clavier, utilise les flèches
      pour déplacer d’un pas, ou Maj + flèche pour un grand pas. L’origine x 0 %, y 0 % se trouve au
      fond à gauche.
    </p>

    <div
      ref="surfaceElement"
      :class="['formation-surface', `formation-surface--${surface}`]"
      role="group"
      :aria-label="`${surfaceLabel} du plan de formation`"
      :aria-describedby="instructionsId"
      :aria-disabled="disabled"
    >
      <span class="formation-surface__front" aria-hidden="true">Avant · public</span>
      <span class="formation-surface__back" aria-hidden="true">Fond</span>

      <svg
        class="formation-surface__lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <line
          v-for="annotation in annotations.filter((entry) => entry.kind === 'line')"
          :key="annotation.id"
          :x1="svgCoordinate(annotationStart(annotation).x)"
          :y1="svgCoordinate(annotationStart(annotation).y)"
          :x2="svgCoordinate(annotationEnd(annotation).x)"
          :y2="svgCoordinate(annotationEnd(annotation).y)"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <template v-for="annotation in annotations" :key="annotation.id">
        <button
          v-if="annotation.kind === 'point'"
          type="button"
          class="formation-marker formation-marker--point"
          :class="{
            'is-dragged':
              pointerDrag?.target.kind === 'annotation' && pointerDrag.target.id === annotation.id,
          }"
          :style="controlPointStyle(annotationStart(annotation))"
          :disabled="disabled"
          :aria-label="endpointAccessibleLabel(annotation, 'start')"
          :aria-describedby="instructionsId"
          @pointerdown="startAnnotationPointerDrag(annotation, 'start', $event)"
          @pointermove="updatePointerDrag"
          @pointerup="finishPointerDrag"
          @pointercancel="onPointerCancel"
          @keydown="moveAnnotationWithKeyboard(annotation, 'start', $event)"
        >
          <span class="formation-marker__dot" aria-hidden="true" />
          <span class="formation-marker__caption">{{ annotationCaption(annotation) }}</span>
        </button>

        <template v-else>
          <span
            class="formation-line__caption"
            :style="midpointStyle(annotation)"
            aria-hidden="true"
          >
            {{ annotationCaption(annotation) }}
          </span>
          <button
            v-for="endpoint in ['start', 'end'] as const"
            :key="`${annotation.id}-${endpoint}`"
            type="button"
            :class="[
              'formation-line__endpoint',
              `is-${endpoint}`,
              {
                'is-dragged':
                  pointerDrag?.target.kind === 'annotation' &&
                  pointerDrag.target.id === annotation.id &&
                  pointerDrag.target.endpoint === endpoint,
              },
            ]"
            :style="
              controlPointStyle(
                endpoint === 'start' ? annotationStart(annotation) : annotationEnd(annotation),
              )
            "
            :disabled="disabled"
            :aria-label="endpointAccessibleLabel(annotation, endpoint)"
            :aria-describedby="instructionsId"
            @pointerdown="startAnnotationPointerDrag(annotation, endpoint, $event)"
            @pointermove="updatePointerDrag"
            @pointerup="finishPointerDrag"
            @pointercancel="onPointerCancel"
            @keydown="moveAnnotationWithKeyboard(annotation, endpoint, $event)"
          >
            <span aria-hidden="true" />
          </button>
        </template>
      </template>

      <button
        v-for="group in groups"
        :key="group.id"
        type="button"
        class="formation-group"
        :class="{
          'is-dragged': pointerDrag?.target.kind === 'group' && pointerDrag.target.id === group.id,
        }"
        :style="controlPointStyle(groupPlacement(group))"
        :disabled="disabled"
        :aria-label="groupAccessibleLabel(group)"
        :aria-describedby="instructionsId"
        @pointerdown="startGroupPointerDrag(group, $event)"
        @pointermove="updatePointerDrag"
        @pointerup="finishPointerDrag"
        @pointercancel="onPointerCancel"
        @keydown="moveGroupWithKeyboard(group, $event)"
      >
        <strong>{{ groupLabel(group) }}</strong>
        <small>{{ group.members.length }}/3</small>
      </button>
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
  </section>
</template>

<style scoped>
.formation-board {
  container: formation-board / inline-size;
  display: grid;
  gap: 0.8rem;
  min-width: 0;
}

.formation-board__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.formation-board__header h5,
.formation-board__header p,
.formation-board__instructions {
  margin: 0;
}

.formation-board__header p,
.formation-board__instructions {
  color: #606b91;
}

.formation-board__header p {
  margin-top: 0.2rem;
  font-size: 0.86rem;
}

.formation-board__instructions {
  font-size: 0.82rem;
  line-height: 1.5;
}

.formation-board__surface-label {
  flex: none;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  color: var(--navy, #202b71);
  background: #eef0f8;
  font-size: 0.75rem;
  font-weight: 900;
}

.formation-surface {
  --formation-line: var(--orange, #ff8427);
  --formation-grid: rgb(42 56 144 / 9%);
  position: relative;
  isolation: isolate;
  inline-size: min(100%, var(--formation-max-inline-size));
  aspect-ratio: var(--formation-aspect-ratio);
  margin-inline: auto;
  overflow: visible;
  border: 2px solid #aeb7d4;
  border-radius: 0.9rem;
  background-color: #fbfcff;
  background-image:
    linear-gradient(to right, var(--formation-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--formation-grid) 1px, transparent 1px),
    linear-gradient(145deg, rgb(255 255 255 / 92%), rgb(237 240 250 / 86%));
  background-size:
    10% 100%,
    100% 10%,
    100% 100%;
  box-shadow: inset 0 0 0 0.35rem rgb(255 255 255 / 60%);
  touch-action: pan-y;
}

.formation-surface--square {
  --formation-aspect-ratio: 1;
  --formation-max-inline-size: 44rem;
}

.formation-surface--landscape {
  --formation-aspect-ratio: 16 / 10;
  --formation-max-inline-size: 64rem;
}

.formation-surface--portrait {
  --formation-aspect-ratio: 10 / 16;
  --formation-max-inline-size: 34rem;
}

.formation-surface__front,
.formation-surface__back {
  position: absolute;
  z-index: 1;
  left: 50%;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  color: #525e83;
  background: rgb(255 255 255 / 90%);
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  pointer-events: none;
  text-transform: uppercase;
  transform: translateX(-50%);
}

.formation-surface__front {
  bottom: 0.35rem;
  color: #7c4217;
  background: #fff1e4;
}

.formation-surface__back {
  top: 0.35rem;
}

.formation-surface__lines {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.formation-surface__lines line {
  stroke: var(--formation-line);
  stroke-linecap: round;
  stroke-width: 3;
}

.formation-group,
.formation-marker,
.formation-line__endpoint {
  position: absolute;
  touch-action: none;
  transform: translate(-50%, -50%);
}

.formation-group {
  z-index: 6;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.35rem;
  align-items: center;
  min-width: 4.5rem;
  min-height: 2.75rem;
  max-width: 8rem;
  padding: 0.45rem 0.6rem;
  border: 2px solid var(--indigo, #2a3890);
  border-radius: 0.8rem;
  color: #17214f;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 0.25rem 0.9rem rgb(31 43 85 / 18%);
  cursor: grab;
  font: inherit;
  text-align: left;
}

.formation-group strong {
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formation-group small {
  display: grid;
  min-width: 1.5rem;
  min-height: 1.5rem;
  place-items: center;
  border-radius: 999px;
  color: white;
  background: var(--indigo, #2a3890);
  font-size: 0.66rem;
  font-weight: 900;
}

.formation-marker {
  z-index: 5;
  display: grid;
  grid-template-columns: 1rem minmax(0, auto);
  gap: 0.35rem;
  align-items: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid #bdc5dc;
  border-radius: 999px;
  color: #17214f;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 0.2rem 0.65rem rgb(31 43 85 / 14%);
  cursor: grab;
  font: inherit;
}

.formation-marker__dot,
.formation-line__endpoint > span {
  display: block;
  width: 0.75rem;
  height: 0.75rem;
  border: 0.18rem solid white;
  border-radius: 50%;
  background: var(--orange, #ff8427);
  box-shadow: 0 0 0 2px var(--indigo, #2a3890);
}

.formation-marker__caption {
  overflow: hidden;
  max-width: 10rem;
  font-size: 0.7rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formation-line__endpoint {
  z-index: 5;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  place-items: center;
  background: transparent;
  cursor: grab;
}

.formation-line__endpoint.is-end > span {
  background: var(--indigo, #2a3890);
  box-shadow: 0 0 0 2px var(--orange, #ff8427);
}

.formation-line__caption {
  position: absolute;
  z-index: 4;
  overflow: hidden;
  max-width: 11rem;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  color: #563416;
  background: rgb(255 247 239 / 94%);
  font-size: 0.66rem;
  font-weight: 850;
  pointer-events: none;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

.formation-group.is-dragged,
.formation-marker.is-dragged,
.formation-line__endpoint.is-dragged {
  z-index: 10;
  cursor: grabbing;
  filter: drop-shadow(0 0.35rem 0.6rem rgb(31 43 85 / 28%));
}

.formation-group:focus-visible,
.formation-marker:focus-visible,
.formation-line__endpoint:focus-visible {
  outline: 0.2rem solid var(--orange, #ff8427);
  outline-offset: 0.2rem;
}

.formation-group:disabled,
.formation-marker:disabled,
.formation-line__endpoint:disabled {
  cursor: not-allowed;
}

.formation-board.is-disabled .formation-surface {
  background-color: #f4f5f9;
}

.formation-board.is-disabled .formation-group,
.formation-board.is-disabled .formation-marker,
.formation-board.is-disabled .formation-line__endpoint {
  opacity: 0.65;
}

@container formation-board (max-width: 34rem) {
  .formation-board__header {
    display: grid;
  }

  .formation-board__surface-label {
    justify-self: start;
  }

  .formation-group {
    min-width: 3.6rem;
    max-width: 5.4rem;
    min-height: 2.75rem;
    padding-inline: 0.4rem;
  }

  .formation-group strong,
  .formation-marker__caption,
  .formation-line__caption {
    font-size: 0.62rem;
  }

  .formation-marker__caption,
  .formation-line__caption {
    max-width: 6.5rem;
  }
}

@media (forced-colors: active) {
  .formation-surface,
  .formation-group,
  .formation-marker {
    border-color: CanvasText;
  }

  .formation-surface__lines line {
    stroke: CanvasText;
  }
}
</style>
