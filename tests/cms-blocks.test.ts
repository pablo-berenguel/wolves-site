import { describe, expect, it } from 'vitest'
import { cmsBlockRegistry, createCmsBlock, listCmsBlockDefinitions } from '../shared/cms/registry'
import { sanitizeCmsBlock, sanitizeCmsPage } from '../shared/cms/sanitize'
import { cmsBlockTypes, type CmsFieldSchema } from '../shared/cms/types'
import { cmsSeedPages } from '../server/data/cms-seed'

function collectFieldKinds(schema: CmsFieldSchema, kinds: Set<string>) {
  kinds.add(schema.kind)
  if (schema.kind === 'list') collectFieldKinds(schema.item, kinds)
  if (schema.kind === 'object') {
    Object.values(schema.fields).forEach((field) => collectFieldKinds(field, kinds))
  }
}

describe('registre des blocs CMS', () => {
  it('déclare un renderer éditorial pour les 17 types attendus', () => {
    expect(cmsBlockTypes).toHaveLength(17)
    expect(Object.keys(cmsBlockRegistry)).toEqual([...cmsBlockTypes])
    expect(listCmsBlockDefinitions()).toHaveLength(cmsBlockTypes.length)
  })

  it('expose les champs récursifs nécessaires à l’éditeur', () => {
    const kinds = new Set<string>()
    listCmsBlockDefinitions().forEach((definition) => {
      Object.values(definition.fields).forEach((field) => collectFieldKinds(field, kinds))
    })

    expect([...kinds]).toEqual(
      expect.arrayContaining([
        'text',
        'textarea',
        'url',
        'image',
        'boolean',
        'select',
        'list',
        'object',
      ]),
    )
  })

  it('crée des données par défaut indépendantes', () => {
    const first = createCmsBlock('indexed_card_grid', 'first')
    const second = createCmsBlock('indexed_card_grid', 'second')
    first.data.cards.push({ title: 'Étape', content: 'Contenu' })

    expect(second.data.cards).toEqual([])
    expect(createCmsBlock('rich_text', 'text').variant).toBe('default')
  })

  it('associe les recettes image au contexte du bloc', () => {
    const heroImage = cmsBlockRegistry.hero.fields.image
    const teamList = cmsBlockRegistry.team_grid.fields.teams
    const photoList = cmsBlockRegistry.photo_rail.fields.photos

    expect(heroImage.kind === 'image' ? heroImage.imagePreset : undefined).toBe('hero')
    expect(teamList.kind).toBe('list')
    expect(photoList.kind).toBe('list')
  })
})

