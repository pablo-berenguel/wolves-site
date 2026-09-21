export interface PostalAddress {
  street: string
  postalCode: string
  city: string
  country: string
  formatted: string
}

export interface SiteIdentity {
  name: string
  shortName: string
  tagline: string
  description: string
  footerDescription: string
  founded: number
  location: string
  address: PostalAddress
  logo: string
  heroImage: string
}

export interface NavItem {
  label: string
  to: string
  children?: NavItem[]
}

export interface Value {
  title: string
  description: string
  icon: string
}

export type SocialPlatform = 'Instagram' | 'Facebook' | 'YouTube' | 'TikTok'

export interface SocialLink {
  platform: SocialPlatform
  label: string
  url: string
  href: string
  icon: Lowercase<SocialPlatform>
}

export interface Team {
  slug: string
  name: string
  division: string
  level: string
  program: string
  description: string
  image: string
  imageAlt: string
  imageWidth?: number
  imageHeight?: number
  imagePosition?: string
  accent: string
}

export interface StaffMember {
  name: string
  role: string
  teams?: string[]
  image?: string
  imageAlt?: string
}

export interface CoachingGroup {
  team: string
  level?: string
  coaches: string[]
  support?: string[]
}

export interface PalmaresHighlight {
  competition: string
  date?: string
  results: string[]
}

export interface SeasonPalmares {
  season: string
  highlights: PalmaresHighlight[]
}

export type FaqCategory = 'Cheerleading' | 'Club' | 'Inscription' | 'Animations'

export interface FaqItem {
  question: string
  answer: string
  category: FaqCategory
}

export interface JoinStep {
  title: string
  description: string
}

export interface JoiningInformation {
  season: string
  intro: string
  formUrl: string
  discordUrl: string
  steps: JoinStep[]
  note: string
}

export interface ContactInformation {
  address: PostalAddress
  mapsUrl: string
  animationFormUrl: string
}

export const clubAddress: PostalAddress = {
  street: '249 cours Rosalind Franklin',
  postalCode: '31400',
  city: 'Toulouse',
  country: 'France',
  formatted: '249 cours Rosalind Franklin, 31400 Toulouse',
}

export const site: SiteIdentity = {
  name: 'Wolves Toulouse Cheerleading',
  shortName: 'Wolves Toulouse',
  tagline: 'The Wolves are on the mat',
  description:
    'Club de cheerleading senior implanté à Toulouse, engagé en loisir et en compétition en France comme à l’international.',
  footerDescription: 'Club de cheerleading senior à Toulouse, du loisir au niveau international.',
  founded: 2014,
  location: 'Toulouse · Université Paul-Sabatier',
  address: clubAddress,
  logo: '/images/logo-wolves.webp',
  heroImage: '/images/hero-wolves.webp',
}

export const navigation: NavItem[] = [
  { label: 'Accueil', to: '/' },
  {
    label: 'Le club',
    to: '/club',
    children: [
      { label: 'Notre histoire', to: '/club#histoire' },
      { label: 'Le cheerleading, c’est quoi ?', to: '/club/cheerleading' },
      { label: 'Bureau & coaching', to: '/club#staff' },
      { label: 'Palmarès', to: '/club#palmares' },
    ],
  },
  { label: 'Équipes', to: '/equipes' },
  { label: 'Nous rejoindre', to: '/rejoindre' },
  { label: 'Animations', to: '/animations' },
  { label: 'Contact', to: '/contact' },
]

export const footerLinks: NavItem[] = [
  { label: 'Le club', to: '/club' },
  { label: 'Le cheerleading', to: '/club/cheerleading' },
  { label: 'Les équipes', to: '/equipes' },
  { label: 'Palmarès', to: '/club#palmares' },
  { label: 'Nous rejoindre', to: '/rejoindre' },
  { label: 'Animations', to: '/animations' },
  { label: 'FAQ & contact', to: '/contact' },
]

export const values: Value[] = [
  {
    title: 'Découverte',
    description: 'Découvrir une discipline complète, spectaculaire et ouverte à tous les profils.',
    icon: 'compass',
  },
  {
    title: 'Apprentissage',
    description:
      'Progresser avec méthode, du premier porté aux éléments techniques les plus avancés.',
    icon: 'spark',
  },
  {
    title: 'Compétition',
    description: 'Se dépasser ensemble sur les praticables français et internationaux.',
    icon: 'trophy',
  },
  {
    title: 'Entraide',
    description: 'Faire confiance à sa stunt, soutenir la meute et célébrer chaque progrès.',
    icon: 'hands',
  },
  {
    title: 'Cheerspirit',
    description: 'Porter l’énergie, le respect et la solidarité qui font vivre le cheerleading.',
    icon: 'megaphone',
  },
]

