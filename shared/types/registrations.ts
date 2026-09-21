export type RegistrationDenialReason = 'not_guild_member' | 'channel_forbidden'

export type RegistrationEligibilityReason = 'missing_role' | 'team_restricted'

export type RegistrationAction = 'register' | 'cancel' | 'subscribe_alert' | 'unsubscribe_alert'

export type RegistrationCommandStatus = 'pending' | 'succeeded' | 'rejected'

export type RegistrationCommandCode =
  | 'already_registered'
  | 'not_registered'
  | 'full'
  | 'missing_role'
  | 'not_guild_member'
  | 'channel_forbidden'
  | 'stale_session'
  | 'discord_unavailable'
  | 'bridge_unavailable'
  | 'places_available'
  | 'alert_not_enabled'
  | 'idempotency_conflict'
  | 'native_reaction_required'
  | 'rate_limited'

export interface MemberRegistrationSession {
  /** Identifiant opaque du créneau courant, jamais un identifiant membre. */
  sessionKey: string
  emoji: string
  label: string
  details: string
  startsAt: string | null
  endsAt: string | null
  capacity: number | null
  registeredCount: number
  remaining: number | null
  isFull: boolean
  isRegistered: boolean
  /** Les réactions Discord restent gérées dans Discord par choix de parcours. */
  registrationMethod: 'web' | 'discord' | null
  isEligible: boolean
  eligibilityReason: RegistrationEligibilityReason | null
  alertEnabled: boolean
  discordUrl: string | null
}

export interface MemberRegistrationAnnouncement {
  title: string
  weekLabel: string
  createdAt: string
  discordUrl: string | null
  sessions: MemberRegistrationSession[]
}

export interface MemberRegistrationResponse {
  generatedAt: string
  eligible: boolean
  denialReason: RegistrationDenialReason | null
  announcement: MemberRegistrationAnnouncement | null
}

export interface MemberRegistrationActionBody {
  action: RegistrationAction
  sessionKey: string
}

export interface MemberRegistrationCommandResponse {
  requestId: string
  status: RegistrationCommandStatus
  code: RegistrationCommandCode | null
}
