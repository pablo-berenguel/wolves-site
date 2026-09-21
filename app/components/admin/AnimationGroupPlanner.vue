<script setup lang="ts">
import type {
  AnimationEventFormationAnnotation,
  AnimationEventFormationPoint,
  AnimationEventFormationSurface,
  AnimationEventGroupConfigResponse,
  AnimationEventGroupRequest,
  AnimationEventGroupStageRequest,
  AnimationEventParticipant,
  AnimationEventSlot,
} from '#shared/types/animation-events'
import {
  ANIMATION_EVENT_FORMATION_COORDINATE_MAX,
  ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS,
  ANIMATION_EVENT_MAX_GROUP_LABEL_LENGTH,
  ANIMATION_EVENT_MAX_GROUPS,
  ANIMATION_EVENT_MAX_GROUP_STAGES,
  ANIMATION_EVENT_MAX_GROUP_STAGE_LABEL_LENGTH,
} from '#shared/animation-events/validation'
import {
  mutationErrorCode,
  mutationErrorStatus,
  mutationOutcomeIsUnknown,
  shouldReleaseMutationRequestId,
} from '~/utils/autosave-mutation'

interface EditableGroup {
  id: string
  members: string[]
  placement: AnimationEventFormationPoint
}

interface EditableStage {
  id: string
  label: string
  surface: AnimationEventFormationSurface
  annotations: AnimationEventFormationAnnotation[]
  groups: EditableGroup[]
}

interface FormationAnnotationPatch {
  count?: string
  figure?: string
  start?: AnimationEventFormationPoint
  end?: AnimationEventFormationPoint | null
}

interface GroupPlanSnapshot {
  label: string
  stages: AnimationEventGroupStageRequest[]
}

interface GroupPlanSaveJob extends GroupPlanSnapshot {
  eventId: string
  slotId: string
  generation: number
  requestId: string
  expectedVersion: number
  signature: string
  legacyProjectionSignature: string
  formationProjectionSignature: string
  manual: boolean
}

const STRUCTURAL_AUTOSAVE_DELAY_MS = 150
const TEXT_AUTOSAVE_DELAY_MS = 700

const props = defineProps<{
  eventId: string
  reactionSlot: AnimationEventSlot
}>()
const emit = defineEmits<{
  saved: [config: AnimationEventGroupConfigResponse['groupConfig']]
  'dirty-change': [dirty: boolean]
  'settling-change': [settling: boolean]
}>()
const plannerId = useId()
const plannerTitleId = `${plannerId}-title`
const saveStatusId = `${plannerId}-save-status`
const stagesTitleId = `${plannerId}-stages-title`
const activeStageTitleId = `${plannerId}-active-stage-title`
const formationTitleId = `${plannerId}-formation-title`
const unassignedTitleId = `${plannerId}-unassigned-title`

const stages = ref<EditableStage[]>([])
const activeStageId = ref('')
const planLabel = ref('')
const baseline = ref('')
const movableInactiveAssignments = ref(new Set<string>())
const search = ref('')
const teamFilter = ref('')
const statusFilter = ref<'all' | 'active' | 'removed'>('all')
const draggedParticipantKey = ref<string | null>(null)
const saving = ref(false)
const saveQueued = ref(false)
const autosaveScheduled = ref(false)
const saveFailed = ref(false)
const saveConflict = ref(false)
const recoveryRequired = ref(false)
const serverVersion = ref(0)
const formationSchemaVersion = ref<0 | 1>(0)
const feedback = reactive({ kind: '' as '' | 'success' | 'error', text: '' })
const liveMessage = ref('')
let textAutosaveTimer: ReturnType<typeof setTimeout> | null = null
let structuralAutosaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSaveJob: GroupPlanSaveJob | null = null
let plannerGeneration = 0
let disposed = false
let manualSaveRequested = false

const participantByKey = computed(
  () =>
    new Map(
      props.reactionSlot.participants.map((participant) => [
        participant.participantKey,
        participant,
      ]),
    ),
)
const activeStage = computed(
  () => stages.value.find((stage) => stage.id === activeStageId.value) || null,
)
const groups = computed<EditableGroup[]>({
  get: () => activeStage.value?.groups || [],
  set: (nextGroups) => {
    if (activeStage.value) activeStage.value.groups = nextGroups
  },
})
const assignedKeys = computed(() => new Set(groups.value.flatMap((group) => group.members)))
const unassignedParticipants = computed(() =>
  props.reactionSlot.participants.filter(
    (participant) => !assignedKeys.value.has(participant.participantKey),
  ),
)
const teams = computed(() =>
  [...new Set(props.reactionSlot.participants.flatMap((participant) => participant.teams))].sort(
    (a, b) => a.localeCompare(b, 'fr'),
  ),
)
const formationSupported = computed(() => formationSchemaVersion.value === 1)
const formationGroups = computed(() =>
  groups.value.map((group, groupIndex) => ({
    id: group.id,
    label: `Groupe ${groupIndex + 1}`,
    members: participantsForGroup(group).map(participantLabel),
    placement: group.placement,
  })),
)
const isDirty = computed(() => serializePlan() !== baseline.value)
const activeCount = computed(
  () => props.reactionSlot.participants.filter((participant) => participant.active).length,
)
const removedCount = computed(() => props.reactionSlot.participants.length - activeCount.value)
const hasInvalidStageLabels = computed(() => stages.value.some((stage) => !stage.label.trim()))
const hasInvalidFormationAnnotations = computed(() =>
  stages.value.some((stage) =>
    stage.annotations.some((annotation) => !annotation.count.trim() || !annotation.figure.trim()),
  ),
)
const hasInvalidFormationLines = computed(() =>
  stages.value.some((stage) =>
    stage.annotations.some(
      (annotation) =>
        annotation.kind === 'line' &&
        annotation.start.x === annotation.end.x &&
        annotation.start.y === annotation.end.y,
    ),
  ),
)
const hasInvalidPlan = computed(
  () =>
    hasInvalidStageLabels.value ||
    hasInvalidFormationAnnotations.value ||
    hasInvalidFormationLines.value,
)
const editsLocked = computed(() => saveConflict.value || recoveryRequired.value)
const isSettling = computed(() => saving.value || recoveryRequired.value)
const emptyGroupCount = computed(() =>
  stages.value.reduce(
    (total, stage) => total + stage.groups.filter((group) => group.members.length === 0).length,
    0,
  ),
)
const hasLocalOnlyChanges = computed(() => emptyGroupCount.value > 0)
const hasPendingChanges = computed(() => isDirty.value || hasLocalOnlyChanges.value)
const saveStatus = computed(() => {
  if (saveConflict.value) {
    return 'Conflit de version : le plan local est conservé. Recharge les données avant de reprendre.'
  }
  if (recoveryRequired.value) {
    return 'Réponse du serveur incertaine : réessaie exactement le même enregistrement avant de modifier le plan.'
  }
  if (hasInvalidPlan.value && !(recoveryRequired.value && pendingSaveJob)) {
    return hasInvalidStageLabels.value
      ? 'Donne un nom à chaque étape pour reprendre l’enregistrement automatique.'
      : hasInvalidFormationAnnotations.value
        ? 'Renseigne le compte et la figure de chaque repère pour reprendre l’enregistrement automatique.'
        : 'Écarte les deux extrémités de chaque ligne pour reprendre l’enregistrement automatique.'
  }
  if (saving.value) return 'Enregistrement automatique en cours…'
  if (autosaveScheduled.value || saveQueued.value) return 'Modifications en attente…'
  if (saveFailed.value) {
    return 'L’enregistrement automatique a échoué. Tu peux réessayer avec le bouton Enregistrer.'
  }
  if (isDirty.value) return 'Modifications non enregistrées.'
  if (emptyGroupCount.value > 0) {
    return emptyGroupCount.value === 1
      ? 'Un groupe vide reste local. Ajoute une personne pour l’enregistrer.'
      : `${emptyGroupCount.value} groupes vides restent locaux. Ajoute une personne pour les enregistrer.`
  }
  return 'Toutes les modifications sont enregistrées.'
})

