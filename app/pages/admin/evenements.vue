<script setup lang="ts">
import {
  ANIMATION_EVENT_TIME_ZONE,
  type AnimationEvent,
  type AnimationEventAction,
  type AnimationEventDraft,
  type AnimationEventGroupConfig,
  type AnimationEventItemDraft,
  type AnimationEventListResponse,
  type AnimationEventPreviewResponse,
  type AnimationEventPublishWindow,
  type AnimationEventResponse,
  type AnimationEventSlot,
  type AnimationEventStatus,
} from '#shared/types/animation-events'
import {
  ANIMATION_EVENT_MAX_CAPACITY,
  ANIMATION_EVENT_MAX_DETAILS_LENGTH,
  ANIMATION_EVENT_MAX_EMOJI_LENGTH,
  ANIMATION_EVENT_MAX_ITEMS,
  ANIMATION_EVENT_MAX_LOCATION_LENGTH,
  ANIMATION_EVENT_MAX_SLOT_LABEL_LENGTH,
  ANIMATION_EVENT_MAX_SLOTS,
  ANIMATION_EVENT_MAX_TEXT_LENGTH,
  ANIMATION_EVENT_MAX_TITLE_LENGTH,
  validateAnimationEventDraft,
} from '#shared/animation-events/validation'
import {
  mutationErrorCode,
  mutationOutcomeIsUnknown,
  shouldReleaseMutationRequestId,
} from '~/utils/autosave-mutation'

definePageMeta({ layout: 'admin', middleware: 'animation-events-admin' })

useSeoMeta({
  title: 'Événements d’animation · Wolves Admin',
  robots: 'noindex, nofollow',
})

interface EditableSlot {
  localId: string
  id?: string
  label: string
  emoji: string
  capacity: number | null
}

interface EditableItem {
  localId: string
  id?: string
  title: string
  eventDate: string
  startTime: string
  meetingTime: string
  location: string
  details: string
  slots: EditableSlot[]
}

interface EditableEvent {
  id: string | null
  expectedRevisionId: string | null
  status: AnimationEventStatus
  title: string
  intro: string
  outro: string
  publishWindow: AnimationEventPublishWindow
  items: EditableItem[]
  scheduledFor: string | null
  discordUrl: string | null
}

type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'blocked' | 'error'

const EDITABLE_STATUSES = new Set<AnimationEventStatus>([
  'draft',
  'scheduled',
  'missed',
  'published',
])
const EVENT_EMOJI_SUGGESTIONS = ['🔥', '✌️', '💜', '💛', '💚', '💙', '❤️', '🧡', '🐺', '⭐']
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

let localSequence = 0
const activeTab = ref<'message' | 'groups'>('message')
const initialEventDate = useState('animation-events-initial-date', () => nextSaturday())
const form = ref(createBlankEvent(initialEventDate.value))
const selectedEvent = ref<AnimationEvent | null>(null)
const selectedSlotId = ref('')
const groupPlanDirty = ref(false)
const groupPlanSettling = ref(false)
const baseline = ref('')
const lastSavedPayloadSignature = ref('')
const busy = ref(false)
const loadingItem = ref(false)
const syncing = ref(false)
const preview = ref<AnimationEventPreviewResponse['preview'] | null>(null)
const previewDirty = ref(true)
const validationErrors = ref<string[]>([])
const feedback = reactive({ kind: '' as '' | 'success' | 'error', text: '' })
const autosaveState = ref<AutosaveState>('idle')
const autosaveRetryRequired = ref(false)
const requestIds = new Map<string, string>()
let pollTimer: number | null = null
let autosaveTimer: number | null = null
let autosaveGeneration = 0
const revisionConflict = ref(false)

const {
  data: listResponse,
  error: listError,
  status: listStatus,
  refresh: refreshList,
  clear: clearList,
} = await useFetch<AnimationEventListResponse>('/api/admin/animation-events', {
  key: 'admin-animation-events',
  server: false,
  lazy: true,
  retry: 0,
  timeout: 60_000,
  default: () => ({ events: [] }),
  getCachedData: (key, nuxtApp) => (nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined),
})

const events = computed(() => listResponse.value?.events || [])
const loadingHistory = computed(
  () =>
    events.value.length === 0 && (listStatus.value === 'idle' || listStatus.value === 'pending'),
)
const isExisting = computed(() => Boolean(form.value.id))
const isManaged = computed(() => selectedEvent.value?.kind !== 'legacy')
const isPublished = computed(() => form.value.status === 'published')
const isEditable = computed(
  () => isManaged.value && (!isExisting.value || EDITABLE_STATUSES.has(form.value.status)),
)
const canScheduleOrPublish = computed(
  () => isEditable.value && ['draft', 'scheduled'].includes(form.value.status),
)
const isDirty = computed(() => JSON.stringify(form.value) !== baseline.value)
const editorLocked = computed(
  () => busy.value || loadingItem.value || autosaveRetryRequired.value || revisionConflict.value,
)
const autosaveMessage = computed(() => {
  if (revisionConflict.value) {
    return 'Cet événement a été modifié ailleurs. Recharge-le depuis l’historique avant de continuer.'
  }
  if (autosaveRetryRequired.value) {
    return 'Résultat de sauvegarde incertain. Réessaie avec le bouton manuel sans modifier le formulaire.'
  }
  if (isPublished.value && isDirty.value) {
    return 'Validation manuelle requise pour modifier le message déjà publié sur Discord.'
  }

  const messages: Record<AutosaveState, string> = {
    idle: isDirty.value ? 'Modifications non enregistrées.' : '',
    pending: 'Enregistrement automatique dans un instant…',
    saving: 'Enregistrement automatique…',
    saved: 'Modifications enregistrées automatiquement.',
    blocked: 'Enregistrement automatique en attente : vérifie les champs obligatoires.',
    error: 'Échec de l’enregistrement automatique. Le bouton manuel reste disponible.',
  }

  return messages[autosaveState.value]
})
const groupPlannerUnavailableMessage = computed(() => {
  if (revisionConflict.value) {
    return 'Recharge l’événement depuis l’historique avant de modifier les groupes.'
  }
  if (autosaveRetryRequired.value) {
    return 'Réessaie d’abord l’enregistrement du message depuis l’onglet Message.'
  }
  if (syncing.value) return 'Synchronisation Discord en cours…'
  if (busy.value) return 'Mise à jour de l’événement en cours…'

  return ''
})
const totalSlots = computed(() => form.value.items.flatMap((item) => item.slots).length)
const availableSlots = computed(
  () =>
    selectedEvent.value?.items.flatMap((item) =>
      item.slots.map((slot) => ({
        item,
        slot,
        label: `${item.title} · ${slot.emoji} ${slot.label}`,
      })),
    ) || [],
)
const selectedSlot = computed<AnimationEventSlot | null>(
  () => availableSlots.value.find(({ slot }) => slot.id === selectedSlotId.value)?.slot || null,
)

