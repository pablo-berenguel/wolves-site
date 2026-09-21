import { createHash, createHmac } from 'node:crypto'

import type {
  MemberParticipationAccess,
  MemberParticipationAccessReason,
} from '../../../shared/types/participations'
import type {
  MemberRegistrationCommandResponse,
  MemberRegistrationResponse,
  MemberRegistrationSession,
  RegistrationCommandCode,
  RegistrationCommandStatus,
  RegistrationDenialReason,
  RegistrationEligibilityReason,
} from '../../../shared/types/registrations'
import type {
  TrainingAnnouncement,
  TrainingAnnouncementAccess,
  TrainingAnnouncementAccessReason,
  TrainingAnnouncementListResponse,
  TrainingAnnouncementResponse,
  TrainingAnnouncementStatus,
  TrainingAnnouncementSummary,
} from '../../../shared/types/training-announcements'
import {
  TRAINING_ANNOUNCEMENT_MAX_EVENTS,
  validateTrainingAnnouncementDraft,
} from '../../../shared/training-announcements/validation'

const SESSION_KEY_PATTERN = /^[\w:-]{1,160}$/
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DENIAL_REASONS = new Set<RegistrationDenialReason>(['not_guild_member', 'channel_forbidden'])
const ELIGIBILITY_REASONS = new Set<RegistrationEligibilityReason>([
  'missing_role',
  'team_restricted',
])
const COMMAND_STATUSES = new Set<RegistrationCommandStatus>(['pending', 'succeeded', 'rejected'])
const COMMAND_CODES = new Set<RegistrationCommandCode>([
  'already_registered',
  'not_registered',
  'full',
  'missing_role',
  'not_guild_member',
  'channel_forbidden',
  'stale_session',
  'discord_unavailable',
  'bridge_unavailable',
  'places_available',
  'alert_not_enabled',
  'idempotency_conflict',
  'native_reaction_required',
  'rate_limited',
])
const REGISTRATION_METHODS = new Set(['web', 'discord'] as const)
const MEMBER_PARTICIPATION_ACCESS_REASONS = new Set<MemberParticipationAccessReason>([
  'wolves_channel',
  'participation_record',
])
const TRAINING_ANNOUNCEMENT_STATUSES = new Set<TrainingAnnouncementStatus>([
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'missed',
  'cancelled',
])
const TRAINING_ANNOUNCEMENT_ACCESS_REASONS = new Set<TrainingAnnouncementAccessReason>([
  'super_admin',
  'head_coach',
])
const PARIS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function invalid(): never {
  throw new Error('Invalid BigBadBot bridge response')
}

export function createBridgeSignatureHeaders(
  secret: string,
  method: string,
  pathWithQuery: string,
  rawBody: string,
  timestamp = Math.floor(Date.now() / 1000).toString(),
) {
  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  const payload = `${timestamp}\n${method.toUpperCase()}\n${pathWithQuery}\n${bodyHash}`

  return {
    'Content-Type': 'application/json',
    'X-Wolves-Key-Id': 'v1',
    'X-Wolves-Timestamp': timestamp,
    'X-Wolves-Signature': createHmac('sha256', secret).update(payload).digest('hex'),
  }
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid()
}

function text(value: unknown, maximum: number, allowEmpty = false) {
  const candidate = typeof value === 'string' ? value.trim() : ''

  return (candidate || allowEmpty) && candidate.length <= maximum ? candidate : invalid()
}

function nullableDate(value: unknown) {
  if (value === null) return null
  const candidate = text(value, 40)

  return Number.isFinite(Date.parse(candidate)) ? candidate : invalid()
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid()
}

function nullableCount(value: unknown) {
  return value === null ? null : count(value)
}

function boolean(value: unknown) {
  return typeof value === 'boolean' ? value : invalid()
}

function optionalDiscordUrl(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  try {
    const url = new URL(text(value, 400))
    const allowedHostnames = new Set([
      'discord.com',
      'www.discord.com',
      'canary.discord.com',
      'ptb.discord.com',
    ])

    return url.protocol === 'https:' && allowedHostnames.has(url.hostname)
      ? url.toString()
      : invalid()
  } catch {
    return invalid()
  }
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>) {
  if (value === null) return null

  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : invalid()
}