watch(hasPendingChanges, (dirty) => emit('dirty-change', dirty), { immediate: true })
watch(isSettling, (settling) => emit('settling-change', settling), {
  immediate: true,
  flush: 'sync',
})

watch(planLabel, () => scheduleTextAutosave())

watch(
  () =>
    stages.value.map((stage) => ({
      id: stage.id,
      label: stage.label,
      annotations: stage.annotations.map((annotation) => ({
        id: annotation.id,
        count: annotation.count,
        figure: annotation.figure,
      })),
    })),
  (nextStages, previousStages) => {
    const previousText = new Map(
      previousStages.map((stage) => [
        stage.id,
        JSON.stringify({ label: stage.label, annotations: stage.annotations }),
      ]),
    )
    const sameStages =
      nextStages.length === previousStages.length &&
      nextStages.every(
        (stage) =>
          previousText.has(stage.id) &&
          previousStages.find((previous) => previous.id === stage.id)?.annotations.length ===
            stage.annotations.length &&
          stage.annotations.every((annotation) =>
            previousStages
              .find((previous) => previous.id === stage.id)
              ?.annotations.some((previous) => previous.id === annotation.id),
          ),
      )
    if (
      sameStages &&
      nextStages.some(
        (stage) =>
          previousText.get(stage.id) !==
          JSON.stringify({ label: stage.label, annotations: stage.annotations }),
      )
    ) {
      scheduleTextAutosave()
    }
  },
)

watch(
  () => props.reactionSlot,
  (slot) => {
    plannerGeneration += 1
    clearAutosaveTimers()
    pendingSaveJob = null
    manualSaveRequested = false
    saveQueued.value = false
    saveFailed.value = false
    saveConflict.value = false
    recoveryRequired.value = false
    serverVersion.value = slot.groupConfig.version
    formationSchemaVersion.value = slot.groupConfig.formationSchemaVersion
    stages.value = [...slot.groupConfig.stages]
      .sort((first, second) => first.position - second.position)
      .map((stage) => ({
        id: stage.id,
        label: stage.label,
        surface: stage.surface,
        annotations: stage.annotations.map((annotation) => ({
          ...annotation,
          start: { ...annotation.start },
          end: annotation.end ? { ...annotation.end } : null,
        })) as AnimationEventFormationAnnotation[],
        groups: [...stage.groups]
          .sort((first, second) => first.position - second.position)
          .map((group, groupIndex, sortedGroups) => ({
            id: group.id,
            members: [...group.members]
              .sort((first, second) => first.position - second.position)
              .map((member) => member.participantKey),
            placement:
              group.placement || defaultFormationPlacement(groupIndex, sortedGroups.length),
          })),
      }))
    activeStageId.value = stages.value[0]?.id || ''
    planLabel.value = slot.groupConfig.label
    movableInactiveAssignments.value = new Set(
      stages.value.flatMap((stage) =>
        stage.groups.flatMap((group) =>
          group.members
            .filter((key) => !participantByKey.value.get(key)?.active)
            .map((key) => inactiveAssignmentKey(stage.id, key)),
        ),
      ),
    )
    baseline.value = serializePlan()
    feedback.kind = ''
    feedback.text = ''
  },
  { immediate: true },
)

function currentPlanSnapshot(includeFormation = formationSupported.value): GroupPlanSnapshot {
  return {
    label: planLabel.value.trim(),
    stages: normalizedStages(includeFormation),
  }
}

function serializePlan(snapshot: GroupPlanSnapshot = currentPlanSnapshot()) {
  return JSON.stringify(snapshot)
}

function inactiveAssignmentKey(stageId: string, participantKey: string) {
  return `${stageId}\u0000${participantKey}`
}

function groupTitleId(groupId: string) {
  return `${plannerId}-group-${groupId}`
}

function stageSelectId(stageId: string) {
  return `${plannerId}-stage-${stageId}`
}

function stageFormationError(stage: EditableStage) {
  if (!stage.label.trim()) return 'Nom à compléter'
  if (
    stage.annotations.some((annotation) => !annotation.count.trim() || !annotation.figure.trim())
  ) {
    return 'Repère à compléter'
  }
  if (
    stage.annotations.some(
      (annotation) =>
        annotation.kind === 'line' &&
        annotation.start.x === annotation.end.x &&
        annotation.start.y === annotation.end.y,
    )
  ) {
    return 'Ligne à corriger'
  }
  return ''
}

function defaultFormationPlacement(index: number, total: number): AnimationEventFormationPoint {
  const safeTotal = Math.max(total, 1)
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(safeTotal * 1.4))))
  const rows = Math.ceil(safeTotal / columns)
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    x: Math.round(((column + 1) / (columns + 1)) * ANIMATION_EVENT_FORMATION_COORDINATE_MAX),
    y: Math.round(((row + 1) / (rows + 1)) * ANIMATION_EVENT_FORMATION_COORDINATE_MAX),
  }
}

function formationPositionLabel(point: AnimationEventFormationPoint) {
  const horizontal = point.x < 3333 ? 'gauche' : point.x > 6667 ? 'droite' : 'centre'
  const vertical = point.y < 3333 ? 'fond' : point.y > 6667 ? 'avant' : 'centre'
  return vertical === 'centre' && horizontal === 'centre'
    ? 'au centre'
    : `${vertical} ${horizontal}`
}

function displayDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(date)
}

function participantLabel(participant: AnimationEventParticipant) {
  return participant.displayName || participant.username
}