baseline.value = JSON.stringify(form.value)
lastSavedPayloadSignature.value = JSON.stringify(requestPayload())

watch(
  form,
  () => {
    previewDirty.value = true
    queueAutosave()
  },
  { deep: true, flush: 'post' },
)

watch(
  availableSlots,
  (slots) => {
    if (!slots.some(({ slot }) => slot.id === selectedSlotId.value)) {
      selectedSlotId.value = slots[0]?.slot.id || ''
    }
  },
  { immediate: true },
)

function currentParisDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Paris',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function dateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function addDays(value: string, days: number) {
  const date = dateOnly(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateOnly(date)
}

function nextSaturday() {
  const today = currentParisDate()
  const date = dateOnly(today)
  if (!date) return today
  // Keep the default publication Sunday in the future, even late in the week.
  const distance = ((6 - date.getUTCDay() + 7) % 7 || 7) + 7
  return addDays(today, distance)
}

function previousSunday(value: string) {
  const date = dateOnly(value)
  if (!date) return value
  const daysSinceSunday = date.getUTCDay() || 7
  return addDays(value, -daysSinceSunday)
}

function localId(prefix: string) {
  localSequence += 1
  return `${prefix}-${localSequence}`
}

function createSlot(source: Partial<EditableSlot> = {}): EditableSlot {
  return {
    localId: localId('slot'),
    ...(source.id ? { id: source.id } : {}),
    label: source.label || 'Je participe',
    emoji: source.emoji || '',
    capacity: source.capacity ?? null,
  }
}

function createItem(source: Partial<EditableItem> = {}): EditableItem {
  return {
    localId: localId('item'),
    ...(source.id ? { id: source.id } : {}),
    title: source.title || '',
    eventDate: source.eventDate ?? nextSaturday(),
    startTime: source.startTime ?? '20:00',
    meetingTime: source.meetingTime || '',
    location: source.location || '',
    details: source.details || '',
    slots: source.slots?.map((slot) => createSlot(slot)) || [createSlot()],
  }
}

function createBlankEvent(eventDate = nextSaturday()): EditableEvent {
  return {
    id: null,
    expectedRevisionId: null,
    status: 'draft',
    title: '',
    intro: 'Hello la meute ! Une nouvelle animation arrive.',
    outro: 'Merci de réagir uniquement si vous êtes disponibles.',
    publishWindow: {
      date: previousSunday(eventDate),
      startTime: '17:00',
      endTime: '19:00',
      timeZone: ANIMATION_EVENT_TIME_ZONE,
    },
    items: [createItem({ eventDate })],
    scheduledFor: null,
    discordUrl: null,
  }
}

function mapEventToForm(event: AnimationEvent): EditableEvent {
  return {
    id: event.id,
    expectedRevisionId: event.revisionId,
    status: event.status,
    title: event.title,
    intro: event.intro,
    outro: event.outro,
    publishWindow: event.publishWindow
      ? { ...event.publishWindow }
      : {
          date: '',
          startTime: '',
          endTime: '',
          timeZone: ANIMATION_EVENT_TIME_ZONE,
        },
    items: event.items.map((item) =>
      createItem({
        id: item.id,
        title: item.title,
        eventDate: item.eventDate ?? '',
        startTime: item.startTime ?? '',
        meetingTime: item.meetingTime || '',
        location: item.location,
        details: item.details,
        slots: item.slots.map((slot) => ({
          localId: '',
          id: slot.id,
          label: slot.label,
          emoji: slot.emoji || '',
          capacity: slot.capacity,
        })),
      }),
    ),
    scheduledFor: event.scheduledFor,
    discordUrl: event.discordUrl,
  }
}

function requestPayload(): AnimationEventDraft {
  return {
    title: form.value.title.trim(),
    intro: form.value.intro.trim(),
    outro: form.value.outro.trim(),
    timeZone: ANIMATION_EVENT_TIME_ZONE,
    publishWindow: { ...form.value.publishWindow },
    items: form.value.items.map((item): AnimationEventItemDraft => ({
      ...(item.id ? { id: item.id } : {}),
      title: item.title.trim(),
      eventDate: item.eventDate,
      startTime: item.startTime,
      meetingTime: item.meetingTime || null,
      location: item.location.trim(),
      details: item.details.trim(),
      slots: item.slots.map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        label: slot.label.trim(),
        emoji: slot.emoji.trim() || null,
        capacity:
          typeof slot.capacity === 'number' && Number.isFinite(slot.capacity)
            ? slot.capacity
            : null,
      })),
    })),
  }
}

function resetToNew() {
  if (
    busy.value ||
    loadingItem.value ||
    syncing.value ||
    groupPlanSettling.value ||
    autosaveRetryRequired.value ||
    !confirmDiscardChanges()
  ) {
    return
  }
  cancelAutosave()
  autosaveRetryRequired.value = false
  revisionConflict.value = false
  form.value = createBlankEvent()
  selectedEvent.value = null
  groupPlanDirty.value = false
  activeTab.value = 'message'
  preview.value = null
  previewDirty.value = true
  baseline.value = JSON.stringify(form.value)
  lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
  clearFeedback()
}

function clearFeedback() {
  feedback.kind = ''
  feedback.text = ''
  validationErrors.value = []
}

function setFeedback(kind: 'success' | 'error', text: string) {
  feedback.kind = kind
  feedback.text = text
}

function showError(error: unknown, fallback: string) {
  const source = error as { data?: { statusMessage?: string }; message?: string }
  setFeedback('error', source.data?.statusMessage || source.message || fallback)
}

function releaseRequestIdAfterError(error: unknown, key: string) {
  if (shouldReleaseMutationRequestId(error)) requestIds.delete(key)
}

function confirmDiscardChanges() {
  return (
    (!isDirty.value && !groupPlanDirty.value) ||
    window.confirm('Abandonner les modifications non enregistrées ?')
  )
}

function addItem() {
  if (form.value.items.length >= ANIMATION_EVENT_MAX_ITEMS) return
  form.value.items.push(
    createItem({ eventDate: form.value.items.at(-1)?.eventDate || nextSaturday() }),
  )
}

function removeItem(localItemId: string) {
  if (form.value.items.length <= 1) return
  form.value.items = form.value.items.filter((item) => item.localId !== localItemId)
}

function moveItem(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.items.length) return
  const [item] = form.value.items.splice(index, 1)
  if (item) form.value.items.splice(targetIndex, 0, item)
}