describe('sanitation des contenus CMS', () => {
  it('rejette les protocoles de lien dangereux et retire les champs inconnus', () => {
    const result = sanitizeCmsBlock({
      id: 'cta-test',
      type: 'cta_band',
      sortOrder: 0,
      enabled: true,
      data: {
        title: 'Continuer',
        html: '<script>alert(1)</script>',
        action: {
          label: 'Action',
          href: 'javascript:alert(1)',
        },
      },
    })

    expect(result.success).toBe(false)
    expect(result.issues.some((issue) => issue.path === 'data.action.href')).toBe(true)
    expect(result.value?.data).not.toHaveProperty('html')
  })

  it('rejette aussi les URL relatives au protocole', () => {
    const result = sanitizeCmsBlock({
      id: 'cta-protocol-relative',
      type: 'cta_band',
      data: {
        title: 'Continuer',
        action: { label: 'Action', href: '//example.test/piège' },
      },
    })

    expect(result.success).toBe(false)
    expect(result.issues.some((issue) => issue.path === 'data.action.href')).toBe(true)
  })

  it('rejette les chemins avec antislash normalisés comme une origine externe', () => {
    const result = sanitizeCmsBlock({
      id: 'cta-backslash',
      type: 'cta_band',
      data: {
        title: 'Continuer',
        action: { label: 'Action', href: '/\\evil.example/piège' },
      },
    })

    expect(result.success).toBe(false)
    expect(result.issues.some((issue) => issue.path === 'data.action.href')).toBe(true)
  })

  it('normalise une page et trie ses blocs', () => {
    const result = sanitizeCmsPage({
      id: 'page-test',
      path: '/club///',
      title: 'Le club',
      status: 'published',
      seo: { title: 'Le club', description: 'Découvrir le club.' },
      blocks: [
        {
          id: 'hero-main',
          type: 'hero',
          sortOrder: 0,
          data: { title: 'Le club' },
        },
        {
          id: 'cta-last',
          type: 'cta_band',
          sortOrder: 20,
          data: { title: 'Dernier bloc' },
        },
        {
          id: 'cta-first',
          type: 'cta_band',
          sortOrder: 10,
          data: { title: 'Premier bloc' },
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.value?.path).toBe('/club')
    expect(result.value?.blocks.map((block) => block.id)).toEqual([
      'hero-main',
      'cta-first',
      'cta-last',
    ])
  })

  it('impose un seul bloc principal tout en autorisant le texte structuré secondaire', () => {
    const result = sanitizeCmsPage({
      id: 'page-headings',
      path: '/headings',
      title: 'Titres',
      status: 'draft',
      seo: { title: 'Titres', description: 'Page de contrôle des titres.' },
      blocks: [
        { id: 'hero-main', type: 'hero', variant: 'page-image', data: { title: 'Titre' } },
        {
          id: 'rich-secondary',
          type: 'rich_text',
          variant: 'default',
          sortOrder: 1,
          data: { title: 'Section', introduction: [], sections: [] },
        },
      ],
    })

    expect(result.success).toBe(true)

    const duplicateMain = sanitizeCmsPage({
      ...result.value,
      blocks: [
        ...(result.value?.blocks || []),
        {
          id: 'legal-main',
          type: 'rich_text',
          variant: 'legal',
          sortOrder: 2,
          data: { title: 'Autre titre', introduction: [], sections: [] },
        },
      ],
    })

    expect(duplicateMain.success).toBe(false)
    expect(duplicateMain.issues.some((issue) => issue.path === 'blocks')).toBe(true)
  })

  it('rejette les identifiants et ancres de bloc dupliqués', () => {
    const result = sanitizeCmsPage({
      id: 'page-duplicates',
      path: '/duplicates',
      title: 'Doublons',
      status: 'draft',
      seo: { title: 'Doublons', description: 'Page de contrôle des doublons.' },
      blocks: [
        {
          id: 'same-block',
          type: 'cta_band',
          anchor: 'same-anchor',
          data: { title: 'Premier' },
        },
        {
          id: 'same-block',
          type: 'cta_band',
          anchor: 'same-anchor',
          data: { title: 'Second' },
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['blocks.1.id', 'blocks.1.anchor']),
    )
  })

  it('accepte les neuf pages du seed initial', () => {
    const invalidPages = cmsSeedPages.flatMap((page) => {
      const result = sanitizeCmsPage({ ...page, status: 'published' })
      return result.success ? [] : [{ path: page.path, issues: result.issues }]
    })

    expect(invalidPages).toEqual([])
  })

  it('enregistre explicitement une variante valide pour chaque bloc du seed', () => {
    for (const page of cmsSeedPages) {
      for (const block of page.blocks) {
        expect(cmsBlockRegistry[block.type].variants, `${page.path} · ${block.id}`).toContain(
          block.variant,
        )
      }
    }
  })

  it('préserve les variantes historiques déductibles du seed', () => {
    const sanitizedPages = cmsSeedPages.map(
      (page) => sanitizeCmsPage({ ...page, status: 'published' }).value,
    )
    const home = sanitizedPages.find((page) => page?.path === '/')
    const events = sanitizedPages.find((page) => page?.path === '/animations')
    const cheerleading = sanitizedPages.find((page) => page?.path === '/club/cheerleading')

    expect(home?.blocks.find((block) => block.id === 'home:hero')?.variant).toBe('home-video')
    expect(home?.blocks.find((block) => block.id === 'home:about')?.variant).toBe('story')
    expect(events?.blocks.find((block) => block.id === 'events:cta')?.variant).toBe('default')
    expect(
      cheerleading?.blocks.find((block) => block.id === 'cheerleading:disciplines')?.variant,
    ).toBe('disciplines')
  })
})
