<script setup lang="ts">
import {
  TRAINING_ANNOUNCEMENT_TIME_ZONE,
  type TrainingAnnouncement,
  type TrainingAnnouncementAction,
  type TrainingAnnouncementDraft,
  type TrainingAnnouncementEventDraft,
  type TrainingAnnouncementListResponse,
  type TrainingAnnouncementPublishWindow,
  type TrainingAnnouncementResponse,
  type TrainingAnnouncementStatus,
  type TrainingEventType,
} from '#shared/types/training-announcements'
import {
  TRAINING_ANNOUNCEMENT_EMOJI_SUGGESTIONS,
  TRAINING_ANNOUNCEMENT_MAX_CAPACITY,
  TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH,
  TRAINING_ANNOUNCEMENT_MAX_EVENTS,
  TRAINING_ANNOUNCEMENT_MAX_INTRO_LENGTH,
  TRAINING_ANNOUNCEMENT_MAX_OUTRO_LENGTH,
  TRAINING_ANNOUNCEMENT_MAX_TOPIC_LENGTH,
  validateTrainingAnnouncementDraft,
} from '#shared/training-announcements/validation'
import {
  mutationErrorCode,
  mutationOutcomeIsUnknown,
  shouldReleaseMutationRequestId,
} from '~/utils/autosave-mutation'

definePageMeta({
  layout: 'admin',
  middleware: 'training-announcements-admin',
})

useSeoMeta({
  title: 'Annonces d’entraînement · Wolves Admin',
  robots: 'noindex, nofollow',
})

interface EditableEvent {
  localId: string
  id?: string
  dayOffset: number
  startTime: string
  endTime: string
  types: TrainingEventType[]
  topic: string
  details: string
  emoji: string
  originalEmoji: string
  capacity: number
}

interface EditableAnnouncement {
  id: string | null
  expectedRevisionId: string | null
  status: TrainingAnnouncementStatus
  weekStart: string
  intro: string
  outro: string
  events: EditableEvent[]
  publishWindow: TrainingAnnouncementPublishWindow
  scheduledFor: string | null
  publishedAt: string | null
  discordUrl: string | null
}

type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'blocked' | 'error'

const DAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const
const EDITABLE_STATUSES = new Set<TrainingAnnouncementStatus>([
  'draft',
  'scheduled',
  'failed',
  'missed',
])
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
})
const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
})
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

let localEventSequence = 0

const initialWeekStart = useState('training-announcements-initial-week', () => nextMonday())
const form = ref<EditableAnnouncement>(createBlankAnnouncement(initialWeekStart.value))
const baseline = ref('')
const lastSavedPayloadSignature = ref('')
const busy = ref(false)
const loadingItem = ref(false)
const feedback = reactive({ kind: '' as 'success' | 'error' | '', text: '' })
const validationErrors = ref<string[]>([])
const autosaveState = ref<AutosaveState>('idle')
const autosaveRetryRequired = ref(false)
const mutationRequestIds = new Map<string, string>()
let historyPollTimer: number | null = null
let autosaveTimer: number | null = null
let autosaveGeneration = 0
const revisionConflict = ref(false)

const {
  data: listResponse,
  error: listError,
  status: listStatus,
  refresh: refreshHistory,
  clear: clearHistory,
} = await useFetch<TrainingAnnouncementListResponse>('/api/admin/training-announcements', {
  key: 'admin-training-announcements',
  server: false,
  lazy: true,
  retry: 0,
  timeout: 60_000,
  default: () => ({ announcements: [] }),
  getCachedData: (key, nuxtApp) => (nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined),
})

const announcements = computed(() => listResponse.value?.announcements || [])
const loadingHistory = computed(
  () =>
    announcements.value.length === 0 &&
    (listStatus.value === 'idle' || listStatus.value === 'pending'),
)
const isExisting = computed(() => Boolean(form.value.id))
const isPublished = computed(() => form.value.status === 'published')
const isEditable = computed(
  () => !isExisting.value || isPublished.value || EDITABLE_STATUSES.has(form.value.status),
)
const isDirty = computed(() => JSON.stringify(form.value) !== baseline.value)
const editorLocked = computed(
  () => busy.value || loadingItem.value || autosaveRetryRequired.value || revisionConflict.value,
)
const autosaveMessage = computed(() => {
  if (revisionConflict.value) {
    return 'Cette annonce a été modifiée ailleurs. Recharge-la depuis l’historique avant de continuer.'
  }
  if (autosaveRetryRequired.value) {
    return 'Résultat de sauvegarde incertain. Réessaie avec le bouton manuel sans modifier le formulaire.'
  }
  if (isPublished.value && isDirty.value) {
    return 'Validation manuelle requise pour modifier le message déjà publié sur Discord.'
  }
  if (autosaveState.value === 'blocked' && existingForSelectedWeek.value) {
    return 'Enregistrement automatique suspendu : une annonce existe déjà pour cette semaine.'
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
const existingForSelectedWeek = computed(
  () =>
    announcements.value.find(
      (announcement) =>
        announcement.id !== form.value.id &&
        announcement.weekStart === form.value.weekStart &&
        announcement.status !== 'cancelled',
    ) || null,
)
const sortedEvents = computed(() =>
  [...form.value.events].sort(
    (first, second) =>
      first.dayOffset - second.dayOffset || first.startTime.localeCompare(second.startTime),
  ),
)
const previewText = computed(() => buildPreview())
const previewCharacterCount = computed(() => [...previewText.value].length)
const previewTooLong = computed(() => previewCharacterCount.value > 2_000)

baseline.value = JSON.stringify(form.value)
lastSavedPayloadSignature.value = JSON.stringify(requestPayload())

function dateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12))

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number) {
  const date = dateOnly(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)

  return formatDateOnly(date)
}

function currentParisDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function nextMonday() {
  const today = currentParisDate()
  const date = dateOnly(today)
  if (!date) return today
  const daysSinceMonday = (date.getUTCDay() + 6) % 7

  return addDays(today, 7 - daysSinceMonday)
}