export const socials: SocialLink[] = [
  {
    platform: 'Instagram',
    label: 'Suivre les Wolves sur Instagram',
    url: 'https://www.instagram.com/wolves_toulouse_cheerleading/',
    href: 'https://www.instagram.com/wolves_toulouse_cheerleading/',
    icon: 'instagram',
  },
  {
    platform: 'Facebook',
    label: 'Suivre les Wolves sur Facebook',
    url: 'https://www.facebook.com/WolvesToulouseCheerleadingPaulSabatier/',
    href: 'https://www.facebook.com/WolvesToulouseCheerleadingPaulSabatier/',
    icon: 'facebook',
  },
  {
    platform: 'YouTube',
    label: 'Voir les routines des Wolves sur YouTube',
    url: 'https://www.youtube.com/@wolvestoulousecheerleading195',
    href: 'https://www.youtube.com/@wolvestoulousecheerleading195',
    icon: 'youtube',
  },
  {
    platform: 'TikTok',
    label: 'Suivre les Wolves sur TikTok',
    url: 'https://www.tiktok.com/@wolvestlsecheer',
    href: 'https://www.tiktok.com/@wolvestlsecheer',
    icon: 'tiktok',
  },
]

export const teams: Team[] = [
  {
    slug: 'octogone',
    name: 'Octogone',
    division: 'Senior COED',
    level: 'Premier',
    program: 'France · Monde · Europe',
    description:
      'L’équipe mixte au plus haut niveau du club participe aux championnats de France, aux championnats du monde à Orlando et au championnat d’Europe 2026.',
    image: '/images/team-octogone.webp',
    imageAlt: 'L’équipe Octogone des Wolves Toulouse en compétition',
    imageWidth: 800,
    imageHeight: 1132,
    accent: '#2a3890',
  },
  {
    slug: 'octolady',
    name: 'Octolady',
    division: 'Senior All Girl',
    level: 'Élite',
    program: 'France · Monde',
    description:
      'L’équipe féminine élite concourt en championnat de France et représente les Wolves aux championnats du monde à Orlando.',
    image: '/images/team-octolady.webp',
    imageAlt: 'L’équipe Octolady des Wolves Toulouse en compétition',
    imageWidth: 800,
    imageHeight: 1132,
    accent: '#4b2f60',
  },
  {
    slug: 'heptagone',
    name: 'Heptagone',
    division: 'Senior',
    level: 'Avancé',
    program: 'Championnat de France',
    description:
      'Une équipe compétition de niveau avancé qui porte les couleurs de Toulouse jusqu’aux finales nationales.',
    image: '/images/team-heptagone.webp',
    imageAlt: 'L’équipe Heptagone des Wolves Toulouse',
    imageWidth: 800,
    imageHeight: 1132,
    accent: '#a6abb0',
  },
  {
    slug: 'hexagone',
    name: 'Hexagone',
    division: 'Senior',
    level: 'Médian',
    program: 'Championnat de France',
    description:
      'L’équipe médiane développe technique, synchronisation et confiance avec le championnat de France comme objectif.',
    image: '/images/team-hexagone.webp',
    imageAlt: 'L’équipe Hexagone des Wolves Toulouse',
    imageWidth: 800,
    imageHeight: 1132,
    accent: '#2f7b59',
  },
  {
    slug: 'pentagone',
    name: 'Pentagone',
    division: 'Senior',
    level: 'Novice',
    program: 'Qualifications France',
    description:
      'La porte d’entrée vers la compétition, avec une routine novice présentée aux qualifications du championnat de France.',
    image: '/images/team-pentagone.webp',
    imageAlt: 'L’équipe Pentagone des Wolves Toulouse',
    imageWidth: 800,
    imageHeight: 1067,
    accent: '#ff8427',
  },
  {
    slug: 'polygone',
    name: 'Polygone',
    division: 'Senior',
    level: 'Loisir',
    program: 'Pratique loisir',
    description:
      'Une équipe pour découvrir le cheerleading, apprendre les fondamentaux et progresser au rythme de la meute.',
    image: '/images/team-polygone.webp',
    imageAlt: 'L’équipe loisir Polygone des Wolves Toulouse',
    imageWidth: 800,
    imageHeight: 1067,
    accent: '#ffc800',
  },
]

