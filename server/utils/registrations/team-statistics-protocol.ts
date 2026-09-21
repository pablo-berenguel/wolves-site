import {
  TEAM_STATISTICS_TEAMS,
  type TeamStatisticsAccess,
  type TeamStatisticsCounts,
  type TeamStatisticsDetail,
  type TeamStatisticsMember,
  type TeamStatisticsMetadata,
  type TeamStatisticsOverview,
  type TeamStatisticsSummary,
  type TeamStatisticsTeamKey,
} from '../../../shared/types/team-statistics'

function invalid(): never {
  throw new Error('Invalid team statistics response')
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
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) {
    return invalid()
  }
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid()
  return value
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid()
  return value
}

function year(value: unknown): number {
  const result = count(value)
  if (result < 2000 || result > 2100) return invalid()
  return result
}

export function isTeamStatisticsKey(value: unknown): value is TeamStatisticsTeamKey {
  return typeof value === 'string' && Object.hasOwn(TEAM_STATISTICS_TEAMS, value)
}

function teamKey(value: unknown): TeamStatisticsTeamKey {
  if (!isTeamStatisticsKey(value)) return invalid()
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

function counts(row: Record<string, unknown>): TeamStatisticsCounts {
  const result = {
    registrations: count(row.registrations),
    cancellations: count(row.cancellations),
    lateCancellations: count(row.lateCancellations),
    activeWeeks: count(row.activeWeeks),
  }
  if (result.lateCancellations > result.cancellations) return invalid()
  return result
}

function metadata(row: Record<string, unknown>): TeamStatisticsMetadata {
  const currentYear = year(row.currentYear)
  const selectedYear = year(row.year)
  const availableYears = unique(list(row.availableYears, 101).map(year))
  if (
    selectedYear > currentYear ||
    availableYears.some((value) => value > currentYear) ||
    !availableYears.includes(currentYear) ||
    !availableYears.includes(selectedYear) ||
    row.rosterBasis !== 'current_roles' ||
    (row.historyStatus !== 'available' && row.historyStatus !== 'empty')
  ) {
    return invalid()
  }
  return {
    year: selectedYear,
    currentYear,
    availableYears,
    generatedAt: timestamp(row.generatedAt),
    sourceUpdatedAt: row.sourceUpdatedAt === null ? null : timestamp(row.sourceUpdatedAt),
    rosterBasis: 'current_roles',
    historyStatus: row.historyStatus,
  }
}

function summary(value: unknown): TeamStatisticsSummary {
  const row = record(value)
  const key = teamKey(row.key)
  const result = {
    ...counts(row),
    key,
    // Libellés canoniques, indépendants des noms de rôles observés dans Discord.
    label: TEAM_STATISTICS_TEAMS[key],
    configured: boolean(row.configured),
    canViewDetails: boolean(row.canViewDetails),
    memberCount: count(row.memberCount),
    registeredMemberCount: count(row.registeredMemberCount),
  }
  if (
    result.registeredMemberCount > result.memberCount ||
    (!result.configured && result.canViewDetails)
  ) {
    return invalid()
  }
  return result
}

/** Chaque parseur reconstruit une liste blanche, sans recopier les champs privés du bridge. */
export function parseTeamStatisticsAccess(value: unknown): TeamStatisticsAccess {
  const row = record(value)
  const canAccess = boolean(row.canAccess)
  const keys = unique(list(row.detailTeamKeys, 6).map(teamKey))
  const reason = row.reason
  if (
    (!canAccess && (reason !== null || keys.length !== 0)) ||
    (canAccess &&
      reason !== 'super_admin' &&
      reason !== 'admin' &&
      reason !== 'head_coach' &&
      reason !== 'team_coach')
  ) {
    return invalid()
  }
  return { canAccess, reason: reason as TeamStatisticsAccess['reason'], detailTeamKeys: keys }
}

export function parseTeamStatisticsOverview(value: unknown): TeamStatisticsOverview {
  const row = record(value)
  const teams = list(row.teams, 6).map(summary)
  if (teams.length !== 6) return invalid()
  unique(teams.map((team) => team.key))
  return { ...metadata(row), teams }
}

export function parseTeamStatisticsDetail(value: unknown): TeamStatisticsDetail {
  const row = record(value)
  const meta = metadata(row)
  const team = summary(row.team)
  if (!team.configured || !team.canViewDetails) return invalid()
  const members = list(row.members, 5000).map((value): TeamStatisticsMember => {
    const member = record(value)
    const key = text(member.key, 67)
    if (!/^ts_[a-f0-9]{64}$/.test(key)) return invalid()
    return {
      ...counts(member),
      key,
      displayName: text(member.displayName, 160),
      username: text(member.username, 80, true),
      openGym: count(member.openGym),
      workshop: count(member.workshop),
      other: count(member.other),
    }
  })
  unique(members.map((member) => member.key))
  if (members.length !== team.memberCount) return invalid()
  const monthly = list(row.monthly, 12).map((value) => {
    const month = record(value)
    const label = text(month.month, 7)
    if (!new RegExp(`^${meta.year}-(0[1-9]|1[0-2])$`).test(label)) return invalid()
    return { month: label, registrations: count(month.registrations) }
  })
  if (monthly.length !== 12) return invalid()
  unique(monthly.map((month) => month.month))
  return { ...meta, team, members, monthly }
}
