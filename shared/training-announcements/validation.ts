import {
  TRAINING_ANNOUNCEMENT_TIME_ZONE,
  type TrainingAnnouncementAction,
  type TrainingAnnouncementActionRequest,
  type TrainingAnnouncementCreateRequest,
  type TrainingAnnouncementDraft,
  type TrainingAnnouncementEventDraft,
  type TrainingAnnouncementPublishWindow,
  type TrainingAnnouncementUpdateRequest,
  type TrainingEventType,
} from '../types/training-announcements'

export const TRAINING_ANNOUNCEMENT_DEFAULT_CAPACITY = 40
export const TRAINING_ANNOUNCEMENT_MAX_CAPACITY = 200
// Discord supports at most 20 distinct reactions on one message. Each event
// owns one stable reaction, so the editor must enforce the same hard limit.
export const TRAINING_ANNOUNCEMENT_MAX_EVENTS = 20
export const TRAINING_ANNOUNCEMENT_MAX_INTRO_LENGTH = 1_000
export const TRAINING_ANNOUNCEMENT_MAX_OUTRO_LENGTH = 1_000
export const TRAINING_ANNOUNCEMENT_MAX_TOPIC_LENGTH = 180
export const TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH = 500
export const TRAINING_ANNOUNCEMENT_MAX_WINDOW_MINUTES = 12 * 60
export const TRAINING_ANNOUNCEMENT_EMOJI_SUGGESTIONS = [
  '🔥',
  '💜',
  '💛',
  '💚',
  '💙',
  '❤️',
  '🧡',
  '🩷',
  '🩵',
  '🤍',
  '🖤',
  '⚡',
  '🌟',
  '🌙',
  '☀️',
  '🌈',
  '🍀',
  '🦋',
  '🐺',
  '🏆',
] as const
export const TRAINING_ANNOUNCEMENT_MAX_EMOJI_CODE_POINTS = 16

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const OPAQUE_ID_PATTERN = /^[\w:-]{1,160}$/
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_TYPES = new Set<TrainingEventType>(['open_gym', 'workshop'])
const ACTIONS = new Set<TrainingAnnouncementAction>(['schedule', 'publish_now', 'cancel', 'retry'])
const PARIS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TRAINING_ANNOUNCEMENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export interface TrainingAnnouncementValidationIssue {
  path: string
  message: string
}

export type TrainingAnnouncementValidationResult<T> =
  | { success: true; value: T; issues: [] }
  | { success: false; value: null; issues: TrainingAnnouncementValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''
}

function emojiIdentity(value: string) {
  return value.replace(/[\uFE0E\uFE0F]/g, '')
}

function isSimpleUnicodeEmoji(value: string) {
  return (
    [...value].length <= TRAINING_ANNOUNCEMENT_MAX_EMOJI_CODE_POINTS &&
    [...value].some((character) => /\p{S}/u.test(character)) &&
    !/[\p{C}\s<>:@]/u.test(value)
  )
}

function isIsoDate(value: string) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))

  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
}

