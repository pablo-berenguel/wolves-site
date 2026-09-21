import type {
  AnimationEvent,
  AnimationEventFormationAnnotation,
  AnimationEventFormationPoint,
  AnimationEventFormationSurface,
  AnimationEventGroup,
  AnimationEventGroupConfig,
  AnimationEventGroupStage,
  AnimationEventGroupConfigResponse,
  AnimationEventKind,
  LegacyAnimationEventItem,
  ManagedAnimationEventItem,
  ManagedAnimationEventStatus,
  AnimationEventListResponse,
  AnimationEventParticipant,
  AnimationParticipantSource,
  AnimationEventPreviewResponse,
  AnimationEventResponse,
  AnimationEventSlot,
  AnimationEventStatus,
  AnimationEventSummary,
} from '../../../shared/types/animation-events'
import {
  ANIMATION_EVENT_FORMATION_COORDINATE_MAX,
  ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS,
  ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH,
  ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH,
  canonicalAnimationEventEmoji,
  isAnimationEventEmoji,
  validateAnimationEventDraft,
} from '../../../shared/animation-events/validation'

const OPAQUE_ID_PATTERN = /^[\w:-]{1,160}$/
const KINDS = new Set<AnimationEventKind>(['legacy', 'managed'])
const STATUSES = new Set<AnimationEventStatus>([
  'imported',
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'missed',
  'cancelled',
])
const PARTICIPANT_SOURCES = new Set<AnimationParticipantSource>(['gateway', 'backfill'])
const FORMATION_SURFACES = new Set<AnimationEventFormationSurface>([
  'square',
  'landscape',
  'portrait',
])
const DISCORD_HOSTNAMES = new Set([
  'discord.com',
  'www.discord.com',
  'canary.discord.com',
  'ptb.discord.com',
])
const AVATAR_PATH_PREFIX = '/api/admin/animation-events/participants/'
const LEGACY_CUSTOM_EMOJI_LABEL_PATTERN = /^:[A-Za-z0-9_]{2,32}:$/

