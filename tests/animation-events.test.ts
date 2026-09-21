import { describe, expect, it } from 'vitest'

import {
  ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS,
  ANIMATION_EVENT_MAX_SLOTS,
  validateAnimationEventActionRequest,
  validateAnimationEventCreateRequest,
  validateAnimationEventDraft,
  validateAnimationEventGroupConfigRequest,
  validateAnimationEventUpdateRequest,
} from '../shared/animation-events/validation'
import {
  parseAnimationEventGroupConfigResponse,
  parseAnimationEventListResponse,
  parseAnimationEventPreviewResponse,
  parseAnimationEventResponse,
} from '../server/utils/registrations/animation-events-protocol'
import {
  ANIMATION_EVENT_AVATAR_MAX_BYTES,
  parseAnimationEventAvatarResponse,
} from '../server/utils/registrations/animation-event-avatar'

const requestId = 'de305d54-75b4-431b-adb2-eb6b9e546014'

function validDraft() {
  return {
    title: 'Gala de médecine',
    intro: 'Bonjour la meute !',
    outro: 'Merci pour vos réponses.',
    timeZone: 'Europe/Paris',
    publishWindow: {
      date: '2026-08-30',
      startTime: '17:00',
      endTime: '19:00',
      timeZone: 'Europe/Paris',
    },
    items: [
      {
        title: 'Gala de médecine',
        eventDate: '2026-09-05',
        startTime: '21:00',
        meetingTime: '19:30',
        location: 'Le Bikini',
        details: "L'effectif pourra être ajusté selon l'espace disponible.",
        slots: [
          { label: 'Je participe', emoji: '🔥', capacity: 40 },
          { label: 'Je suis bénévole', emoji: '✌️', capacity: null },
        ],
      },
    ],
  }
}

function bridgeEvent() {
  return {
    id: 'animation:event:1',
    revisionId: null,
    kind: 'legacy',
    status: 'imported',
    title: 'Gala de médecine',
    intro: '',
    outro: '',
    timeZone: null,
    publishWindow: null,
    itemCount: 1,
    slotCount: 2,
    participantCount: 1,
    historyComplete: false,
    scheduledFor: null,
    discordUrl:
      'https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333',
    createdAt: '2026-05-21T18:20:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    publishedAt: '2026-05-21T18:20:00.000Z',
    lastSyncedAt: '2026-08-20T10:00:00.000Z',
    authorDisplayName: 'Coach Exemple',
    items: [
      {
        id: 'animation:item:1',
        title: 'Gala de médecine',
        eventDate: null,
        startTime: null,
        meetingTime: null,
        location: '',
        details: '',
        position: 0,
        slots: validDraft().items[0]?.slots.map((slot, index) => ({
          ...slot,
          id: `animation:slot:${index}`,
          position: index,
          isPresent: true,
          participants:
            index === 0
              ? [
                  {
                    participantKey: 'participant:opaque:1',
                    displayName: 'Camille Wolf',
                    username: 'camille',
                    avatarUrl:
                      '/api/admin/animation-events/participants/participant:opaque:1/avatar',
                    teams: ['Octogone'],
                    active: true,
                    source: 'backfill',
                    historyComplete: false,
                    firstSeenAt: '2026-08-20T10:00:00.000Z',
                    addedAt: null,
                    removedAt: null,
                    discordId: '123456789012345678',
                  },
                ]
              : [],
          groupConfig: { version: 0, label: '', updatedAt: null, groups: [] },
        })),
      },
    ],
  }
}

function managedBridgeEvent() {
  const event = bridgeEvent()
  return {
    ...event,
    kind: 'managed',
    status: 'published',
    revisionId: 'animation:revision:1',
    timeZone: 'Europe/Paris',
    publishWindow: validDraft().publishWindow,
    items: event.items.map((item) => ({
      ...item,
      eventDate: '2026-09-05',
      startTime: '21:00',
      meetingTime: '19:30',
    })),
  }
}