function parseSession(value: unknown): MemberRegistrationSession {
  const source = record(value)
  const sessionKey = text(source.sessionKey, 160)
  if (!SESSION_KEY_PATTERN.test(sessionKey)) return invalid()

  const capacity = nullableCount(source.capacity)
  const registeredCount = count(source.registeredCount)
  const remaining = nullableCount(source.remaining)
  const isFull = boolean(source.isFull)
  const isRegistered = boolean(source.isRegistered)
  const registrationMethod = optionalEnum(source.registrationMethod, REGISTRATION_METHODS)
  const isEligible = boolean(source.isEligible)
  const eligibilityReason = optionalEnum(source.eligibilityReason, ELIGIBILITY_REASONS)
  if (
    capacity !== null &&
    remaining !== null &&
    remaining !== Math.max(0, capacity - registeredCount)
  ) {
    return invalid()
  }
  if (remaining !== null && isFull !== (remaining === 0)) return invalid()
  if (isRegistered !== Boolean(registrationMethod)) return invalid()
  if ((isEligible && eligibilityReason) || (!isEligible && !eligibilityReason)) return invalid()

  return {
    sessionKey,
    emoji: typeof source.emoji === 'string' && source.emoji.length <= 64 ? source.emoji : '',
    label: text(source.label, 180),
    details: text(source.details, 500, true),
    startsAt: nullableDate(source.startsAt),
    endsAt: nullableDate(source.endsAt),
    capacity,
    registeredCount,
    remaining,
    isFull,
    isRegistered,
    registrationMethod,
    isEligible,
    eligibilityReason,
    alertEnabled: boolean(source.alertEnabled),
    discordUrl: optionalDiscordUrl(source.discordUrl),
  }
}

export function parseMemberRegistrationResponse(value: unknown): MemberRegistrationResponse {
  const source = record(value)
  const eligible = boolean(source.eligible)
  const announcementSource = source.announcement === null ? null : record(source.announcement)
  const sessionSources = announcementSource?.sessions
  if (
    announcementSource &&
    (!Array.isArray(sessionSources) || sessionSources.length > TRAINING_ANNOUNCEMENT_MAX_EVENTS)
  ) {
    return invalid()
  }

  const denialReason = optionalEnum(source.denialReason, DENIAL_REASONS)
  if ((eligible && denialReason) || (!eligible && !denialReason)) return invalid()
  if (!eligible && announcementSource) return invalid()

  return {
    generatedAt: nullableDate(source.generatedAt) || invalid(),
    eligible,
    denialReason,
    announcement: announcementSource
      ? {
          title: text(announcementSource.title, 180),
          weekLabel: text(announcementSource.weekLabel, 100),
          createdAt: nullableDate(announcementSource.createdAt) || invalid(),
          discordUrl: optionalDiscordUrl(announcementSource.discordUrl),
          sessions: (sessionSources as unknown[]).map(parseSession),
        }
      : null,
  }
}

export function parseMemberParticipationAccess(value: unknown): MemberParticipationAccess {
  const source = record(value)
  const canAccess = boolean(source.canAccess)
  const reason = optionalEnum(source.reason, MEMBER_PARTICIPATION_ACCESS_REASONS)
  if (canAccess !== Boolean(reason)) return invalid()

  return { canAccess, reason }
}

export function parseRegistrationCommandResponse(
  value: unknown,
): MemberRegistrationCommandResponse {
  const source = record(value)
  const requestId = text(source.requestId, 36)
  if (!REQUEST_ID_PATTERN.test(requestId)) return invalid()

  return {
    requestId,
    status:
      typeof source.status === 'string' &&
      COMMAND_STATUSES.has(source.status as RegistrationCommandStatus)
        ? (source.status as RegistrationCommandStatus)
        : invalid(),
    code: optionalEnum(source.code, COMMAND_CODES),
  }
}

function requiredDate(value: unknown) {
  return nullableDate(value) || invalid()
}

function parisLocalDateTime(value: string) {
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return invalid()
  const parts = Object.fromEntries(
    PARIS_DATE_TIME_FORMATTER.formatToParts(instant).map((part) => [part.type, part.value]),
  )

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

function previousIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return value
  date.setUTCDate(date.getUTCDate() - 1)

  return date.toISOString().slice(0, 10)
}