function invalid(): never {
  throw new Error('Invalid BigBadBot animation event response')
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

function opaqueId(value: unknown) {
  const candidate = text(value, 160)
  return OPAQUE_ID_PATTERN.test(candidate) ? candidate : invalid()
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid()
}

function formationCoordinate(value: unknown) {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= ANIMATION_EVENT_FORMATION_COORDINATE_MAX
    ? value
    : invalid()
}

function formationPoint(value: unknown): AnimationEventFormationPoint {
  const source = record(value)
  return { x: formationCoordinate(source.x), y: formationCoordinate(source.y) }
}

function formationSurface(value: unknown): AnimationEventFormationSurface {
  if (value === undefined || value === null) return 'square'
  return typeof value === 'string' &&
    FORMATION_SURFACES.has(value as AnimationEventFormationSurface)
    ? (value as AnimationEventFormationSurface)
    : invalid()
}

function formationSchemaVersion(value: unknown): 0 | 1 {
  if (value === undefined || value === null) return 0
  return value === 0 || value === 1 ? value : invalid()
}

function nullableCount(value: unknown) {
  return value === null || value === undefined ? null : count(value)
}

function emoji(value: unknown) {
  return isAnimationEventEmoji(value) ? value : invalid()
}

function legacyEmoji(value: unknown) {
  if (isAnimationEventEmoji(value)) return value
  const candidate = text(value, 34)
  return LEGACY_CUSTOM_EMOJI_LABEL_PATTERN.test(candidate) ? candidate : invalid()
}

function bool(value: unknown) {
  return typeof value === 'boolean' ? value : invalid()
}

function date(value: unknown) {
  const candidate = text(value, 40)
  return Number.isFinite(Date.parse(candidate)) ? candidate : invalid()
}

function nullableDate(value: unknown) {
  return value === null || value === undefined ? null : date(value)
}

function url(value: unknown, allowedHostnames: Set<string>) {
  if (value === null || value === undefined || value === '') return null
  try {
    const candidate = new URL(text(value, 500))
    return candidate.protocol === 'https:' && allowedHostnames.has(candidate.hostname)
      ? candidate.toString()
      : invalid()
  } catch {
    return invalid()
  }
}

function avatarUrl(value: unknown, participantKey: string) {
  if (value === null || value === undefined || value === '') return null
  const candidate = text(value, 400)
  const expected = `${AVATAR_PATH_PREFIX}${participantKey}/avatar`

  return candidate === expected ? candidate : invalid()
}

function kind(value: unknown) {
  return typeof value === 'string' && KINDS.has(value as AnimationEventKind)
    ? (value as AnimationEventKind)
    : invalid()
}

function status(value: unknown) {
  return typeof value === 'string' && STATUSES.has(value as AnimationEventStatus)
    ? (value as AnimationEventStatus)
    : invalid()
}

function participantSource(value: unknown) {
  return typeof value === 'string' && PARTICIPANT_SOURCES.has(value as AnimationParticipantSource)
    ? (value as AnimationParticipantSource)
    : invalid()
}

function parseSummary(value: unknown): AnimationEventSummary {
  const source = record(value)
  const sourceKind = kind(source.kind)
  const sourceStatus = status(source.status)
  const scheduledFor = nullableDate(source.scheduledFor)
  const publishedAt = nullableDate(source.publishedAt)
  if (sourceKind === 'legacy' && sourceStatus !== 'imported') invalid()
  if (sourceKind === 'managed' && sourceStatus === 'imported') invalid()
  if (['scheduled', 'publishing'].includes(sourceStatus) && !scheduledFor) invalid()
  if (['imported', 'published'].includes(sourceStatus) && !publishedAt) invalid()

  const summary = {
    id: opaqueId(source.id),
    title: text(source.title, 180),
    itemCount: count(source.itemCount),
    slotCount: count(source.slotCount),
    participantCount: count(source.participantCount),
    historyComplete: bool(source.historyComplete),
    scheduledFor,
    discordUrl: url(source.discordUrl, DISCORD_HOSTNAMES),
    createdAt: date(source.createdAt),
    updatedAt: date(source.updatedAt),
    publishedAt,
    lastSyncedAt: nullableDate(source.lastSyncedAt),
    ...(typeof source.authorDisplayName === 'string' && source.authorDisplayName.trim()
      ? { authorDisplayName: text(source.authorDisplayName, 100) }
      : {}),
  }

  return sourceKind === 'legacy'
    ? { ...summary, kind: 'legacy', status: 'imported' }
    : {
        ...summary,
        kind: 'managed',
        status: sourceStatus as ManagedAnimationEventStatus,
      }
}

function parseParticipant(value: unknown): AnimationEventParticipant {
  const source = record(value)
  const teams = Array.isArray(source.teams) ? source.teams : invalid()
  if (teams.length > 10) invalid()
  const participantKey = opaqueId(source.participantKey)
  const addedAt = nullableDate(source.addedAt)
  const removedAt = nullableDate(source.removedAt)
  const active = bool(source.active)
  if (active && removedAt) invalid()

  return {
    participantKey,
    displayName: text(source.displayName, 100),
    username: text(source.username, 80),
    avatarUrl: avatarUrl(source.avatarUrl, participantKey),
    teams: teams.map((team) => text(team, 60)),
    active,
    source: participantSource(source.source),
    historyComplete: bool(source.historyComplete),
    firstSeenAt: date(source.firstSeenAt),
    addedAt,
    removedAt,
  }
}

function parseGroup(value: unknown): AnimationEventGroup {
  const source = record(value)
  const members = Array.isArray(source.members) ? source.members : invalid()
  if (members.length < 1 || members.length > 3) invalid()
  const parsedMembers = members.map((member) => {
    const memberSource = record(member)
    return {
      participantKey: opaqueId(memberSource.participantKey),
      position: count(memberSource.position),
    }
  })
  if (new Set(parsedMembers.map((member) => member.position)).size !== parsedMembers.length) {
    invalid()
  }

  return {
    id: opaqueId(source.id),
    position: count(source.position),
    members: parsedMembers,
    placement:
      source.placement === undefined || source.placement === null
        ? null
        : formationPoint(source.placement),
  }
}

function parseFormationAnnotation(value: unknown): AnimationEventFormationAnnotation {
  const source = record(value)
  const base = {
    id: opaqueId(source.id),
    position: count(source.position),
    count: text(source.count, ANIMATION_EVENT_MAX_FORMATION_COUNT_LENGTH),
    figure: text(source.figure, ANIMATION_EVENT_MAX_FORMATION_FIGURE_LENGTH),
    start: formationPoint(source.start),
  }
  if (source.kind === 'point') {
    if (source.end !== null) invalid()
    return { ...base, kind: 'point', end: null }
  }
  if (source.kind === 'line') {
    const end = formationPoint(source.end)
    if (base.start.x === end.x && base.start.y === end.y) invalid()
    return { ...base, kind: 'line', end }
  }
  return invalid()
}

function parseGroupStage(value: unknown): AnimationEventGroupStage {
  const source = record(value)
  const groups = Array.isArray(source.groups) ? source.groups : invalid()
  if (groups.length > 100) invalid()
  const parsedGroups = groups.map(parseGroup)
  const annotations =
    source.annotations === undefined
      ? []
      : Array.isArray(source.annotations)
        ? source.annotations
        : invalid()
  if (annotations.length > ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS) invalid()
  const parsedAnnotations = annotations.map(parseFormationAnnotation)
  const groupIds = parsedGroups.map((group) => group.id)
  const groupPositions = parsedGroups.map((group) => group.position)
  const participantKeys = parsedGroups.flatMap((group) =>
    group.members.map((member) => member.participantKey),
  )
  if (new Set(groupIds).size !== groupIds.length) invalid()
  if (new Set(groupPositions).size !== groupPositions.length) invalid()
  if (new Set(participantKeys).size !== participantKeys.length) invalid()
  if (new Set(parsedAnnotations.map((annotation) => annotation.id)).size !== annotations.length) {
    invalid()
  }
  if (
    new Set(parsedAnnotations.map((annotation) => annotation.position)).size !== annotations.length
  ) {
    invalid()
  }

  return {
    id: opaqueId(source.id),
    label: text(source.label, 120),
    position: count(source.position),
    surface: formationSurface(source.surface),
    groups: parsedGroups,
    annotations: parsedAnnotations,
  }
}

function parseGroupConfig(value: unknown): AnimationEventGroupConfig {
  const source = record(value)
  const legacyGroups = Array.isArray(source.groups) ? source.groups : null
  const stages = Array.isArray(source.stages)
    ? source.stages
    : legacyGroups
      ? [{ id: 'legacy:stage:1', label: 'Étape 1', position: 0, groups: legacyGroups }]
      : invalid()
  if (stages.length < 1 || stages.length > 20) invalid()
  const parsedStages = stages.map(parseGroupStage)
  if (new Set(parsedStages.map((stage) => stage.id)).size !== parsedStages.length) invalid()
  if (new Set(parsedStages.map((stage) => stage.position)).size !== parsedStages.length) invalid()
  const groupIds = parsedStages.flatMap((stage) => stage.groups.map((group) => group.id))
  if (new Set(groupIds).size !== groupIds.length) invalid()
  const annotationIds = parsedStages.flatMap((stage) =>
    stage.annotations.map((annotation) => annotation.id),
  )
  if (new Set(annotationIds).size !== annotationIds.length) invalid()

  return {
    version: count(source.version),
    formationSchemaVersion: formationSchemaVersion(source.formationSchemaVersion),
    label: text(source.label, 120, true),
    updatedAt: nullableDate(source.updatedAt),
    stages: parsedStages,
  }
}

function parseSlot(value: unknown, emojiKind: AnimationEventKind): AnimationEventSlot {
  const source = record(value)
  const participants = Array.isArray(source.participants) ? source.participants : invalid()
  if (participants.length > 1_000) invalid()
  const parsedParticipants = participants.map(parseParticipant)
  if (
    new Set(parsedParticipants.map((participant) => participant.participantKey)).size !==
    parsedParticipants.length
  ) {
    invalid()
  }
  const groupConfig = parseGroupConfig(source.groupConfig)
  const participantKeys = new Set(
    parsedParticipants.map((participant) => participant.participantKey),
  )
  if (
    groupConfig.stages.some((stage) =>
      stage.groups.some((group) =>
        group.members.some((member) => !participantKeys.has(member.participantKey)),
      ),
    )
  ) {
    invalid()
  }

  return {
    id: opaqueId(source.id),
    label: text(source.label, 120),
    emoji: emojiKind === 'managed' ? emoji(source.emoji) : legacyEmoji(source.emoji),
    capacity: nullableCount(source.capacity),
    position: count(source.position),
    isPresent: bool(source.isPresent),
    participants: parsedParticipants,
    groupConfig,
  }
}

function parseItemBase(value: unknown, kind: AnimationEventKind) {
  const source = record(value)
  const slots = Array.isArray(source.slots) ? source.slots : invalid()
  if (slots.length < 1 || slots.length > 20) invalid()
  const parsedSlots = slots.map((slot) => parseSlot(slot, kind))
  if (new Set(parsedSlots.map((slot) => slot.id)).size !== parsedSlots.length) invalid()

  const base = {
    id: opaqueId(source.id),
    title: text(source.title, 180),
    location: text(source.location, 180, true),
    details: text(source.details, 1_000, true),
    position: count(source.position),
    slots: parsedSlots,
  }

  return { source, base }
}

function parseLegacyItem(value: unknown): LegacyAnimationEventItem {
  const { source, base } = parseItemBase(value, 'legacy')
  if (source.eventDate !== null || source.startTime !== null || source.meetingTime !== null) {
    invalid()
  }
  return { ...base, eventDate: null, startTime: null, meetingTime: null }
}

function parseManagedItem(value: unknown): ManagedAnimationEventItem {
  const { source, base } = parseItemBase(value, 'managed')
  return {
    ...base,
    eventDate: text(source.eventDate, 10),
    startTime: text(source.startTime, 5),
    meetingTime:
      source.meetingTime === null || source.meetingTime === undefined
        ? null
        : text(source.meetingTime, 5),
  }
}

function validateItemCount(summary: AnimationEventSummary, items: Array<{ slots: unknown[] }>) {
  if (summary.itemCount !== items.length) invalid()
  if (summary.slotCount !== items.flatMap((item) => item.slots).length) invalid()
}

function validateUniqueEmojis(items: Array<{ slots: Array<{ emoji: string }> }>) {
  const identities = items.flatMap((item) =>
    item.slots.map((slot) => canonicalAnimationEventEmoji(slot.emoji)),
  )
  if (new Set(identities).size !== identities.length) invalid()
}

function parseEvent(value: unknown): AnimationEvent {
  const source = record(value)
  const summary = parseSummary(source)
  const items = Array.isArray(source.items) ? source.items : invalid()
  if (items.length < 1 || items.length > 10) invalid()

  if (summary.kind === 'legacy') {
    const parsedItems = items.map(parseLegacyItem)
    validateItemCount(summary, parsedItems)
    validateUniqueEmojis(parsedItems)
    if (source.revisionId !== null || source.timeZone !== null || source.publishWindow !== null) {
      invalid()
    }
    return {
      ...summary,
      kind: 'legacy',
      status: 'imported',
      revisionId: null,
      intro: text(source.intro, 1_000, true),
      outro: text(source.outro, 1_000, true),
      timeZone: null,
      publishWindow: null,
      items: parsedItems,
    }
  }

  const parsedItems = items.map(parseManagedItem)
  validateItemCount(summary, parsedItems)
  validateUniqueEmojis(parsedItems)
  const validated = validateAnimationEventDraft({
    title: source.title,
    intro: source.intro,
    outro: source.outro,
    timeZone: source.timeZone,
    publishWindow: source.publishWindow,
    items: parsedItems.map((item) => ({
      id: item.id,
      title: item.title,
      eventDate: item.eventDate,
      startTime: item.startTime,
      meetingTime: item.meetingTime,
      location: item.location,
      details: item.details,
      slots: item.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        emoji: slot.emoji,
        capacity: slot.capacity,
      })),
    })),
  })
  if (!validated.success) invalid()
  return {
    ...summary,
    kind: 'managed',
    revisionId: opaqueId(source.revisionId),
    intro: validated.value.intro,
    outro: validated.value.outro,
    timeZone: validated.value.timeZone,
    publishWindow: validated.value.publishWindow,
    items: parsedItems,
  }
}