function participantHistory(participant: AnimationEventParticipant) {
  const joined = participant.addedAt
    ? `Ajouté le ${displayDateTime(participant.addedAt)}`
    : `Présent au premier import du ${displayDateTime(participant.firstSeenAt)}`
  return participant.removedAt
    ? `${joined} · retiré le ${displayDateTime(participant.removedAt)}`
    : participant.active
      ? joined
      : `${joined} · réaction absente au dernier relevé (date de retrait inconnue)`
}

function participantMatches(participant: AnimationEventParticipant) {
  const query = search.value.trim().toLocaleLowerCase('fr-FR')
  if (
    query &&
    !`${participant.displayName} ${participant.username} ${participant.teams.join(' ')}`
      .toLocaleLowerCase('fr-FR')
      .includes(query)
  ) {
    return false
  }
  if (teamFilter.value && !participant.teams.includes(teamFilter.value)) return false
  if (statusFilter.value === 'active' && !participant.active) return false
  if (statusFilter.value === 'removed' && participant.active) return false
  return true
}

function visibleParticipants(participants: AnimationEventParticipant[]) {
  return participants.filter(participantMatches)
}

function participantsForGroup(group: EditableGroup) {
  return group.members.flatMap((key) => {
    const participant = participantByKey.value.get(key)
    return participant ? [participant] : []
  })
}

function groupForParticipant(participantKey: string) {
  return groups.value.find((group) => group.members.includes(participantKey)) || null
}

function selectStage(stageId: string) {
  if (!stages.value.some((stage) => stage.id === stageId)) return
  activeStageId.value = stageId
  feedback.kind = ''
  feedback.text = ''
}

function addStage() {
  if (editsLocked.value || stages.value.length >= ANIMATION_EVENT_MAX_GROUP_STAGES) return
  const stage: EditableStage = {
    id: globalThis.crypto.randomUUID(),
    label: `Étape ${stages.value.length + 1}`,
    surface: activeStage.value?.surface || 'square',
    annotations: [],
    groups: [],
  }
  stages.value.push(stage)
  activeStageId.value = stage.id
  liveMessage.value = `${stage.label} ajoutée.`
  scheduleStructuralAutosave()
}

function removeStage(stageId: string) {
  if (editsLocked.value || stages.value.length <= 1) return
  const stageIndex = stages.value.findIndex((stage) => stage.id === stageId)
  const stage = stages.value[stageIndex]
  if (!stage) return
  if (
    (stage.groups.some((group) => group.members.length > 0) || stage.annotations.length > 0) &&
    !globalThis.confirm(
      `Supprimer « ${stage.label.trim() || 'cette étape'} », tous ses groupes et ses repères ?`,
    )
  ) {
    return
  }
  for (const group of stage.groups) {
    for (const participantKey of group.members) {
      movableInactiveAssignments.value.delete(inactiveAssignmentKey(stage.id, participantKey))
    }
  }
  stages.value.splice(stageIndex, 1)
  if (activeStageId.value === stageId) {
    activeStageId.value = stages.value[Math.min(stageIndex, stages.value.length - 1)]?.id || ''
  }
  const focusStageId = stages.value[Math.min(stageIndex, stages.value.length - 1)]?.id
  if (focusStageId) {
    nextTick(() => document.getElementById(stageSelectId(focusStageId))?.focus())
  }
  liveMessage.value = `${stage.label.trim() || 'Étape'} supprimée.`
  scheduleStructuralAutosave()
}

function moveStage(stageId: string, direction: -1 | 1) {
  if (editsLocked.value) return
  const stageIndex = stages.value.findIndex((stage) => stage.id === stageId)
  const targetIndex = stageIndex + direction
  if (stageIndex < 0 || targetIndex < 0 || targetIndex >= stages.value.length) return
  const [stage] = stages.value.splice(stageIndex, 1)
  if (!stage) return
  stages.value.splice(targetIndex, 0, stage)
  liveMessage.value = `${stage.label.trim() || 'Étape'} déplacée en position ${targetIndex + 1}.`
  scheduleStructuralAutosave()
}

function addGroup() {
  if (
    editsLocked.value ||
    !activeStage.value ||
    groups.value.length >= ANIMATION_EVENT_MAX_GROUPS
  ) {
    return
  }
  groups.value.push({
    id: globalThis.crypto.randomUUID(),
    members: [],
    placement: defaultFormationPlacement(groups.value.length, groups.value.length + 1),
  })
  liveMessage.value = `Groupe ${groups.value.length} ajouté dans ${activeStage.value.label}.`
  scheduleStructuralAutosave()
}

function removeGroup(groupId: string) {
  if (editsLocked.value) return
  const groupIndex = groups.value.findIndex((group) => group.id === groupId)
  if (groupIndex < 0) return
  const memberCount = groups.value[groupIndex]?.members.length || 0
  for (const participantKey of groups.value[groupIndex]?.members || []) {
    if (!participantByKey.value.get(participantKey)?.active) {
      movableInactiveAssignments.value.delete(
        inactiveAssignmentKey(activeStageId.value, participantKey),
      )
    }
  }
  groups.value.splice(groupIndex, 1)
  liveMessage.value = `Groupe supprimé. ${memberCount} personne(s) sont de nouveau non affectées.`
  scheduleStructuralAutosave()
}

function moveParticipant(participantKey: string, targetGroupId: string | null) {
  if (editsLocked.value) return
  const participant = participantByKey.value.get(participantKey)
  if (!participant) return
  const currentGroup = groupForParticipant(participantKey)
  if (
    !participant.active &&
    targetGroupId &&
    currentGroup?.id !== targetGroupId &&
    !movableInactiveAssignments.value.has(
      inactiveAssignmentKey(activeStageId.value, participantKey),
    )
  ) {
    feedback.kind = 'error'
    feedback.text =
      'Une personne ayant retiré sa réaction ne peut pas être ajoutée à un autre groupe.'
    return
  }
  const target = targetGroupId ? groups.value.find((group) => group.id === targetGroupId) : null
  if (target && !target.members.includes(participantKey) && target.members.length >= 3) {
    feedback.kind = 'error'
    feedback.text = 'Ce groupe contient déjà trois personnes.'
    return
  }

  for (const group of groups.value) {
    group.members = group.members.filter((key) => key !== participantKey)
  }
  if (target) target.members.push(participantKey)
  if (!participant.active && !target) {
    movableInactiveAssignments.value.delete(
      inactiveAssignmentKey(activeStageId.value, participantKey),
    )
  }
  groups.value = groups.value.filter(
    (group) => group.members.length > 0 || group.id === targetGroupId,
  )
  liveMessage.value = target
    ? `${participantLabel(participant)} déplacé dans le groupe ${groups.value.indexOf(target) + 1}.`
    : `${participantLabel(participant)} déplacé vers les personnes non affectées.`
  feedback.kind = ''
  feedback.text = ''
  scheduleStructuralAutosave()
}