function precedingSunday(weekStart: string) {
  return addDays(weekStart, -1)
}

function createBlankAnnouncement(weekStart = nextMonday()): EditableAnnouncement {
  return {
    id: null,
    expectedRevisionId: null,
    status: 'draft',
    weekStart,
    intro: 'Hello la meute ! Voici les créneaux proposés pour la semaine à venir.',
    outro: 'Pensez à vous inscrire uniquement si vous êtes disponibles. À très vite !',
    events: [],
    publishWindow: {
      date: precedingSunday(weekStart),
      startTime: '17:00',
      endTime: '19:00',
      timeZone: TRAINING_ANNOUNCEMENT_TIME_ZONE,
    },
    scheduledFor: null,
    publishedAt: null,
    discordUrl: null,
  }
}

function createLocalEvent(
  dayOffset: number,
  source: Partial<Omit<EditableEvent, 'localId'>> = {},
): EditableEvent {
  localEventSequence += 1

  return {
    localId: `event-${localEventSequence}`,
    ...(source.id ? { id: source.id } : {}),
    dayOffset,
    startTime: source.startTime || '18:00',
    endTime: source.endTime || '20:00',
    types: source.types ? [...source.types] : ['open_gym'],
    topic: source.topic || '',
    details: source.details || '',
    emoji: source.emoji || '',
    originalEmoji: source.originalEmoji || source.emoji || '',
    capacity: source.capacity ?? 40,
  }
}

function eventDayOffset(weekStart: string, date: string) {
  const week = dateOnly(weekStart)
  const event = dateOnly(date)
  if (!week || !event) return 0

  return Math.round((event.getTime() - week.getTime()) / 86_400_000)
}

function mapRecordToForm(record: TrainingAnnouncement): EditableAnnouncement {
  return {
    id: record.id,
    expectedRevisionId: record.revisionId,
    status: record.status,
    weekStart: record.weekStart,
    intro: record.intro,
    outro: record.outro,
    events: record.events.map((event) =>
      createLocalEvent(eventDayOffset(record.weekStart, event.date), event),
    ),
    publishWindow: { ...record.publishWindow },
    scheduledFor: record.scheduledFor,
    publishedAt: record.publishedAt,
    discordUrl: record.discordUrl,
  }
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

function showApiError(error: unknown, fallback: string) {
  const candidate = error as { data?: { statusMessage?: string }; message?: string }
  setFeedback('error', candidate.data?.statusMessage || candidate.message || fallback)
}

function mutationKey(scope: string, payload: object) {
  return `${scope}:${JSON.stringify(payload)}`
}

function mutationRequestId(key: string) {
  const existing = mutationRequestIds.get(key)
  if (existing) return existing

  const created = globalThis.crypto.randomUUID()
  mutationRequestIds.set(key, created)

  return created
}

function handleMutationError(error: unknown, fallback: string, key: string) {
  if (shouldReleaseMutationRequestId(error)) {
    mutationRequestIds.delete(key)
    showApiError(error, fallback)
    return
  }

  const candidate = error as { data?: { statusMessage?: string }; message?: string }
  const detail = candidate.data?.statusMessage || candidate.message || fallback
  setFeedback(
    'error',
    `${detail} Tu peux réessayer sans modifier le formulaire : la même requête sera reprise sans créer de doublon.`,
  )
}

function confirmDiscardChanges() {
  return !isDirty.value || window.confirm('Abandonner les modifications non enregistrées ?')
}

function resetToNew(weekStart = nextMonday()) {
  if (busy.value || loadingItem.value || autosaveRetryRequired.value || !confirmDiscardChanges()) {
    return
  }
  cancelAutosave()
  autosaveRetryRequired.value = false
  revisionConflict.value = false
  form.value = createBlankAnnouncement(weekStart)
  baseline.value = JSON.stringify(form.value)
  lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
  clearFeedback()
}

function addEvent(dayOffset: number) {
  if (form.value.events.length >= TRAINING_ANNOUNCEMENT_MAX_EVENTS) return
  form.value.events.push(createLocalEvent(dayOffset))
}

function removeEvent(localId: string) {
  form.value.events = form.value.events.filter((event) => event.localId !== localId)
}

function eventsForDay(dayOffset: number) {
  return form.value.events.filter((event) => event.dayOffset === dayOffset)
}

function dayDate(dayOffset: number) {
  return addDays(form.value.weekStart, dayOffset)
}

function displayDate(value: string, short = false) {
  const date = dateOnly(value)

  return date ? (short ? shortDateFormatter : dateFormatter).format(date) : value
}

function displayDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function onWeekChange() {
  const parsed = dateOnly(form.value.weekStart)
  if (!parsed) return
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7
  if (daysSinceMonday !== 0) {
    form.value.weekStart = addDays(form.value.weekStart, -daysSinceMonday)
  }
  form.value.publishWindow.date = precedingSunday(form.value.weekStart)
}

function moveWeek(direction: -1 | 1) {
  form.value.weekStart = addDays(form.value.weekStart, direction * 7)
  form.value.publishWindow.date = precedingSunday(form.value.weekStart)
}

function onWorkshopToggle(event: EditableEvent) {
  if (!event.types.includes('workshop')) event.topic = ''
}

function activitySummary(event: EditableEvent) {
  const activities: string[] = []
  if (event.types.includes('open_gym')) activities.push('Open Gym')
  if (event.types.includes('workshop')) activities.push('Atelier')
  if (activities.length === 0) return 'Activité à choisir'

  const details = [activities.join(' + ')]
  if (event.types.includes('workshop')) {
    details.push(event.topic.trim() || 'sujet à préciser')
  }
  if (event.types.includes('open_gym') && event.details.trim()) {
    details.push(event.details.trim())
  }

  return details.join(' · ')
}

const previewEmojis = computed(() => {
  const result = new Map<string, string>()
  const used = new Set<string>()

  for (const event of sortedEvents.value) {
    const emoji = event.emoji.trim() || event.originalEmoji
    if (!emoji) continue
    result.set(event.localId, emoji)
    used.add(emoji.replace(/[\uFE0E\uFE0F]/g, ''))
  }
  for (const event of sortedEvents.value) {
    if (result.has(event.localId)) continue
    const emoji =
      TRAINING_ANNOUNCEMENT_EMOJI_SUGGESTIONS.find(
        (suggestion) => !used.has(suggestion.replace(/[\uFE0E\uFE0F]/g, '')),
      ) || '•'
    result.set(event.localId, emoji)
    used.add(emoji.replace(/[\uFE0E\uFE0F]/g, ''))
  }

  return result
})

function displayTime(value: string) {
  const [hours = '', minutes = ''] = value.split(':')

  return minutes === '00' ? `${Number(hours)} h` : `${Number(hours)} h ${minutes}`
}

function displayNumericDate(value: string) {
  const date = dateOnly(value)
  if (!date) return value

  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function isoWeekNumber(value: string) {
  const source = dateOnly(value)
  if (!source) return ''
  const date = new Date(source)
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4, 12))
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))

  return String(1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000))
}

