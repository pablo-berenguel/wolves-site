export const TRAINING_ANNOUNCEMENT_TIME_ZONE = 'Europe/Paris' as const

export type TrainingAnnouncementStatus =
  'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'missed' | 'cancelled'

export type TrainingEventType = 'open_gym' | 'workshop'

export type TrainingAnnouncementAction = 'schedule' | 'publish_now' | 'cancel' | 'retry'

export type TrainingAnnouncementAccessReason = 'super_admin' | 'head_coach'

export interface TrainingAnnouncementPublishWindow {
  date: string
  startTime: string
  endTime: string
  timeZone: typeof TRAINING_ANNOUNCEMENT_TIME_ZONE
}

/** Event input kept independent from Discord message formatting. */
export interface TrainingAnnouncementEventDraft {
  /** Stable opaque ID on updates; BigBadBot creates it when omitted on creation. */
  id?: string
  date: string
  startTime: string
  endTime: string
  types: TrainingEventType[]
  topic: string
  details: string
  /** Omitted on creation to let BigBadBot select the first available reaction. */
  emoji?: string | null
  capacity: number
}

export interface TrainingAnnouncementDraft {
  /** ISO local date for the Monday starting the selected week. */
  weekStart: string
  timeZone: typeof TRAINING_ANNOUNCEMENT_TIME_ZONE
  intro: string
  outro: string
  publishWindow: TrainingAnnouncementPublishWindow
  events: TrainingAnnouncementEventDraft[]
}

export interface TrainingAnnouncementEvent extends Omit<TrainingAnnouncementEventDraft, 'emoji'> {
  id: string
  emoji: string
}

export interface TrainingAnnouncement extends Omit<TrainingAnnouncementDraft, 'events'> {
  id: string
  revisionId: string
  status: TrainingAnnouncementStatus
  events: TrainingAnnouncementEvent[]
  scheduledFor: string | null
  discordUrl: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface TrainingAnnouncementSummary {
  id: string
  revisionId: string
  status: TrainingAnnouncementStatus
  weekStart: string
  timeZone: typeof TRAINING_ANNOUNCEMENT_TIME_ZONE
  eventCount: number
  scheduledFor: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface TrainingAnnouncementAccess {
  canManage: boolean
  reason: TrainingAnnouncementAccessReason | null
}

export interface TrainingAnnouncementCreateRequest {
  requestId: string
  announcement: TrainingAnnouncementDraft
}

export interface TrainingAnnouncementUpdateRequest extends TrainingAnnouncementCreateRequest {
  expectedRevisionId: string
}

export interface TrainingAnnouncementActionRequest {
  requestId: string
  expectedRevisionId: string
  action: TrainingAnnouncementAction
}

export interface TrainingAnnouncementListResponse {
  announcements: TrainingAnnouncementSummary[]
}

export interface TrainingAnnouncementResponse {
  announcement: TrainingAnnouncement
}