function distributeAutomatically() {
  if (editsLocked.value) return
  const available = unassignedParticipants.value.filter((participant) => participant.active)
  for (const participant of available) {
    let target = groups.value.find((group) => group.members.length < 3)
    if (!target) {
      if (groups.value.length >= ANIMATION_EVENT_MAX_GROUPS) {
        feedback.kind = 'error'
        feedback.text = 'Le nombre maximal de groupes est atteint.'
        break
      }
      target = {
        id: globalThis.crypto.randomUUID(),
        members: [],
        placement: defaultFormationPlacement(groups.value.length, groups.value.length + 1),
      }
      groups.value.push(target)
    }
    target.members.push(participant.participantKey)
  }
  liveMessage.value = `${available.length} personne(s) répartie(s) dans des groupes de trois.`
  scheduleStructuralAutosave()
}

function onDragStart(participant: AnimationEventParticipant, event: DragEvent) {
  if (editsLocked.value || !canMoveParticipant(participant)) {
    event.preventDefault()
    return
  }
  draggedParticipantKey.value = participant.participantKey
  event.dataTransfer?.setData('text/plain', participant.participantKey)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function canMoveParticipant(participant: AnimationEventParticipant) {
  return (
    participant.active ||
    movableInactiveAssignments.value.has(
      inactiveAssignmentKey(activeStageId.value, participant.participantKey),
    )
  )
}

function onDrop(targetGroupId: string | null, event: DragEvent) {
  event.preventDefault()
  const participantKey =
    event.dataTransfer?.getData('text/plain') || draggedParticipantKey.value || ''
  draggedParticipantKey.value = null
  if (participantKey) moveParticipant(participantKey, targetGroupId)
}

function updateFormationSurface(surface: AnimationEventFormationSurface) {
  if (editsLocked.value || !activeStage.value || activeStage.value.surface === surface) return
  activeStage.value.surface = surface
  liveMessage.value = `Format du terrain : ${surface === 'square' ? 'carré' : surface === 'landscape' ? 'rectangle horizontal' : 'rectangle vertical'}.`
  scheduleStructuralAutosave()
}

function moveFormationGroup(groupId: string, placement: AnimationEventFormationPoint) {
  if (editsLocked.value) return
  const groupIndex = groups.value.findIndex((group) => group.id === groupId)
  const group = groups.value[groupIndex]
  if (!group) return
  group.placement = { ...placement }
  liveMessage.value = `Groupe ${groupIndex + 1} déplacé ${formationPositionLabel(placement)}.`
  scheduleStructuralAutosave()
}

function addFormationAnnotation(kind: AnimationEventFormationAnnotation['kind']) {
  if (
    editsLocked.value ||
    !activeStage.value ||
    activeStage.value.annotations.length >= ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS
  ) {
    return
  }
  const position = activeStage.value.annotations.length
  const base = {
    id: globalThis.crypto.randomUUID(),
    position,
    kind,
    count: '',
    figure: '',
    start: kind === 'point' ? { x: 5000, y: 5000 } : { x: 3500, y: 5000 },
  } as const
  const annotation: AnimationEventFormationAnnotation =
    kind === 'point'
      ? { ...base, kind: 'point', end: null }
      : { ...base, kind: 'line', end: { x: 6500, y: 5000 } }
  activeStage.value.annotations.push(annotation)
  liveMessage.value = `${kind === 'point' ? 'Point' : 'Ligne'} ajouté. Renseigne son compte et sa figure.`
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(
      `[data-formation-annotation-id="${annotation.id}"] input`,
    )
    input?.focus()
  })
  scheduleStructuralAutosave()
}

function updateFormationAnnotation(id: string, patch: FormationAnnotationPatch) {
  if (editsLocked.value || !activeStage.value) return
  const annotationIndex = activeStage.value.annotations.findIndex(
    (annotation) => annotation.id === id,
  )
  const annotation = activeStage.value.annotations[annotationIndex]
  if (!annotation) return

  if (typeof patch.count === 'string') annotation.count = patch.count
  if (typeof patch.figure === 'string') annotation.figure = patch.figure
  if (patch.start) annotation.start = { ...patch.start }
  if (annotation.kind === 'line' && patch.end) annotation.end = { ...patch.end }

  if (patch.start || patch.end) {
    liveMessage.value = `Repère ${annotationIndex + 1} déplacé.`
    scheduleStructuralAutosave()
  }
}

function moveFormationAnnotation(
  annotationId: string,
  endpoint: 'start' | 'end',
  placement: AnimationEventFormationPoint,
) {
  updateFormationAnnotation(
    annotationId,
    endpoint === 'start' ? { start: placement } : { end: placement },
  )
}

function removeFormationAnnotation(id: string) {
  if (editsLocked.value || !activeStage.value) return
  const annotationIndex = activeStage.value.annotations.findIndex(
    (annotation) => annotation.id === id,
  )
  if (annotationIndex < 0) return
  const annotation = activeStage.value.annotations[annotationIndex]
  if (
    annotation &&
    (annotation.count.trim() || annotation.figure.trim()) &&
    !globalThis.confirm(
      `Supprimer le repère « ${annotation.figure.trim() || `compte ${annotation.count.trim()}`} » ?`,
    )
  ) {
    return
  }
  activeStage.value.annotations.splice(annotationIndex, 1)
  liveMessage.value = `Repère ${annotationIndex + 1} supprimé.`
  scheduleStructuralAutosave()
}

function normalizedGroups(
  groups: EditableGroup[],
  includeFormation = formationSupported.value,
): AnimationEventGroupRequest[] {
  return groups
    .filter((group) => group.members.length > 0)
    .map((group, groupIndex) => {
      const normalized: AnimationEventGroupRequest = {
        id: group.id,
        position: groupIndex,
        members: group.members.map((participantKey, position) => ({ participantKey, position })),
      }
      if (includeFormation) normalized.placement = { ...group.placement }
      return normalized
    })
}

function normalizedStages(
  includeFormation = formationSupported.value,
): AnimationEventGroupStageRequest[] {
  return stages.value.map((stage, position) => {
    const normalized: AnimationEventGroupStageRequest = {
      id: stage.id,
      label: stage.label.trim(),
      position,
      groups: normalizedGroups(stage.groups, includeFormation),
    }
    if (includeFormation) {
      normalized.surface = stage.surface
      normalized.annotations = stage.annotations.map((annotation, annotationPosition) => ({
        ...annotation,
        position: annotationPosition,
        count: annotation.count.trim(),
        figure: annotation.figure.trim(),
        start: { ...annotation.start },
        end: annotation.end ? { ...annotation.end } : null,
      })) as AnimationEventFormationAnnotation[]
    }
    return normalized
  })
}

function updateAutosaveScheduled() {
  autosaveScheduled.value = textAutosaveTimer !== null || structuralAutosaveTimer !== null
}

