import type { H3Event } from 'h3'

import { describe, expect, it, vi } from 'vitest'

import {
  TRAINING_ANNOUNCEMENT_DEFAULT_CAPACITY,
  TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH,
  TRAINING_ANNOUNCEMENT_MAX_EVENTS,
  validateTrainingAnnouncementActionRequest,
  validateTrainingAnnouncementCreateRequest,
  validateTrainingAnnouncementDraft,
  validateTrainingAnnouncementUpdateRequest,
} from '../shared/training-announcements/validation'
import {
  parseTrainingAnnouncementAccess,
  parseTrainingAnnouncementListResponse,
  parseTrainingAnnouncementResponse,
  withTrainingAnnouncementDiscordSession,
} from '../server/utils/registrations/protocol'

const requestId = 'de305d54-75b4-431b-adb2-eb6b9e546014'

function validDraft() {
  return {
    weekStart: '2026-08-24',
    timeZone: 'Europe/Paris',
    intro: 'Voici les entraînements de la semaine.',
    outro: 'À très vite !',
    publishWindow: {
      date: '2026-08-23',
      startTime: '17:00',
      endTime: '19:00',
      timeZone: 'Europe/Paris',
    },
    events: [
      {
        date: '2026-08-25',
        startTime: '18:00',
        endTime: '20:00',
        types: ['open_gym', 'workshop'],
        topic: 'Tumbling',
        details: 'Travail libre sur le praticable.',
      },
    ],
  }
}

function bridgeAnnouncement() {
  return {
    id: 'announcement:week-35',
    revisionId: 'revision:2',
    status: 'draft',
    ...validDraft(),
    events: [
      {
        ...validDraft().events[0],
        id: 'event:tuesday',
        emoji: '🔥',
        capacity: 40,
      },
    ],
    scheduledFor: null,
    discordUrl: null,
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    publishedAt: null,
  }
}