function addSlot(item: EditableItem) {
  if (totalSlots.value >= ANIMATION_EVENT_MAX_SLOTS) return
  const suggestion = EVENT_EMOJI_SUGGESTIONS.find(
    (emoji) => !form.value.items.some((entry) => entry.slots.some((slot) => slot.emoji === emoji)),
  )
  item.slots.push(createSlot({ label: 'Nouvelle catégorie', emoji: suggestion || '' }))
}

function removeSlot(item: EditableItem, localSlotId: string) {
  if (item.slots.length <= 1) return
  item.slots = item.slots.filter((slot) => slot.localId !== localSlotId)
}

function moveSlot(item: EditableItem, index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= item.slots.length) return
  const [slot] = item.slots.splice(index, 1)
  if (slot) item.slots.splice(targetIndex, 0, slot)
}

function moveSlotToItem(sourceItem: EditableItem, localSlotId: string, event: Event) {
  const select = event.target as HTMLSelectElement
  const target = form.value.items.find((item) => item.localId === select.value)
  if (!target || target.localId === sourceItem.localId) return
  if (sourceItem.slots.length <= 1) {
    select.value = sourceItem.localId
    setFeedback(
      'error',
      'Un événement doit conserver au moins une catégorie. Ajoute-en une avant de déplacer celle-ci.',
    )
    return
  }
  const slotIndex = sourceItem.slots.findIndex((slot) => slot.localId === localSlotId)
  if (slotIndex < 0) return
  const [slot] = sourceItem.slots.splice(slotIndex, 1)
  if (slot) target.slots.push(slot)
}

function validateForm() {
  const result = validateAnimationEventDraft(requestPayload())
  validationErrors.value = result.success
    ? []
    : [...new Set(result.issues.map((issue) => issue.message))]
  return result.success
}

function canAutosaveDraft() {
  return validateAnimationEventDraft(requestPayload()).success
}

function cancelAutosave(resetState = true) {
  autosaveGeneration += 1
  if (autosaveTimer !== null && import.meta.client) window.clearTimeout(autosaveTimer)
  autosaveTimer = null
  if (resetState) autosaveState.value = 'idle'
}

function queueAutosave() {
  if (!import.meta.client) return
  cancelAutosave(false)

  if (!isDirty.value) {
    if (autosaveState.value !== 'saved') autosaveState.value = 'idle'
    return
  }
  if (autosaveRetryRequired.value) {
    autosaveState.value = 'error'
    return
  }
  if (revisionConflict.value) {
    autosaveState.value = 'error'
    return
  }
  if (!isEditable.value) {
    autosaveState.value = 'idle'
    return
  }
  if (isPublished.value) {
    autosaveState.value = 'blocked'
    return
  }

  autosaveState.value = 'pending'
  const generation = autosaveGeneration
  autosaveTimer = window.setTimeout(() => {
    if (generation === autosaveGeneration) void runAutosave()
  }, 900)
}

async function runAutosave() {
  autosaveTimer = null
  if (!isDirty.value) return
  if (busy.value || loadingItem.value || syncing.value) {
    queueAutosave()
    return
  }
  if (!isEditable.value || isPublished.value) {
    autosaveState.value = isPublished.value ? 'blocked' : 'idle'
    return
  }
  if (isExisting.value && JSON.stringify(requestPayload()) === lastSavedPayloadSignature.value) {
    baseline.value = JSON.stringify(form.value)
    autosaveState.value = 'saved'
    return
  }
  if (!canAutosaveDraft()) {
    autosaveState.value = 'blocked'
    return
  }

  autosaveState.value = 'saving'
  const saved = await persistDraft()
  if (!saved) {
    autosaveState.value = 'error'
    return
  }

  autosaveState.value = 'saved'
}

function mutationKey(scope: string, payload: object) {
  return `${scope}:${JSON.stringify(payload)}`
}

function requestId(key: string) {
  const existing = requestIds.get(key)
  if (existing) return existing
  const created = globalThis.crypto.randomUUID()
  requestIds.set(key, created)
  return created
}

async function loadEvent(id: string, allowWhileSyncing = false) {
  if (
    busy.value ||
    loadingItem.value ||
    groupPlanSettling.value ||
    autosaveRetryRequired.value ||
    (syncing.value && !allowWhileSyncing) ||
    !confirmDiscardChanges()
  ) {
    return
  }
  cancelAutosave()
  loadingItem.value = true
  clearFeedback()
  try {
    const response = await $fetch<AnimationEventResponse>(
      `/api/admin/animation-events/${encodeURIComponent(id)}`,
    )
    selectedEvent.value = response.event
    groupPlanDirty.value = false
    form.value = mapEventToForm(response.event)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    autosaveRetryRequired.value = false
    revisionConflict.value = false
    preview.value = null
    previewDirty.value = true
    activeTab.value = response.event.kind === 'legacy' ? 'groups' : 'message'
  } catch (error) {
    showError(error, "Impossible de charger l'événement.")
  } finally {
    loadingItem.value = false
  }
}

async function syncEvents() {
  if (
    busy.value ||
    loadingItem.value ||
    syncing.value ||
    groupPlanSettling.value ||
    autosaveRetryRequired.value
  ) {
    return
  }
  if (isDirty.value || groupPlanDirty.value) {
    setFeedback(
      'error',
      'Attends l’enregistrement du message et des groupes avant de synchroniser Discord.',
    )
    return
  }
  cancelAutosave()
  syncing.value = true
  clearFeedback()
  try {
    listResponse.value = await $fetch<AnimationEventListResponse>(
      '/api/admin/animation-events/sync',
      { method: 'POST' },
    )
    if (selectedEvent.value) await loadEvent(selectedEvent.value.id, true)
    setFeedback('success', 'Les derniers messages et réactions Discord ont été synchronisés.')
  } catch (error) {
    showError(error, 'La synchronisation Discord a échoué.')
  } finally {
    syncing.value = false
  }
}

async function requestPreview() {
  clearFeedback()
  if (!validateForm()) {
    setFeedback('error', "Corrige le formulaire avant de générer l'aperçu.")
    return
  }
  busy.value = true
  try {
    const response = await $fetch<AnimationEventPreviewResponse>(
      '/api/admin/animation-events/preview',
      { method: 'POST', body: { event: requestPayload() } },
    )
    preview.value = response.preview
    previewDirty.value = false
  } catch (error) {
    showError(error, "L'aperçu BigBadBot n'a pas pu être généré.")
  } finally {
    busy.value = false
  }
}