function parseTrainingAnnouncement(value: unknown): TrainingAnnouncement {
  const source = record(value)
  const draft = validateTrainingAnnouncementDraft(source)
  if (!draft.success) return invalid()

  const id = text(source.id, 160)
  const revisionId = text(source.revisionId, 160)
  if (!SESSION_KEY_PATTERN.test(id) || !SESSION_KEY_PATTERN.test(revisionId)) return invalid()

  const sourceEvents = Array.isArray(source.events) ? source.events : invalid()
  const sourceEventRecords = sourceEvents.map(record)
  const eventIds = sourceEventRecords.map((event) => {
    const eventId = text(event.id, 160)
    return SESSION_KEY_PATTERN.test(eventId) ? eventId : invalid()
  })
  const eventEmojis = sourceEventRecords.map((event) => {
    return text(event.emoji, 64)
  })
  if (new Set(eventIds).size !== eventIds.length) return invalid()
  if (
    new Set(eventEmojis.map((emoji) => emoji.replace(/[\uFE0E\uFE0F]/g, ''))).size !==
    eventEmojis.length
  ) {
    return invalid()
  }

  const status =
    typeof source.status === 'string' &&
    TRAINING_ANNOUNCEMENT_STATUSES.has(source.status as TrainingAnnouncementStatus)
      ? (source.status as TrainingAnnouncementStatus)
      : invalid()
  const scheduledFor = nullableDate(source.scheduledFor)
  const publishedAt = nullableDate(source.publishedAt)
  if (['scheduled', 'publishing'].includes(status) && !scheduledFor) return invalid()
  if (status === 'published' && !publishedAt) return invalid()
  if (status === 'scheduled' && scheduledFor) {
    const localSchedule = parisLocalDateTime(scheduledFor)
    if (
      localSchedule.date !== draft.value.publishWindow.date ||
      localSchedule.time < draft.value.publishWindow.startTime ||
      localSchedule.time >= draft.value.publishWindow.endTime
    ) {
      return invalid()
    }
  }

  return {
    id,
    revisionId,
    status,
    ...draft.value,
    events: draft.value.events.map((event, index) => ({
      ...event,
      id: eventIds[index] as string,
      emoji: eventEmojis[index] as string,
    })),
    scheduledFor,
    discordUrl: optionalDiscordUrl(source.discordUrl),
    createdAt: requiredDate(source.createdAt),
    updatedAt: requiredDate(source.updatedAt),
    publishedAt,
  }
}

function parseTrainingAnnouncementSummary(value: unknown): TrainingAnnouncementSummary {
  const source = record(value)
  const id = text(source.id, 160)
  const revisionId = text(source.revisionId, 160)
  if (!SESSION_KEY_PATTERN.test(id) || !SESSION_KEY_PATTERN.test(revisionId)) return invalid()

  const status =
    typeof source.status === 'string' &&
    TRAINING_ANNOUNCEMENT_STATUSES.has(source.status as TrainingAnnouncementStatus)
      ? (source.status as TrainingAnnouncementStatus)
      : invalid()
  const weekStart = text(source.weekStart, 10)
  const eventCount = count(source.eventCount)
  if (eventCount < 1 || eventCount > TRAINING_ANNOUNCEMENT_MAX_EVENTS) return invalid()
  const minimalDraft = validateTrainingAnnouncementDraft({
    weekStart,
    timeZone: source.timeZone,
    intro: '',
    outro: '',
    publishWindow: {
      date: previousIsoDate(weekStart),
      startTime: '17:00',
      endTime: '19:00',
      timeZone: source.timeZone,
    },
    events: [
      {
        date: weekStart,
        startTime: '18:00',
        endTime: '19:00',
        types: ['open_gym'],
        topic: '',
        capacity: 40,
      },
    ],
  })
  if (!minimalDraft.success) return invalid()

  const scheduledFor = nullableDate(source.scheduledFor)
  const publishedAt = nullableDate(source.publishedAt)
  if (['scheduled', 'publishing'].includes(status) && !scheduledFor) return invalid()
  if (status === 'published' && !publishedAt) return invalid()

  return {
    id,
    revisionId,
    status,
    weekStart,
    timeZone: minimalDraft.value.timeZone,
    eventCount,
    scheduledFor,
    createdAt: requiredDate(source.createdAt),
    updatedAt: requiredDate(source.updatedAt),
    publishedAt,
  }
}

export function parseTrainingAnnouncementAccess(value: unknown): TrainingAnnouncementAccess {
  const source = record(value)
  const canManage = boolean(source.canManage)
  const reason = optionalEnum(source.reason, TRAINING_ANNOUNCEMENT_ACCESS_REASONS)
  if (canManage !== Boolean(reason)) return invalid()

  return { canManage, reason }
}

export function parseTrainingAnnouncementListResponse(
  value: unknown,
): TrainingAnnouncementListResponse {
  const source = record(value)
  if (!Array.isArray(source.announcements) || source.announcements.length > 200) return invalid()

  return {
    announcements: source.announcements.map(parseTrainingAnnouncementSummary),
  }
}

export function parseTrainingAnnouncementResponse(value: unknown): TrainingAnnouncementResponse {
  const source = record(value)

  return { announcement: parseTrainingAnnouncement(source.announcement) }
}

/**
 * Passes only the immutable Discord ID resolved by the server-side session.
 * Request queries and bodies never participate in selecting the actor.
 */
export async function withTrainingAnnouncementDiscordSession<TEvent, TResult>(
  event: TEvent,
  requireUser: (event: TEvent) => Promise<{ discordId: string }>,
  operation: (discordId: string) => Promise<TResult>,
) {
  const user = await requireUser(event)

  return operation(user.discordId)
}
