import {
  ANIMATION_EVENT_TIME_ZONE,
  type AnimationEventAction,
  type AnimationEventActionRequest,
  type AnimationEventCreateRequest,
  type AnimationEventDraft,
  type AnimationEventFormationAnnotation,
  type AnimationEventFormationPoint,
  type AnimationEventFormationSurface,
  type AnimationEventGroupConfigRequest,
  type AnimationEventGroupRequest,
  type AnimationEventGroupStageRequest,
  type AnimationEventItemDraft,
  type AnimationEventPublishWindow,
  type AnimationEventSlotDraft,
  type AnimationEventUpdateRequest,
} from '../types/animation-events'

export const ANIMATION_EVENT_DEFAULT_CAPACITY = 40
export const ANIMATION_EVENT_MAX_CAPACITY = 200
export const ANIMATION_EVENT_MAX_ITEMS = 10
export const ANIMATION_EVENT_MAX_SLOTS = 20
export const ANIMATION_EVENT_MAX_TITLE_LENGTH = 180
export const ANIMATION_EVENT_MAX_TEXT_LENGTH = 1_000
export const ANIMATION_EVENT_MAX_LOCATION_LENGTH = 180
export const ANIMATION_EVENT_MAX_DETAILS_LENGTH = 1_000
export const ANIMATION_EVENT_MAX_SLOT_LABEL_LENGTH = 120
export const ANIMATION_EVENT_MAX_EMOJI_LENGTH = 16
export const ANIMATION_EVENT_MAX_GROUP_LABEL_LENGTH = 120
export const ANIMATION_EVENT_MAX_GROUPS = 100
export const ANIMATION_EVENT_MAX_GROUP_STAGES = 20
export const ANIMATION_EVENT_MAX_GROUP_STAGE_LABEL_LENGTH = 120
export const ANIMATION_EVENT_FORMATION_COORDINATE_MAX = 10_000
export const ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS = 32
export const ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH = 24
export const ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH = 120
export const ANIMATION_EVENT_MAX_WINDOW_MINUTES = 12 * 60

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const OPAQUE_ID_PATTERN = /^[\w:-]{1,160}$/
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIONS = new Set<AnimationEventAction>([
  'schedule',
  'publish_now',
  'cancel',
  'retry',
  'duplicate',
])
const FORMATION_SURFACES = new Set<AnimationEventFormationSurface>([
  'square',
  'landscape',
  'portrait',
])
const PARIS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ANIMATION_EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export interface AnimationEventValidationIssue {
  path: string
  message: string
}

export type AnimationEventValidationResult<T> =
  | { success: true; value: T; issues: [] }
  | { success: false; value: null; issues: AnimationEventValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''
}

export function canonicalAnimationEventEmoji(value: string) {
  return value.replace(/[\uFE0E\uFE0F]/gu, '')
}

