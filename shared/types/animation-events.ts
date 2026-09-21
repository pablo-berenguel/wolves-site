export const ANIMATION_EVENT_TIME_ZONE = 'Europe/Paris' as const

export type AnimationEventKind = 'legacy' | 'managed'

export type AnimationEventStatus =
  | 'imported'
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'missed'
  | 'cancelled'

export type ManagedAnimationEventStatus = Exclude<AnimationEventStatus, 'imported'>

export type AnimationEventAction = 'schedule' | 'publish_now' | 'cancel' | 'retry' | 'duplicate'

export type AnimationParticipantSource = 'gateway' | 'backfill'

export interface AnimationEventPublishWindow {
  date: string
  startTime: string
  endTime: string
  timeZone: typeof ANIMATION_EVENT_TIME_ZONE
}

export interface AnimationEventSlotDraft {
  id?: string
  label: string
  emoji?: string | null
  capacity?: number | null
}

export interface AnimationEventItemDraft {
  id?: string
  title: string
  eventDate: string
  startTime: string
  meetingTime?: string | null
  location: string
  details: string
  slots: AnimationEventSlotDraft[]
}

export interface AnimationEventDraft {
  title: string
  intro: string
  outro: string
  timeZone: typeof ANIMATION_EVENT_TIME_ZONE
  publishWindow: AnimationEventPublishWindow
  items: AnimationEventItemDraft[]
}

export interface AnimationEventParticipant {
  /** Opaque bridge identifier. This is never a Discord ID. */
  participantKey: string
  displayName: string
  username: string
  avatarUrl: string | null
  teams: string[]
  active: boolean
  source: AnimationParticipantSource
  historyComplete: boolean
  firstSeenAt: string
  addedAt: string | null
  removedAt: string | null
}

export interface AnimationEventGroupMember {
  participantKey: string
  position: number
}

export type AnimationEventFormationSurface = 'square' | 'landscape' | 'portrait'

export interface AnimationEventFormationPoint {
  /** Integer coordinate from 0 to 10,000, relative to the formation surface. */
  x: number
  /** Integer coordinate from 0 to 10,000, relative to the formation surface. */
  y: number
}

export interface AnimationEventFormationAnnotationBase {
  id: string
  position: number
  count: string
  figure: string
}

export type AnimationEventFormationAnnotation = AnimationEventFormationAnnotationBase &
  (
    | {
        kind: 'point'
        start: AnimationEventFormationPoint
        end: null
      }
    | {
        kind: 'line'
        start: AnimationEventFormationPoint
        end: AnimationEventFormationPoint
      }
  )

export interface AnimationEventGroup {
  id: string
  position: number
  members: AnimationEventGroupMember[]
  placement: AnimationEventFormationPoint | null
}

export interface AnimationEventGroupStage {
  id: string
  label: string
  position: number
  surface: AnimationEventFormationSurface
  groups: AnimationEventGroup[]
  annotations: AnimationEventFormationAnnotation[]
}

/**
 * Write model kept separate from the canonical response. Optional formation fields let an old
 * browser omit data without turning that omission into an explicit reset in BigBadBot.
 */
export interface AnimationEventGroupRequest {
  id: string
  position: number
  members: AnimationEventGroupMember[]
  placement?: AnimationEventFormationPoint | null
}

export interface AnimationEventGroupStageRequest {
  id: string
  label: string
  position: number
  surface?: AnimationEventFormationSurface
  groups: AnimationEventGroupRequest[]
  annotations?: AnimationEventFormationAnnotation[]
}

export interface AnimationEventGroupConfig {
  version: number
  formationSchemaVersion: 0 | 1
  label: string
  updatedAt: string | null
  stages: AnimationEventGroupStage[]
}

export interface AnimationEventSlot extends Omit<
  Required<AnimationEventSlotDraft>,
  'capacity' | 'emoji'
> {
  emoji: string
  capacity: number | null
  position: number
  isPresent: boolean
  participants: AnimationEventParticipant[]
  groupConfig: AnimationEventGroupConfig
}

interface AnimationEventItemBase {
  id: string
  title: string
  location: string
  details: string
  position: number
  slots: AnimationEventSlot[]
}

export interface ManagedAnimationEventItem extends AnimationEventItemBase {
  eventDate: string
  startTime: string
  meetingTime: string | null
}

export interface LegacyAnimationEventItem extends AnimationEventItemBase {
  /** Discord does not expose reliable structured dates for historical free-form messages. */
  eventDate: null
  startTime: null
  meetingTime: null
}

export type AnimationEventItem = ManagedAnimationEventItem | LegacyAnimationEventItem

interface AnimationEventSummaryBase {
  id: string
  title: string
  itemCount: number
  slotCount: number
  participantCount: number
  historyComplete: boolean
  scheduledFor: string | null
  discordUrl: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  lastSyncedAt: string | null
  authorDisplayName?: string
}

export type AnimationEventSummary = AnimationEventSummaryBase &
  (
    | { kind: 'legacy'; status: 'imported' }
    | { kind: 'managed'; status: ManagedAnimationEventStatus }
  )

interface AnimationEventBase extends AnimationEventSummaryBase {
  intro: string
  outro: string
}

export interface ManagedAnimationEvent extends AnimationEventBase {
  kind: 'managed'
  status: ManagedAnimationEventStatus
  revisionId: string
  timeZone: typeof ANIMATION_EVENT_TIME_ZONE
  publishWindow: AnimationEventPublishWindow
  items: ManagedAnimationEventItem[]
}

export interface LegacyAnimationEvent extends AnimationEventBase {
  kind: 'legacy'
  status: 'imported'
  revisionId: null
  timeZone: null
  publishWindow: null
  items: LegacyAnimationEventItem[]
}

export type AnimationEvent = ManagedAnimationEvent | LegacyAnimationEvent

export interface AnimationEventPreviewSlot {
  itemId: string
  slotId: string
  label: string
  emoji: string
}

export interface AnimationEventPreview {
  content: string
  characterCount: number
  slots: AnimationEventPreviewSlot[]
}

export interface AnimationEventCreateRequest {
  requestId: string
  event: AnimationEventDraft
}

export interface AnimationEventUpdateRequest extends AnimationEventCreateRequest {
  expectedRevisionId: string
}

export interface AnimationEventActionRequest {
  requestId: string
  expectedRevisionId: string
  action: AnimationEventAction
}

export interface AnimationEventGroupConfigRequest {
  requestId: string
  expectedVersion: number
  label: string
  stages: AnimationEventGroupStageRequest[]
}

export interface AnimationEventListResponse {
  events: AnimationEventSummary[]
}

export interface AnimationEventResponse {
  event: AnimationEvent
}

export interface AnimationEventPreviewResponse {
  preview: AnimationEventPreview
}

export interface AnimationEventGroupConfigResponse {
  groupConfig: AnimationEventGroupConfig
}
