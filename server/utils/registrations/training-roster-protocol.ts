import type {
  TrainingRosterAccess,
  TrainingRosterParticipant,
  TrainingRosterResponse,
  TrainingRosterSession,
} from '../../../shared/types/training-roster'
import { isTeamStatisticsKey } from './team-statistics-protocol'

const SESSION_KEY = /^[A-Za-z0-9_-]{24}$/

function invalid(): never {
  throw new Error('Invalid training roster response')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}

function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid()
  return value
}

function text(value: unknown, maximum: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim()))
    return invalid()
  return value
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid()
  return value
}

function timestamp(value: unknown): string {
  const result = text(value, 40)
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(result) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    return invalid()
  return result
}

function unique<T>(values: T[]): T[] {
  if (new Set(values).size !== values.length) return invalid()
  return values
}

export function isTrainingRosterSessionKey(value: unknown): value is string {
  return typeof value === 'string' && SESSION_KEY.test(value)
}

function sessionKey(value: unknown): string {
  if (!isTrainingRosterSessionKey(value)) return invalid()
  return value
}

export function parseTrainingRosterAccess(value: unknown): TrainingRosterAccess {
  const row = record(value)
  const canAccess = bool(row.canAccess)
  if (canAccess) {
    if (row.reason !== 'wolves_role') return invalid()
    return { canAccess: true, reason: 'wolves_role' }
  }
  if (
    row.reason !== 'missing_wolves_role' &&
    row.reason !== 'not_guild_member' &&
    row.reason !== 'channel_forbidden'
  )
    return invalid()
  return { canAccess: false, reason: row.reason }
}

function session(value: unknown): TrainingRosterSession {
  const row = record(value)
  const startsAt = timestamp(row.startsAt)
  const endsAt = timestamp(row.endsAt)
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return invalid()
  const capacity = row.capacity
  if (typeof capacity !== 'number' || !Number.isSafeInteger(capacity) || capacity < 0)
    return invalid()
  const state = row.state
  if (state !== 'upcoming' && state !== 'ongoing' && state !== 'past') return invalid()
  return {
    key: sessionKey(row.key),
    emoji: text(row.emoji, 100),
    label: text(row.label, 180),
    details: text(row.details, 1000, true),
    startsAt,
    endsAt,
    capacity,
    state,
  }
}

function participant(value: unknown): TrainingRosterParticipant {
  const row = record(value)
  const key = text(row.key, 67)
  if (!/^tr_[a-f0-9]{64}$/.test(key)) return invalid()
  const teamKeys = unique(
    list(row.teamKeys, 6).map((value) => {
      if (!isTeamStatisticsKey(value)) return invalid()
      return value
    }),
  )
  const profileAvailable = bool(row.profileAvailable)
  const isFlyer = row.isFlyer === null ? null : bool(row.isFlyer)
  if (
    (profileAvailable && isFlyer === null) ||
    (!profileAvailable && (teamKeys.length > 0 || isFlyer !== null))
  )
    return invalid()
  return {
    key,
    displayName: text(row.displayName, 160),
    username: text(row.username, 80, true),
    teamKeys,
    isFlyer,
    profileAvailable,
  }
}

/** Liste blanche : aucune réaction brute, clé Discord ni statistique annuelle n’est recopiée. */
export function parseTrainingRosterResponse(value: unknown): TrainingRosterResponse {
  const row = record(value)
  const generatedAt = timestamp(row.generatedAt)
  const participants = list(row.participants, 5000).map(participant)
  unique(participants.map((entry) => entry.key))
  if (row.announcement === null) {
    if (row.selectedSessionKey !== null || row.selectionReason !== null || participants.length)
      return invalid()
    return {
      generatedAt,
      announcement: null,
      selectedSessionKey: null,
      selectionReason: null,
      participants: [],
    }
  }
  const announcement = record(row.announcement)
  const sessions = list(announcement.sessions, 20).map(session)
  if (!sessions.length) return invalid()
  unique(sessions.map((entry) => entry.key))
  const selectedSessionKey = sessionKey(row.selectedSessionKey)
  if (!sessions.some((entry) => entry.key === selectedSessionKey)) return invalid()
  const selectionReason = row.selectionReason
  if (
    selectionReason !== 'requested' &&
    selectionReason !== 'next' &&
    selectionReason !== 'ongoing' &&
    selectionReason !== 'latest_past'
  )
    return invalid()
  return {
    generatedAt,
    announcement: {
      title: text(announcement.title, 180),
      weekLabel: text(announcement.weekLabel, 180),
      publishedAt: timestamp(announcement.publishedAt),
      sessions,
    },
    selectedSessionKey,
    selectionReason,
    participants,
  }
}
