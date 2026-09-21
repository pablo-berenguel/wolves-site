import type {
  CmsBlock,
  CmsBlockDefinition,
  CmsBlockOfType,
  CmsBlockType,
  CmsFieldSchema,
  CmsImageFieldPreset,
  CmsListFieldSchema,
  CmsObjectFieldSchema,
  CmsScalarFieldSchema,
} from './types'
import { cmsBlockTypes } from './types'

const text = (label: string, required = false, maxLength = 200): CmsScalarFieldSchema => ({
  kind: 'text',
  label,
  required,
  maxLength,
})

const textarea = (label: string, required = false, maxLength = 2_000): CmsScalarFieldSchema => ({
  kind: 'textarea',
  label,
  required,
  maxLength,
})

const url = (label: string, required = false): CmsScalarFieldSchema => ({
  kind: 'url',
  label,
  required,
  maxLength: 2_048,
})

const image = (
  label: string,
  required = false,
  imagePreset: CmsImageFieldPreset = 'card',
  imageAltRequired = true,
): CmsScalarFieldSchema => ({
  kind: 'image',
  label,
  required,
  imagePreset,
  imageAltRequired,
})

const boolean = (label: string): CmsScalarFieldSchema => ({ kind: 'boolean', label })

const select = (
  label: string,
  options: readonly string[],
  required = false,
): CmsScalarFieldSchema => ({
  kind: 'select',
  label,
  required,
  options: options.map((value) => ({ label: value, value })),
})

const object = (
  label: string,
  fields: Record<string, CmsFieldSchema>,
  required = false,
): CmsObjectFieldSchema => ({ kind: 'object', label, fields, required })

const list = (
  label: string,
  item: CmsFieldSchema,
  minItems = 0,
  maxItems = 100,
): CmsListFieldSchema => ({ kind: 'list', label, item, minItems, maxItems })

const actionFields: Record<string, CmsFieldSchema> = {
  label: text('Libellé', true),
  href: url('Destination', true),
  variant: select('Style', ['primary', 'ghost', 'light']),
  newWindow: boolean('Ouvrir dans un nouvel onglet'),
  arrow: select('Flèche', ['none', 'right', 'external']),
}

const actions = (label = 'Actions') => list(label, object('Action', actionFields), 0, 6)

const headingFields: Record<string, CmsFieldSchema> = {
  eyebrow: text('Surtitre'),
  title: text('Titre', true),
  description: textarea('Introduction'),
}

const paragraphList = (label = 'Paragraphes') => list(label, textarea('Paragraphe', true), 0, 20)

export const cmsSeoImageFieldSchema = image('Image de partage', false, 'hero')