async function persistDraft() {
  clearFeedback()
  if (!validateForm()) {
    setFeedback('error', 'Corrige les champs signalés avant d’enregistrer.')
    return null
  }
  busy.value = true
  const event = requestPayload()
  const scope = form.value.id ? `update:${form.value.id}` : 'create'
  const payload = form.value.id
    ? { event, expectedRevisionId: form.value.expectedRevisionId }
    : { event }
  const key = mutationKey(scope, payload)
  const idempotencyKey = requestId(key)
  try {
    const response = form.value.id
      ? await $fetch<AnimationEventResponse>(
          `/api/admin/animation-events/${encodeURIComponent(form.value.id)}`,
          {
            method: 'PUT',
            body: {
              requestId: idempotencyKey,
              expectedRevisionId: form.value.expectedRevisionId,
              event,
            },
          },
        )
      : await $fetch<AnimationEventResponse>('/api/admin/animation-events', {
          method: 'POST',
          body: { requestId: idempotencyKey, event },
        })
    requestIds.delete(key)
    autosaveRetryRequired.value = false
    revisionConflict.value = false
    selectedEvent.value = response.event
    form.value = mapEventToForm(response.event)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    await refreshList()
    return response.event
  } catch (error) {
    autosaveRetryRequired.value = mutationOutcomeIsUnknown(error)
    if (mutationErrorCode(error) === 'stale_revision') revisionConflict.value = true
    releaseRequestIdAfterError(error, key)
    showError(error, "Le brouillon n'a pas pu être enregistré. Tu peux réessayer sans le modifier.")
    return null
  } finally {
    busy.value = false
  }
}

async function saveDraft() {
  if (
    isPublished.value &&
    !window.confirm(
      'Mettre à jour ce même message sur Discord ? BigBadBot protégera l’historique des réactions et refusera tout changement incompatible.',
    )
  ) {
    return
  }
  cancelAutosave()
  const saved = await persistDraft()
  if (!saved) return
  setFeedback(
    'success',
    saved.status === 'published'
      ? 'Le message Discord publié a été mis à jour sans perdre l’historique des réactions.'
      : 'Brouillon enregistré dans BigBadBot.',
  )
}

async function runAction(action: AnimationEventAction) {
  if (groupPlanSettling.value) return
  const confirmations: Record<AnimationEventAction, string> = {
    schedule: 'Programmer cette annonce dans la plage indiquée ?',
    publish_now: 'Publier maintenant ce message et ses réactions sur Discord ?',
    cancel: 'Annuler cette publication programmée ?',
    retry: 'Relancer la publication ?',
    duplicate: 'Créer un nouveau brouillon à partir de cet événement ?',
  }
  const discardsLocalChanges =
    ['duplicate', 'cancel'].includes(action) && (isDirty.value || groupPlanDirty.value)
  if (
    discardsLocalChanges &&
    !window.confirm(
      'Cette action ignorera les modifications non enregistrées du message ou des groupes. Continuer ?',
    )
  ) {
    return
  }
  if (!discardsLocalChanges && groupPlanDirty.value && !confirmDiscardChanges()) return
  if (!window.confirm(confirmations[action])) return
  cancelAutosave()
  groupPlanDirty.value = false

  let eventId = form.value.id
  if (!eventId) {
    const saved = await persistDraft()
    if (!saved) return
    eventId = saved.id
  } else if (isDirty.value && action !== 'duplicate' && action !== 'cancel') {
    const saved = await persistDraft()
    if (!saved) return
    eventId = saved.id
  }
  if (!eventId || !form.value.expectedRevisionId) return

  busy.value = true
  clearFeedback()
  const payload = { action, expectedRevisionId: form.value.expectedRevisionId }
  const key = mutationKey(`action:${eventId}`, payload)
  try {
    const response = await $fetch<AnimationEventResponse>(
      `/api/admin/animation-events/${encodeURIComponent(eventId)}/action`,
      {
        method: 'POST',
        body: { ...payload, requestId: requestId(key) },
      },
    )
    requestIds.delete(key)
    revisionConflict.value = false
    selectedEvent.value = response.event
    form.value = mapEventToForm(response.event)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    activeTab.value = response.event.status === 'draft' ? 'message' : activeTab.value
    await refreshList()
    setFeedback(
      'success',
      action === 'duplicate'
        ? 'Nouveau brouillon créé.'
        : action === 'publish_now'
          ? 'Publication confiée à BigBadBot.'
          : 'Action enregistrée.',
    )
  } catch (error) {
    releaseRequestIdAfterError(error, key)
    showError(error, "BigBadBot n'a pas pu appliquer cette action. Tu peux réessayer.")
  } finally {
    busy.value = false
  }
}

function updateGroupConfig(config: AnimationEventGroupConfig) {
  const slot = selectedSlot.value
  if (slot) slot.groupConfig = config
}

async function changeActiveTab(tab: 'message' | 'groups') {
  if (tab === activeTab.value || busy.value || syncing.value || groupPlanSettling.value) {
    return
  }
  if (tab === 'groups' && (autosaveRetryRequired.value || revisionConflict.value)) {
    return
  }
  if (groupPlanDirty.value && !confirmDiscardChanges()) return

  if (tab === 'groups' && isDirty.value) {
    cancelAutosave()
    if (isPublished.value) {
      setFeedback(
        'error',
        'Valide manuellement la mise à jour du message Discord avant d’ouvrir les groupes.',
      )
      return
    }

    await runAutosave()
    if (isDirty.value) {
      if (autosaveState.value === 'blocked') {
        setFeedback(
          'error',
          'Complète les champs obligatoires avant d’ouvrir les participants et les groupes.',
        )
      }
      return
    }
  }

  groupPlanDirty.value = false
  activeTab.value = tab
}

function changeSelectedSlot(event: Event) {
  const select = event.target as HTMLSelectElement
  if (
    busy.value ||
    syncing.value ||
    groupPlanSettling.value ||
    autosaveRetryRequired.value ||
    revisionConflict.value
  ) {
    select.value = selectedSlotId.value
    return
  }
  const nextSlotId = select.value
  if (nextSlotId === selectedSlotId.value) return
  if (groupPlanDirty.value && !confirmDiscardChanges()) {
    select.value = selectedSlotId.value
    return
  }
  groupPlanDirty.value = false
  selectedSlotId.value = nextSlotId
}

function displayDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function statusLabel(status: AnimationEventStatus) {
  const labels: Record<AnimationEventStatus, string> = {
    imported: 'Importé',
    draft: 'Brouillon',
    scheduled: 'Programmé',
    publishing: 'Publication en cours',
    published: 'Publié',
    failed: 'À vérifier',
    missed: 'Diffusion manquée',
    cancelled: 'Annulé',
  }
  return labels[status]
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value && !groupPlanDirty.value && !groupPlanSettling.value) return
  event.preventDefault()
  event.returnValue = ''
}