describe("validation des annonces d'entraînement", () => {
  it('normalise le brouillon et applique la capacité serveur par défaut', () => {
    const result = validateTrainingAnnouncementDraft(validDraft())

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.events[0]).toMatchObject({
      types: ['open_gym', 'workshop'],
      topic: 'Tumbling',
      details: 'Travail libre sur le praticable.',
      capacity: TRAINING_ANNOUNCEMENT_DEFAULT_CAPACITY,
    })
  })

  it.each([
    ['2026-08-25', 'weekStart'],
    ['2026-02-30', 'weekStart'],
  ])('refuse une semaine qui ne commence pas par un lundi (%s)', (weekStart, path) => {
    const result = validateTrainingAnnouncementDraft({ ...validDraft(), weekStart })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues.some((issue) => issue.path === path)).toBe(true)
  })

  it('refuse un événement hors semaine, sans type, avec des heures ou une capacité invalides', () => {
    const draft = validDraft()
    const result = validateTrainingAnnouncementDraft({
      ...draft,
      events: [
        {
          ...draft.events[0],
          date: '2026-09-01',
          startTime: '20:00',
          endTime: '18:00',
          types: [],
          capacity: 201,
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'events.0.date',
        'events.0.endTime',
        'events.0.types',
        'events.0.capacity',
      ]),
    )
  })

  it("exige un sujet dès qu'un événement contient un atelier", () => {
    const draft = validDraft()
    const result = validateTrainingAnnouncementDraft({
      ...draft,
      events: [{ ...draft.events[0], types: ['workshop'], topic: '  ' }],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toContainEqual({
      path: 'events.0.topic',
      message: "Le sujet de l'atelier est obligatoire.",
    })
  })

  it('conserve un détail Open Gym séparé du sujet d’atelier dans un créneau mixte', () => {
    const draft = validDraft()
    const result = validateTrainingAnnouncementDraft({
      ...draft,
      events: [
        {
          ...draft.events[0],
          topic: '  Partner stunt  ',
          details: '  Travail libre après l’atelier.  ',
        },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.events[0]).toMatchObject({
      topic: 'Partner stunt',
      details: 'Travail libre après l’atelier.',
    })
  })

  it('refuse un détail Open Gym trop long', () => {
    const draft = validDraft()
    const result = validateTrainingAnnouncementDraft({
      ...draft,
      events: [
        {
          ...draft.events[0],
          details: 'x'.repeat(TRAINING_ANNOUNCEMENT_MAX_DETAILS_LENGTH + 1),
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toContainEqual({
      path: 'events.0.details',
      message: 'Le détail de l’Open Gym est trop long.',
    })
  })

  it('accepte un emoji Unicode court et refuse les réactions dupliquées ou Discord custom', () => {
    const draft = validDraft()
    const valid = validateTrainingAnnouncementDraft({
      ...draft,
      events: [{ ...draft.events[0], emoji: '🐺' }],
    })
    const duplicate = validateTrainingAnnouncementDraft({
      ...draft,
      events: [
        { ...draft.events[0], emoji: '❤️' },
        {
          ...draft.events[0],
          startTime: '20:00',
          endTime: '21:00',
          emoji: '❤',
        },
      ],
    })
    const invalidEmojis = ['<:wolves:123456789>', 'abc', '🔥:test', '👩‍🦰']

    expect(valid.success).toBe(true)
    expect(duplicate.success).toBe(false)
    for (const emoji of invalidEmojis) {
      expect(
        validateTrainingAnnouncementDraft({
          ...draft,
          events: [{ ...draft.events[0], emoji }],
        }).success,
      ).toBe(false)
    }
  })

  it('respecte la limite Discord de vingt réactions par annonce', () => {
    const draft = validDraft()
    const events = Array.from({ length: TRAINING_ANNOUNCEMENT_MAX_EVENTS + 1 }, (_, index) => ({
      ...draft.events[0],
      startTime: `${String(index).padStart(2, '0')}:00`,
      endTime: `${String(index + 1).padStart(2, '0')}:00`,
    }))
    const result = validateTrainingAnnouncementDraft({ ...draft, events })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path === 'events')).toBe(true)
    }
  })

  it('refuse une fenêtre inversée ou un autre fuseau horaire', () => {
    const result = validateTrainingAnnouncementDraft({
      ...validDraft(),
      timeZone: 'UTC',
      publishWindow: {
        date: '2026-08-23',
        startTime: '19:00',
        endTime: '17:00',
        timeZone: 'UTC',
      },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['timeZone', 'publishWindow.endTime', 'publishWindow.timeZone']),
    )
  })

  it('accepte une date de diffusion personnalisée avant le premier créneau', () => {
    const result = validateTrainingAnnouncementDraft({
      ...validDraft(),
      publishWindow: {
        date: '2026-08-24',
        startTime: '09:00',
        endTime: '11:00',
        timeZone: 'Europe/Paris',
      },
    })

    expect(result.success).toBe(true)
  })

  it('refuse une fenêtre trop longue ou terminée après le premier créneau', () => {
    const tooLong = validateTrainingAnnouncementDraft({
      ...validDraft(),
      publishWindow: {
        date: '2026-08-23',
        startTime: '06:00',
        endTime: '19:00',
        timeZone: 'Europe/Paris',
      },
    })
    const afterFirstEvent = validateTrainingAnnouncementDraft({
      ...validDraft(),
      publishWindow: {
        date: '2026-08-25',
        startTime: '17:00',
        endTime: '19:00',
        timeZone: 'Europe/Paris',
      },
    })

    expect(tooLong.success).toBe(false)
    expect(afterFirstEvent.success).toBe(false)
    if (!tooLong.success) {
      expect(tooLong.issues).toContainEqual({
        path: 'publishWindow.endTime',
        message: 'La plage de diffusion est limitée à 12 heures.',
      })
    }
    if (!afterFirstEvent.success) {
      expect(afterFirstEvent.issues).toContainEqual({
        path: 'publishWindow.endTime',
        message: 'La fenêtre de diffusion doit se terminer avant le premier créneau.',
      })
    }
  })

  it("refuse les heures inexistantes ou ambiguës lors des changements d'heure", () => {
    const spring = validateTrainingAnnouncementDraft({
      ...validDraft(),
      publishWindow: {
        date: '2026-03-29',
        startTime: '02:15',
        endTime: '03:30',
        timeZone: 'Europe/Paris',
      },
    })
    const autumn = validateTrainingAnnouncementDraft({
      ...validDraft(),
      publishWindow: {
        date: '2026-10-25',
        startTime: '02:15',
        endTime: '03:30',
        timeZone: 'Europe/Paris',
      },
    })

    expect(spring.success).toBe(false)
    expect(autumn.success).toBe(false)
    if (!spring.success) {
      expect(spring.issues.some((issue) => issue.path === 'publishWindow.startTime')).toBe(true)
    }
    if (!autumn.success) {
      expect(autumn.issues.some((issue) => issue.path === 'publishWindow.startTime')).toBe(true)
    }
  })

  it('valide les contrats idempotents de création, mise à jour et action', () => {
    const create = validateTrainingAnnouncementCreateRequest({
      requestId,
      announcement: validDraft(),
    })
    const update = validateTrainingAnnouncementUpdateRequest({
      requestId,
      expectedRevisionId: 'revision:1',
      announcement: validDraft(),
    })
    const action = validateTrainingAnnouncementActionRequest({
      requestId,
      expectedRevisionId: 'revision:1',
      action: 'schedule',
    })

    expect(create.success).toBe(true)
    expect(update.success).toBe(true)
    expect(action.success).toBe(true)
    expect(
      validateTrainingAnnouncementActionRequest({
        requestId: 'not-a-uuid',
        expectedRevisionId: 'revision:1',
        action: 'delete',
      }).success,
    ).toBe(false)
  })
})

describe("contrat privé des annonces d'entraînement", () => {
  it("réduit les réponses du bridge à la liste blanche et n'expose aucun ID Discord", () => {
    const discordId = '123456789012345678'
    const response = parseTrainingAnnouncementResponse({
      announcement: { ...bridgeAnnouncement(), discordId },
      discordId,
    })

    expect(response.announcement.id).toBe('announcement:week-35')
    expect(response.announcement.events[0]?.capacity).toBe(40)
    expect(response.announcement.events[0]?.emoji).toBe('🔥')
    expect(response.announcement.events[0]?.details).toBe('Travail libre sur le praticable.')
    expect(JSON.stringify(response)).not.toContain(discordId)
  })

  it("valide l'accès et refuse une autorisation incohérente", () => {
    expect(parseTrainingAnnouncementAccess({ canManage: true, reason: 'head_coach' })).toEqual({
      canManage: true,
      reason: 'head_coach',
    })
    expect(parseTrainingAnnouncementAccess({ canManage: false, reason: null })).toEqual({
      canManage: false,
      reason: null,
    })
    expect(() => parseTrainingAnnouncementAccess({ canManage: true, reason: null })).toThrow()
  })

  it('valide une liste historique bornée', () => {
    const announcement = bridgeAnnouncement()
    const response = parseTrainingAnnouncementListResponse({
      announcements: [
        {
          id: announcement.id,
          revisionId: announcement.revisionId,
          status: announcement.status,
          weekStart: announcement.weekStart,
          timeZone: announcement.timeZone,
          eventCount: announcement.events.length,
          scheduledFor: announcement.scheduledFor,
          createdAt: announcement.createdAt,
          updatedAt: announcement.updatedAt,
          publishedAt: announcement.publishedAt,
          discordId: '123456789012345678',
        },
      ],
    })

    expect(response.announcements).toHaveLength(1)
    expect(JSON.stringify(response)).not.toContain('123456789012345678')
  })
})

describe('identité administrateur self-only', () => {
  it("utilise uniquement l'ID Discord de session malgré une query forgée", async () => {
    const sessionDiscordId = '123456789012345678'
    const attackerDiscordId = '999999999999999999'
    const event = {
      node: { req: { url: `/api/admin/training-announcements?discordId=${attackerDiscordId}` } },
    } as unknown as H3Event
    const operation = vi.fn(async () => ({ announcements: [] }))

    await withTrainingAnnouncementDiscordSession(
      event,
      async () => ({
        discordId: sessionDiscordId,
        username: 'head-coach',
        displayName: 'Head Coach',
      }),
      operation,
    )

    expect(operation).toHaveBeenCalledOnce()
    expect(operation).toHaveBeenCalledWith(sessionDiscordId)
    expect(operation).not.toHaveBeenCalledWith(attackerDiscordId)
  })
})