export function isAnimationEventEmoji(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const candidate = value.trim()
  if (
    !candidate ||
    candidate !== value ||
    [...candidate].length > ANIMATION_EVENT_MAX_EMOJI_LENGTH ||
    /\s/u.test(candidate) ||
    /[\p{Cc}\p{Cs}]/u.test(candidate)
  ) {
    return false
  }

  const significant = [...candidate].filter((character) => {
    const codePoint = character.codePointAt(0) as number
    return (
      !['\uFE0E', '\uFE0F', '\u200D', '\u20E3'].includes(character) &&
      !(codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) &&
      !/[\p{Mn}\p{Me}]/u.test(character)
    )
  })
  const isAllowedBase = (character: string) => {
    const codePoint = character.codePointAt(0) as number
    return (
      (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
      (codePoint >= 0x2100 && codePoint <= 0x27ff) ||
      (codePoint >= 0x2b00 && codePoint <= 0x2bff) ||
      ('0123456789#*'.includes(character) && candidate.includes('\u20E3'))
    )
  }
  if (significant.length < 1 || !significant.every(isAllowedBase)) return false

  const isFlag =
    significant.length === 2 &&
    significant.every((character) => {
      const codePoint = character.codePointAt(0) as number
      return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    })

  return significant.length <= 1 || candidate.includes('\u200D') || isFlag
}

function addIssue(issues: AnimationEventValidationIssue[], path: string, message: string) {
  issues.push({ path, message })
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

function validateParisTime(
  date: string,
  time: string,
  path: string,
  issues: AnimationEventValidationIssue[],
) {
  if (!isIsoDate(date) || !TIME_PATTERN.test(time)) return
  const occurrences = parisLocalTimeOccurrenceCount(date, time)
  if (occurrences === 0) {
    addIssue(issues, path, "Cette heure n'existe pas en Europe/Paris.")
  } else if (occurrences > 1) {
    addIssue(issues, path, 'Cette heure est ambiguë en Europe/Paris.')
  }
}

function validatePublishWindow(
  value: unknown,
  issues: AnimationEventValidationIssue[],
): AnimationEventPublishWindow | null {
  if (!isRecord(value)) {
    addIssue(issues, 'publishWindow', 'La fenêtre de diffusion est obligatoire.')
    return null
  }

  const date = normalizeText(value.date)
  const startTime = normalizeText(value.startTime)
  const endTime = normalizeText(value.endTime)
  const timeZone = normalizeText(value.timeZone)
  if (!isIsoDate(date)) addIssue(issues, 'publishWindow.date', 'La date est invalide.')
  if (!TIME_PATTERN.test(startTime)) {
    addIssue(issues, 'publishWindow.startTime', "L'heure de début est invalide.")
  }
  if (!TIME_PATTERN.test(endTime)) {
    addIssue(issues, 'publishWindow.endTime', "L'heure de fin est invalide.")
  }
  if (TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime)) {
    if (startTime >= endTime) {
      addIssue(issues, 'publishWindow.endTime', 'La plage doit se terminer après son début.')
    } else {
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const [endHour, endMinute] = endTime.split(':').map(Number)
      const duration =
        (endHour as number) * 60 +
        (endMinute as number) -
        ((startHour as number) * 60 + (startMinute as number))
      if (duration > ANIMATION_EVENT_MAX_WINDOW_MINUTES) {
        addIssue(issues, 'publishWindow.endTime', 'La plage est limitée à 12 heures.')
      }
    }
  }
  if (timeZone !== ANIMATION_EVENT_TIME_ZONE) {
    addIssue(issues, 'publishWindow.timeZone', 'Le fuseau doit être Europe/Paris.')
  }
  validateParisTime(date, startTime, 'publishWindow.startTime', issues)
  validateParisTime(date, endTime, 'publishWindow.endTime', issues)

  return { date, startTime, endTime, timeZone: ANIMATION_EVENT_TIME_ZONE }
}

function validateSlot(
  value: unknown,
  path: string,
  issues: AnimationEventValidationIssue[],
): AnimationEventSlotDraft | null {
  if (!isRecord(value)) {
    addIssue(issues, path, "La catégorie d'inscription est invalide.")
    return null
  }

  const id = normalizeText(value.id)
  const label = normalizeText(value.label)
  const emoji = value.emoji === null ? null : normalizeText(value.emoji) || null
  const capacity = value.capacity === null || value.capacity === undefined ? null : value.capacity
  if (id && !OPAQUE_ID_PATTERN.test(id))
    addIssue(issues, `${path}.id`, "L'identifiant est invalide.")
  if (!label) addIssue(issues, `${path}.label`, 'Le libellé est obligatoire.')
  if (label.length > ANIMATION_EVENT_MAX_SLOT_LABEL_LENGTH) {
    addIssue(issues, `${path}.label`, 'Le libellé est trop long.')
  }
  if (emoji && !isAnimationEventEmoji(emoji)) {
    addIssue(issues, `${path}.emoji`, "L'emoji est invalide.")
  }
  if (
    capacity !== null &&
    (typeof capacity !== 'number' ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > ANIMATION_EVENT_MAX_CAPACITY)
  ) {
    addIssue(issues, `${path}.capacity`, 'La capacité doit être comprise entre 1 et 200.')
  }

  return {
    ...(id ? { id } : {}),
    label,
    emoji,
    capacity: typeof capacity === 'number' && Number.isSafeInteger(capacity) ? capacity : null,
  }
}

function validateItem(
  value: unknown,
  index: number,
  issues: AnimationEventValidationIssue[],
): AnimationEventItemDraft | null {
  const root = `items.${index}`
  if (!isRecord(value)) {
    addIssue(issues, root, "L'événement est invalide.")
    return null
  }

  const id = normalizeText(value.id)
  const title = normalizeText(value.title)
  const eventDate = normalizeText(value.eventDate)
  const startTime = normalizeText(value.startTime)
  const meetingTime = value.meetingTime === null ? null : normalizeText(value.meetingTime) || null
  const location = normalizeText(value.location)
  const details = normalizeText(value.details)
  if (id && !OPAQUE_ID_PATTERN.test(id))
    addIssue(issues, `${root}.id`, "L'identifiant est invalide.")
  if (!title) addIssue(issues, `${root}.title`, 'Le titre est obligatoire.')
  if (title.length > ANIMATION_EVENT_MAX_TITLE_LENGTH) {
    addIssue(issues, `${root}.title`, 'Le titre est trop long.')
  }
  if (!isIsoDate(eventDate)) addIssue(issues, `${root}.eventDate`, 'La date est invalide.')
  if (!TIME_PATTERN.test(startTime)) addIssue(issues, `${root}.startTime`, "L'heure est invalide.")
  if (meetingTime && !TIME_PATTERN.test(meetingTime)) {
    addIssue(issues, `${root}.meetingTime`, "L'heure de rendez-vous est invalide.")
  }
  if (meetingTime && TIME_PATTERN.test(startTime) && meetingTime > startTime) {
    addIssue(issues, `${root}.meetingTime`, "Le rendez-vous doit précéder le début de l'événement.")
  }
  validateParisTime(eventDate, startTime, `${root}.startTime`, issues)
  if (meetingTime) validateParisTime(eventDate, meetingTime, `${root}.meetingTime`, issues)
  if (location.length > ANIMATION_EVENT_MAX_LOCATION_LENGTH) {
    addIssue(issues, `${root}.location`, 'Le lieu est trop long.')
  }
  if (details.length > ANIMATION_EVENT_MAX_DETAILS_LENGTH) {
    addIssue(issues, `${root}.details`, 'Les informations pratiques sont trop longues.')
  }

  const sourceSlots = Array.isArray(value.slots) ? value.slots : []
  if (sourceSlots.length < 1) addIssue(issues, `${root}.slots`, 'Ajoute au moins une catégorie.')
  if (sourceSlots.length > ANIMATION_EVENT_MAX_SLOTS) {
    addIssue(
      issues,
      `${root}.slots`,
      `Une annonce accepte au maximum ${ANIMATION_EVENT_MAX_SLOTS} réactions.`,
    )
  }
  const slots = sourceSlots
    .slice(0, ANIMATION_EVENT_MAX_SLOTS)
    .map((slot, slotIndex) => validateSlot(slot, `${root}.slots.${slotIndex}`, issues))
    .filter((slot): slot is AnimationEventSlotDraft => Boolean(slot))

  return {
    ...(id ? { id } : {}),
    title,
    eventDate,
    startTime,
    meetingTime,
    location,
    details,
    slots,
  }
}

export function validateAnimationEventDraft(
  value: unknown,
): AnimationEventValidationResult<AnimationEventDraft> {
  const issues: AnimationEventValidationIssue[] = []
  if (!isRecord(value)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: "L'événement est invalide." }],
    }
  }

  const title = normalizeText(value.title)
  const intro = normalizeText(value.intro)
  const outro = normalizeText(value.outro)
  const timeZone = normalizeText(value.timeZone)
  if (!title) addIssue(issues, 'title', 'Le titre principal est obligatoire.')
  if (title.length > ANIMATION_EVENT_MAX_TITLE_LENGTH)
    addIssue(issues, 'title', 'Le titre est trop long.')
  if (intro.length > ANIMATION_EVENT_MAX_TEXT_LENGTH)
    addIssue(issues, 'intro', "L'introduction est trop longue.")
  if (outro.length > ANIMATION_EVENT_MAX_TEXT_LENGTH)
    addIssue(issues, 'outro', 'La conclusion est trop longue.')
  if (timeZone !== ANIMATION_EVENT_TIME_ZONE)
    addIssue(issues, 'timeZone', 'Le fuseau doit être Europe/Paris.')

  const publishWindow = validatePublishWindow(value.publishWindow, issues)
  const sourceItems = Array.isArray(value.items) ? value.items : []
  if (sourceItems.length < 1 || sourceItems.length > ANIMATION_EVENT_MAX_ITEMS) {
    addIssue(issues, 'items', `Ajoute entre 1 et ${ANIMATION_EVENT_MAX_ITEMS} événements.`)
  }
  const items = sourceItems
    .slice(0, ANIMATION_EVENT_MAX_ITEMS)
    .map((item, index) => validateItem(item, index, issues))
    .filter((item): item is AnimationEventItemDraft => Boolean(item))

  const slots = items.flatMap((item) => item.slots)
  if (slots.length > ANIMATION_EVENT_MAX_SLOTS) {
    addIssue(
      issues,
      'items',
      `Une annonce accepte au maximum ${ANIMATION_EVENT_MAX_SLOTS} réactions.`,
    )
  }
  const explicitEmojis = slots.flatMap((slot) =>
    slot.emoji && isAnimationEventEmoji(slot.emoji)
      ? [canonicalAnimationEventEmoji(slot.emoji)]
      : [],
  )
  if (new Set(explicitEmojis).size !== explicitEmojis.length) {
    addIssue(issues, 'items', 'Chaque catégorie doit utiliser un emoji différent.')
  }
  const ids = [
    ...items.flatMap((item) => (item.id ? [item.id] : [])),
    ...slots.flatMap((slot) => (slot.id ? [slot.id] : [])),
  ]
  if (new Set(ids).size !== ids.length)
    addIssue(issues, 'items', 'Deux éléments partagent le même identifiant.')

  const earliestItem = [...items].sort(
    (first, second) =>
      first.eventDate.localeCompare(second.eventDate) ||
      first.startTime.localeCompare(second.startTime),
  )[0]
  if (
    publishWindow &&
    earliestItem &&
    isIsoDate(publishWindow.date) &&
    TIME_PATTERN.test(publishWindow.endTime) &&
    `${publishWindow.date}T${publishWindow.endTime}` >
      `${earliestItem.eventDate}T${earliestItem.startTime}`
  ) {
    addIssue(
      issues,
      'publishWindow.endTime',
      'La diffusion doit se terminer avant le premier événement.',
    )
  }

  if (issues.length > 0 || !publishWindow) return { success: false, value: null, issues }
  return {
    success: true,
    issues: [],
    value: { title, intro, outro, timeZone: ANIMATION_EVENT_TIME_ZONE, publishWindow, items },
  }
}