function dateNumber(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`)
}

function parisLocalTimeOccurrenceCount(date: string, time: string) {
  if (!isIsoDate(date) || !TIME_PATTERN.test(time)) return 0
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const expected = `${date} ${time}`
  const matches = new Set<number>()

  for (let utcOffset = -3; utcOffset <= 3; utcOffset += 1) {
    const instant = Date.UTC(
      year as number,
      (month as number) - 1,
      day,
      (hour as number) - utcOffset,
      minute,
    )
    const parts = Object.fromEntries(
      PARIS_DATE_TIME_FORMATTER.formatToParts(instant).map((part) => [part.type, part.value]),
    )
    if (`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` === expected) {
      matches.add(instant)
    }
  }

  return matches.size
}

function validateUnambiguousParisTime(
  date: string,
  time: string,
  path: string,
  issues: TrainingAnnouncementValidationIssue[],
) {
  if (!isIsoDate(date) || !TIME_PATTERN.test(time)) return

  const occurrences = parisLocalTimeOccurrenceCount(date, time)
  if (occurrences === 0) {
    addIssue(
      issues,
      path,
      "Cette heure n'existe pas en Europe/Paris à cause du changement d'heure.",
    )
  } else if (occurrences > 1) {
    addIssue(issues, path, "Cette heure est ambiguë en Europe/Paris à cause du changement d'heure.")
  }
}

function addIssue(issues: TrainingAnnouncementValidationIssue[], path: string, message: string) {
  issues.push({ path, message })
}

function validatePublishWindow(
  value: unknown,
  issues: TrainingAnnouncementValidationIssue[],
): TrainingAnnouncementPublishWindow | null {
  if (!isRecord(value)) {
    addIssue(issues, 'publishWindow', 'La fenêtre de diffusion est obligatoire.')
    return null
  }

  const date = normalizeText(value.date)
  const startTime = normalizeText(value.startTime)
  const endTime = normalizeText(value.endTime)
  const timeZone = normalizeText(value.timeZone)

  if (!isIsoDate(date)) {
    addIssue(issues, 'publishWindow.date', 'La date de diffusion est invalide.')
  }
  if (!TIME_PATTERN.test(startTime)) {
    addIssue(issues, 'publishWindow.startTime', "L'heure de début est invalide.")
  }
  if (!TIME_PATTERN.test(endTime)) {
    addIssue(issues, 'publishWindow.endTime', "L'heure de fin est invalide.")
  }
  if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime >= endTime) {
    addIssue(issues, 'publishWindow.endTime', 'La fenêtre doit se terminer après son début.')
  }
  if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime < endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const duration =
      (endHour as number) * 60 +
      (endMinute as number) -
      ((startHour as number) * 60 + (startMinute as number))
    if (duration > TRAINING_ANNOUNCEMENT_MAX_WINDOW_MINUTES) {
      addIssue(issues, 'publishWindow.endTime', 'La plage de diffusion est limitée à 12 heures.')
    }
  }
  if (timeZone !== TRAINING_ANNOUNCEMENT_TIME_ZONE) {
    addIssue(issues, 'publishWindow.timeZone', 'Le fuseau horaire doit être Europe/Paris.')
  }
  validateUnambiguousParisTime(date, startTime, 'publishWindow.startTime', issues)
  validateUnambiguousParisTime(date, endTime, 'publishWindow.endTime', issues)

  return {
    date,
    startTime,
    endTime,
    timeZone: TRAINING_ANNOUNCEMENT_TIME_ZONE,
  }
}

function validateEvent(
  value: unknown,
  index: number,
  weekStart: string,
  issues: TrainingAnnouncementValidationIssue[],
): TrainingAnnouncementEventDraft | null {
  const root = `events.${index}`
  if (!isRecord(value)) {
    addIssue(issues, root, "L'événement est invalide.")
    return null
  }

  const id = normalizeText(value.id)
  const date = normalizeText(value.date)
  const startTime = normalizeText(value.startTime)
  const endTime = normalizeText(value.endTime)
  const topic = normalizeText(value.topic)
  const details = normalizeText(value.details)
  const emoji = normalizeText(value.emoji)
  const capacity =
    value.capacity === undefined ? TRAINING_ANNOUNCEMENT_DEFAULT_CAPACITY : value.capacity
  const types = Array.isArray(value.types)
    ? [
        ...new Set(
          value.types.filter((type): type is TrainingEventType =>
            EVENT_TYPES.has(type as TrainingEventType),
          ),
        ),
      ]
    : []

  if (id && !OPAQUE_ID_PATTERN.test(id)) {
    addIssue(issues, `${root}.id`, "L'identifiant de l'événement est invalide.")
  }
  if (!isIsoDate(date)) {
    addIssue(issues, `${root}.date`, "La date de l'événement est invalide.")
  } else if (isIsoDate(weekStart)) {
    const offset = (dateNumber(date) - dateNumber(weekStart)) / 86_400_000
    if (!Number.isInteger(offset) || offset < 0 || offset > 6) {
      addIssue(issues, `${root}.date`, "L'événement doit appartenir à la semaine choisie.")
    }
  }
  if (!TIME_PATTERN.test(startTime)) {
    addIssue(issues, `${root}.startTime`, "L'heure de début est invalide.")
  }
  if (!TIME_PATTERN.test(endTime)) {
    addIssue(issues, `${root}.endTime`, "L'heure de fin est invalide.")
  }
  if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime >= endTime) {
    addIssue(issues, `${root}.endTime`, "L'événement doit se terminer après son début.")
  }
  validateUnambiguousParisTime(date, startTime, `${root}.startTime`, issues)
  validateUnambiguousParisTime(date, endTime, `${root}.endTime`, issues)
  if (!Array.isArray(value.types) || value.types.length === 0 || types.length === 0) {
    addIssue(issues, `${root}.types`, 'Choisis Open Gym, Atelier, ou les deux.')
  } else if (types.length !== value.types.length) {
    addIssue(issues, `${root}.types`, "Un type d'événement est invalide ou dupliqué.")
  }
  if (types.includes('workshop') && !topic) {
    addIssue(issues, `${root}.topic`, "Le sujet de l'atelier est obligatoire.")
  }
  if (topic.length > TRAINING_ANNOUNCEMENT_MAX_TOPIC_LENGTH) {
    addIssue(issues, `${root}.topic`, 'Le sujet est trop long.')
  }
  if (details.length > TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH) {
    addIssue(issues, `${root}.details`, 'Le détail de l’Open Gym est trop long.')
  }
  if (value.emoji !== undefined && value.emoji !== null && typeof value.emoji !== 'string') {
    addIssue(issues, `${root}.emoji`, 'La réaction doit être un emoji Unicode court.')
  }
  if (emoji && !isSimpleUnicodeEmoji(emoji)) {
    addIssue(issues, `${root}.emoji`, 'La réaction doit être un emoji Unicode court.')
  }
  if (
    typeof capacity !== 'number' ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    capacity > TRAINING_ANNOUNCEMENT_MAX_CAPACITY
  ) {
    addIssue(issues, `${root}.capacity`, 'La capacité doit être comprise entre 1 et 200.')
  }

  return {
    ...(id ? { id } : {}),
    date,
    startTime,
    endTime,
    types,
    topic,
    details,
    ...(emoji && isSimpleUnicodeEmoji(emoji) ? { emoji } : {}),
    capacity:
      typeof capacity === 'number' && Number.isSafeInteger(capacity)
        ? capacity
        : TRAINING_ANNOUNCEMENT_DEFAULT_CAPACITY,
  }
}

export function validateTrainingAnnouncementDraft(
  value: unknown,
): TrainingAnnouncementValidationResult<TrainingAnnouncementDraft> {
  const issues: TrainingAnnouncementValidationIssue[] = []
  if (!isRecord(value)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: "L'annonce est invalide." }],
    }
  }

  const weekStart = normalizeText(value.weekStart)
  const timeZone = normalizeText(value.timeZone)
  const intro = normalizeText(value.intro)
  const outro = normalizeText(value.outro)

  if (!isIsoDate(weekStart)) {
    addIssue(issues, 'weekStart', 'Le début de semaine est invalide.')
  } else if (new Date(`${weekStart}T00:00:00.000Z`).getUTCDay() !== 1) {
    addIssue(issues, 'weekStart', 'La semaine doit commencer un lundi.')
  }
  if (timeZone !== TRAINING_ANNOUNCEMENT_TIME_ZONE) {
    addIssue(issues, 'timeZone', 'Le fuseau horaire doit être Europe/Paris.')
  }
  if (intro.length > TRAINING_ANNOUNCEMENT_MAX_INTRO_LENGTH) {
    addIssue(issues, 'intro', "Le message d'introduction est trop long.")
  }
  if (outro.length > TRAINING_ANNOUNCEMENT_MAX_OUTRO_LENGTH) {
    addIssue(issues, 'outro', 'Le message de conclusion est trop long.')
  }

  const publishWindow = validatePublishWindow(value.publishWindow, issues)
  const sourceEvents = Array.isArray(value.events) ? value.events : []
  if (sourceEvents.length < 1 || sourceEvents.length > TRAINING_ANNOUNCEMENT_MAX_EVENTS) {
    addIssue(
      issues,
      'events',
      `L'annonce doit contenir entre 1 et ${TRAINING_ANNOUNCEMENT_MAX_EVENTS} événements.`,
    )
  }
  const events = sourceEvents
    .slice(0, TRAINING_ANNOUNCEMENT_MAX_EVENTS)
    .map((event, index) => validateEvent(event, index, weekStart, issues))
    .filter((event): event is TrainingAnnouncementEventDraft => Boolean(event))

  const ids = events.flatMap((event) => (event.id ? [event.id] : []))
  if (new Set(ids).size !== ids.length) {
    addIssue(issues, 'events', 'Deux événements ne peuvent pas partager le même identifiant.')
  }
  const emojis = events.flatMap((event) => (event.emoji ? [emojiIdentity(event.emoji)] : []))
  if (new Set(emojis).size !== emojis.length) {
    addIssue(issues, 'events', 'Chaque créneau doit utiliser une réaction différente.')
  }
  const eventFingerprints = events.map((event) =>
    [event.date, event.startTime, event.endTime, [...event.types].sort().join(','), event.topic]
      .join('|')
      .toLocaleLowerCase('fr-FR'),
  )
  if (new Set(eventFingerprints).size !== eventFingerprints.length) {
    addIssue(issues, 'events', 'Deux événements identiques ont été ajoutés.')
  }

  const earliestEvent = [...events].sort(
    (first, second) =>
      first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime),
  )[0]
  if (
    publishWindow &&
    earliestEvent &&
    isIsoDate(publishWindow.date) &&
    TIME_PATTERN.test(publishWindow.endTime) &&
    `${publishWindow.date}T${publishWindow.endTime}` >
      `${earliestEvent.date}T${earliestEvent.startTime}`
  ) {
    addIssue(
      issues,
      'publishWindow.endTime',
      'La fenêtre de diffusion doit se terminer avant le premier créneau.',
    )
  }

  if (issues.length > 0 || !publishWindow) {
    return { success: false, value: null, issues }
  }

  return {
    success: true,
    issues: [],
    value: {
      weekStart,
      timeZone: TRAINING_ANNOUNCEMENT_TIME_ZONE,
      intro,
      outro,
      publishWindow,
      events,
    },
  }
}