async function pollLiveEvents() {
  if (busy.value || loadingItem.value || groupPlanSettling.value) return
  if (!events.value.some((event) => ['scheduled', 'publishing'].includes(event.status))) return
  await refreshList()
  const current = selectedEvent.value
  if (!current || isDirty.value || groupPlanDirty.value) return
  const summary = events.value.find((event) => event.id === current.id)
  if (summary && (summary.status !== current.status || summary.updatedAt !== current.updatedAt)) {
    await loadEvent(current.id)
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  pollTimer = window.setInterval(() => void pollLiveEvents(), 15_000)
})
onBeforeUnmount(() => {
  cancelAutosave()
  window.removeEventListener('beforeunload', beforeUnload)
  if (pollTimer !== null) window.clearInterval(pollTimer)
  clearList()
})
onBeforeRouteLeave(() => {
  if (busy.value || syncing.value || groupPlanSettling.value) return false
  const canLeave = confirmDiscardChanges()
  if (canLeave) cancelAutosave()
  return canLeave
})
</script>

<template>
  <div class="animation-admin">
    <aside class="animation-history" aria-labelledby="animation-history-title">
      <a class="animation-history__skip" href="#animation-workspace">Aller à l’éditeur</a>
      <header>
        <div>
          <p class="admin-eyebrow">BigBadBot</p>
          <h1 id="animation-history-title">Événements</h1>
        </div>
        <button
          type="button"
          class="admin-button admin-button--primary"
          :disabled="busy || loadingItem || syncing || groupPlanSettling || autosaveRetryRequired"
          @click="resetToNew"
        >
          + Nouveau
        </button>
      </header>
      <button
        type="button"
        class="admin-button animation-history__sync"
        :disabled="
          busy ||
          loadingItem ||
          syncing ||
          groupPlanSettling ||
          autosaveRetryRequired ||
          revisionConflict
        "
        @click="syncEvents"
      >
        {{ syncing ? 'Synchronisation…' : '↻ Synchroniser Discord' }}
      </button>

      <div class="animation-history__content">
        <AppLoadingState
          v-if="loadingHistory"
          label="Chargement des événements…"
          variant="list"
          :count="4"
        />
        <AppLoadingStatus
          v-else-if="listStatus === 'pending'"
          label="Actualisation des événements…"
        />
        <div v-if="listError" class="animation-history__state is-error" role="alert">
          <p>Les événements sont momentanément indisponibles.</p>
          <button
            type="button"
            class="admin-button"
            :disabled="listStatus === 'pending'"
            @click="refreshList()"
          >
            Réessayer
          </button>
        </div>
        <p v-else-if="!loadingHistory && events.length === 0" class="animation-history__state">
          Aucun message importé ou créé.
        </p>
        <div
          v-if="events.length"
          class="animation-history__list"
          role="region"
          aria-label="Historique des événements"
          tabindex="0"
        >
          <button
            v-for="event in events"
            :key="event.id"
            type="button"
            :class="['animation-history-card', { 'is-active': event.id === form.id }]"
            :disabled="busy || loadingItem || syncing || groupPlanSettling || autosaveRetryRequired"
            @click="loadEvent(event.id)"
          >
            <span class="animation-history-card__heading">
              <strong>{{ event.title }}</strong>
              <span :class="['animation-status', `is-${event.status}`]">
                {{ event.kind === 'legacy' ? 'Importé' : statusLabel(event.status) }}
              </span>
            </span>
            <span>{{ event.itemCount }} événement(s) · {{ event.slotCount }} catégorie(s)</span>
            <small
              >{{ event.participantCount }} participant(s) ·
              {{ displayDateTime(event.updatedAt) }}</small
            >
          </button>
        </div>
      </div>
    </aside>

    <section
      id="animation-workspace"
      class="animation-workspace"
      tabindex="-1"
      :aria-busy="!loadingItem && (busy || syncing || groupPlanSettling)"
    >
      <header class="animation-workspace__header">
        <div>
          <p class="admin-eyebrow">
            {{ selectedEvent?.kind === 'legacy' ? 'Message historique' : statusLabel(form.status) }}
          </p>
          <h2>{{ form.title || 'Nouvel événement d’animation' }}</h2>
          <p
            v-if="autosaveMessage"
            :class="[
              'animation-workspace__dirty',
              { 'is-saved': autosaveState === 'saved' && !isDirty },
            ]"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ autosaveMessage }}
          </p>
        </div>
        <div class="animation-workspace__actions">
          <a
            v-if="form.discordUrl && !loadingItem"
            class="admin-button"
            :href="form.discordUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir dans Discord ↗
          </a>
          <button
            v-if="form.id && isManaged"
            type="button"
            class="admin-button"
            :disabled="
              busy ||
              loadingItem ||
              syncing ||
              groupPlanSettling ||
              autosaveRetryRequired ||
              revisionConflict
            "
            @click="runAction('duplicate')"
          >
            Dupliquer
          </button>
          <button
            v-if="form.status === 'failed'"
            type="button"
            class="admin-button admin-button--primary"
            :disabled="
              busy ||
              loadingItem ||
              syncing ||
              groupPlanSettling ||
              autosaveRetryRequired ||
              revisionConflict
            "
            @click="runAction('retry')"
          >
            Relancer
          </button>
          <button
            v-if="form.status === 'scheduled'"
            type="button"
            class="admin-button admin-button--danger"
            :disabled="
              busy ||
              loadingItem ||
              syncing ||
              groupPlanSettling ||
              autosaveRetryRequired ||
              revisionConflict
            "
            @click="runAction('cancel')"
          >
            Annuler la diffusion
          </button>
        </div>
      </header>

      <p
        v-if="feedback.text"
        :class="['animation-feedback', `is-${feedback.kind}`]"
        :role="feedback.kind === 'error' ? 'alert' : 'status'"
      >
        {{ feedback.text }}
      </p>
      <div v-if="validationErrors.length" class="animation-validation" role="alert">
        <strong>Champs à vérifier</strong>
        <ul>
          <li v-for="issue in validationErrors" :key="issue">{{ issue }}</li>
        </ul>
      </div>
      <AppLoadingState
        v-if="loadingItem"
        label="Chargement de l’événement…"
        variant="detail"
        :count="3"
      />

      <template v-else>
        <nav v-if="form.id" class="animation-tabs" aria-label="Sections de l’événement">
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'message' }"
            :aria-current="activeTab === 'message' ? 'page' : undefined"
            :disabled="busy || syncing || groupPlanSettling"
            @click="changeActiveTab('message')"
          >
            Message
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'groups' }"
            :aria-current="activeTab === 'groups' ? 'page' : undefined"
            :disabled="
              busy || syncing || groupPlanSettling || autosaveRetryRequired || revisionConflict
            "
            @click="changeActiveTab('groups')"
          >
            Participants & groupes
          </button>
        </nav>

        <section v-if="activeTab === 'message'" class="animation-message-editor">
          <div v-if="selectedEvent?.kind === 'legacy'" class="animation-legacy-summary">
            <p class="animation-readonly">
              Ce message historique est importé en lecture seule. Discord ne fournit pas les dates
              d’ajout des réactions antérieures au suivi par BigBadBot.
            </p>
            <dl>
              <div>
                <dt>Auteur</dt>
                <dd>{{ selectedEvent.authorDisplayName || 'Auteur Discord' }}</dd>
              </div>
              <div>
                <dt>Message publié</dt>
                <dd>{{ displayDateTime(selectedEvent.publishedAt) }}</dd>
              </div>
            </dl>
            <article v-for="item in selectedEvent.items" :key="item.id">
              <h3>{{ item.title }}</h3>
              <p>Date et heure structurées non disponibles pour ce message historique.</p>
              <ul>
                <li v-for="slot in item.slots" :key="slot.id">
                  {{ slot.emoji }} {{ slot.label }} · {{ slot.participants.length }} réaction(s)
                </li>
              </ul>
            </article>
          </div>
          <p v-else-if="form.id && !isEditable" class="animation-readonly">
            Ce message ne peut pas être modifié dans son état actuel. S’il est en échec, utilise «
            Relancer » pour compléter sa publication ; duplique-le pour préparer un nouveau message.
          </p>

          <form v-else class="animation-form" @submit.prevent="saveDraft">
            <p v-if="isPublished" class="animation-live-notice" role="status">
              Ce message est déjà visible sur Discord. Tu peux corriger son contenu, ses événements
              et ses catégories : l’enregistrement modifiera le même message. BigBadBot refusera
              toutefois de supprimer ou de changer la réaction d’une catégorie qui possède déjà un
              historique, ainsi que de réduire une capacité sous le nombre de participants actifs.
              Toute modification doit être validée manuellement avec le bouton de mise à jour.
            </p>
            <fieldset class="animation-panel" :disabled="!isEditable || editorLocked">
              <legend>Message général</legend>
              <label>
                <span>Titre principal</span>
                <input
                  v-model.trim="form.title"
                  type="text"
                  :maxlength="ANIMATION_EVENT_MAX_TITLE_LENGTH"
                  required
                />
              </label>
              <label>
                <span>Introduction</span>
                <textarea
                  v-model="form.intro"
                  rows="4"
                  :maxlength="ANIMATION_EVENT_MAX_TEXT_LENGTH"
                />
              </label>
              <label>
                <span>Conclusion</span>
                <textarea
                  v-model="form.outro"
                  rows="3"
                  :maxlength="ANIMATION_EVENT_MAX_TEXT_LENGTH"
                />
              </label>
            </fieldset>

            <fieldset class="animation-panel" :disabled="!isEditable || editorLocked">
              <legend>Événements et inscriptions</legend>
              <p class="animation-help">
                Chaque catégorie obtient une réaction distincte. Par exemple 🔥 pour participer et
                ✌️ pour être bénévole.
              </p>
              <article
                v-for="(item, itemIndex) in form.items"
                :key="item.localId"
                class="animation-item"
              >
                <header>
                  <h3>Événement {{ itemIndex + 1 }}</h3>
                  <div class="animation-order-actions">
                    <button
                      type="button"
                      :disabled="itemIndex === 0"
                      :aria-label="`Monter l'événement ${itemIndex + 1}`"
                      @click="moveItem(itemIndex, -1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      :disabled="itemIndex === form.items.length - 1"
                      :aria-label="`Descendre l'événement ${itemIndex + 1}`"
                      @click="moveItem(itemIndex, 1)"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      :disabled="form.items.length <= 1"
                      :aria-label="`Supprimer l'événement ${itemIndex + 1}`"
                      @click="removeItem(item.localId)"
                    >
                      Supprimer
                    </button>
                  </div>
                </header>
                <div class="animation-item__fields">
                  <label class="is-wide">
                    <span>Nom</span>
                    <input
                      v-model.trim="item.title"
                      type="text"
                      :maxlength="ANIMATION_EVENT_MAX_TITLE_LENGTH"
                      required
                    />
                  </label>
                  <label>
                    <span>Date</span>
                    <input v-model="item.eventDate" type="date" required />
                  </label>
                  <label>
                    <span>Début</span>
                    <input v-model="item.startTime" type="time" required />
                  </label>
                  <label>
                    <span>Rendez-vous <small>(facultatif)</small></span>
                    <input v-model="item.meetingTime" type="time" />
                  </label>
                  <label class="is-wide">
                    <span>Lieu <small>(facultatif)</small></span>
                    <input
                      v-model.trim="item.location"
                      type="text"
                      :maxlength="ANIMATION_EVENT_MAX_LOCATION_LENGTH"
                    />
                  </label>
                  <label class="is-full">
                    <span>Informations pratiques <small>(facultatif)</small></span>
                    <textarea
                      v-model="item.details"
                      rows="3"
                      :maxlength="ANIMATION_EVENT_MAX_DETAILS_LENGTH"
                      placeholder="Tenue, contraintes, effectif recherché…"
                    />
                  </label>
                </div>

                <fieldset class="animation-slots">
                  <legend>Catégories de réaction</legend>
                  <article
                    v-for="(slot, slotIndex) in item.slots"
                    :key="slot.localId"
                    class="animation-slot"
                  >
                    <div class="animation-slot__fields">
                      <label>
                        <span>
                          Emoji
                          <small v-if="slot.id">(modifiable sans historique)</small>
                        </span>
                        <input
                          v-model.trim="slot.emoji"
                          type="text"
                          :maxlength="ANIMATION_EVENT_MAX_EMOJI_LENGTH"
                          placeholder="Auto"
                        />
                      </label>
                      <label class="is-wide">
                        <span>Libellé</span>
                        <input
                          v-model.trim="slot.label"
                          type="text"
                          :maxlength="ANIMATION_EVENT_MAX_SLOT_LABEL_LENGTH"
                          required
                        />
                      </label>
                      <label>
                        <span>Capacité</span>
                        <input
                          v-model.number="slot.capacity"
                          type="number"
                          min="1"
                          :max="ANIMATION_EVENT_MAX_CAPACITY"
                          placeholder="Illimitée"
                        />
                      </label>
                    </div>
                    <footer class="animation-slot__footer">
                      <label>
                        <span>Événement associé</span>
                        <select
                          :value="item.localId"
                          :disabled="form.items.length <= 1 || item.slots.length <= 1"
                          @change="moveSlotToItem(item, slot.localId, $event)"
                        >
                          <option
                            v-for="(targetItem, targetIndex) in form.items"
                            :key="targetItem.localId"
                            :value="targetItem.localId"
                          >
                            Événement {{ targetIndex + 1 }} · {{ targetItem.title || 'Sans nom' }}
                          </option>
                        </select>
                      </label>
                      <div class="animation-order-actions">
                        <button
                          type="button"
                          :disabled="slotIndex === 0"
                          :aria-label="`Monter la catégorie ${slotIndex + 1}`"
                          @click="moveSlot(item, slotIndex, -1)"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          :disabled="slotIndex === item.slots.length - 1"
                          :aria-label="`Descendre la catégorie ${slotIndex + 1}`"
                          @click="moveSlot(item, slotIndex, 1)"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          :disabled="item.slots.length <= 1"
                          :aria-label="`Supprimer la catégorie ${slotIndex + 1}`"
                          @click="removeSlot(item, slot.localId)"
                        >
                          Supprimer
                        </button>
                      </div>
                    </footer>
                  </article>
                  <button
                    type="button"
                    class="admin-button"
                    :disabled="totalSlots >= ANIMATION_EVENT_MAX_SLOTS"
                    @click="addSlot(item)"
                  >
                    + Catégorie
                  </button>
                </fieldset>
              </article>
              <button
                type="button"
                class="admin-button"
                :disabled="form.items.length >= ANIMATION_EVENT_MAX_ITEMS"
                @click="addItem"
              >
                + Ajouter un événement au message
              </button>
            </fieldset>

            <fieldset
              class="animation-panel"
              :disabled="!isEditable || isPublished || editorLocked"
            >
              <legend>Diffusion</legend>
              <p class="animation-help">
                BigBadBot choisira une minute aléatoire dans cette plage et la conservera après
                redémarrage.
              </p>
              <div class="animation-publish-window">
                <label
                  ><span>Date</span><input v-model="form.publishWindow.date" type="date" required
                /></label>
                <label
                  ><span>Entre</span
                  ><input v-model="form.publishWindow.startTime" type="time" required
                /></label>
                <label
                  ><span>Et</span><input v-model="form.publishWindow.endTime" type="time" required
                /></label>
              </div>
              <p v-if="form.scheduledFor">
                Diffusion prévue le {{ displayDateTime(form.scheduledFor) }}.
              </p>
            </fieldset>

            <div class="animation-form__actions">
              <button
                type="button"
                class="admin-button"
                :disabled="busy || syncing || autosaveRetryRequired || revisionConflict"
                @click="requestPreview"
              >
                {{ previewDirty ? 'Générer l’aperçu' : 'Actualiser l’aperçu' }}
              </button>
              <button
                v-if="isEditable"
                type="submit"
                class="admin-button"
                :disabled="busy || syncing || revisionConflict || (!isDirty && isExisting)"
              >
                {{
                  autosaveRetryRequired
                    ? 'Réessayer l’enregistrement'
                    : isPublished
                      ? 'Mettre à jour le message Discord'
                      : 'Enregistrer le brouillon'
                }}
              </button>
              <button
                v-if="canScheduleOrPublish"
                type="button"
                class="admin-button admin-button--primary"
                :disabled="busy || syncing || autosaveRetryRequired || revisionConflict"
                @click="runAction('schedule')"
              >
                Programmer
              </button>
              <button
                v-if="canScheduleOrPublish"
                type="button"
                class="admin-button admin-button--primary"
                :disabled="busy || syncing || autosaveRetryRequired || revisionConflict"
                @click="runAction('publish_now')"
              >
                Publier maintenant
              </button>
              <button
                v-if="form.status === 'missed'"
                type="button"
                class="admin-button admin-button--primary"
                :disabled="busy || syncing || autosaveRetryRequired || revisionConflict"
                @click="runAction('retry')"
              >
                Relancer
              </button>
            </div>
          </form>

          <aside v-if="preview" class="animation-preview" aria-labelledby="animation-preview-title">
            <header>
              <h3 id="animation-preview-title">Aperçu exact BigBadBot</h3>
              <span>{{ preview.characterCount }}/2 000</span>
            </header>
            <p v-if="previewDirty" class="animation-preview__stale">
              Le formulaire a changé : actualise l’aperçu avant
              {{ isPublished ? 'de modifier Discord' : 'publication' }}.
            </p>
            <pre>{{ preview.content }}</pre>
          </aside>
        </section>

        <section v-else class="animation-groups" aria-labelledby="animation-groups-title">
          <header>
            <div>
              <p class="admin-eyebrow">Réactions Discord</p>
              <h3 id="animation-groups-title">Participants et groupes</h3>
            </div>
            <label v-if="availableSlots.length">
              <span>Catégorie ou créneau</span>
              <select
                :value="selectedSlotId"
                :disabled="
                  busy || syncing || groupPlanSettling || autosaveRetryRequired || revisionConflict
                "
                @change="changeSelectedSlot"
              >
                <option v-for="entry in availableSlots" :key="entry.slot.id" :value="entry.slot.id">
                  {{ entry.label }}
                </option>
              </select>
            </label>
          </header>
          <p
            v-if="selectedEvent && !selectedEvent.historyComplete"
            class="animation-readonly"
            role="status"
          >
            La liste des réactions peut être incomplète : Discord n’a pas permis de reconstituer
            tout l’historique de cet événement. Une nouvelle synchronisation peut actualiser l’état
            courant, mais ne recréera pas les dates historiques manquantes.
          </p>
          <p v-if="!selectedEvent">Choisis un événement depuis l’historique.</p>
          <p v-else-if="availableSlots.length === 0">Aucune réaction suivie pour cet événement.</p>
          <p v-else-if="groupPlannerUnavailableMessage" role="status">
            {{ groupPlannerUnavailableMessage }}
          </p>
          <AdminAnimationGroupPlanner
            v-else-if="selectedSlot"
            :event-id="selectedEvent.id"
            :reaction-slot="selectedSlot"
            @saved="updateGroupConfig"
            @dirty-change="groupPlanDirty = $event"
            @settling-change="groupPlanSettling = $event"
          />
        </section>
      </template>
    </section>
  </div>