export function isAnimationEventOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_ID_PATTERN.test(value)
}

export function isAnimationEventRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value)
}

export function validateAnimationEventCreateRequest(
  value: unknown,
): AnimationEventValidationResult<AnimationEventCreateRequest> {
  if (!isRecord(value) || !isAnimationEventRequestId(value.requestId)) {
    return {
      success: false,
      value: null,
      issues: [{ path: 'requestId', message: 'La clé de requête est invalide.' }],
    }
  }
  const event = validateAnimationEventDraft(value.event)
  if (!event.success) return event
  return { success: true, issues: [], value: { requestId: value.requestId, event: event.value } }
}

export function validateAnimationEventUpdateRequest(
  value: unknown,
): AnimationEventValidationResult<AnimationEventUpdateRequest> {
  if (!isRecord(value) || !isAnimationEventOpaqueId(value.expectedRevisionId)) {
    return {
      success: false,
      value: null,
      issues: [{ path: 'expectedRevisionId', message: 'La révision est invalide.' }],
    }
  }
  const created = validateAnimationEventCreateRequest(value)
  if (!created.success) return created
  return {
    success: true,
    issues: [],
    value: { ...created.value, expectedRevisionId: value.expectedRevisionId },
  }
}

export function validateAnimationEventActionRequest(
  value: unknown,
): AnimationEventValidationResult<AnimationEventActionRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: "L'action est invalide." }],
    }
  }
  const issues: AnimationEventValidationIssue[] = []
  if (!isAnimationEventRequestId(value.requestId))
    addIssue(issues, 'requestId', 'La clé de requête est invalide.')
  if (!isAnimationEventOpaqueId(value.expectedRevisionId))
    addIssue(issues, 'expectedRevisionId', 'La révision est invalide.')
  if (typeof value.action !== 'string' || !ACTIONS.has(value.action as AnimationEventAction)) {
    addIssue(issues, 'action', "L'action est invalide.")
  }
  if (issues.length > 0) return { success: false, value: null, issues }
  return {
    success: true,
    issues: [],
    value: {
      requestId: value.requestId as string,
      expectedRevisionId: value.expectedRevisionId as string,
      action: value.action as AnimationEventAction,
    },
  }
}