export function isTrainingAnnouncementRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value)
}

export function isTrainingAnnouncementOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_ID_PATTERN.test(value)
}

export function validateTrainingAnnouncementCreateRequest(
  value: unknown,
): TrainingAnnouncementValidationResult<TrainingAnnouncementCreateRequest> {
  if (!isRecord(value) || !isTrainingAnnouncementRequestId(value.requestId)) {
    return {
      success: false,
      value: null,
      issues: [{ path: 'requestId', message: 'La clé de requête est invalide.' }],
    }
  }

  const announcement = validateTrainingAnnouncementDraft(value.announcement)
  if (!announcement.success) return announcement

  return {
    success: true,
    issues: [],
    value: { requestId: value.requestId, announcement: announcement.value },
  }
}

export function validateTrainingAnnouncementUpdateRequest(
  value: unknown,
): TrainingAnnouncementValidationResult<TrainingAnnouncementUpdateRequest> {
  if (!isRecord(value) || !isTrainingAnnouncementOpaqueId(value.expectedRevisionId)) {
    return {
      success: false,
      value: null,
      issues: [{ path: 'expectedRevisionId', message: 'La révision attendue est invalide.' }],
    }
  }

  const created = validateTrainingAnnouncementCreateRequest(value)
  if (!created.success) return created

  return {
    success: true,
    issues: [],
    value: { ...created.value, expectedRevisionId: value.expectedRevisionId },
  }
}

export function validateTrainingAnnouncementActionRequest(
  value: unknown,
): TrainingAnnouncementValidationResult<TrainingAnnouncementActionRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: "L'action est invalide." }],
    }
  }

  const issues: TrainingAnnouncementValidationIssue[] = []
  if (!isTrainingAnnouncementRequestId(value.requestId)) {
    addIssue(issues, 'requestId', 'La clé de requête est invalide.')
  }
  if (!isTrainingAnnouncementOpaqueId(value.expectedRevisionId)) {
    addIssue(issues, 'expectedRevisionId', 'La révision attendue est invalide.')
  }
  if (
    typeof value.action !== 'string' ||
    !ACTIONS.has(value.action as TrainingAnnouncementAction)
  ) {
    addIssue(issues, 'action', "L'action demandée est invalide.")
  }

  if (issues.length > 0) return { success: false, value: null, issues }

  return {
    success: true,
    issues: [],
    value: {
      requestId: value.requestId as string,
      expectedRevisionId: value.expectedRevisionId as string,
      action: value.action as TrainingAnnouncementAction,
    },
  }
}