export const board: StaffMember[] = [
  {
    name: 'Romain Perrochaud',
    role: 'Président',
  },
  {
    name: 'Ophélie Toutain',
    role: 'Secrétaire',
  },
  {
    name: 'Paolo De Sousa',
    role: 'Trésorier',
  },
]

export const sportsLeadership: StaffMember[] = [
  {
    name: 'Amélie Maier',
    role: 'Head coach',
  },
  {
    name: 'Lucie Richard',
    role: 'Assistante',
  },
]

export const coachingGroups: CoachingGroup[] = [
  {
    team: 'Polygone',
    level: 'Loisir',
    coaches: ['Flora Tejiras', 'Mathilde Marcilly', 'Sophie Lignac'],
  },
  {
    team: 'Pentagone',
    level: 'N2 universitaire',
    coaches: ['Lucie Richard', 'Lucile Jallat'],
  },
  {
    team: 'Hexagone',
    level: 'N2 ou N3',
    coaches: ['Yvana Aguière', 'Maxime Esparell'],
    support: ['Ceylan Thomas', 'Pauline Maier'],
  },
  {
    team: 'Heptagone',
    level: 'N4 ou N5',
    coaches: ['Jean-André Balsas', 'Samantha Mc Donald'],
    support: ['Cindy Fernandes', 'Pierrick Harvet'],
  },
  {
    team: 'OctoLady',
    level: 'N5',
    coaches: ['Laurine Wastiaux', 'Esteban Billaud'],
    support: ['Paolo De Sousa'],
  },
  {
    team: 'Octogone',
    level: 'NP',
    coaches: ['Amélie Maier', 'Emma Quinio'],
  },
  {
    team: 'Animations',
    coaches: ['Léa Veyret', 'Serafine Rollin'],
  },
]

export const palmares: SeasonPalmares[] = [
  {
    season: '2025–2026',
    highlights: [
      {
        competition: 'Championnats d’Europe ICU · Prague',
        date: '30 juin au 6 juillet 2026',
        results: ['Octogone · Senior Premier · 10e place'],
      },
      {
        competition: 'Finale des championnats de France FFFA',
        date: '13 et 14 juin 2026',
        results: [
          'Heptagone · Senior Avancé · Championne de France',
          'Octolady · Senior Elite All Girl · Championne de France',
          'Hexagone · Senior Médian · Vice-championne de France',
          'Octogone · Senior Premier · Vice-championne de France',
        ],
      },
      {
        competition: 'Trophée de Brive',
        date: '6 juin 2026',
        results: [
          'Pentagone · Senior Novice · 4e place',
          'Kayou · Partner Stunt Senior · 2e place',
          'Loulous · Group Stunt Senior niveaux 3–4 · 1re place',
          'Cocottes · Group Stunt Senior niveaux 3–4 · 2e place',
          'Loux-foques · Group Stunt Senior niveaux 3–4 · 3e place',
          'Toulousaings · Group Stunt Senior niveaux 5–6 · 3e place',
        ],
      },
      {
        competition: 'Championnats du monde',
        date: '21 au 30 avril 2026',
        results: ['Octolady · ICC All Girl Elite · 6e place'],
      },
      {
        competition: 'Qualifications Zone Sud-Ouest',
        date: '8 mars 2026',
        results: [
          'Pentagone · Senior Novice · 1re place',
          'Hexagone · Senior Médian · 1re place et qualification en finale',
          'Heptagone · Senior Avancé · 1re place et qualification en finale',
          'Octolady · Senior Elite All Girl · 1re place et qualification en finale',
          'Octogone · Senior Premier · 1re place et qualification en finale',
        ],
      },
    ],
  },
  {
    season: '2024–2025',
    highlights: [
      {
        competition: 'Finale des championnats de France FFFA',
        date: '10 et 11 mai 2025',
        results: [
          'Hexagone · Senior Intermédiaire · 1re place',
          'Heptagone · Senior Avancé · 2e place',
          'Octogone · Senior COED Elite · 2e place et BID pour les Worlds',
          'Octolady · Senior All Girl Elite · 2e place et BID pour les Worlds',
        ],
      },
      {
        competition: 'Championnats du monde',
        date: '2025',
        results: [
          'Octolady · ICC All Girl Elite · 1re place',
          'Octogone · ICC COED Elite · 4e place',
        ],
      },
      {
        competition: 'Qualifications Zone C',
        date: '29 mars 2025',
        results: [
          'Hexagone · Senior Intermédiaire · 1re place',
          'Heptagone · Senior Avancé · 1re place',
          'Octogone · Senior Elite · 1re place',
          'Octolady · Senior Elite All Girl · 1re place',
        ],
      },
    ],
  },
  {
    season: '2023–2024',
    highlights: [
      {
        competition: 'Finale des championnats de France FFFA',
        date: '8 et 9 juin 2024',
        results: [
          'Octogone · Senior COED Elite · Championne de France et BID pour les Worlds',
          'Octolady · Senior All Girl Elite · 2e place et BID pour les Worlds',
          'Hexagone · Senior Intermédiaire · 3e place',
          'Heptagone · Senior Médian · 3e place',
        ],
      },
      {
        competition: 'Open de Lyon SACD',
        date: '25 mai 2024',
        results: ['Octogone · Senior All Girl niveau 5 · 5e place'],
      },
      {
        competition: 'Championnats du monde',
        date: '2024',
        results: ['Octogone · International Global Club COED · 8e place en finale'],
      },
    ],
  },
]