function clearTextAutosave() {
  if (textAutosaveTimer !== null) clearTimeout(textAutosaveTimer)
  textAutosaveTimer = null
  updateAutosaveScheduled()
}

function clearStructuralAutosave() {
  if (structuralAutosaveTimer !== null) clearTimeout(structuralAutosaveTimer)
  structuralAutosaveTimer = null
  updateAutosaveScheduled()
}

function clearAutosaveTimers() {
  if (textAutosaveTimer !== null) clearTimeout(textAutosaveTimer)
  if (structuralAutosaveTimer !== null) clearTimeout(structuralAutosaveTimer)
  textAutosaveTimer = null
  structuralAutosaveTimer = null
  updateAutosaveScheduled()
}

function prepareAutosave() {
  if (disposed || !import.meta.client || editsLocked.value || !isDirty.value) return false
  if (saveFailed.value) {
    feedback.kind = ''
    feedback.text = ''
  }
  saveFailed.value = false
  return true
}

function scheduleTextAutosave() {
  clearTextAutosave()
  if (!prepareAutosave()) return
  textAutosaveTimer = setTimeout(() => {
    textAutosaveTimer = null
    updateAutosaveScheduled()
    requestSave(false)
  }, TEXT_AUTOSAVE_DELAY_MS)
  updateAutosaveScheduled()
}

function scheduleStructuralAutosave() {
  clearStructuralAutosave()
  if (!prepareAutosave()) return
  // A structural save includes the current text, so its shorter timer supersedes the text debounce.
  clearTextAutosave()
  structuralAutosaveTimer = setTimeout(() => {
    structuralAutosaveTimer = null
    updateAutosaveScheduled()
    requestSave(false)
  }, STRUCTURAL_AUTOSAVE_DELAY_MS)
  updateAutosaveScheduled()
}

function requestSave(manual: boolean) {
  if (manual) {
    clearAutosaveTimers()
    manualSaveRequested = true
  }
  if (hasInvalidPlan.value && !(recoveryRequired.value && pendingSaveJob)) {
    if (manual) {
      feedback.kind = 'error'
      feedback.text = hasInvalidStageLabels.value
        ? 'Chaque étape doit avoir un nom.'
        : hasInvalidFormationAnnotations.value
          ? 'Chaque repère doit avoir un compte et une figure.'
          : 'Les deux extrémités d’une ligne doivent être différentes.'
    }
    manualSaveRequested = false
    return
  }
  if (saveConflict.value) {
    manualSaveRequested = false
    return
  }
  if (!isDirty.value && !pendingSaveJob) {
    manualSaveRequested = false
    return
  }
  saveQueued.value = true
  void drainSaveQueue()
}

function createSaveJob(manual: boolean): GroupPlanSaveJob | null {
  const legacySnapshot = currentPlanSnapshot(false)
  const formationSnapshot = currentPlanSnapshot(true)
  const snapshot = formationSupported.value ? formationSnapshot : legacySnapshot
  const legacyProjectionSignature = serializePlan(legacySnapshot)
  const formationProjectionSignature = serializePlan(formationSnapshot)
  const signature = serializePlan(snapshot)
  if (signature === baseline.value) return null
  return {
    ...snapshot,
    eventId: props.eventId,
    slotId: props.reactionSlot.id,
    generation: plannerGeneration,
    requestId: globalThis.crypto.randomUUID(),
    expectedVersion: serverVersion.value,
    signature,
    legacyProjectionSignature,
    formationProjectionSignature,
    manual,
  }
}

function saveJobTargetsCurrentPlanner(job: GroupPlanSaveJob) {
  return (
    !disposed &&
    job.generation === plannerGeneration &&
    job.eventId === props.eventId &&
    job.slotId === props.reactionSlot.id
  )
}

