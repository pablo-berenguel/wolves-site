import type { TeamStatisticsTeamKey } from './team-statistics'

export interface TrainingRosterAccess {
  canAccess: boolean
  reason: 'wolves_role' | 'missing_wolves_role' | 'not_guild_member' | 'channel_forbidden'
}

export interface TrainingRosterSession {
  /** Clé opaque du créneau, et non ID Discord du message. */
  key: string
  emoji: string
  label: string
  details: string
  startsAt: string
  endsAt: string
  capacity: number
  state: 'upcoming' | 'ongoing' | 'past'
}

export interface TrainingRosterParticipant {
  /** HMAC opaque ; aucun identifiant membre n’est envoyé au navigateur. */
  key: string
  displayName: string
  username: string
  teamKeys: TeamStatisticsTeamKey[]
  /** L’absence du rôle Flyer ne prouve pas qu’une personne est Base. */
  isFlyer: boolean | null
  profileAvailable: boolean
}

export interface TrainingRosterAnnouncement {
  title: string
  weekLabel: string
  publishedAt: string
  sessions: TrainingRosterSession[]
}

export interface TrainingRosterResponse {
  generatedAt: string
  /** Dernière annonce publiée reconnue, pas une annonce ancienne encore ouverte. */
  announcement: TrainingRosterAnnouncement | null
  selectedSessionKey: string | null
  selectionReason: 'requested' | 'ongoing' | 'next' | 'latest_past' | null
  participants: TrainingRosterParticipant[]
}
