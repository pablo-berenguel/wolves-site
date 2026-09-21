import { isAbsolute, resolve } from 'node:path'

import BetterSqlite3 from 'better-sqlite3'

import type { MemberParticipationStatsProjection } from '../../../shared/types/participations'

const SUPPORTED_SCHEMA_VERSION = '2'
const MAX_PROJECTION_AGE_MS = 30 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const DISCORD_ID_PATTERN = /^\d{17,20}$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]
const BREAKDOWN_LABELS: Record<string, string> = {
  open_gym: 'Open Gym',
  workshop: 'Ateliers',
  other: 'Autres activités',
}

interface MemberRow {
  registrations: number
  cancellations: number
  late_cancellations: number
  active_weeks: number
  club_active_weeks: number
}

interface PeriodRow {
  period_start: string
  registrations: number
}

interface BreakdownRow {
  category: string
  registrations: number
}

interface RecentRow {
  week_start: string
  category: string
  label: string
}

function unavailable(): never {
  throw Object.assign(new Error('Participation data unavailable'), {
    statusCode: 503,
    statusMessage: 'Participation data unavailable',
  })
}

export function resolveParticipationProjectionFilename() {
  const configured = process.env.NUXT_PARTICIPATION_DATA_PATH?.trim()
  const filename = configured || '.data/stats/participations.sqlite'

  return isAbsolute(filename) ? filename : resolve(filename)
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function metadata(database: BetterSqlite3.Database) {
  const entries = database.prepare('SELECT key, value FROM metadata').all() as Array<{
    key: string
    value: string
  }>

  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]))
}

function openProjection(filename: string) {
  try {
    const database = new BetterSqlite3(filename, {
      readonly: true,
      fileMustExist: true,
    })
    database.pragma('query_only = ON')
    database.pragma('busy_timeout = 5000')

    return database
  } catch {
    return unavailable()
  }
}

function validateMetadata(values: Record<string, string>) {
  const generatedAt = Date.parse(values.generated_at || '')
  const age = Date.now() - generatedAt

  if (
    values.schema_version !== SUPPORTED_SCHEMA_VERSION ||
    !Number.isFinite(generatedAt) ||
    age > MAX_PROJECTION_AGE_MS ||
    age < -MAX_CLOCK_SKEW_MS
  ) {
    return unavailable()
  }
}

function formatMonth(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return value

  const [year, month] = value.split('-').map(Number)
  return `${MONTHS[(month || 1) - 1]} ${year}`
}

function period(values: Record<string, string>) {
  const startCandidate = values.period_start || ''
  const endCandidate = values.period_end || ''
  const startDate = ISO_DATE_PATTERN.test(startCandidate) ? startCandidate : ''
  const endDate = ISO_DATE_PATTERN.test(endCandidate) ? endCandidate : ''

  return {
    label: startDate && endDate ? 'Historique des inscriptions' : 'Aucune période enregistrée',
    startDate,
    endDate,
  }
}

function emptyProjection(values: Record<string, string>): MemberParticipationStatsProjection {
  const clubActiveWeeks = safeCount(Number(values.club_active_weeks))
  const generatedAt = values.generated_at || unavailable()

  return {
    generatedAt,
    sourceUpdatedAt: values.source_updated_at || null,
    period: period(values),
    stats: {
      summary: {
        registrations: 0,
        cancellations: 0,
        lateCancellations: 0,
        totalActiveWeeks: 0,
        clubActiveWeeks,
        regularityPercent: clubActiveWeeks > 0 ? 0 : null,
      },
      timeSeries: {
        granularity: 'monthly',
        points: [],
      },
      breakdown: [],
      recent: [],
    },
  }
}

export async function hasMemberParticipationProjection(
  discordId: string,
  filename = resolveParticipationProjectionFilename(),
) {
  if (!DISCORD_ID_PATTERN.test(discordId)) return false

  const database = openProjection(filename)
  try {
    const values = metadata(database)
    validateMetadata(values)

    return Boolean(database.prepare('SELECT 1 FROM members WHERE discord_id = ?').get(discordId))
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error
    return unavailable()
  } finally {
    database.close()
  }
}

export async function getMemberParticipationProjection(
  discordId: string,
  filename = resolveParticipationProjectionFilename(),
): Promise<MemberParticipationStatsProjection> {
  if (!DISCORD_ID_PATTERN.test(discordId)) return unavailable()

  const database = openProjection(filename)
  try {
    const values = metadata(database)
    validateMetadata(values)
    const projection = emptyProjection(values)
    const member = database
      .prepare(
        `SELECT registrations, cancellations, late_cancellations, active_weeks, club_active_weeks
         FROM members
         WHERE discord_id = ?`,
      )
      .get(discordId) as MemberRow | undefined

    if (!member) return projection

    const registrations = safeCount(member.registrations)
    const cancellations = safeCount(member.cancellations)
    const lateCancellations = safeCount(member.late_cancellations)
    const totalActiveWeeks = safeCount(member.active_weeks)
    const clubActiveWeeks = safeCount(member.club_active_weeks)
    const periods = database
      .prepare(
        `SELECT period_start, registrations
         FROM periods
         WHERE discord_id = ?
         ORDER BY period_start`,
      )
      .all(discordId) as PeriodRow[]
    const breakdown = database
      .prepare(
        `SELECT category, registrations
         FROM breakdowns
         WHERE discord_id = ?
         ORDER BY registrations DESC, category`,
      )
      .all(discordId) as BreakdownRow[]
    const recent = database
      .prepare(
        `SELECT week_start, category, label
         FROM recent
         WHERE discord_id = ?
         ORDER BY position
         LIMIT 20`,
      )
      .all(discordId) as RecentRow[]

    projection.stats.summary = {
      registrations,
      cancellations,
      lateCancellations,
      totalActiveWeeks,
      clubActiveWeeks,
      regularityPercent:
        clubActiveWeeks > 0
          ? Math.min(100, Math.round((totalActiveWeeks / clubActiveWeeks) * 100))
          : null,
    }
    projection.stats.timeSeries.points = periods.map((entry) => ({
      periodStart: entry.period_start,
      label: formatMonth(entry.period_start),
      registrations: safeCount(entry.registrations),
    }))
    projection.stats.breakdown = breakdown.map((entry) => ({
      key: entry.category,
      label: BREAKDOWN_LABELS[entry.category] || 'Autres activités',
      registrations: safeCount(entry.registrations),
    }))
    projection.stats.recent = recent.map((entry) => ({
      startsAt: ISO_DATE_PATTERN.test(entry.week_start) ? entry.week_start : null,
      label: entry.label,
      category: entry.category,
    }))

    return projection
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error
    return unavailable()
  } finally {
    database.close()
  }
}