export const faqs: FaqItem[] = [
  {
    question: 'Le cheerleading, c’est quoi exactement ?',
    answer:
      'C’est un sport complet qui associe un scand, des stunts — les portés —, du tumbling, des sauts, de la danse et des pyramides dans une routine collective.',
    category: 'Cheerleading',
  },
  {
    question: 'Le cheerleading est-il un sport mixte ?',
    answer:
      'Oui. Les équipes COED réunissent femmes et hommes, tandis que la catégorie All Girl est composée exclusivement de femmes. Il existe une place et un rôle pour chaque gabarit.',
    category: 'Cheerleading',
  },
  {
    question: 'Quelles équipes composent la meute ?',
    answer:
      'Les Wolves comptent six équipes : Polygone en loisir, Pentagone en novice, Hexagone en médian, Heptagone en avancé, Octolady en All Girl Elite et Octogone en COED Premier.',
    category: 'Club',
  },
  {
    question: 'Où et à quel rythme ont lieu les entraînements ?',
    answer:
      'Le club s’entraîne au gymnase de l’Université Paul-Sabatier à Toulouse. Selon la section, les entraînements encadrés ont lieu une à deux fois par semaine, avec des créneaux libres supplémentaires pour se perfectionner.',
    category: 'Club',
  },
  {
    question: 'Comment rejoindre les Wolves en 2026–2027 ?',
    answer:
      'Commence par remplir le formulaire d’intérêt de la saison 2026–2027. Les prochaines informations seront publiées pendant l’été sur Instagram et sur le Discord du club.',
    category: 'Inscription',
  },
  {
    question: 'Puis-je rejoindre le club si je débute ?',
    answer:
      'Oui, la section loisir Polygone permet de découvrir les fondamentaux et Pentagone constitue le premier niveau du parcours compétition. Le formulaire d’intérêt aide le coaching à orienter chaque personne.',
    category: 'Inscription',
  },
  {
    question: 'Les Wolves peuvent-ils animer un événement ?',
    answer:
      'Oui. Le club propose des animations et dispose d’un formulaire dédié pour étudier chaque demande d’événement.',
    category: 'Animations',
  },
]

export const joining: JoiningInformation = {
  season: '2026–2027',
  intro:
    'Tu veux rejoindre la meute la saison prochaine ? Le formulaire d’intérêt est déjà ouvert à toutes les personnes qui souhaitent candidater.',
  formUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSc2Hbc_kgnAIfkhpOaVZn8FC6ov7EloDTHXowWo5of5tbPfvg/viewform?pli=1',
  discordUrl: 'https://discord.com/invite/bx7hd292BU',
  steps: [
    {
      title: 'Remplis le formulaire',
      description:
        'Présente ton profil et indique l’équipe ou le type de pratique qui t’intéresse.',
    },
    {
      title: 'Reste connecté',
      description: 'Les dates et informations de rentrée seront publiées pendant l’été 2026.',
    },
    {
      title: 'Rejoins la meute',
      description:
        'Suis les annonces sur Instagram et échange avec le club directement sur Discord.',
    },
  ],
  note: 'Les modalités détaillées de la rentrée 2026–2027 seront communiquées au cours de l’été 2026.',
}

export const contact: ContactInformation = {
  address: clubAddress,
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=249%20cours%20Rosalind%20Franklin%2C%2031400%20Toulouse',
  animationFormUrl: 'https://forms.gle/zbb5FgLSWcEVavYZ6',
}

export const siteContent = {
  site,
  navigation,
  footerLinks,
  values,
  socials,
  teams,
  board,
  sportsLeadership,
  coachingGroups,
  palmares,
  faqs,
  joining,
  contact,
}

export default siteContent