async function drainSaveQueue() {
  if (disposed || saving.value || !saveQueued.value) return
  const manual = manualSaveRequested
  manualSaveRequested = false
  saveQueued.value = false
  if (hasInvalidPlan.value && !pendingSaveJob) return

  const job = pendingSaveJob || createSaveJob(manual)
  if (!job) return
  if (manual) job.manual = true
  pendingSaveJob = job
  saving.value = true
  saveFailed.value = false
  feedback.kind = ''
  feedback.text = ''
  let saved = false
  try {
    const response = await $fetch<AnimationEventGroupConfigResponse>(
      `/api/admin/animation-events/${encodeURIComponent(job.eventId)}/slots/${encodeURIComponent(job.slotId)}/group-config`,
      {
        method: 'PUT',
        body: {
          requestId: job.requestId,
          expectedVersion: job.expectedVersion,
          label: job.label,
          stages: job.stages,
        },
      },
    )
    saved = true
    if (saveJobTargetsCurrentPlanner(job)) {
      pendingSaveJob = null
      serverVersion.value = response.groupConfig.version
      formationSchemaVersion.value = response.groupConfig.formationSchemaVersion
      recoveryRequired.value = false
      // The response may expose a display fallback for an empty plan label. The accepted request
      // snapshot remains the correct baseline for the still-unmodified local editor. Keep both
      // schema projections captured with that snapshot: rebuilding one from live state here would
      // incorrectly absorb edits made while the request was in flight.
      baseline.value =
        response.groupConfig.formationSchemaVersion === 1
          ? job.formationProjectionSignature
          : job.legacyProjectionSignature
      if (job.manual) {
        feedback.kind = 'success'
        feedback.text = 'Plan de groupes enregistré.'
      }
      liveMessage.value = 'Modifications enregistrées.'
      emit('saved', response.groupConfig)

      // Edits made while this snapshot was in flight stay untouched and are coalesced here.
      if ((saveQueued.value || job.manual) && isDirty.value) saveQueued.value = true
    }
  } catch (error) {
    if (saveJobTargetsCurrentPlanner(job)) {
      const candidate = error as {
        data?: { statusMessage?: string }
        message?: string
      }
      const message =
        candidate.data?.statusMessage || candidate.message || "Le plan n'a pas pu être enregistré."
      const errorCode = mutationErrorCode(error)
      const errorStatus = mutationErrorStatus(error)
      const isVersionConflict =
        errorCode === 'stale_version' ||
        (!errorCode &&
          (errorStatus === null || errorStatus >= 400) &&
          /stale[_ -]?version|version.+(?:périmée|obsolète|attendue)/iu.test(message))
      const outcomeIsUnknown = mutationOutcomeIsUnknown(error)
      const releaseRequestId = shouldReleaseMutationRequestId(error)
      saveFailed.value = true
      saveConflict.value = isVersionConflict
      recoveryRequired.value = !isVersionConflict && outcomeIsUnknown
      if (isVersionConflict || releaseRequestId) pendingSaveJob = null
      saveQueued.value = false
      clearAutosaveTimers()
      feedback.kind = 'error'
      feedback.text = isVersionConflict
        ? `${message} Le plan local est conservé, mais il faut recharger les données avant de reprendre.`
        : recoveryRequired.value
          ? `${message} Le plan local est verrouillé temporairement. Réessaie avec le bouton Enregistrer pour confirmer exactement la même opération.`
          : `${message} Le plan local est conservé. Corrige-le puis réessaie.`
    }
  } finally {
    saving.value = false
    if (!saved && saveJobTargetsCurrentPlanner(job)) saveQueued.value = false
    if (saveQueued.value) void drainSaveQueue()
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!hasPendingChanges.value && !isSettling.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  disposed = true
  clearAutosaveTimers()
  emit('settling-change', false)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <section class="group-planner" :aria-labelledby="plannerTitleId">
    <header class="group-planner__header">
      <div>
        <p class="admin-eyebrow">{{ reactionSlot.emoji }} {{ reactionSlot.label }}</p>
        <h3 :id="plannerTitleId">Composer les groupes</h3>
        <p>{{ activeCount }} actif(s) · {{ removedCount }} réaction(s) retirée(s) · groupes de 3</p>
      </div>
      <div class="group-planner__actions">
        <button
          type="button"
          class="admin-button admin-button--primary"
          :disabled="
            saving ||
            (!isDirty && !recoveryRequired) ||
            (hasInvalidPlan && !recoveryRequired) ||
            saveConflict
          "
          :aria-describedby="saveStatusId"
          @click="requestSave(true)"
        >
          {{
            saving
              ? 'Enregistrement…'
              : recoveryRequired
                ? 'Réessayer l’enregistrement'
                : 'Enregistrer maintenant'
          }}
        </button>
      </div>
    </header>

    <p
      :id="saveStatusId"
      :class="[
        'group-planner__save-status',
        {
          'is-saving': saving,
          'is-error': saveFailed,
          'has-local-groups': emptyGroupCount > 0,
        },
      ]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span aria-hidden="true">
        {{ saving || autosaveScheduled || saveQueued ? '↻' : saveFailed ? '!' : '✓' }}
      </span>
      {{ saveStatus }}
    </p>

    <p v-if="!reactionSlot.isPresent" class="group-planner__warning" role="status">
      Cette réaction n’est plus présente sur Discord. Son historique et ses groupes sont conservés.
    </p>
    <p
      v-if="reactionSlot.participants.some((participant) => !participant.historyComplete)"
      class="group-planner__warning"
    >
      Les dates antérieures au premier import Discord sont inconnues. Le suivi devient exact à
      partir de l’activation de BigBadBot.
    </p>
    <p
      v-if="feedback.text"
      :class="['group-planner__feedback', `is-${feedback.kind}`]"
      :role="feedback.kind === 'error' ? 'alert' : 'status'"
    >
      {{ feedback.text }}
    </p>
    <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

    <section class="group-stages" :aria-labelledby="stagesTitleId">
      <header>
        <div>
          <h4 :id="stagesTitleId">Étapes du plan</h4>
          <p>Chaque étape possède sa propre répartition des participants.</p>
        </div>
        <button
          type="button"
          class="admin-button"
          :disabled="editsLocked || stages.length >= ANIMATION_EVENT_MAX_GROUP_STAGES"
          @click="addStage"
        >
          + Étape
        </button>
      </header>
      <ol class="group-stages__list">
        <li
          v-for="(stage, stageIndex) in stages"
          :key="stage.id"
          :class="{
            'is-active': stage.id === activeStageId,
            'is-invalid': Boolean(stageFormationError(stage)),
          }"
        >
          <button
            :id="stageSelectId(stage.id)"
            type="button"
            class="group-stages__select"
            :aria-current="stage.id === activeStageId ? 'step' : undefined"
            @click="selectStage(stage.id)"
          >
            <span>Étape {{ stageIndex + 1 }}</span>
            <strong>{{ stage.label.trim() || 'Sans nom' }}</strong>
            <small>{{ stage.groups.length }} groupe(s)</small>
            <small v-if="stageFormationError(stage)" class="group-stages__warning">
              {{ stageFormationError(stage) }}
            </small>
          </button>
          <div class="group-stages__order">
            <button
              type="button"
              :disabled="editsLocked || stageIndex === 0"
              :aria-label="`Monter ${stage.label.trim() || `l’étape ${stageIndex + 1}`}`"
              @click="moveStage(stage.id, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="editsLocked || stageIndex === stages.length - 1"
              :aria-label="`Descendre ${stage.label.trim() || `l’étape ${stageIndex + 1}`}`"
              @click="moveStage(stage.id, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="is-danger"
              :disabled="editsLocked || stages.length === 1"
              :aria-label="`Supprimer ${stage.label.trim() || `l’étape ${stageIndex + 1}`}`"
              @click="removeStage(stage.id)"
            >
              ×
            </button>
          </div>
        </li>
      </ol>
    </section>

    <section v-if="activeStage" class="active-stage" :aria-labelledby="activeStageTitleId">
      <header class="active-stage__header">
        <div class="active-stage__identity">
          <h4 :id="activeStageTitleId">
            {{ activeStage.label.trim() || 'Étape sans nom' }}
          </h4>
          <label>
            <span>Nom de l’étape</span>
            <input
              v-model="activeStage.label"
              type="text"
              required
              :maxlength="ANIMATION_EVENT_MAX_GROUP_STAGE_LABEL_LENGTH"
              :disabled="editsLocked"
              :aria-invalid="!activeStage.label.trim()"
            />
            <small v-if="!activeStage.label.trim()">Le nom de l’étape est obligatoire.</small>
          </label>
        </div>
        <div class="group-planner__actions">
          <button
            type="button"
            class="admin-button"
            :disabled="editsLocked"
            @click="distributeAutomatically"
          >
            Répartir automatiquement
          </button>
          <button
            type="button"
            class="admin-button"
            :disabled="editsLocked || groups.length >= ANIMATION_EVENT_MAX_GROUPS"
            @click="addGroup"
          >
            + Groupe
          </button>
        </div>
      </header>

      <div class="group-planner__filters" aria-label="Filtres des participants">
        <label>
          <span>Rechercher</span>
          <input v-model="search" type="search" placeholder="Nom, pseudo ou équipe" />
        </label>
        <label>
          <span>Équipe</span>
          <select v-model="teamFilter">
            <option value="">Toutes les équipes</option>
            <option v-for="team in teams" :key="team" :value="team">{{ team }}</option>
          </select>
        </label>
        <label>
          <span>Statut</span>
          <select v-model="statusFilter">
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="removed">Réaction retirée</option>
          </select>
        </label>
        <label>
          <span>Nom du plan</span>
          <input
            v-model.trim="planLabel"
            type="text"
            :maxlength="ANIMATION_EVENT_MAX_GROUP_LABEL_LENGTH"
            :disabled="editsLocked"
            placeholder="Ex. passages du soir"
          />
        </label>
      </div>

      <section class="formation-editor" :aria-labelledby="formationTitleId">
        <header>
          <div>
            <p class="admin-eyebrow">Placement par étape</p>
            <h4 :id="formationTitleId">Plan de formation</h4>
            <p>
              Déplace les groupes sur le terrain et ajoute des repères pour les comptes et les
              figures.
            </p>
          </div>
        </header>

        <p v-if="!formationSupported" class="group-planner__warning" role="status">
          Les plans visuels seront disponibles après la mise à jour de BigBadBot.
        </p>
        <div v-else class="formation-editor__layout" :aria-busy="saving">
          <AdminAnimationFormationBoard
            :context-key="`${reactionSlot.id}:${activeStage.id}`"
            :surface="activeStage.surface"
            :groups="formationGroups"
            :annotations="activeStage.annotations"
            :disabled="editsLocked"
            @move-group="moveFormationGroup"
            @move-annotation="moveFormationAnnotation"
          />
          <AdminAnimationFormationInspector
            :surface="activeStage.surface"
            :annotations="activeStage.annotations"
            :disabled="editsLocked"
            @surface-change="updateFormationSurface"
            @add-annotation="addFormationAnnotation"
            @update-annotation="updateFormationAnnotation"
            @remove-annotation="removeFormationAnnotation"
          />
        </div>
      </section>

      <div class="group-planner__board">
        <section
          class="group-column group-column--unassigned"
          :aria-labelledby="unassignedTitleId"
          @dragover.prevent
          @drop="onDrop(null, $event)"
        >
          <header>
            <h4 :id="unassignedTitleId">Non affectés</h4>
            <span>{{ unassignedParticipants.length }}</span>
          </header>
          <div class="participant-list">
            <article
              v-for="participant in visibleParticipants(unassignedParticipants)"
              :key="participant.participantKey"
              :class="['participant-card', { 'is-removed': !participant.active }]"
              :draggable="!editsLocked && canMoveParticipant(participant)"
              @dragstart="onDragStart(participant, $event)"
            >
              <img
                v-if="participant.avatarUrl"
                :src="participant.avatarUrl"
                alt=""
                width="40"
                height="40"
                loading="lazy"
              />
              <span v-else class="participant-card__avatar" aria-hidden="true">
                {{ participantLabel(participant).slice(0, 1).toUpperCase() }}
              </span>
              <span class="participant-card__identity">
                <strong>{{ participantLabel(participant) }}</strong>
                <small
                  >@{{ participant.username }} ·
                  {{ participant.teams.join(', ') || 'Sans équipe' }}</small
                >
                <small>{{ participantHistory(participant) }}</small>
              </span>
              <span :class="['participant-status', { 'is-active': participant.active }]">
                <span aria-hidden="true">{{ participant.active ? '✓' : '↶' }}</span>
                {{ participant.active ? 'Actif' : 'Retiré' }}
              </span>
              <label v-if="canMoveParticipant(participant)" class="participant-card__move">
                <span class="sr-only">Déplacer {{ participantLabel(participant) }}</span>
                <select
                  :aria-label="`Déplacer ${participantLabel(participant)} vers un groupe`"
                  :value="''"
                  :disabled="editsLocked"
                  @change="
                    moveParticipant(
                      participant.participantKey,
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Déplacer…</option>
                  <option
                    v-for="(group, groupIndex) in groups"
                    :key="group.id"
                    :value="group.id"
                    :disabled="group.members.length >= 3"
                  >
                    Groupe {{ groupIndex + 1 }}
                  </option>
                </select>
              </label>
            </article>
            <p
              v-if="visibleParticipants(unassignedParticipants).length === 0"
              class="group-column__empty"
            >
              Aucun participant ne correspond aux filtres.
            </p>
          </div>
        </section>

        <div class="group-planner__groups">
          <section
            v-for="(group, groupIndex) in groups"
            :key="group.id"
            class="group-column"
            :aria-labelledby="groupTitleId(group.id)"
            @dragover.prevent
            @drop="onDrop(group.id, $event)"
          >
            <header>
              <h4 :id="groupTitleId(group.id)">Groupe {{ groupIndex + 1 }}</h4>
              <span>{{ group.members.length }}/3</span>
              <button
                type="button"
                :disabled="editsLocked"
                :aria-label="`Supprimer le groupe ${groupIndex + 1}`"
                @click="removeGroup(group.id)"
              >
                ×
              </button>
            </header>
            <div class="participant-list">
              <p v-if="group.members.length === 0" class="group-column__empty" role="status">
                Ajoute une personne pour enregistrer ce groupe.
              </p>
              <article
                v-for="participant in visibleParticipants(participantsForGroup(group))"
                :key="participant.participantKey"
                :class="['participant-card', { 'is-removed': !participant.active }]"
                :draggable="!editsLocked && canMoveParticipant(participant)"
                @dragstart="onDragStart(participant, $event)"
              >
                <img
                  v-if="participant.avatarUrl"
                  :src="participant.avatarUrl"
                  alt=""
                  width="40"
                  height="40"
                  loading="lazy"
                />
                <span v-else class="participant-card__avatar" aria-hidden="true">
                  {{ participantLabel(participant).slice(0, 1).toUpperCase() }}
                </span>
                <span class="participant-card__identity">
                  <strong>{{ participantLabel(participant) }}</strong>
                  <small>{{ participant.teams.join(', ') || 'Sans équipe' }}</small>
                  <small>{{ participantHistory(participant) }}</small>
                </span>
                <span :class="['participant-status', { 'is-active': participant.active }]">
                  <span aria-hidden="true">{{ participant.active ? '✓' : '↶' }}</span>
                  {{ participant.active ? 'Actif' : 'Retiré' }}
                </span>
                <label v-if="canMoveParticipant(participant)" class="participant-card__move">
                  <span class="sr-only">Déplacer {{ participantLabel(participant) }}</span>
                  <select
                    :aria-label="`Choisir la destination de ${participantLabel(participant)}`"
                    :value="group.id"
                    :disabled="editsLocked"
                    @change="
                      moveParticipant(
                        participant.participantKey,
                        ($event.target as HTMLSelectElement).value || null,
                      )
                    "
                  >
                    <option value="">Non affecté</option>
                    <option
                      v-for="(targetGroup, targetIndex) in groups"
                      :key="targetGroup.id"
                      :value="targetGroup.id"
                      :disabled="targetGroup.id !== group.id && targetGroup.members.length >= 3"
                    >
                      Groupe {{ targetIndex + 1 }}
                    </option>
                  </select>
                </label>
                <button
                  v-else
                  type="button"
                  class="participant-card__remove"
                  :disabled="editsLocked"
                  @click="moveParticipant(participant.participantKey, null)"
                >
                  Retirer du groupe
                </button>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.group-planner {
  display: grid;
  gap: 1.25rem;
}

.group-planner__header,
.group-planner__actions,
.group-column > header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.group-planner__header {
  align-items: flex-start;
  justify-content: space-between;
}

.group-planner__header h3,
.group-planner__header p {
  margin: 0.2rem 0 0;
}

.group-planner__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.group-stages,
.active-stage {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: #f8f9fd;
}

.group-stages > header,
.active-stage__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.group-stages h4,
.group-stages p {
  margin: 0;
}

.group-stages p {
  margin-top: 0.25rem;
  color: #6c7597;
}

.group-stages__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.group-stages__list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  border: 1px solid #d7dced;
  border-radius: 0.75rem;
  overflow: hidden;
  background: white;
}

