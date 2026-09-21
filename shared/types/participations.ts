export type ParticipationTimeGranularity = 'weekly' | 'monthly'

export type MemberParticipationAccessReason = 'wolves_channel' | 'participation_record'

/**
 * Décision privée rendue par BigBadBot. L'identifiant du salon vérifié reste
 * dans la configuration du bot et n'est jamais transmis au navigateur.
 */
export interface MemberParticipationAccess {
  canAccess: boolean
  reason: MemberParticipationAccessReason | null
}

export interface MemberParticipationPeriod {
  label: string
  startDate: string
  endDate: string
}

export interface MemberParticipationSummary {
  /** Inscriptions encore actives dans BigBadBot, et non présences confirmées. */
  registrations: number
  /** Annulations conservées dans le journal BigBadBot ; le legacy peut être partiel. */
  cancellations: number
  /** Sous-ensemble des annulations effectuées moins de 24 h avant le créneau. */
  lateCancellations: number
  totalActiveWeeks: number
  clubActiveWeeks: number
  /**
   * Semaines avec au moins une inscription divisées par les semaines
   * d'activité du club. `null` lorsque le dénominateur n'est pas disponible.
   */
  regularityPercent: number | null
}

export interface MemberParticipationTimePoint {
  periodStart: string
  label: string
  registrations: number
}

export interface MemberParticipationTimeSeries {
  granularity: ParticipationTimeGranularity
  points: MemberParticipationTimePoint[]
}

export interface MemberParticipationBreakdownItem {
  key: string
  label: string
  registrations: number
}

export interface MemberParticipationRecentItem {
  /** Lundi ISO de la semaine ; BigBadBot ne garantit pas la date de la séance. */
  startsAt: string | null
  label: string
  category: string
}

/**
 * Projection privée produite côté serveur à partir de BigBadBot.
 * Elle ne doit jamais contenir de ligne brute, d'identifiant Discord, de
 * message, de canal ou de réaction Discord.
 */
export interface MemberParticipationStatsProjection {
  generatedAt: string
  sourceUpdatedAt: string | null
  period: MemberParticipationPeriod
  stats: {
    summary: MemberParticipationSummary
    timeSeries: MemberParticipationTimeSeries
    breakdown: MemberParticipationBreakdownItem[]
    recent: MemberParticipationRecentItem[]
  }
}

export interface MemberParticipationsResponse extends MemberParticipationStatsProjection {
  user: {
    displayName: string | null
    username: string
  }
}