</template>

<style scoped>
.animation-admin {
  display: grid;
  grid-template-columns: minmax(17rem, 23rem) minmax(0, 1fr);
  gap: clamp(1.25rem, 3vw, 2.5rem);
  align-items: start;
}

.animation-history {
  position: sticky;
  top: 6rem;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  height: calc(100vh - 8rem);
  height: calc(100dvh - 8rem);
  min-width: 0;
  min-height: 0;
  max-height: calc(100vh - 8rem);
  max-height: calc(100dvh - 8rem);
}

.animation-history > header,
.animation-workspace__header,
.animation-workspace__actions,
.animation-form__actions,
.animation-groups > header,
.animation-preview > header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.animation-history > header,
.animation-workspace__header,
.animation-groups > header,
.animation-preview > header {
  justify-content: space-between;
}

.animation-history h1,
.animation-workspace h2,
.animation-groups h3,
.animation-preview h3 {
  margin: 0.15rem 0 0;
}

.animation-history__skip {
  position: absolute;
  padding: 0.6rem;
  color: white;
  background: #17214f;
  transform: translateY(-200%);
}

.animation-history__skip:focus {
  transform: translateY(0);
}

.animation-history__sync {
  width: 100%;
}

.animation-history__content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  overflow: hidden;
}

.animation-history__state {
  margin: 0;
  padding: 0.9rem;
  border-radius: 0.6rem;
  color: #717a9b;
  background: #f6f7fb;
}