function buildPreview() {
  const weekEnd = addDays(form.value.weekStart, 6)
  const lines = [
    `[INSCRIPTION OG/ATELIERS SEMAINE ${isoWeekNumber(form.value.weekStart)} - du ${displayNumericDate(form.value.weekStart)} au ${displayNumericDate(weekEnd)}]`,
  ]
  if (form.value.intro.trim()) lines.push('', form.value.intro.trim())
  lines.push('')

  for (const event of sortedEvents.value) {
    lines.push(
      `• ${DAY_LABELS[event.dayOffset]} ${displayTime(event.startTime)}-${displayTime(event.endTime)} : ${activitySummary(event)} · limite à ${event.capacity} places (${previewEmojis.value.get(event.localId) || '•'})`,
    )
  }

  if (form.value.outro.trim()) lines.push('', form.value.outro.trim())
  lines.push('', `Référence Wolves : WLV-${form.value.id?.slice(0, 8).toUpperCase() || 'XXXXXXXX'}`)

  return lines.join('\n')
}

function validateForm() {
  const result = validateTrainingAnnouncementDraft(requestPayload())
  const issues = result.success ? [] : result.issues.map((issue) => issue.message)
  if (previewTooLong.value) {
    issues.push('Le message dépasse la limite Discord de 2 000 caractères.')
  }

  validationErrors.value = [...new Set(issues)]

  return validationErrors.value.length === 0
}