.group-stages__list li.is-active {
  border-color: #5967b3;
  box-shadow: 0 0 0 2px rgb(89 103 179 / 15%);
}

.group-stages__list li.is-invalid {
  border-color: #c45a6b;
}

.group-stages__select {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.7rem;
  border: 0;
  color: #17214f;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.group-stages__select span,
.group-stages__select small {
  color: #6c7597;
  font-size: 0.72rem;
}

.group-stages__select .group-stages__warning {
  color: #8f2535;
  font-weight: 800;
}

.group-stages__select strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-stages__order {
  display: grid;
  grid-template-columns: repeat(3, 1.9rem);
  align-content: center;
  gap: 0.2rem;
  padding: 0.35rem;
}

.group-stages__order button {
  min-width: 1.9rem;
  min-height: 1.9rem;
  border: 1px solid #d7dced;
  border-radius: 0.4rem;
  color: #3f4b7a;
  background: white;
  cursor: pointer;
}

.group-stages__order button.is-danger {
  color: #8f2535;
}

.group-stages__order button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.active-stage {
  background: white;
}

.active-stage__identity {
  display: grid;
  flex: 1;
  max-width: 28rem;
  gap: 0.6rem;
}

.active-stage__identity h4 {
  margin: 0;
}

.active-stage__identity label {
  display: grid;
  gap: 0.35rem;
  color: #505b80;
  font-size: 0.8rem;
  font-weight: 800;
}

.active-stage__header input {
  min-height: 2.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid #cfd5e6;
  border-radius: 0.6rem;
  color: #17214f;
  background: white;
  font: inherit;
}

.active-stage__header input[aria-invalid='true'] {
  border-color: #b62e45;
}

.active-stage__header small {
  color: #8f2535;
}

.group-planner__filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(10rem, 1fr));
  gap: 0.75rem;
}