export function parseAnimationEventListResponse(value: unknown): AnimationEventListResponse {
  const source = record(value)
  const events = Array.isArray(source.events) ? source.events : invalid()
  if (events.length > 200) invalid()
  return { events: events.map(parseSummary) }
}

export function parseAnimationEventResponse(value: unknown): AnimationEventResponse {
  return { event: parseEvent(record(value).event) }
}

export function parseAnimationEventPreviewResponse(value: unknown): AnimationEventPreviewResponse {
  const preview = record(record(value).preview)
  const slots = Array.isArray(preview.slots) ? preview.slots : invalid()
  if (slots.length < 1 || slots.length > 20) invalid()
  const content = text(preview.content, 2_000)
  const characterCount = count(preview.characterCount)
  if ([...content].length !== characterCount || characterCount > 2_000) invalid()

  const parsedSlots = slots.map((slot) => {
    const source = record(slot)
    return {
      itemId: opaqueId(source.itemId),
      slotId: opaqueId(source.slotId),
      label: text(source.label, 120),
      emoji: emoji(source.emoji),
    }
  })
  const emojiIdentities = parsedSlots.map((slot) => canonicalAnimationEventEmoji(slot.emoji))
  if (new Set(emojiIdentities).size !== emojiIdentities.length) invalid()

  return {
    preview: {
      content,
      characterCount,
      slots: parsedSlots,
    },
  }
}

export function parseAnimationEventGroupConfigResponse(
  value: unknown,
): AnimationEventGroupConfigResponse {
  return { groupConfig: parseGroupConfig(record(value).groupConfig) }
}