export const cmsBlockRegistry = {
  hero: {
    type: 'hero',
    label: 'Hero',
    description: 'En-tête principal avec image ou vidéo et appels à l’action.',
    variants: ['page-image', 'home-video', 'compact'],
    fields: {
      eyebrow: text('Surtitre'),
      title: text('Titre principal', true),
      titleLines: list(
        'Lignes de titre stylées',
        object('Ligne', {
          text: text('Texte', true),
          style: select('Style', ['solid', 'outline']),
        }),
        0,
        4,
      ),
      description: textarea('Description'),
      image: image('Image', false, 'hero'),
      video: object('Vidéo', {
        src: url('Fichier vidéo', true),
        mimeType: text('Type MIME'),
        poster: image('Poster', false, 'hero', false),
      }),
      aside: text('Texte latéral'),
      size: select('Taille', ['compact', 'default', 'large']),
      actions: actions(),
    },
    defaultData: { title: '', size: 'default', actions: [] },
  },
  value_ticker: {
    type: 'value_ticker',
    label: 'Bandeau de valeurs',
    description: 'Liste répétée et animée de valeurs courtes.',
    variants: ['marquee'],
    fields: {
      label: text('Nom accessible'),
      values: list('Valeurs', object('Valeur', { title: text('Titre', true) }), 1, 20),
    },
    defaultData: { label: 'Valeurs', values: [] },
  },
  split_content: {
    type: 'split_content',
    label: 'Texte et image',
    description: 'Contenu éditorial en deux colonnes, avec options de citation, liste et chiffres.',
    variants: ['default', 'story'],
    fields: {
      ...headingFields,
      paragraphs: paragraphList(),
      image: image('Image'),
      imageSide: select('Position de l’image', ['left', 'right']),
      badge: text('Badge sur l’image'),
      quote: textarea('Citation'),
      listLabel: text('Nom accessible de la liste'),
      listItems: list('Liste', text('Élément', true), 0, 30),
      stats: list(
        'Chiffres clés',
        object('Chiffre', { value: text('Valeur', true), label: text('Libellé', true) }),
        0,
        6,
      ),
      actions: actions(),
    },
    defaultData: { title: '', paragraphs: [], imageSide: 'left', actions: [] },
  },
  team_grid: {
    type: 'team_grid',
    label: 'Grille d’équipes',
    description: 'Sélection ordonnée de cartes équipes.',
    variants: ['default'],
    fields: {
      ...headingFields,
      teams: list(
        'Équipes',
        object('Équipe', {
          slug: text('Identifiant', true),
          name: text('Nom', true),
          division: text('Division', true),
          level: text('Niveau', true),
          program: text('Programme', true),
          description: textarea('Description', true),
          image: image('Image', true, 'master'),
          accent: text('Couleur d’accent'),
        }),
        1,
        20,
      ),
      actions: actions(),
    },
    defaultData: { title: '', teams: [], actions: [] },
  },
  photo_rail: {
    type: 'photo_rail',
    label: 'Galerie horizontale',
    description: 'Rail de photos navigable au clavier.',
    variants: ['default'],
    fields: {
      ...headingFields,
      label: text('Nom accessible de la galerie'),
      photos: list(
        'Photos',
        object('Photo', { image: image('Image', true), caption: text('Légende') }),
        1,
        30,
      ),
    },
    defaultData: { title: '', label: 'Galerie photos', photos: [] },
  },
  feature_card: {
    type: 'feature_card',
    label: 'Carte éditoriale mise en avant',
    description: 'Grande actualité illustrée avec texte et actions.',
    variants: ['news'],
    fields: {
      heading: object('En-tête de section', headingFields, true),
      ...headingFields,
      image: image('Image'),
      paragraphs: paragraphList(),
      actions: actions(),
    },
    defaultData: { title: '', paragraphs: [], actions: [] },
  },
  link_card_grid: {
    type: 'link_card_grid',
    label: 'Cartes de navigation',
    description: 'Cartes illustrées menant vers des pages ou services.',
    variants: ['paths'],
    fields: {
      ...headingFields,
      cards: list(
        'Cartes',
        object('Carte', {
          index: text('Index'),
          title: text('Titre', true),
          content: textarea('Contenu', true),
          linkLabel: text('Libellé du lien', true),
          href: url('Destination', true),
          image: image('Image', false, 'card', false),
          variant: select('Style', ['practice', 'events', 'default']),
        }),
        1,
        8,
      ),
    },
    defaultData: { title: '', cards: [] },
  },
  social_follow: {
    type: 'social_follow',
    label: 'Réseaux sociaux',
    description: 'Liens vers les réseaux sociaux du club.',
    variants: ['default'],
    fields: {
      ...headingFields,
      links: list(
        'Réseaux',
        object('Réseau', {
          platform: select('Plateforme', ['Instagram', 'Facebook', 'YouTube', 'TikTok'], true),
          label: text('Nom accessible', true),
          url: url('URL', true),
        }),
        1,
        8,
      ),
      compact: boolean('Affichage compact'),
    },
    defaultData: { title: '', links: [], compact: false },
  },
  cta_band: {
    type: 'cta_band',
    label: 'Bandeau d’appel à l’action',
    description: 'Conclusion courte avec un bouton principal.',
    variants: ['compact', 'default'],
    fields: {
      title: text('Titre', true),
      content: textarea('Contenu'),
      action: object('Action', actionFields),
    },
    defaultData: { title: '' },
  },
  indexed_card_grid: {
    type: 'indexed_card_grid',
    label: 'Cartes indexées',
    description: 'Étapes ou disciplines présentées dans une grille numérotée.',
    variants: ['steps', 'disciplines'],
    fields: {
      ...headingFields,
      cards: list(
        'Cartes',
        object('Carte', {
          index: text('Index'),
          title: text('Titre', true),
          content: textarea('Contenu', true),
        }),
        1,
        12,
      ),
    },
    defaultData: { title: '', cards: [] },
  },
  season_card: {
    type: 'season_card',
    label: 'Carte de saison',
    description: 'Informations de rentrée propres à une saison.',
    variants: ['joining'],
    fields: {
      season: text('Saison', true),
      title: text('Titre', true),
      content: textarea('Contenu', true),
      note: textarea('Note'),
      actions: actions(),
    },
    defaultData: { season: '', title: '', content: '', actions: [] },
  },
  comparison_card_grid: {
    type: 'comparison_card_grid',
    label: 'Cartes comparatives',
    description: 'Comparaison de parcours avec listes de caractéristiques.',
    variants: ['joining-paths'],
    fields: {
      ...headingFields,
      cards: list(
        'Parcours',
        object('Parcours', {
          tag: text('Étiquette'),
          title: text('Titre', true),
          content: textarea('Contenu', true),
          items: list('Caractéristiques', text('Caractéristique', true), 0, 12),
        }),
        1,
        6,
      ),
    },
    defaultData: { title: '', cards: [] },
  },
  faq: {
    type: 'faq',
    label: 'Questions fréquentes',
    description: 'Liste de questions/réponses structurées.',
    variants: ['default'],
    fields: {
      ...headingFields,
      items: list(
        'Questions',
        object('Question', {
          question: text('Question', true, 300),
          answer: textarea('Réponse', true, 4_000),
          category: select('Catégorie', ['Cheerleading', 'Club', 'Inscription', 'Animations']),
        }),
        1,
        100,
      ),
      openFirst: boolean('Ouvrir la première réponse'),
    },
    defaultData: { title: '', items: [], openFirst: false },
  },
  palmares_timeline: {
    type: 'palmares_timeline',
    label: 'Palmarès',
    description: 'Résultats regroupés par saison et compétition.',
    variants: ['timeline'],
    fields: {
      ...headingFields,
      seasons: list(
        'Saisons',
        object('Saison', {
          season: text('Saison', true),
          highlights: list(
            'Compétitions',
            object('Compétition', {
              competition: text('Nom', true),
              date: text('Date affichée'),
              results: list('Résultats', text('Résultat', true), 1, 50),
            }),
            1,
            30,
          ),
        }),
        1,
        30,
      ),
      action: object('Action', actionFields),
    },
    defaultData: { title: '', seasons: [] },
  },
  staff_directory: {
    type: 'staff_directory',
    label: 'Bureau et coaching',
    description: 'Groupes de responsables, membres du bureau et coachs.',
    variants: ['default'],
    fields: {
      ...headingFields,
      season: text('Saison'),
      groups: list(
        'Groupes',
        object('Groupe', {
          title: text('Titre', true),
          members: list(
            'Membres',
            object('Membre', {
              role: text('Rôle', true),
              name: text('Nom', true),
              support: text('Support'),
            }),
            1,
            50,
          ),
        }),
        1,
        20,
      ),
    },
    defaultData: { title: '', groups: [] },
  },
  contact_directory: {
    type: 'contact_directory',
    label: 'Contact et adresse',
    description: 'Canaux de contact et panneau illustré de localisation.',
    variants: ['default'],
    fields: {
      contact: object(
        'Contact',
        {
          eyebrow: text('Surtitre'),
          title: text('Titre', true),
          content: textarea('Contenu'),
          channels: list(
            'Canaux',
            object('Canal', {
              title: text('Titre', true),
              description: text('Description', true),
              href: url('Destination', true),
            }),
            1,
            12,
          ),
        },
        true,
      ),
      address: object(
        'Adresse',
        {
          eyebrow: text('Surtitre'),
          title: text('Titre', true),
          lines: list('Lignes', text('Ligne', true), 1, 8),
          image: image('Image', false, 'hero', false),
          action: object('Action', actionFields),
        },
        true,
      ),
    },
    defaultData: {
      contact: { title: '', channels: [] },
      address: { title: '', lines: [] },
    },
  },
  rich_text: {
    type: 'rich_text',
    label: 'Texte structuré',
    description: 'Texte sans HTML arbitraire pour les pages éditoriales et légales.',
    variants: ['default', 'legal'],
    fields: {
      eyebrow: text('Surtitre'),
      title: text('Titre', true),
      introduction: list(
        'Introduction',
        object('Paragraphe', {
          text: textarea('Texte', true),
          style: select('Style', ['default', 'notice']),
        }),
        0,
        10,
      ),
      sections: list(
        'Sections',
        object('Section', {
          title: text('Titre'),
          paragraphs: list(
            'Paragraphes',
            object('Paragraphe', {
              text: textarea('Texte', true),
              style: select('Style', ['default', 'notice', 'address']),
            }),
            0,
            30,
          ),
          list: object('Liste', {
            ordered: boolean('Liste ordonnée'),
            items: list('Éléments', text('Élément', true), 1, 100),
          }),
        }),
        0,
        100,
      ),
    },
    defaultData: { title: '', introduction: [], sections: [] },
  },
} satisfies { [TType in CmsBlockType]: CmsBlockDefinition<TType> }

export function isCmsBlockType(value: unknown): value is CmsBlockType {
  return typeof value === 'string' && (cmsBlockTypes as readonly string[]).includes(value)
}

export function getCmsBlockDefinition<TType extends CmsBlockType>(
  type: TType,
): CmsBlockDefinition<TType> {
  return cmsBlockRegistry[type] as unknown as CmsBlockDefinition<TType>
}

export function createCmsBlock<TType extends CmsBlockType>(
  type: TType,
  id: string,
  sortOrder = 0,
): CmsBlockOfType<TType> {
  const definition = getCmsBlockDefinition(type)

  return {
    id,
    type,
    variant: definition.variants[0],
    sortOrder,
    enabled: true,
    schemaVersion: 1,
    data: structuredClone(definition.defaultData),
  } as unknown as CmsBlockOfType<TType>
}

export function listCmsBlockDefinitions(): CmsBlockDefinition[] {
  return cmsBlockTypes.map((type) => cmsBlockRegistry[type]) as CmsBlockDefinition[]
}

export function sortCmsBlocks(blocks: readonly CmsBlock[]): CmsBlock[] {
  return [...blocks].sort((first, second) => first.sortOrder - second.sortOrder)
}