.group-planner__filters label {
  display: grid;
  gap: 0.35rem;
  color: #505b80;
  font-size: 0.8rem;
  font-weight: 800;
}

.group-planner__filters input,
.group-planner__filters select,
.participant-card__move select {
  min-height: 2.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid #cfd5e6;
  border-radius: 0.6rem;
  color: #17214f;
  background: white;
  font: inherit;
}

.group-planner__warning,
.group-planner__feedback {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.7rem;
  background: #fff7df;
}

.group-planner__save-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #356247;
  font-size: 0.86rem;
  font-weight: 700;
}

.group-planner__save-status > span {
  display: inline-grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-radius: 50%;
  color: #17633b;
  background: #e8f8ef;
}

.group-planner__save-status.is-saving {
  color: #505b80;
}

.group-planner__save-status.is-saving > span {
  color: #3f4b7a;
  background: #eef0f8;
}

.group-planner__save-status.is-error {
  color: #8f2535;
}

.group-planner__save-status.is-error > span {
  color: #8f2535;
  background: #fdecef;
}

.group-planner__save-status.has-local-groups:not(.is-error, .is-saving) {
  color: #765315;
}

.group-planner__save-status.has-local-groups:not(.is-error, .is-saving) > span {
  color: #765315;
  background: #fff7df;
}

.group-planner__feedback.is-success {
  color: #17633b;
  background: #e8f8ef;
}

.group-planner__feedback.is-error {
  color: #8f2535;
  background: #fdecef;
}

.formation-editor {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: #fff;
}

.formation-editor > header h4,
.formation-editor > header p {
  margin: 0;
}

.formation-editor > header h4 {
  margin-top: 0.2rem;
}

.formation-editor > header p:last-child {
  margin-top: 0.3rem;
  color: #6c7597;
}

.formation-editor__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.8fr);
  gap: 1rem;
  align-items: start;
  min-width: 0;
}

.group-planner__board {
  display: grid;
  grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 2fr);
  gap: 1rem;
  align-items: start;
}

.group-planner__groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(16rem, 1fr));
  gap: 1rem;
}

.group-column {
  min-height: 10rem;
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: #fff;
}

.group-column--unassigned {
  position: sticky;
  top: 6rem;
  max-height: calc(100vh - 8rem);
  overflow: auto;
  background: #f8f9fd;
}

.group-column > header {
  margin-bottom: 0.8rem;
}

.group-column h4 {
  flex: 1;
  margin: 0;
}

.group-column > header button {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 50%;
  color: #8f2535;
  background: #fdecef;
  cursor: pointer;
}

.participant-list {
  display: grid;
  gap: 0.55rem;
}

.participant-card {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
  padding: 0.7rem;
  border: 1px solid #e1e5f0;
  border-radius: 0.75rem;
  background: white;
}

.participant-card[draggable='true'] {
  cursor: grab;
}

.participant-card.is-removed {
  border-style: dashed;
  background: #f8f9fc;
}

.participant-card img,
.participant-card__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
}

.participant-card__avatar {
  display: grid;
  place-items: center;
  color: white;
  background: #5967b3;
  font-weight: 900;
}

.participant-card__identity {
  display: grid;
  min-width: 0;
}

.participant-card__identity strong,
.participant-card__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participant-card__identity small {
  color: #6c7597;
}

.participant-status {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  color: #6b7280;
  background: #eceef4;
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
}

.participant-status.is-active {
  color: #17633b;
  background: #e3f7eb;
}

.participant-card__move,
.participant-card__remove {
  grid-column: 2 / -1;
}

.participant-card__move select {
  width: 100%;
  min-height: 2.2rem;
  padding-block: 0.35rem;
}

.participant-card__remove {
  justify-self: start;
  border: 0;
  color: #8f2535;
  background: none;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.group-column__empty {
  color: #727b9b;
}

@media (max-width: 1100px) {
  .group-planner__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .group-planner__board {
    grid-template-columns: 1fr;
  }

  .formation-editor__layout {
    grid-template-columns: 1fr;
  }

  .group-column--unassigned {
    position: static;
    max-height: 28rem;
  }
}

@media (max-width: 720px) {
  .group-planner__header {
    display: grid;
  }

  .group-stages > header,
  .active-stage__header {
    display: grid;
  }

  .group-planner__actions {
    justify-content: flex-start;
  }

  .group-planner__filters,
  .group-planner__groups {
    grid-template-columns: 1fr;
  }
}
</style>