describe("validation des événements d'animation", () => {
  it('normalise un message avec plusieurs catégories non exclusives', () => {
    const result = validateAnimationEventDraft(validDraft())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.items[0]?.slots).toEqual([
      { label: 'Je participe', emoji: '🔥', capacity: 40 },
      { label: 'Je suis bénévole', emoji: '✌️', capacity: null },
    ])
  })

  it('refuse deux catégories avec le même emoji', () => {
    const draft = validDraft()
    const result = validateAnimationEventDraft({
      ...draft,
      items: [
        {
          ...draft.items[0],
          slots: [
            { label: 'Participants', emoji: '🔥' },
            { label: 'Bénévoles', emoji: '🔥' },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.message.includes('emoji différent'))).toBe(true)
    }
  })

  it.each(['texte', '<:wolves:123456789012345678>'])(
    'refuse un emoji de catégorie non Unicode simple (%s)',
    (emoji) => {
      const draft = validDraft()
      draft.items[0]!.slots[0]!.emoji = emoji

      const result = validateAnimationEventDraft(draft)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.issues).toContainEqual({
          path: 'items.0.slots.0.emoji',
          message: "L'emoji est invalide.",
        })
      }
    },
  )

  it('accepte le label anonymisé d’un emoji custom sur un événement legacy', () => {
    const event = bridgeEvent()
    event.items[0]!.slots[0]!.emoji = ':wolves:'

    const response = parseAnimationEventResponse({ event })

    expect(response.event.items[0]?.slots[0]?.emoji).toBe(':wolves:')
    expect(JSON.stringify(response)).not.toContain('123456789012345678')
  })

  it('garde le contrat emoji Unicode strict sur un événement géré', () => {
    const event = managedBridgeEvent()
    event.items[0]!.slots[0]!.emoji = ':wolves:'

    expect(() => parseAnimationEventResponse({ event })).toThrow()
  })

  it('considère les variantes de présentation FE0 comme le même emoji', () => {
    const draft = validDraft()
    draft.items[0]!.slots = [
      { label: 'Participants', emoji: '✌', capacity: 40 },
      { label: 'Bénévoles', emoji: '✌️', capacity: null },
    ]

    const result = validateAnimationEventDraft(draft)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.message.includes('emoji différent'))).toBe(true)
    }
  })

  it('accepte un emoji Unicode composé valide', () => {
    const draft = validDraft()
    draft.items[0]!.slots[0]!.emoji = '👩🏽‍🦰'

    expect(validateAnimationEventDraft(draft).success).toBe(true)
  })

  it('respecte la limite Discord de vingt réactions', () => {
    const draft = validDraft()
    const result = validateAnimationEventDraft({
      ...draft,
      items: [
        {
          ...draft.items[0],
          slots: Array.from({ length: ANIMATION_EVENT_MAX_SLOTS + 1 }, (_, index) => ({
            label: `Catégorie ${index + 1}`,
          })),
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('refuse une diffusion après le premier événement et une heure de rendez-vous tardive', () => {
    const draft = validDraft()
    const result = validateAnimationEventDraft({
      ...draft,
      publishWindow: { ...draft.publishWindow, date: '2026-09-05', endTime: '22:00' },
      items: [{ ...draft.items[0], meetingTime: '22:00' }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['publishWindow.endTime', 'items.0.meetingTime']),
      )
    }
  })

  it("refuse une heure de diffusion ambiguë lors du changement d'heure", () => {
    const draft = validDraft()
    const result = validateAnimationEventDraft({
      ...draft,
      publishWindow: {
        date: '2026-10-25',
        startTime: '02:15',
        endTime: '03:30',
        timeZone: 'Europe/Paris',
      },
      items: [{ ...draft.items[0], eventDate: '2026-10-31' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path === 'publishWindow.startTime')).toBe(true)
    }
  })

  it('valide les requêtes idempotentes de création, mise à jour et action', () => {
    expect(validateAnimationEventCreateRequest({ requestId, event: validDraft() }).success).toBe(
      true,
    )
    expect(
      validateAnimationEventUpdateRequest({
        requestId,
        expectedRevisionId: 'revision:1',
        event: validDraft(),
      }).success,
    ).toBe(true)
    expect(
      validateAnimationEventActionRequest({
        requestId,
        expectedRevisionId: 'revision:1',
        action: 'publish_now',
      }).success,
    ).toBe(true)
  })

  it('valide plusieurs étapes et autorise une personne dans chaque étape', () => {
    const valid = validateAnimationEventGroupConfigRequest({
      requestId,
      expectedVersion: 0,
      label: 'Passages',
      stages: [
        {
          id: 'stage:1',
          label: 'Étape 1',
          position: 0,
          groups: [
            {
              id: 'group:1',
              position: 0,
              members: ['one', 'two', 'three'].map((participantKey, position) => ({
                participantKey,
                position,
              })),
            },
          ],
        },
        {
          id: 'stage:2',
          label: 'Étape 2',
          position: 1,
          groups: [
            {
              id: 'group:2',
              position: 0,
              members: [{ participantKey: 'one', position: 0 }],
            },
          ],
        },
      ],
    })
    expect(valid.success).toBe(true)
  })

  it("préserve l'absence des champs de formation envoyés par un ancien client", () => {
    const legacy = validateAnimationEventGroupConfigRequest({
      requestId,
      expectedVersion: 0,
      label: '',
      stages: [
        {
          id: 'stage:legacy',
          label: 'Étape 1',
          position: 0,
          groups: [
            {
              id: 'group:legacy',
              position: 0,
              members: [{ participantKey: 'one', position: 0 }],
            },
          ],
        },
      ],
    })
    expect(legacy.success).toBe(true)
    if (!legacy.success) return
    expect(Object.hasOwn(legacy.value.stages[0]!, 'surface')).toBe(false)
    expect(Object.hasOwn(legacy.value.stages[0]!, 'annotations')).toBe(false)
    expect(Object.hasOwn(legacy.value.stages[0]!.groups[0]!, 'placement')).toBe(false)
  })

  it('valide une surface, des placements et des annotations point ou ligne', () => {
    const result = validateAnimationEventGroupConfigRequest({
      requestId,
      expectedVersion: 3,
      label: 'Finale',
      stages: [
        {
          id: 'stage:formation',
          label: 'Pyramide',
          position: 0,
          surface: 'landscape',
          groups: [
            {
              id: 'group:formation',
              position: 0,
              members: [{ participantKey: 'one', position: 0 }],
              placement: { x: 2_500, y: 7_500 },
            },
          ],
          annotations: [
            {
              id: 'annotation:point',
              position: 0,
              kind: 'point',
              count: '1–2',
              figure: 'Prep',
              start: { x: 5_000, y: 5_000 },
              end: null,
            },
            {
              id: 'annotation:line',
              position: 1,
              kind: 'line',
              count: '3–4',
              figure: 'Extension',
              start: { x: 5_000, y: 5_000 },
              end: { x: 8_000, y: 2_000 },
            },
          ],
        },
      ],
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.stages[0]?.surface).toBe('landscape')
    expect(result.value.stages[0]?.groups[0]?.placement).toEqual({ x: 2_500, y: 7_500 })
    expect(result.value.stages[0]?.annotations).toHaveLength(2)
  })

  it('refuse les géométries ambiguës ou hors limites', () => {
    const formation = (overrides: Record<string, unknown>) => ({
      requestId,
      expectedVersion: 0,
      label: '',
      stages: [
        {
          id: 'stage:formation',
          label: 'Étape 1',
          position: 0,
          surface: 'square',
          groups: [
            {
              id: 'group:formation',
              position: 0,
              members: [{ participantKey: 'one', position: 0 }],
              placement: { x: 1_000, y: 2_000 },
            },
          ],
          annotations: [],
          ...overrides,
        },
      ],
    })

    expect(validateAnimationEventGroupConfigRequest(formation({ surface: 'circle' })).success).toBe(
      false,
    )
    expect(
      validateAnimationEventGroupConfigRequest(
        formation({
          groups: [
            {
              id: 'group:formation',
              position: 0,
              members: [{ participantKey: 'one', position: 0 }],
              placement: { x: 10_001, y: 0 },
            },
          ],
        }),
      ).success,
    ).toBe(false)
    expect(
      validateAnimationEventGroupConfigRequest(
        formation({
          annotations: [
            {
              id: 'annotation:line',
              position: 0,
              kind: 'line',
              count: '1',
              figure: 'Prep',
              start: { x: 5_000, y: 5_000 },
              end: { x: 5_000, y: 5_000 },
            },
          ],
        }),
      ).success,
    ).toBe(false)
  })

  it('borne les annotations et leurs libellés, y compris entre deux étapes', () => {
    const annotation = (id: string, position: number) => ({
      id,
      position,
      kind: 'point',
      count: '1',
      figure: 'Prep',
      start: { x: 0, y: 10_000 },
      end: null,
    })
    const stage = (id: string, position: number, annotations: unknown[]) => ({
      id,
      label: `Étape ${position + 1}`,
      position,
      surface: 'square',
      groups: [],
      annotations,
    })
    const parse = (stages: unknown[]) =>
      validateAnimationEventGroupConfigRequest({
        requestId,
        expectedVersion: 0,
        label: '',
        stages,
      })

    expect(
      parse([
        stage(
          'stage:1',
          0,
          Array.from({ length: ANIMATION_EVENT_MAX_FORMATION_ANNOTATIONS + 1 }, (_, index) =>
            annotation(`annotation:${index}`, index),
          ),
        ),
      ]).success,
    ).toBe(false)
    expect(
      parse([stage('stage:1', 0, [{ ...annotation('annotation:1', 0), count: '1'.repeat(25) }])])
        .success,
    ).toBe(false)
    expect(
      parse([stage('stage:1', 0, [{ ...annotation('annotation:1', 0), figure: 'F'.repeat(121) }])])
        .success,
    ).toBe(false)
    expect(
      parse([
        stage('stage:1', 0, [annotation('annotation:shared', 0)]),
        stage('stage:2', 1, [annotation('annotation:shared', 0)]),
      ]).success,
    ).toBe(false)
  })

  it('refuse les doublons et les positions ambiguës dans une étape', () => {
    const duplicate = validateAnimationEventGroupConfigRequest({
      requestId,
      expectedVersion: 0,
      label: '',
      stages: [
        {
          id: 'stage:1',
          label: 'Étape 1',
          position: 0,
          groups: [
            { id: 'group:1', position: 0, members: [{ participantKey: 'one', position: 0 }] },
            { id: 'group:2', position: 0, members: [{ participantKey: 'one', position: 0 }] },
          ],
        },
      ],
    })
    expect(duplicate.success).toBe(false)
  })

  it('exige au moins une étape nommée et des identifiants de groupe globaux', () => {
    expect(
      validateAnimationEventGroupConfigRequest({
        requestId,
        expectedVersion: 0,
        label: '',
        stages: [],
      }).success,
    ).toBe(false)

    const duplicateGroupId = validateAnimationEventGroupConfigRequest({
      requestId,
      expectedVersion: 0,
      label: '',
      stages: [0, 1].map((position) => ({
        id: `stage:${position}`,
        label: `Étape ${position + 1}`,
        position,
        groups: [
          {
            id: 'group:shared',
            position: 0,
            members: [{ participantKey: `participant:${position}`, position: 0 }],
          },
        ],
      })),
    })
    expect(duplicateGroupId.success).toBe(false)
  })
})

describe('contrat privé des événements', () => {
  it("supprime les IDs Discord et conserve uniquement la clé opaque d'un participant", () => {
    const response = parseAnimationEventResponse({
      event: { ...bridgeEvent(), discordId: '123456789012345678' },
    })
    expect(response.event.items[0]?.slots[0]?.participants[0]?.participantKey).toBe(
      'participant:opaque:1',
    )
    expect(response.event.items[0]?.slots[0]?.participants[0]?.avatarUrl).toBe(
      '/api/admin/animation-events/participants/participant:opaque:1/avatar',
    )
    expect(response.event.items[0]?.slots[0]?.groupConfig.stages).toEqual([
      {
        id: 'legacy:stage:1',
        label: 'Étape 1',
        position: 0,
        surface: 'square',
        groups: [],
        annotations: [],
      },
    ])
    expect(response.event.items[0]?.slots[0]?.groupConfig.formationSchemaVersion).toBe(0)
    expect(JSON.stringify(response)).not.toContain('123456789012345678')
  })

  it.each([
    'https://cdn.discordapp.com/avatars/123/hash.webp',
    '/api/admin/animation-events/participants/another:participant/avatar',
    '/api/admin/animation-events/participants/participant:opaque:1/avatar?discordId=123',
  ])("refuse une URL d'avatar qui contourne le proxy privé (%s)", (avatarUrl) => {
    const event = bridgeEvent()
    const participant = event.items[0]?.slots?.[0]?.participants?.[0]
    if (!participant) throw new Error('Fixture de participant manquante')
    participant.avatarUrl = avatarUrl

    expect(() => parseAnimationEventResponse({ event })).toThrow()
  })

  it.each(['texte', '<:wolves:123456789012345678>'])(
    'refuse un emoji invalide renvoyé par le bridge (%s)',
    (emoji) => {
      const event = bridgeEvent()
      event.items[0]!.slots[0]!.emoji = emoji

      expect(() => parseAnimationEventResponse({ event })).toThrow()
    },
  )

  it('refuse deux emojis équivalents FE0 renvoyés par le bridge', () => {
    const event = bridgeEvent()
    event.items[0]!.slots[0]!.emoji = '✌'
    event.items[0]!.slots[1]!.emoji = '✌️'

    expect(() => parseAnimationEventResponse({ event })).toThrow()
  })

  it('valide une liste historique bornée', () => {
    const event = bridgeEvent()
    const {
      items: _items,
      revisionId: _revisionId,
      intro: _intro,
      outro: _outro,
      ...summary
    } = event
    const response = parseAnimationEventListResponse({ events: [summary] })
    expect(response.events).toHaveLength(1)
    expect(response.events[0]?.kind).toBe('legacy')
  })

  it('valide l’aperçu exact et sa limite de caractères', () => {
    const content = '[Animation] Gala\n🔥 Je participe'
    expect(
      parseAnimationEventPreviewResponse({
        preview: {
          content,
          characterCount: [...content].length,
          slots: [
            {
              itemId: 'animation:item:1',
              slotId: 'animation:slot:1',
              label: 'Je participe',
              emoji: '🔥',
            },
          ],
        },
      }).preview.content,
    ).toBe(content)
  })

  it('valide un plan de groupes renvoyé en liste blanche', () => {
    const response = parseAnimationEventGroupConfigResponse({
      groupConfig: {
        version: 2,
        formationSchemaVersion: 1,
        label: 'Passages',
        updatedAt: '2026-08-20T10:00:00.000Z',
        stages: [
          {
            id: 'stage:1',
            label: 'Étape 1',
            position: 0,
            surface: 'portrait',
            groups: [
              {
                id: 'group:1',
                position: 0,
                members: [{ participantKey: 'participant:opaque:1', position: 0 }],
                placement: { x: 4_000, y: 6_000 },
              },
            ],
            annotations: [
              {
                id: 'annotation:1',
                position: 0,
                kind: 'point',
                count: '1–2',
                figure: 'Prep',
                start: { x: 4_000, y: 6_000 },
                end: null,
              },
            ],
          },
        ],
        updatedByDiscordId: '123456789012345678',
      },
    })
    expect(response.groupConfig.version).toBe(2)
    expect(response.groupConfig.formationSchemaVersion).toBe(1)
    expect(response.groupConfig.stages[0]?.surface).toBe('portrait')
    expect(response.groupConfig.stages[0]?.groups[0]?.placement).toEqual({
      x: 4_000,
      y: 6_000,
    })
    expect(JSON.stringify(response)).not.toContain('123456789012345678')
  })

  it("normalise une réponse d'ancien bridge et refuse une formation non canonique", () => {
    const legacy = parseAnimationEventGroupConfigResponse({
      groupConfig: {
        version: 1,
        label: '',
        updatedAt: null,
        stages: [
          {
            id: 'stage:legacy',
            label: 'Étape 1',
            position: 0,
            groups: [
              {
                id: 'group:legacy',
                position: 0,
                members: [{ participantKey: 'participant:opaque:1', position: 0 }],
              },
            ],
          },
        ],
      },
    })
    expect(legacy.groupConfig.formationSchemaVersion).toBe(0)
    expect(legacy.groupConfig.stages[0]).toMatchObject({
      surface: 'square',
      annotations: [],
      groups: [{ placement: null }],
    })

    const invalidFormation = {
      ...legacy.groupConfig,
      formationSchemaVersion: 1,
      stages: [
        {
          ...legacy.groupConfig.stages[0],
          groups: [{ ...legacy.groupConfig.stages[0]!.groups[0], placement: { x: -1, y: 0 } }],
        },
      ],
    }
    expect(() =>
      parseAnimationEventGroupConfigResponse({ groupConfig: invalidFormation }),
    ).toThrow()
    expect(() =>
      parseAnimationEventGroupConfigResponse({
        groupConfig: { ...legacy.groupConfig, formationSchemaVersion: 2 },
      }),
    ).toThrow()
  })

  it('refuse les identifiants et positions ambigus dans un plan à étapes', () => {
    const group = (id: string, position: number) => ({
      id,
      position,
      members: [{ participantKey: 'participant:opaque:1', position: 0 }],
    })
    const stage = (id: string, position: number, groups = [group(`group:${id}`, 0)]) => ({
      id,
      label: `Étape ${position + 1}`,
      position,
      groups,
    })
    const parse = (stages: unknown[]) =>
      parseAnimationEventGroupConfigResponse({
        groupConfig: { version: 1, label: '', updatedAt: null, stages },
      })

    expect(() => parse([stage('stage:1', 0), stage('stage:2', 0)])).toThrow()
    expect(() =>
      parse([
        stage('stage:1', 0, [group('group:shared', 0)]),
        stage('stage:2', 1, [group('group:shared', 0)]),
      ]),
    ).toThrow()
    expect(() =>
      parse([
        stage('stage:1', 0, [
          {
            id: 'group:1',
            position: 0,
            members: [
              { participantKey: 'participant:opaque:1', position: 0 },
              { participantKey: 'participant:opaque:2', position: 0 },
            ],
          },
        ]),
      ]),
    ).toThrow()
  })
})

describe("proxy binaire des avatars d'événement", () => {
  it('accepte uniquement une image raster bornée et normalise son type MIME', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const avatar = await parseAnimationEventAvatarResponse(
      new Response(bytes, { headers: { 'Content-Type': 'image/png; charset=binary' } }),
    )

    expect(avatar.contentType).toBe('image/png')
    expect([...avatar.bytes]).toEqual([...bytes])
  })

  it('refuse un SVG même annoncé comme image', async () => {
    await expect(
      parseAnimationEventAvatarResponse(
        new Response('<svg></svg>', { headers: { 'Content-Type': 'image/svg+xml' } }),
      ),
    ).rejects.toThrow('Invalid BigBadBot animation event avatar response')
  })

  it('refuse une taille déclarée ou effectivement supérieure à 2 Mio', async () => {
    await expect(
      parseAnimationEventAvatarResponse(
        new Response(new Uint8Array([1]), {
          headers: {
            'Content-Type': 'image/webp',
            'Content-Length': String(ANIMATION_EVENT_AVATAR_MAX_BYTES + 1),
          },
        }),
      ),
    ).rejects.toThrow('Invalid BigBadBot animation event avatar response')

    await expect(
      parseAnimationEventAvatarResponse(
        new Response(new Uint8Array(ANIMATION_EVENT_AVATAR_MAX_BYTES + 1), {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
    ).rejects.toThrow('Invalid BigBadBot animation event avatar response')
  })
})