.animation-history__state.is-error {
  color: #9d203a;
  background: #fbe9ed;
}

.animation-history__state > p {
  margin: 0 0 0.65rem;
}

.animation-history__list {
  display: grid;
  flex: 1;
  min-height: 0;
  gap: 0.55rem;
  padding: 0 0.25rem 0.25rem 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}

.animation-history-card {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  width: 100%;
  padding: 0.85rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.75rem;
  color: #28335f;
  background: white;
  text-align: left;
  cursor: pointer;
}

.animation-history-card.is-active {
  border-color: #5967b3;
  box-shadow: 0 0 0 2px rgb(89 103 179 / 15%);
}

.animation-history-card__heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.animation-history-card__heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.animation-history-card small,
.animation-history-card > span:not(.animation-history-card__heading) {
  color: #717a9b;
}

.animation-status {
  flex: none;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  color: #48527b;
  background: #edf0f7;
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
}

.animation-status.is-published,
.animation-status.is-scheduled {
  color: #17633b;
  background: #e3f7eb;
}

.animation-status.is-failed,
.animation-status.is-missed {
  color: #8f2535;
  background: #fdecef;
}

.animation-workspace {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.animation-workspace__header {
  align-items: flex-start;
}

.animation-workspace__actions,
.animation-form__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.animation-workspace__dirty {
  margin: 0.25rem 0 0;
  color: #a56509;
  font-weight: 800;
}

.animation-workspace__dirty.is-saved {
  color: #2f7658;
}

.animation-feedback,
.animation-validation,
.animation-readonly,
.animation-live-notice {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 0.75rem;
  background: #fff7df;
}

.animation-feedback.is-success {
  color: #17633b;
  background: #e3f7eb;
}

.animation-feedback.is-error,
.animation-validation {
  color: #8f2535;
  background: #fdecef;
}

.animation-live-notice {
  color: #7b4a1c;
  background: #fff3e7;
}

.animation-tabs {
  display: flex;
  gap: 0.4rem;
  padding: 0.3rem;
  border-radius: 0.75rem;
  background: #e8ebf4;
}

.animation-tabs button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 0.55rem;
  color: #59617f;
  background: transparent;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.animation-tabs button.is-active {
  color: #25368c;
  background: white;
  box-shadow: 0 0.2rem 0.8rem rgb(31 43 85 / 8%);
}

.animation-message-editor,
.animation-form,
.animation-panel,
.animation-groups {
  display: grid;
  gap: 1rem;
}

.animation-legacy-summary {
  display: grid;
  gap: 1rem;
}

.animation-legacy-summary dl,
.animation-legacy-summary article {
  margin: 0;
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: white;
}

.animation-legacy-summary dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.animation-legacy-summary dt {
  color: #717a9b;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.animation-legacy-summary dd,
.animation-legacy-summary h3,
.animation-legacy-summary p {
  margin: 0.2rem 0 0;
}

.animation-panel {
  margin: 0;
  padding: 1.15rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: white;
}

.animation-panel > legend,
.animation-slots > legend {
  padding: 0 0.35rem;
  color: #17214f;
  font-weight: 900;
}

.animation-panel label,
.animation-item__fields label,
.animation-slot label,
.animation-groups > header label {
  display: grid;
  gap: 0.35rem;
  color: #505b80;
  font-size: 0.82rem;
  font-weight: 800;
}

.animation-panel input,
.animation-panel textarea,
.animation-panel select,
.animation-groups select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #cfd5e6;
  border-radius: 0.6rem;
  color: #17214f;
  background: white;
  font: inherit;
}

.animation-panel textarea {
  resize: vertical;
}

.animation-help {
  margin: 0;
  color: #697291;
}

.animation-item {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e2e5ef;
  border-radius: 0.8rem;
  background: #f9faff;
}

.animation-item > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.animation-item h3 {
  margin: 0;
}

.animation-item > header button,
.animation-order-actions button {
  border: 0;
  color: #283b91;
  background: none;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.animation-order-actions button:last-child {
  color: #8f2535;
}

.animation-order-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.animation-item__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.animation-item__fields .is-wide {
  grid-column: span 2;
}

.animation-item__fields .is-full {
  grid-column: 1 / -1;
}

.animation-slots {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 1rem;
  border: 1px dashed #cbd2e5;
  border-radius: 0.7rem;
}

.animation-slot {
  display: grid;
  gap: 0.8rem;
  padding: 0.8rem;
  border-radius: 0.6rem;
  background: #f7f8fc;
}

.animation-slot__fields {
  display: grid;
  grid-template-columns: 7rem minmax(10rem, 1fr) 8rem;
  gap: 0.65rem;
  align-items: end;
}

.animation-slot__footer {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.animation-slot__footer label {
  width: min(100%, 24rem);
}

.animation-publish-window {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.animation-preview {
  padding: 1rem;
  border: 1px solid #dfe3f0;
  border-radius: 0.9rem;
  background: #17191f;
  color: #f7f7f8;
}

.animation-preview__stale {
  color: #ffd17c;
}

.animation-preview pre {
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  font: inherit;
  line-height: 1.6;
}

.animation-groups > header label {
  min-width: min(26rem, 100%);
}

@media (max-width: 1050px) {
  .animation-admin {
    grid-template-columns: 1fr;
  }

  .animation-history {
    position: static;
    grid-template-rows: none;
    height: auto;
    max-height: none;
  }

  .animation-history__list {
    max-height: 22rem;
    max-height: min(22rem, 45dvh);
  }
}

@media (max-width: 720px) {
  .animation-workspace__header,
  .animation-groups > header {
    display: grid;
  }

  .animation-workspace__actions,
  .animation-form__actions {
    justify-content: flex-start;
  }

  .animation-item__fields,
  .animation-publish-window,
  .animation-slot__fields,
  .animation-legacy-summary dl {
    grid-template-columns: 1fr;
  }

  .animation-item__fields .is-wide,
  .animation-item__fields .is-full,
  .animation-slot__fields .is-wide {
    grid-column: auto;
  }

  .animation-slot__footer {
    display: grid;
  }

  .animation-slot__footer .animation-order-actions {
    justify-content: flex-start;
  }
}
</style>