export function validateAnimationEventGroupConfigRequest(
  value: unknown,
): AnimationEventValidationResult<AnimationEventGroupConfigRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: 'Le plan de groupes est invalide.' }],
    }
  }
  const issues: AnimationEventValidationIssue[] = []
  if (!isAnimationEventRequestId(value.requestId))
    addIssue(issues, 'requestId', 'La clé de requête est invalide.')
  if (
    typeof value.expectedVersion !== 'number' ||
    !Number.isSafeInteger(value.expectedVersion) ||
    value.expectedVersion < 0
  ) {
    addIssue(issues, 'expectedVersion', 'La version est invalide.')
  }
  const label = normalizeText(value.label)
  if (label.length > ANIMATION_EVENT_MAX_GROUP_LABEL_LENGTH)
    addIssue(issues, 'label', 'Le nom du plan est trop long.')
  const sourceStages = Array.isArray(value.stages) ? value.stages : []
  if (sourceStages.length < 1 || sourceStages.length > ANIMATION_EVENT_MAX_GROUP_STAGES) {
    addIssue(
      issues,
      'stages',
      `Le plan contient entre 1 et ${ANIMATION_EVENT_MAX_GROUP_STAGES} étapes.`,
    )
  }

  function validateFormationPoint(value: unknown, path: string): AnimationEventFormationPoint {
    if (!isRecord(value)) {
      addIssue(issues, path, 'La position sur le plan est invalide.')
      return { x: 0, y: 0 }
    }
    const validCoordinate = (coordinate: unknown) =>
      typeof coordinate === 'number' &&
      Number.isSafeInteger(coordinate) &&
      coordinate >= 0 &&
      coordinate <= ANIMATION_EVENT_FORMATION_COORDINATE_MAX
    if (!validCoordinate(value.x)) {
      addIssue(
        issues,
        `${path}.x`,
        `La coordonnée est comprise entre 0 et ${ANIMATION_EVENT_FORMATION_COORDINATE_MAX}.`,
      )
    }
    if (!validCoordinate(value.y)) {
      addIssue(
        issues,
        `${path}.y`,
        `La coordonnée est comprise entre 0 et ${ANIMATION_EVENT_FORMATION_COORDINATE_MAX}.`,
      )
    }
    return {
      x: typeof value.x === 'number' ? value.x : 0,
      y: typeof value.y === 'number' ? value.y : 0,
    }
  }

  function validateAnnotations(
    value: unknown,
    stageIndex: number,
  ): AnimationEventFormationAnnotation[] {
    const path = `stages.${stageIndex}.annotations`
    if (!Array.isArray(value)) {
      addIssue(issues, path, 'Les annotations sont invalides.')
      return []
    }
    if (value.length > ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS) {
      addIssue(
        issues,
        path,
        `Une étape contient au maximum ${ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS} annotations.`,
      )
    }
    const annotations = value
      .slice(0, ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS)
      .flatMap((annotation, annotationIndex): AnimationEventFormationAnnotation[] => {
        const annotationPath = `${path}.${annotationIndex}`
        if (!isRecord(annotation)) {
          addIssue(issues, annotationPath, "L'annotation est invalide.")
          return []
        }
        const id = normalizeText(annotation.id)
        if (!isAnimationEventOpaqueId(id)) {
          addIssue(issues, `${annotationPath}.id`, "L'identifiant est invalide.")
        }
        const position = annotation.position
        if (typeof position !== 'number' || !Number.isSafeInteger(position) || position < 0) {
          addIssue(issues, `${annotationPath}.position`, 'La position est invalide.')
        }
        const count = normalizeText(annotation.count)
        if (!count || count.length > ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH) {
          addIssue(issues, `${annotationPath}.count`, 'Le compte est invalide.')
        }
        const figure = normalizeText(annotation.figure)
        if (!figure || figure.length > ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH) {
          addIssue(issues, `${annotationPath}.figure`, 'Le nom de la figure est invalide.')
        }
        const start = validateFormationPoint(annotation.start, `${annotationPath}.start`)
        const base = {
          id,
          position: typeof position === 'number' ? position : annotationIndex,
          count,
          figure,
          start,
        }
        if (annotation.kind === 'point') {
          if (annotation.end !== null) {
            addIssue(issues, `${annotationPath}.end`, "Un point n'a pas d'extrémité.")
          }
          return [{ ...base, kind: 'point', end: null }]
        }
        if (annotation.kind === 'line') {
          const end = validateFormationPoint(annotation.end, `${annotationPath}.end`)
          if (start.x === end.x && start.y === end.y) {
            addIssue(issues, `${annotationPath}.end`, 'Une ligne doit avoir une longueur.')
          }
          return [{ ...base, kind: 'line', end }]
        }
        addIssue(issues, `${annotationPath}.kind`, "Le type d'annotation est invalide.")
        return []
      })
    const annotationIds = annotations.map((annotation) => annotation.id)
    if (new Set(annotationIds).size !== annotationIds.length) {
      addIssue(issues, path, 'Deux annotations ne peuvent pas avoir le même identifiant.')
    }
    const annotationPositions = annotations.map((annotation) => annotation.position)
    if (new Set(annotationPositions).size !== annotationPositions.length) {
      addIssue(issues, path, 'Deux annotations ne peuvent pas avoir la même position.')
    }
    return annotations
  }

  function validateGroups(value: unknown, stageIndex: number): AnimationEventGroupRequest[] {
    const path = `stages.${stageIndex}.groups`
    const sourceGroups = Array.isArray(value) ? value : []
    if (!Array.isArray(value)) addIssue(issues, path, 'Les groupes sont invalides.')
    if (sourceGroups.length > ANIMATION_EVENT_MAX_GROUPS) {
      addIssue(issues, path, "L'étape contient trop de groupes.")
    }
    const groups = sourceGroups
      .slice(0, ANIMATION_EVENT_MAX_GROUPS)
      .flatMap((group, groupIndex) => {
        if (!isRecord(group)) {
          addIssue(issues, `${path}.${groupIndex}`, 'Le groupe est invalide.')
          return []
        }
        const id = normalizeText(group.id)
        if (!isAnimationEventOpaqueId(id))
          addIssue(issues, `${path}.${groupIndex}.id`, "L'identifiant est invalide.")
        const position = group.position
        if (typeof position !== 'number' || !Number.isSafeInteger(position) || position < 0) {
          addIssue(issues, `${path}.${groupIndex}.position`, 'La position est invalide.')
        }
        const sourceMembers = Array.isArray(group.members) ? group.members : []
        if (sourceMembers.length < 1 || sourceMembers.length > 3) {
          addIssue(
            issues,
            `${path}.${groupIndex}.members`,
            'Un groupe contient entre 1 et 3 personnes.',
          )
        }
        const members = sourceMembers.slice(0, 3).flatMap((member, memberIndex) => {
          if (!isRecord(member)) {
            addIssue(
              issues,
              `${path}.${groupIndex}.members.${memberIndex}`,
              'La personne est invalide.',
            )
            return []
          }
          const participantKey = normalizeText(member.participantKey)
          if (!isAnimationEventOpaqueId(participantKey)) {
            addIssue(
              issues,
              `${path}.${groupIndex}.members.${memberIndex}.participantKey`,
              'La personne est invalide.',
            )
          }
          const memberPosition = member.position
          if (
            typeof memberPosition !== 'number' ||
            !Number.isSafeInteger(memberPosition) ||
            memberPosition < 0
          ) {
            addIssue(
              issues,
              `${path}.${groupIndex}.members.${memberIndex}.position`,
              'La position est invalide.',
            )
          }
          return [
            {
              participantKey,
              position: typeof memberPosition === 'number' ? memberPosition : memberIndex,
            },
          ]
        })
        const memberPositions = members.map((member) => member.position)
        if (new Set(memberPositions).size !== memberPositions.length) {
          addIssue(
            issues,
            `${path}.${groupIndex}.members`,
            'Deux personnes ne peuvent pas avoir la même position dans un groupe.',
          )
        }
        const parsed: AnimationEventGroupRequest = {
          id,
          position: typeof position === 'number' ? position : groupIndex,
          members,
        }
        if (hasOwn(group, 'placement')) {
          parsed.placement =
            group.placement === null
              ? null
              : validateFormationPoint(group.placement, `${path}.${groupIndex}.placement`)
        }
        return [parsed]
      })
    const groupIds = groups.map((group) => group.id)
    if (new Set(groupIds).size !== groupIds.length) {
      addIssue(
        issues,
        path,
        "Deux groupes d'une même étape ne peuvent pas avoir le même identifiant.",
      )
    }
    const groupPositions = groups.map((group) => group.position)
    if (new Set(groupPositions).size !== groupPositions.length) {
      addIssue(issues, path, 'Deux groupes ne peuvent pas avoir la même position dans une étape.')
    }
    const participantKeys = groups.flatMap((group) =>
      group.members.map((member) => member.participantKey),
    )
    if (new Set(participantKeys).size !== participantKeys.length) {
      addIssue(issues, path, 'Une personne ne peut apparaître que dans un groupe par étape.')
    }
    return groups
  }

  const stages: AnimationEventGroupStageRequest[] = sourceStages
    .slice(0, ANIMATION_EVENT_MAX_GROUP_STAGES)
    .flatMap((stage, stageIndex) => {
      if (!isRecord(stage)) {
        addIssue(issues, `stages.${stageIndex}`, "L'étape est invalide.")
        return []
      }
      const id = normalizeText(stage.id)
      if (!isAnimationEventOpaqueId(id))
        addIssue(issues, `stages.${stageIndex}.id`, "L'identifiant est invalide.")
      const label = normalizeText(stage.label)
      if (!label || label.length > ANIMATION_EVENT_MAX_GROUP_STAGE_LABEL_LENGTH) {
        addIssue(issues, `stages.${stageIndex}.label`, "Le nom de l'étape est invalide.")
      }
      const position = stage.position
      if (typeof position !== 'number' || !Number.isSafeInteger(position) || position < 0) {
        addIssue(issues, `stages.${stageIndex}.position`, 'La position est invalide.')
      }
      const parsed: AnimationEventGroupStageRequest = {
        id,
        label,
        position: typeof position === 'number' ? position : stageIndex,
        groups: validateGroups(stage.groups, stageIndex),
      }
      if (hasOwn(stage, 'surface')) {
        if (
          typeof stage.surface !== 'string' ||
          !FORMATION_SURFACES.has(stage.surface as AnimationEventFormationSurface)
        ) {
          addIssue(issues, `stages.${stageIndex}.surface`, 'La surface est invalide.')
        } else {
          parsed.surface = stage.surface as AnimationEventFormationSurface
        }
      }
      if (hasOwn(stage, 'annotations')) {
        parsed.annotations = validateAnnotations(stage.annotations, stageIndex)
      }
      return [parsed]
    })
  const stageIds = stages.map((stage) => stage.id)
  if (new Set(stageIds).size !== stageIds.length) {
    addIssue(issues, 'stages', 'Deux étapes ne peuvent pas avoir le même identifiant.')
  }
  const stagePositions = stages.map((stage) => stage.position)
  if (new Set(stagePositions).size !== stagePositions.length) {
    addIssue(issues, 'stages', 'Deux étapes ne peuvent pas avoir la même position.')
  }
  const groupIds = stages.flatMap((stage) => stage.groups.map((group) => group.id))
  if (new Set(groupIds).size !== groupIds.length) {
    addIssue(issues, 'stages', 'Deux groupes ne peuvent pas avoir le même identifiant.')
  }
  const annotationIds = stages.flatMap((stage) =>
    (stage.annotations || []).map((annotation) => annotation.id),
  )
  if (new Set(annotationIds).size !== annotationIds.length) {
    addIssue(issues, 'stages', 'Deux annotations ne peuvent pas avoir le même identifiant.')
  }
  if (issues.length > 0) return { success: false, value: null, issues }
  return {
    success: true,
    issues: [],
    value: {
      requestId: value.requestId as string,
      expectedVersion: value.expectedVersion as number,
      label,
      stages,
    },
  }
}