function canAutosaveDraft() {
  if (existingForSelectedWeek.value || previewTooLong.value) return false

  return validateTrainingAnnouncementDraft(requestPayload()).success
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
  if (busy.value || loadingItem.value) {
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

function requestPayload(): TrainingAnnouncementDraft {
  return {
    weekStart: form.value.weekStart,
    timeZone: TRAINING_ANNOUNCEMENT_TIME_ZONE,
    intro: form.value.intro.trim(),
    outro: form.value.outro.trim(),
    events: sortedEvents.value.map((event): TrainingAnnouncementEventDraft => ({
      ...(event.id ? { id: event.id } : {}),
      date: dayDate(event.dayOffset),
      startTime: event.startTime,
      endTime: event.endTime,
      types: event.types,
      topic: event.types.includes('workshop') ? event.topic.trim() : '',
      details: event.types.includes('open_gym') ? event.details.trim() : '',
      ...(event.emoji.trim() || event.originalEmoji
        ? { emoji: event.emoji.trim() || event.originalEmoji }
        : {}),
      capacity: event.capacity,
    })),
    publishWindow: { ...form.value.publishWindow },
  }
}

async function loadAnnouncement(id: string) {
  if (busy.value || loadingItem.value || autosaveRetryRequired.value || !confirmDiscardChanges()) {
    return
  }
  cancelAutosave()
  loadingItem.value = true
  clearFeedback()
  try {
    const response = await $fetch<TrainingAnnouncementResponse>(
      `/api/admin/training-announcements/${encodeURIComponent(id)}`,
    )
    form.value = mapRecordToForm(response.announcement)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    autosaveRetryRequired.value = false
    revisionConflict.value = false
  } catch (error) {
    showApiError(error, 'Impossible de charger cette annonce.')
  } finally {
    loadingItem.value = false
  }
}

async function persistDraft() {
  clearFeedback()
  if (existingForSelectedWeek.value) {
    setFeedback(
      'error',
      'Une annonce existe déjà pour cette semaine. Ouvre-la depuis l’historique pour la modifier.',
    )
    return null
  }
  if (!validateForm()) {
    setFeedback('error', 'Corrige les champs signalés avant d’enregistrer.')
    return null
  }

  busy.value = true
  const announcement = requestPayload()
  const scope = form.value.id ? `update:${form.value.id}` : 'create'
  const mutationPayload = form.value.id
    ? {
        announcement,
        expectedRevisionId: form.value.expectedRevisionId,
      }
    : { announcement }
  const key = mutationKey(scope, mutationPayload)
  const requestId = mutationRequestId(key)
  try {
    const response = form.value.id
      ? await $fetch<TrainingAnnouncementResponse>(
          `/api/admin/training-announcements/${encodeURIComponent(form.value.id)}`,
          {
            method: 'PUT',
            body: {
              requestId,
              announcement,
              expectedRevisionId: form.value.expectedRevisionId,
            },
          },
        )
      : await $fetch<TrainingAnnouncementResponse>('/api/admin/training-announcements', {
          method: 'POST',
          body: {
            requestId,
            announcement,
          },
        })

    mutationRequestIds.delete(key)
    autosaveRetryRequired.value = false
    revisionConflict.value = false
    form.value = mapRecordToForm(response.announcement)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    await refreshHistory()

    return response.announcement
  } catch (error) {
    autosaveRetryRequired.value = mutationOutcomeIsUnknown(error)
    if (mutationErrorCode(error) === 'stale_revision') revisionConflict.value = true
    handleMutationError(error, 'Le brouillon n’a pas pu être enregistré.', key)
    return null
  } finally {
    busy.value = false
  }
}

async function saveDraft() {
  if (
    isPublished.value &&
    !window.confirm(
      'Mettre à jour ce même message sur Discord ? BigBadBot protégera les réactions et inscriptions existantes et refusera tout changement incompatible.',
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
      ? 'Le message Discord publié a été mis à jour. Les réactions existantes sont conservées.'
      : saved.status === 'scheduled'
        ? 'Annonce enregistrée. BigBadBot a conservé ou recalculé l’heure selon la plage de diffusion.'
        : 'Brouillon enregistré.',
  )
}

async function runAction(
  action: Extract<TrainingAnnouncementAction, 'schedule' | 'publish_now' | 'cancel' | 'retry'>,
) {
  const confirmations = {
    schedule: 'Programmer cette annonce dans la plage de diffusion indiquée ?',
    publish_now: 'Publier cette annonce immédiatement sur Discord ?',
    cancel: 'Annuler définitivement cette annonce planifiée ?',
    retry: 'Relancer la publication de cette annonce ?',
  }
  if (
    action === 'cancel' &&
    isDirty.value &&
    !window.confirm(
      'Cette annulation ignorera les modifications encore non enregistrées. Continuer ?',
    )
  ) {
    return
  }
  if (!window.confirm(confirmations[action])) return
  cancelAutosave()

  let announcementId = form.value.id
  if (action !== 'cancel' && (!announcementId || isDirty.value)) {
    const saved = await persistDraft()
    if (!saved) return
    announcementId = saved.id
  }
  if (!announcementId) return

  busy.value = true
  clearFeedback()
  const actionPayload = {
    action,
    expectedRevisionId: form.value.expectedRevisionId,
  }
  const key = mutationKey(`action:${announcementId}`, actionPayload)
  const requestId = mutationRequestId(key)
  try {
    const response = await $fetch<TrainingAnnouncementResponse>(
      `/api/admin/training-announcements/${encodeURIComponent(announcementId)}/action`,
      {
        method: 'POST',
        body: {
          requestId,
          action,
          expectedRevisionId: form.value.expectedRevisionId,
        },
      },
    )
    mutationRequestIds.delete(key)
    form.value = mapRecordToForm(response.announcement)
    baseline.value = JSON.stringify(form.value)
    lastSavedPayloadSignature.value = JSON.stringify(requestPayload())
    await refreshHistory()
    const messages = {
      schedule: form.value.scheduledFor
        ? `Annonce programmée le ${displayDateTime(form.value.scheduledFor)}.`
        : 'Annonce programmée.',
      publish_now: 'Publication demandée à BigBadBot.',
      cancel: 'Annonce annulée.',
      retry: 'Nouvelle tentative demandée à BigBadBot.',
    }
    setFeedback('success', messages[action])
  } catch (error) {
    handleMutationError(error, 'BigBadBot n’a pas pu appliquer cette action.', key)
  } finally {
    busy.value = false
  }
}

function duplicateCurrent() {
  if (busy.value || loadingItem.value || autosaveRetryRequired.value || !confirmDiscardChanges()) {
    return
  }
  cancelAutosave()
  autosaveRetryRequired.value = false
  revisionConflict.value = false
  const duplicatedWeek = addDays(form.value.weekStart, 7)
  form.value = {
    ...createBlankAnnouncement(duplicatedWeek),
    intro: form.value.intro,
    outro: form.value.outro,
    events: form.value.events.map((event) =>
      createLocalEvent(event.dayOffset, {
        startTime: event.startTime,
        endTime: event.endTime,
        types: event.types,
        topic: event.topic,
        details: event.details,
        emoji: event.emoji,
        capacity: event.capacity,
      }),
    ),
  }
  baseline.value = ''
  lastSavedPayloadSignature.value = ''
  clearFeedback()
  setFeedback(
    'success',
    'Copie préparée pour la semaine suivante. Vérifie-la avant de l’enregistrer.',
  )
}

function statusLabel(status: TrainingAnnouncementStatus) {
  const labels: Record<TrainingAnnouncementStatus, string> = {
    draft: 'Brouillon',
    scheduled: 'Programmée',
    publishing: 'Publication en cours',
    published: 'Publiée',
    failed: 'À vérifier',
    missed: 'Diffusion manquée',
    cancelled: 'Annulée',
  }

  return labels[status]
}

function historyTiming(announcement: {
  status: TrainingAnnouncementStatus
  publishedAt: string | null
  scheduledFor: string | null
  updatedAt: string
}) {
  if (announcement.publishedAt) return `Publiée le ${displayDateTime(announcement.publishedAt)}`
  if (announcement.status === 'scheduled' && announcement.scheduledFor) {
    return `Prévue le ${displayDateTime(announcement.scheduledFor)}`
  }
  if (announcement.status === 'publishing') return 'Publication en cours…'
  if (announcement.status === 'cancelled') {
    return `Annulée le ${displayDateTime(announcement.updatedAt)}`
  }
  if (announcement.status === 'missed') {
    return `Diffusion manquée · ${displayDateTime(announcement.updatedAt)}`
  }
  if (announcement.status === 'failed') {
    return `Échec le ${displayDateTime(announcement.updatedAt)}`
  }

  return `Modifiée le ${displayDateTime(announcement.updatedAt)}`
}

async function refreshLiveAnnouncements() {
  if (
    busy.value ||
    loadingItem.value ||
    !announcements.value.some((announcement) =>
      ['scheduled', 'publishing'].includes(announcement.status),
    )
  ) {
    return
  }

  await refreshHistory()
  if (!form.value.id || isDirty.value) return

  const selected = announcements.value.find((announcement) => announcement.id === form.value.id)
  if (
    selected &&
    (selected.status !== form.value.status || selected.revisionId !== form.value.expectedRevisionId)
  ) {
    await loadAnnouncement(selected.id)
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

watch(form, queueAutosave, { deep: true, flush: 'post' })

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  historyPollTimer = window.setInterval(() => void refreshLiveAnnouncements(), 15_000)
})
onBeforeUnmount(() => {
  cancelAutosave()
  window.removeEventListener('beforeunload', beforeUnload)
  if (historyPollTimer !== null) window.clearInterval(historyPollTimer)
  clearHistory()
})
onBeforeRouteLeave(() => {
  if (busy.value) return false
  const canLeave = confirmDiscardChanges()
  if (canLeave) cancelAutosave()
  return canLeave
})
</script>

<template>
  <div class="announcements-admin">
    <aside class="announcements-history" aria-labelledby="announcement-history-title">
      <a class="announcements-history__skip" href="#announcement-editor">Aller à l’éditeur</a>
      <header>
        <div>
          <p class="admin-eyebrow">BigBadBot</p>
          <h1 id="announcement-history-title">Annonces</h1>
        </div>
        <button
          type="button"
          class="admin-button admin-button--primary"
          :disabled="busy || loadingItem || autosaveRetryRequired"
          @click="resetToNew()"
        >
          + Nouvelle
        </button>
      </header>

      <AppLoadingState
        v-if="loadingHistory"
        label="Chargement de l’historique…"
        variant="list"
        :count="4"
      />
      <AppLoadingStatus
        v-else-if="listStatus === 'pending'"
        label="Actualisation de l’historique…"
      />
      <div v-if="listError" class="announcements-history__state is-error" role="alert">
        <p>L’historique est momentanément indisponible.</p>
        <button
          type="button"
          class="admin-button"
          :disabled="listStatus === 'pending'"
          @click="refreshHistory()"
        >
          Réessayer
        </button>
      </div>
      <p
        v-else-if="!loadingHistory && announcements.length === 0"
        class="announcements-history__state"
      >
        Aucune annonce créée avec ce nouvel outil.
      </p>

      <div v-if="announcements.length" class="announcements-history__list">
        <button
          v-for="announcement in announcements"
          :key="announcement.id"
          type="button"
          :class="['announcement-history-card', { 'is-active': announcement.id === form.id }]"
          :aria-current="announcement.id === form.id ? 'true' : undefined"
          :disabled="busy || loadingItem || autosaveRetryRequired"
          @click="loadAnnouncement(announcement.id)"
        >
          <span class="announcement-history-card__heading">
            <strong>Semaine du {{ displayDate(announcement.weekStart, true) }}</strong>
            <span :class="['announcement-status', `is-${announcement.status}`]">
              {{ statusLabel(announcement.status) }}
            </span>
          </span>
          <span>{{ announcement.eventCount }} créneau(x)</span>
          <small>{{ historyTiming(announcement) }}</small>
        </button>
      </div>
    </aside>

    <section
      id="announcement-editor"
      class="announcement-editor"
      tabindex="-1"
      :aria-busy="busy && !loadingItem"
      aria-labelledby="announcement-editor-title"
    >
      <header class="announcement-editor__header">
        <div>
          <p class="admin-eyebrow">
            {{ isExisting ? statusLabel(form.status) : 'Nouvelle annonce' }}
          </p>
          <h2 id="announcement-editor-title">
            {{
              isExisting ? `Semaine du ${displayDate(form.weekStart, true)}` : 'Préparer la semaine'
            }}
          </h2>
          <p
            v-if="autosaveMessage"
            :class="[
              'announcement-editor__dirty',
              { 'is-saved': autosaveState === 'saved' && !isDirty },
            ]"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ autosaveMessage }}
          </p>
        </div>
        <div class="announcement-editor__header-actions">
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
            v-if="isExisting"
            type="button"
            class="admin-button"
            :disabled="busy || loadingItem || autosaveRetryRequired || revisionConflict"
            @click="duplicateCurrent"
          >
            Dupliquer
          </button>
          <button
            v-if="form.status === 'scheduled'"
            type="button"
            class="admin-button admin-button--danger"
            :disabled="busy || loadingItem || autosaveRetryRequired || revisionConflict"
            @click="runAction('cancel')"
          >
            Annuler la diffusion
          </button>
          <button
            v-if="form.status === 'failed' || form.status === 'missed'"
            type="button"
            class="admin-button admin-button--primary"
            :disabled="busy || loadingItem || autosaveRetryRequired || revisionConflict"
            @click="runAction('retry')"
          >
            Relancer
          </button>
        </div>
      </header>

      <p
        v-if="feedback.text"
        :class="['announcement-feedback', `is-${feedback.kind}`]"
        :role="feedback.kind === 'error' ? 'alert' : 'status'"
      >
        {{ feedback.text }}
      </p>

      <div v-if="validationErrors.length" class="announcement-validation" role="alert">
        <strong>Champs à vérifier</strong>
        <ul>
          <li v-for="issue in validationErrors" :key="issue">{{ issue }}</li>
        </ul>
      </div>

      <AppLoadingState
        v-if="loadingItem"
        label="Chargement de l’annonce…"
        variant="detail"
        :count="3"
      />

      <template v-else>
        <p v-if="isPublished" class="announcement-live-notice" role="status">
          Cette annonce est déjà visible sur Discord. L’enregistrement modifiera le même message
          sans en publier un nouveau. La semaine et la plage de diffusion restent verrouillées. Les
          autres champs peuvent être corrigés, mais BigBadBot refusera de supprimer un créneau, de
          changer sa réaction ou de réduire sa capacité si des inscriptions sont déjà liées. Toute
          modification doit être validée manuellement avec le bouton de mise à jour.
        </p>
        <p v-else-if="!isEditable" class="announcement-readonly">
          Cette annonce a déjà été traitée par BigBadBot. Duplique-la pour préparer une nouvelle
          semaine sans modifier son historique.
        </p>

        <form class="announcement-form" @submit.prevent="saveDraft">
          <fieldset
            :disabled="!isEditable || isPublished || editorLocked"
            class="announcement-panel"
          >
            <legend>Semaine concernée</legend>
            <div class="week-picker">
              <button type="button" aria-label="Semaine précédente" @click="moveWeek(-1)">←</button>
              <label>
                <span>Lundi de la semaine</span>
                <input v-model="form.weekStart" type="date" required @change="onWeekChange" />
              </label>
              <button type="button" aria-label="Semaine suivante" @click="moveWeek(1)">→</button>
            </div>
          </fieldset>

          <div v-if="existingForSelectedWeek" class="announcement-week-conflict" role="status">
            <p>Une annonce existe déjà pour cette semaine.</p>
            <button
              type="button"
              class="admin-button"
              :disabled="busy || loadingItem || autosaveRetryRequired"
              @click="loadAnnouncement(existingForSelectedWeek.id)"
            >
              Ouvrir l’annonce existante
            </button>
          </div>

          <fieldset :disabled="!isEditable || editorLocked" class="announcement-panel">
            <legend>Créneaux</legend>
            <p class="announcement-help">
              Ajoute les horaires utiles. Open Gym et Atelier peuvent être cochés ensemble.
            </p>

            <div class="training-days">
              <section
                v-for="(dayLabel, dayOffset) in DAY_LABELS"
                :key="dayLabel"
                class="training-day"
                :aria-labelledby="`training-day-${dayOffset}`"
              >
                <header>
                  <div>
                    <h3 :id="`training-day-${dayOffset}`">{{ dayLabel }}</h3>
                    <span>{{ displayDate(dayDate(dayOffset), true) }}</span>
                  </div>
                  <button
                    type="button"
                    :disabled="form.events.length >= TRAINING_ANNOUNCEMENT_MAX_EVENTS"
                    @click="addEvent(dayOffset)"
                  >
                    + Ajouter un créneau
                  </button>
                </header>

                <p v-if="eventsForDay(dayOffset).length === 0" class="training-day__empty">
                  Aucun entraînement prévu.
                </p>

                <fieldset
                  v-for="(event, eventIndex) in eventsForDay(dayOffset)"
                  :key="event.localId"
                  class="training-slot"
                >
                  <legend>Créneau {{ eventIndex + 1 }}</legend>
                  <div class="training-slot__times">
                    <label>
                      <span>Jour</span>
                      <select v-model.number="event.dayOffset">
                        <option
                          v-for="(optionLabel, optionOffset) in DAY_LABELS"
                          :key="optionLabel"
                          :value="optionOffset"
                        >
                          {{ optionLabel }}
                        </option>
                      </select>
                    </label>
                    <label>
                      <span>Début</span>
                      <input v-model="event.startTime" type="time" required />
                    </label>
                    <label>
                      <span>Fin</span>
                      <input v-model="event.endTime" type="time" required />
                    </label>
                    <label>
                      <span>Places</span>
                      <input
                        v-model.number="event.capacity"
                        type="number"
                        min="1"
                        :max="TRAINING_ANNOUNCEMENT_MAX_CAPACITY"
                        inputmode="numeric"
                        required
                      />
                    </label>
                  </div>

                  <fieldset class="training-slot__activities">
                    <legend>Activités</legend>
                    <label>
                      <input v-model="event.types" type="checkbox" value="open_gym" />
                      <span>Open Gym</span>
                    </label>
                    <label>
                      <input
                        v-model="event.types"
                        type="checkbox"
                        value="workshop"
                        @change="onWorkshopToggle(event)"
                      />
                      <span>Atelier</span>
                    </label>
                  </fieldset>

                  <label class="training-slot__subject">
                    <span>
                      Réaction Discord
                      <small>(facultatif pour un nouveau créneau)</small>
                    </span>
                    <input
                      v-model.trim="event.emoji"
                      type="text"
                      maxlength="32"
                      list="training-announcement-emojis"
                      inputmode="text"
                      placeholder="Auto"
                    />
                    <small v-if="event.id">
                      Modifiable seulement si aucune réaction n’a encore été enregistrée.
                    </small>
                  </label>

                  <label v-if="event.types.includes('workshop')" class="training-slot__subject">
                    <span>Sujet de l’atelier</span>
                    <input
                      v-model.trim="event.topic"
                      type="text"
                      :maxlength="TRAINING_ANNOUNCEMENT_MAX_TOPIC_LENGTH"
                      placeholder="Ex. tumbling, partner stunt, baskets…"
                      required
                    />
                  </label>

                  <label v-if="event.types.includes('open_gym')" class="training-slot__subject">
                    <span>Détail de l’Open Gym <small>(facultatif)</small></span>
                    <textarea
                      v-model="event.details"
                      rows="2"
                      :maxlength="TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH"
                      placeholder="Ex. travail libre, thème conseillé, matériel à prévoir…"
                    />
                    <small>
                      {{ event.details.length }}/{{ TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH }}
                    </small>
                  </label>

                  <button
                    type="button"
                    class="training-slot__remove"
                    :aria-label="`Supprimer le créneau ${eventIndex + 1} du ${dayLabel}`"
                    @click="removeEvent(event.localId)"
                  >
                    Supprimer ce créneau
                  </button>
                </fieldset>
              </section>
            </div>
            <datalist id="training-announcement-emojis">
              <option
                v-for="emoji in TRAINING_ANNOUNCEMENT_EMOJI_SUGGESTIONS"
                :key="emoji"
                :value="emoji"
              />
            </datalist>
          </fieldset>

          <fieldset
            :disabled="!isEditable || editorLocked"
            class="announcement-panel announcement-copy"
          >
            <legend>Texte du message</legend>
            <label>
              <span>Introduction</span>
              <textarea
                v-model="form.intro"
                rows="4"
                :maxlength="TRAINING_ANNOUNCEMENT_MAX_INTRO_LENGTH"
              />
              <small>{{ form.intro.length }}/{{ TRAINING_ANNOUNCEMENT_MAX_INTRO_LENGTH }}</small>
            </label>
            <label>
              <span>Conclusion</span>
              <textarea
                v-model="form.outro"
                rows="4"
                :maxlength="TRAINING_ANNOUNCEMENT_MAX_OUTRO_LENGTH"
              />
              <small>{{ form.outro.length }}/{{ TRAINING_ANNOUNCEMENT_MAX_OUTRO_LENGTH }}</small>
            </label>
          </fieldset>

          <fieldset
            :disabled="!isEditable || isPublished || editorLocked"
            class="announcement-panel"
          >
            <legend>Diffusion</legend>
            <p class="announcement-help">
              BigBadBot choisira une heure aléatoire dans cette plage et la conservera même après un
              redémarrage.
            </p>
            <div class="publish-window">
              <label>
                <span>Date</span>
                <input v-model="form.publishWindow.date" type="date" required />
              </label>
              <label>
                <span>Entre</span>
                <input v-model="form.publishWindow.startTime" type="time" required />
              </label>
              <label>
                <span>Et</span>
                <input v-model="form.publishWindow.endTime" type="time" required />
              </label>
            </div>
            <p v-if="form.scheduledFor" class="announcement-scheduled-time">
              Heure retenue : <strong>{{ displayDateTime(form.scheduledFor) }}</strong>
            </p>
          </fieldset>

          <section class="announcement-panel announcement-preview" aria-labelledby="preview-title">
            <header>
              <div>
                <p class="admin-eyebrow">Discord</p>
                <h3 id="preview-title">Aperçu du message</h3>
              </div>
              <span :class="{ 'is-over-limit': previewTooLong }">
                {{ previewCharacterCount }}/2 000 caractères
              </span>
            </header>
            <pre>{{ previewText }}</pre>
          </section>

          <footer v-if="isEditable" class="announcement-actions">
            <button
              type="submit"
              class="admin-button"
              :disabled="busy || revisionConflict || (!isDirty && isExisting)"
            >
              {{
                busy
                  ? 'Traitement…'
                  : autosaveRetryRequired
                    ? 'Réessayer l’enregistrement'
                    : isPublished
                      ? 'Mettre à jour le message Discord'
                      : 'Enregistrer le brouillon'
              }}
            </button>
            <button
              v-if="!isPublished"
              type="button"
              class="admin-button admin-button--primary"
              :disabled="busy || autosaveRetryRequired || revisionConflict"
              @click="runAction('schedule')"
            >
              Programmer la diffusion
            </button>
            <button
              v-if="!isPublished"
              type="button"
              class="admin-button admin-button--accent"
              :disabled="busy || autosaveRetryRequired || revisionConflict"
              @click="runAction('publish_now')"
            >
              Publier maintenant
            </button>
          </footer>
        </form>
      </template>
    </section>
  </div>
</template>

<style scoped>
.announcements-admin {
  display: grid;
  grid-template-columns: minmax(16rem, 21rem) minmax(0, 1fr);
  align-items: start;
  gap: clamp(1rem, 2.5vw, 2rem);
  color: #25305d;
}

.admin-eyebrow {
  margin: 0 0 0.3rem;
  color: #6b7595;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.admin-button,
.week-picker > button,
.training-day header button,
.training-slot__remove {
  min-height: 2.55rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid #cdd3e4;
  border-radius: 0.55rem;
  color: #27325f;
  background: white;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

a.admin-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.admin-button--primary {
  color: white;
  border-color: #283b91;
  background: #283b91;
}

.admin-button--accent {
  color: #43230b;
  border-color: #ff8427;
  background: #ffab66;
}

.admin-button--danger,
.training-slot__remove {
  color: #9d203a;
  border-color: #e7bbc5;
  background: #fff7f8;
}

button:disabled,
fieldset:disabled button {
  cursor: not-allowed;
  opacity: 0.52;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 0.18rem solid #ff8427;
  outline-offset: 0.12rem;
}

.announcements-history {
  position: sticky;
  top: 6rem;
  display: grid;
  gap: 1rem;
  max-height: calc(100dvh - 7.5rem);
  padding: 1rem;
  overflow: auto;
  border: 1px solid #d7ddeb;
  border-radius: 0.85rem;
  background: white;
}

.announcements-history > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.announcements-history__skip {
  color: #283b91;
  font-size: 0.82rem;
  font-weight: 800;
}

.announcements-history h1,
.announcement-editor h2,
.announcement-preview h3,
.training-day h3 {
  margin: 0;
}

.announcements-history h1 {
  font-size: 1.65rem;
}

.announcements-history__state {
  margin: 0;
  padding: 0.9rem;
  border-radius: 0.6rem;
  color: #65708f;
  background: #f6f7fb;
}

.announcements-history__state.is-error {
  color: #9d203a;
  background: #fbe9ed;
}

.announcements-history__state > p {
  margin: 0 0 0.65rem;
}

.announcements-history__list {
  display: grid;
  gap: 0.6rem;
}

.announcement-history-card {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #e0e4ef;
  border-radius: 0.65rem;
  color: #4f597b;
  background: white;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.announcement-history-card:hover,
.announcement-history-card.is-active {
  border-color: #7483c7;
  background: #f4f6ff;
}

.announcement-history-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  color: #25305d;
}

.announcement-history-card small {
  color: #747d99;
}

.announcement-status {
  flex: none;
  padding: 0.2rem 0.42rem;
  border-radius: 999px;
  color: #5f6888;
  background: #e9ecf5;
  font-size: 0.65rem;
  font-weight: 800;
}

.announcement-status.is-scheduled,
.announcement-status.is-publishing {
  color: #315093;
  background: #e5ecff;
}

.announcement-status.is-published {
  color: #17643f;
  background: #e7f6ed;
}

.announcement-status.is-failed,
.announcement-status.is-cancelled {
  color: #9d203a;
  background: #fbe9ed;
}

.announcement-editor {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.announcement-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.announcement-editor__header-actions,
.announcement-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
}

.announcement-editor__dirty {
  margin: 0.35rem 0 0;
  color: #9c5a1f;
  font-size: 0.8rem;
  font-weight: 800;
}

.announcement-editor__dirty.is-saved {
  color: #2f7658;
}

.announcement-feedback,
.announcement-validation,
.announcement-readonly,
.announcement-live-notice,
.announcement-week-conflict {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.6rem;
  color: #315093;
  background: #e5ecff;
  font-weight: 700;
}

.announcement-feedback.is-success {
  color: #17643f;
  background: #e7f6ed;
}

.announcement-feedback.is-error,
.announcement-validation {
  color: #9d203a;
  background: #fbe9ed;
}

.announcement-validation ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.announcement-readonly {
  color: #5c657f;
  background: #eef0f6;
}

.announcement-live-notice {
  color: #7b4a1c;
  background: #fff3e7;
}

.announcement-week-conflict {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #7b4a1c;
  background: #fff3e7;
}

.announcement-week-conflict p {
  margin: 0;
}

.announcement-form {
  display: grid;
  gap: 1rem;
}

.announcement-panel {
  min-width: 0;
  margin: 0;
  padding: clamp(1rem, 2.5vw, 1.5rem);
  border: 1px solid #d7ddeb;
  border-radius: 0.8rem;
  background: white;
}

.announcement-panel > legend {
  padding: 0 0.45rem;
  color: #25305d;
  font-size: 1rem;
  font-weight: 800;
}

.announcement-help {
  margin: 0 0 1rem;
  color: #68718f;
  font-size: 0.84rem;
}

.week-picker {
  display: grid;
  grid-template-columns: auto minmax(13rem, 22rem) auto;
  align-items: end;
  justify-content: start;
  gap: 0.65rem;
}

.week-picker > button {
  width: 2.65rem;
  padding-inline: 0;
  font-size: 1.1rem;
}

.week-picker label,
.training-slot label,
.publish-window label,
.announcement-copy label {
  display: grid;
  gap: 0.4rem;
  color: #596383;
  font-size: 0.78rem;
  font-weight: 800;
}

.week-picker input,
.training-slot input:not([type='checkbox']),
.training-slot select,
.training-slot textarea,
.publish-window input,
.announcement-copy textarea {
  width: 100%;
  min-height: 2.65rem;
  padding: 0.62rem 0.72rem;
  border: 1px solid #cdd3e4;
  border-radius: 0.5rem;
  color: #27325f;
  background: white;
  font: inherit;
}

.training-slot textarea {
  resize: vertical;
}

.training-days {
  display: grid;
  gap: 0.85rem;
}

.training-day {
  padding: 0.9rem;
  border: 1px solid #e0e4ef;
  border-radius: 0.7rem;
  background: #fafbfe;
}

.training-day > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.training-day > header span {
  color: #747d99;
  font-size: 0.78rem;
}

.training-day header button {
  min-height: 2.3rem;
  padding: 0.45rem 0.65rem;
}

.training-day__empty {
  margin: 0.75rem 0 0;
  color: #868da5;
  font-size: 0.82rem;
}

.training-slot {
  position: relative;
  display: grid;
  gap: 0.8rem;
  min-width: 0;
  margin: 0.85rem 0 0;
  padding: 1rem;
  border: 1px solid #d7ddec;
  border-radius: 0.65rem;
  background: white;
}

.training-slot > legend,
.training-slot__activities > legend {
  padding: 0 0.35rem;
  color: #596383;
  font-size: 0.75rem;
  font-weight: 800;
}

.training-slot__times {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.training-slot__activities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem 1rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.training-slot__activities label {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.2rem;
}

.training-slot__activities input {
  width: 1.15rem;
  height: 1.15rem;
}

.training-slot__remove {
  justify-self: start;
  min-height: 2.2rem;
  padding: 0.4rem 0.6rem;
}

.announcement-copy {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.announcement-copy textarea {
  min-height: 7rem;
  resize: vertical;
}

.announcement-copy small {
  justify-self: end;
  color: #7b839d;
}

.publish-window {
  display: grid;
  grid-template-columns: minmax(11rem, 1.5fr) repeat(2, minmax(8rem, 1fr));
  gap: 0.8rem;
  max-width: 42rem;
}

.announcement-scheduled-time {
  margin: 1rem 0 0;
  color: #315093;
}

.announcement-preview > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.announcement-preview > header > span {
  color: #717a98;
  font-size: 0.78rem;
  font-weight: 800;
}

.announcement-preview > header > span.is-over-limit {
  color: #a21f39;
}

.announcement-preview pre {
  margin: 1rem 0 0;
  padding: 1rem;
  overflow-x: auto;
  border-radius: 0.65rem;
  color: #edf0ff;
  background: #17214f;
  font:
    0.88rem/1.55 Raleway,
    sans-serif;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.announcement-actions {
  position: sticky;
  z-index: 5;
  bottom: 0.75rem;
  padding: 0.85rem;
  border: 1px solid #d7ddeb;
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 0.6rem 1.8rem rgb(23 33 79 / 12%);
  backdrop-filter: blur(12px);
}

@media (max-width: 1060px) {
  .announcements-admin {
    grid-template-columns: 1fr;
  }

  .announcements-history {
    position: static;
    max-height: min(24rem, 45dvh);
  }

  .announcements-history__list {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
}

@media (max-width: 680px) {
  .announcement-editor__header,
  .training-day > header,
  .announcement-preview > header {
    align-items: stretch;
    flex-direction: column;
  }

  .announcement-editor__header-actions,
  .announcement-actions {
    justify-content: stretch;
  }

  .announcement-editor__header-actions .admin-button,
  .announcement-actions .admin-button {
    flex: 1 1 100%;
  }

  .week-picker {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .training-slot__times,
  .announcement-copy,
  .publish-window {
    grid-template-columns: 1fr;
  }

  .announcement-actions {
    position: static;
  }
}

@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
