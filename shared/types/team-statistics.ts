export const TEAM_STATISTICS_TEAMS = {
  penta: 'Pentagone',
  poly: 'Polygone',
  hexa: 'Hexagone',
  hepta: 'Heptagone',
  octo: 'Octogone',
  octolady: 'Octolady',
} as const

export type TeamStatisticsTeamKey = keyof typeof TEAM_STATISTICS_TEAMS

export interface TeamStatisticsAccess {
  canAccess: boolean
  reason: 'super_admin' | 'admin' | 'head_coach' | 'team_coach' | null
  detailTeamKeys: TeamStatisticsTeamKey[]
}

export interface TeamStatisticsMetadata {
  /** Année civile des séances, en Europe/Paris ; jamais l’année de la réaction. */
  year: number
  currentYear: number
  availableYears: number[]
  generatedAt: string
  sourceUpdatedAt: string | null
  /** Discord ne permet pas de reconstruire les anciennes affectations d’équipe. */
  rosterBasis: 'current_roles'
  /** « available » ne garantit pas un historique complet. */
  historyStatus: 'available' | 'empty'
}

export interface TeamStatisticsCounts {
  /** Inscriptions encore actives, pas présences confirmées. */
  registrations: number
  cancellations: number
  lateCancellations: number
  activeWeeks: number
}

export interface TeamStatisticsSummary extends TeamStatisticsCounts {
  key: TeamStatisticsTeamKey
  label: string
  configured: boolean
  canViewDetails: boolean
  memberCount: number
  registeredMemberCount: number
}

export interface TeamStatisticsMember extends TeamStatisticsCounts {
  /** Clé HMAC opaque : aucun identifiant Discord n’est transmis au navigateur. */
  key: string
  displayName: string
  username: string
  openGym: number
  workshop: number
  other: number
}

export interface TeamStatisticsMonth {
  month: string
  registrations: number
}

export interface TeamStatisticsOverview extends TeamStatisticsMetadata {
  teams: TeamStatisticsSummary[]
}

export interface TeamStatisticsDetail extends TeamStatisticsMetadata {
  team: TeamStatisticsSummary
  members: TeamStatisticsMember[]
  monthly: TeamStatisticsMonth[]
}
