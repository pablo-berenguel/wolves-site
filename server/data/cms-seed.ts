import type BetterSqlite3 from 'better-sqlite3'

import {
  board,
  coachingGroups,
  contact,
  faqs,
  footerLinks,
  joining,
  navigation,
  palmares,
  site,
  socials,
  sportsLeadership,
  teams,
  values,
} from '../../app/data/site'
import type { CmsBlock, CmsImage, CmsPageSeo } from '../../shared/cms/types'

export const CMS_SEED_VERSION = 1
export const CMS_SEED_MARKER = `seed:current-site:v${CMS_SEED_VERSION}`

interface CmsSeedPage {
  id: string
  path: string
  title: string
  seo: CmsPageSeo
  blocks: CmsBlock[]
}

interface CmsSeedMedia {
  id: string
  path: string
  mimeType: string
  width: number
  height: number
}

export interface CmsSeedResult {
  applied: boolean
  pages: number
  blocks: number
  media: number
}

const mediaDimensions = {
  '/images/hero-wolves.webp': [1246, 704],
  '/images/home-flight.webp': [1246, 704],
  '/images/home-huddle.webp': [1246, 704],
  '/images/home-pyramid.webp': [1246, 704],
  '/images/home-stage.webp': [1960, 876],
  '/images/home-stunt.webp': [1246, 704],
  '/images/home-team.webp': [1246, 704],
  '/images/home-tumbling.webp': [1246, 704],
  '/images/logo-wolves.webp': [461, 512],
  '/images/team-heptagone.webp': [800, 1132],
  '/images/team-hexagone.webp': [800, 1132],
  '/images/team-octogone.webp': [800, 1132],
  '/images/team-octolady.webp': [800, 1132],
  '/images/team-pentagone.webp': [800, 1067],
  '/images/team-polygone.webp': [800, 1067],
  '/og-charte.png': [1200, 630],
} as const

function mediaId(path: string): string {
  return `media:bundled:${path.replace(/^\//, '').replaceAll('/', ':')}`
}

function image(path: keyof typeof mediaDimensions, alt: string): CmsImage {
  const [width, height] = mediaDimensions[path]
  return {
    mediaId: mediaId(path),
    src: path,
    alt,
    width,
    height,
  }
}

function block<T extends CmsBlock>(value: T): T {
  return value
}

const teamBlocks = teams.map((team) => ({
  slug: team.slug,
  name: team.name,
  division: team.division,
  level: team.level,
  program: team.program,
  description: team.description,
  image: image(team.image as keyof typeof mediaDimensions, team.imageAlt),
  accent: team.accent,
}))

const faqBlocks = faqs.map(({ question, answer, category }) => ({
  question,
  answer,
  category,
}))

export const cmsSeedMedia: readonly CmsSeedMedia[] = Object.entries(mediaDimensions).map(
  ([path, [width, height]]) => ({
    id: mediaId(path),
    path,
    mimeType: path.endsWith('.png') ? 'image/png' : 'image/webp',
    width,
    height,
  }),
)

export const cmsSeedSettings: Readonly<Record<string, unknown>> = {
  'site.identity': site,
  'site.navigation': navigation,
  'site.footerLinks': footerLinks,
  'site.values': values,
  'site.socials': socials,
  'site.teams': teams,
  'site.board': board,
  'site.sportsLeadership': sportsLeadership,
  'site.coachingGroups': coachingGroups,
  'site.palmares': palmares,
  'site.faqs': faqs,
  'site.joining': joining,
  'site.contact': contact,
}

export const cmsSeedPages: readonly CmsSeedPage[] = [
  {
    id: 'page:home',
    path: '/',
    title: 'Accueil',
    seo: {
      title: 'Club de cheerleading à Toulouse',
      description:
        'Découvre les Wolves Toulouse : six équipes de cheerleading senior, du loisir au niveau international, entraînées à l’Université Paul-Sabatier.',
      image: image('/og-charte.png', ''),
    },
    blocks: [
      block({
        id: 'home:hero',
        type: 'hero',
        variant: 'home-video',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Toulouse · Depuis 2014',
          title: 'Cheerleading. Esprit de meute.',
          titleLines: [
            { text: 'Cheerleading.', style: 'solid' },
            { text: 'Esprit de meute.', style: 'outline' },
          ],
          description:
            'Prends une chocolatine, entre dans la meute et découvre un club où l’on apprend, où l’on se dépasse et où chaque athlète compte.',
          video: {
            src: '/videos/hero-wolves.mp4',
            mimeType: 'video/mp4',
            poster: image('/images/home-huddle.webp', ''),
          },
          aside: 'Club senior · Loisir & compétition',
          size: 'large',
          actions: [
            {
              label: 'Rejoindre les Wolves',
              href: '/rejoindre',
              variant: 'primary',
              arrow: 'right',
            },
            {
              label: 'Découvrir le cheer',
              href: '/club/cheerleading',
              variant: 'ghost',
            },
          ],
        },
      }),
      block({
        id: 'home:values',
        type: 'value_ticker',
        variant: 'marquee',
        sortOrder: 1,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          label: 'Les valeurs des Wolves',
          values: values.map(({ title }) => ({ title })),
        },
      }),
      block({
        id: 'home:about',
        type: 'split_content',
        variant: 'story',
        sortOrder: 2,
        anchor: 'club',
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Qui sommes-nous ?',
          title: 'Un club toulousain. Une ambition sans frontières.',
          paragraphs: [
            'Fondés en 2014 à l’initiative d’étudiants de l’Université Paul-Sabatier, les Wolves rassemblent aujourd’hui des athlètes seniors en loisir et en compétition, du niveau novice au Premier.',
          ],
          image: image(
            '/images/home-stage.webp',
            'Les Wolves en pleine routine de cheerleading sur scène',
          ),
          imageSide: 'left',
          badge: 'The Wolves are on the mat',
          stats: [
            { value: '2014', label: 'Création du club à Toulouse' },
            { value: '6', label: 'Équipes dans la meute' },
            { value: '3', label: 'Scènes : France, Monde, Europe' },
          ],
          actions: [
            {
              label: 'L’histoire du club',
              href: '/club',
              variant: 'primary',
              arrow: 'right',
            },
            { label: 'Voir le palmarès', href: '/club#palmares', variant: 'light' },
          ],
        },
      }),
      block({
        id: 'home:teams',
        type: 'team_grid',
        variant: 'default',
        sortOrder: 3,
        anchor: 'equipes',
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'La meute',
          title: 'Six équipes. Une même énergie.',
          description:
            'Du loisir au Premier, chaque section a son niveau, ses objectifs et sa personnalité — avec le même goût du collectif.',
          teams: teamBlocks.slice(0, 3),
          actions: [
            {
              label: 'Découvrir les six équipes',
              href: '/equipes',
              variant: 'ghost',
              arrow: 'right',
            },
          ],
        },
      }),
      block({
        id: 'home:gallery',
        type: 'photo_rail',
        variant: 'default',
        sortOrder: 4,
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Sur le praticable',
          title: 'Plus qu’un sport. Une confiance absolue.',
          description:
            'Stunts, tumbling, danse, scand : une routine mêle technique, explosivité et synchronisation.',
          photos: [
            {
              image: image(
                '/images/home-pyramid.webp',
                'Les Wolves réalisent plusieurs portés synchronisés sur le praticable',
              ),
              caption: 'La confiance se construit à plusieurs.',
            },
            {
              image: image(
                '/images/home-tumbling.webp',
                'Une athlète des Wolves réalise un élément de tumbling',
              ),
              caption: 'Force, précision, explosivité.',
            },
            {
              image: image(
                '/images/home-team.webp',
                'La grande photo de groupe des Wolves Toulouse',
              ),
              caption: 'Une meute, six équipes.',
            },
            {
              image: image(
                '/images/home-flight.webp',
                'Des flyers des Wolves dans les airs pendant une routine',
              ),
              caption: 'The Wolves are on the mat.',
            },
          ],
        },
      }),
      block({
        id: 'home:news',
        type: 'feature_card',
        variant: 'news',
        sortOrder: 5,
        anchor: 'actualites',
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          heading: {
            eyebrow: 'Actualités',
            title: 'La meute ne s’arrête jamais.',
            description:
              'Entraînements extérieurs, rendez-vous du club et informations de rentrée : le Discord est le point de ralliement.',
          },
          eyebrow: 'Cet été à Toulouse',
          title: 'Viens stunter avec nous.',
          image: image(
            '/images/home-team.webp',
            'Les athlètes des Wolves réunis sur le praticable',
          ),
          paragraphs: [
            'Les entraînements extérieurs sont ouverts à tout le monde, mineurs compris. Les prochaines dates et les propositions de sessions sont partagées directement sur Discord.',
          ],
          actions: [
            {
              label: 'Rejoindre le Discord',
              href: joining.discordUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
            {
              label: 'Suivre sur Instagram',
              href: socials[0]!.url,
              variant: 'ghost',
              newWindow: true,
            },
          ],
        },
      }),
      block({
        id: 'home:paths',
        type: 'link_card_grid',
        variant: 'paths',
        sortOrder: 6,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Tu cherches…',
          title: 'Ta place est peut-être ici.',
          description:
            'Enfile tes baskets pour pratiquer, ou invite les Wolves à créer un moment spectaculaire lors de ton événement.',
          cards: [
            {
              index: '01',
              title: 'Une équipe pour pratiquer',
              content: 'Loisir ou compétition : découvre le parcours qui te correspond.',
              linkLabel: 'Rejoindre la meute',
              href: '/rejoindre',
              image: image(
                '/images/home-flight.webp',
                'Des flyers des Wolves dans les airs pendant une routine',
              ),
              variant: 'practice',
            },
            {
              index: '02',
              title: 'Une équipe pour animer',
              content: 'Match, soirée, after-work ou événement : faisons vibrer ton public.',
              linkLabel: 'Demander une animation',
              href: '/animations',
              image: image(
                '/images/home-stage.webp',
                'Les Wolves Toulouse pendant une animation de cheerleading',
              ),
              variant: 'events',
            },
          ],
        },
      }),
      block({
        id: 'home:socials',
        type: 'social_follow',
        variant: 'default',
        sortOrder: 7,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Dans les coulisses',
          title: 'Suis la meute au quotidien.',
          links: socials.map(({ platform, label, url }) => ({ platform, label, url })),
        },
      }),
      block({
        id: 'home:cta',
        type: 'cta_band',
        variant: 'compact',
        sortOrder: 8,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          title: 'Prêt à entrer sur le mat ?',
          content: `Le formulaire d’intérêt ${joining.season} est ouvert. Fais le premier pas, le coaching t’aidera à trouver ta place.`,
          action: {
            label: 'Remplir le formulaire',
            href: joining.formUrl,
            variant: 'light',
            newWindow: true,
            arrow: 'external',
          },
        },
      }),
    ],
  },
  {
    id: 'page:teams',
    path: '/equipes',
    title: 'Les équipes',
    seo: {
      title: 'Les équipes de cheerleading',
      description:
        'Découvre les six équipes des Wolves Toulouse : loisir, novice, médian, avancé, All Girl Élite et COED Premier.',
      image: image('/images/home-team.webp', ''),
    },
    blocks: [
      block({
        id: 'teams:hero',
        type: 'hero',
        variant: 'page-image',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Six sections · Une meute',
          title: 'Du loisir au niveau mondial.',
          description:
            'Chaque équipe a son rythme, son niveau et ses objectifs. Toutes partagent le même cheerspirit.',
          image: image(
            '/images/home-team.webp',
            'La grande photo de groupe des six équipes Wolves Toulouse',
          ),
          actions: [
            { label: 'Trouver ma place', href: '/rejoindre', variant: 'primary' },
            { label: 'Voir le palmarès', href: '/club#palmares', variant: 'ghost' },
          ],
        },
      }),
      block({
        id: 'teams:grid',
        type: 'team_grid',
        variant: 'default',
        sortOrder: 1,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Les équipes 2025–2026',
          title: 'Choisis ton terrain de jeu.',
          description:
            'Polygone accueille la pratique loisir. Pentagone, Hexagone, Heptagone, Octolady et Octogone constituent le parcours compétition.',
          teams: teamBlocks,
        },
      }),
      block({
        id: 'teams:orientation',
        type: 'split_content',
        variant: 'default',
        sortOrder: 2,
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Pas besoin de connaître ton niveau',
          title: 'Le coaching t’oriente.',
          paragraphs: [
            'Débutant complet, ancien gymnaste, danseur, joueur de sport collectif ou cheerleader expérimenté : chaque parcours apporte des qualités utiles à une équipe.',
            'Le formulaire d’intérêt permet au coaching de comprendre ton expérience, tes envies et tes disponibilités avant les informations de rentrée.',
          ],
          image: image(
            '/images/home-flight.webp',
            'Plusieurs flyers des Wolves dans les airs pendant une routine',
          ),
          imageSide: 'right',
          actions: [{ label: 'Comment nous rejoindre', href: '/rejoindre', variant: 'primary' }],
        },
      }),
    ],
  },
  {
    id: 'page:events',
    path: '/animations',
    title: 'Animations',
    seo: {
      title: 'Animations cheerleading à Toulouse',
      description:
        'Fais intervenir les Wolves Toulouse lors d’un match, after-work, soirée à thème ou événement. Demande une animation de cheerleading sur mesure.',
      image: image('/images/home-stage.webp', ''),
    },
    blocks: [
      block({
        id: 'events:hero',
        type: 'hero',
        variant: 'page-image',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Prestations & événements',
          title: 'Fais entrer la meute en scène.',
          description:
            'Match, soirée, after-work ou événement de marque : une animation de cheerleading transforme l’énergie d’un public.',
          image: image(
            '/images/home-stage.webp',
            'Les Wolves Toulouse pendant une animation de cheerleading',
          ),
          actions: [
            {
              label: 'Demander un devis',
              href: contact.animationFormUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
          ],
        },
      }),
      block({
        id: 'events:purpose',
        type: 'split_content',
        variant: 'default',
        sortOrder: 1,
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Une prestation qui a du sens',
          title: 'Du spectacle pour soutenir le projet sportif.',
          paragraphs: [
            'Le club a une vocation de compétition. Les animations rémunérées contribuent au financement des déplacements et des échéances sportives, tout en faisant découvrir la discipline au public.',
            'Chaque intervention est étudiée selon le contexte : espace disponible, nature du sol, proximité du public, durée et niveau de technicité compatible avec le lieu.',
          ],
          listLabel: 'Exemples d’événements',
          listItems: [
            'Matchs sportifs',
            'After-works',
            'Soirées à thème',
            'Événements étudiants',
            'Lancements',
            'Temps forts d’entreprise',
          ],
          image: image(
            '/images/home-flight.webp',
            'Une prestation événementielle des Wolves Toulouse',
          ),
          imageSide: 'right',
          actions: [
            {
              label: 'Présenter mon projet',
              href: contact.animationFormUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
          ],
        },
      }),
      block({
        id: 'events:steps',
        type: 'indexed_card_grid',
        variant: 'steps',
        sortOrder: 2,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Comment ça se passe ?',
          title: 'Une animation préparée, jamais improvisée.',
          description:
            'La sécurité et la lisibilité du show guident la proposition, du premier échange au passage devant le public.',
          cards: [
            {
              index: '01',
              title: 'Parle-nous de ton événement',
              content:
                'Lieu, date, public, format et intention : plus le brief est précis, plus la proposition sera adaptée.',
            },
            {
              index: '02',
              title: 'Nous imaginons la prestation',
              content:
                'Effectif, durée et contenu sont définis en fonction du cadre, de l’espace disponible et de la sécurité.',
            },
            {
              index: '03',
              title: 'La meute entre en scène',
              content:
                'Les Wolves apportent énergie, technique et cheerspirit pour créer un temps fort mémorable.',
            },
          ],
        },
      }),
      block({
        id: 'events:cta',
        type: 'cta_band',
        variant: 'default',
        sortOrder: 3,
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          title: 'Ton événement mérite un moment fort.',
          content:
            'Remplis le formulaire avec les premières informations. Le club reviendra vers toi pour étudier la faisabilité.',
          action: {
            label: 'Ouvrir le formulaire',
            href: contact.animationFormUrl,
            variant: 'light',
            newWindow: true,
            arrow: 'external',
          },
        },
      }),
    ],
  },
  {
    id: 'page:join',
    path: '/rejoindre',
    title: 'Nous rejoindre',
    seo: {
      title: 'Rejoindre un club de cheerleading à Toulouse',
      description:
        'Rejoins les Wolves Toulouse en loisir ou en compétition pour la saison 2026–2027. Formulaire d’intérêt, étapes et réponses aux questions.',
      image: image('/images/home-stage.webp', ''),
    },
    blocks: [
      block({
        id: 'join:hero',
        type: 'hero',
        variant: 'page-image',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Rentrée 2026–2027',
          title: 'Entre dans la meute.',
          description:
            'Tu débutes, tu reprends ou tu veux viser la compétition ? Commence par nous parler de toi, le coaching t’aidera à trouver la bonne équipe.',
          image: image(
            '/images/home-stage.webp',
            'Les Wolves réalisent une routine en compétition',
          ),
          actions: [
            {
              label: 'Remplir le formulaire d’intérêt',
              href: joining.formUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
            {
              label: 'Rejoindre le Discord',
              href: joining.discordUrl,
              variant: 'ghost',
              newWindow: true,
            },
          ],
        },
      }),
      block({
        id: 'join:season',
        type: 'season_card',
        variant: 'joining',
        sortOrder: 1,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          season: joining.season,
          title: 'Les informations de rentrée arrivent pendant l’été.',
          content: joining.intro,
          note: joining.note,
          actions: [
            {
              label: 'Je suis intéressé·e',
              href: joining.formUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
            {
              label: 'Suivre les annonces',
              href: socials[0]!.url,
              variant: 'ghost',
              newWindow: true,
            },
          ],
        },
      }),
      block({
        id: 'join:paths',
        type: 'comparison_card_grid',
        variant: 'joining-paths',
        sortOrder: 2,
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Deux façons de vivre le cheer',
          title: 'Découvrir ou performer.',
          description:
            'Les modalités exactes dépendent des équipes et de la saison. Le coaching propose le parcours le plus cohérent avec ton profil.',
          cards: [
            {
              tag: 'Équipe Polygone',
              title: 'Pratique loisir',
              content:
                'Pour apprendre les fondamentaux, progresser en groupe et découvrir toutes les composantes du cheerleading sans objectif de championnat.',
              items: [
                'Accessible aux débutants',
                'Apprentissage progressif des stunts et du tumbling',
                'Une pratique centrée sur le plaisir et le collectif',
              ],
            },
            {
              tag: 'Pentagone à Octogone',
              title: 'Parcours compétition',
              content:
                'Cinq niveaux pour construire une routine, représenter les Wolves et se mesurer aux meilleures équipes en France et à l’international.',
              items: [
                'Novice, médian, avancé, élite et Premier',
                'Engagement régulier et objectifs d’équipe',
                'Placement selon l’expérience et les besoins de la saison',
              ],
            },
          ],
        },
      }),
      block({
        id: 'join:steps',
        type: 'indexed_card_grid',
        variant: 'steps',
        sortOrder: 3,
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Le parcours',
          title: 'Trois pas vers le mat.',
          description:
            'Pas besoin de choisir seul·e une équipe dès maintenant. Commence par manifester ton intérêt.',
          cards: joining.steps.map((step, index) => ({
            index: `0${index + 1}`,
            title: step.title,
            content: step.description,
          })),
        },
      }),
      block({
        id: 'join:faq',
        type: 'faq',
        variant: 'default',
        sortOrder: 4,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Avant de te lancer',
          title: 'Les réponses essentielles.',
          description:
            'Le Discord et Instagram complètent ces informations dès que les dates de rentrée sont fixées.',
          items: faqBlocks.filter(
            ({ category }) => category === 'Inscription' || category === 'Club',
          ),
          openFirst: true,
        },
      }),
    ],
  },
  {
    id: 'page:contact',
    path: '/contact',
    title: 'FAQ et contact',
    seo: {
      title: 'FAQ et contact',
      description:
        'Contacte les Wolves Toulouse, retrouve l’adresse du club, le Discord, Instagram et les réponses aux questions fréquentes sur le cheerleading.',
      image: image('/images/home-pyramid.webp', ''),
    },
    blocks: [
      block({
        id: 'contact:hero',
        type: 'hero',
        variant: 'compact',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'FAQ & contact',
          title: 'On se retrouve où ?',
          description:
            'Une question sur le club, les inscriptions ou une animation ? Choisis le canal le plus direct pour joindre la meute.',
          image: image(
            '/images/home-pyramid.webp',
            'Les Wolves réalisent plusieurs portés synchronisés',
          ),
          size: 'compact',
        },
      }),
      block({
        id: 'contact:directory',
        type: 'contact_directory',
        variant: 'default',
        sortOrder: 1,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          contact: {
            eyebrow: 'Nous contacter',
            title: 'Le bon canal, au bon moment.',
            content:
              'Le club privilégie ses canaux officiels en ligne. Choisis celui qui correspond à ta demande pour obtenir la réponse la plus utile.',
            channels: [
              {
                title: 'Instagram',
                description: 'Actualités et messages directs',
                href: socials[0]!.url,
              },
              {
                title: 'Discord',
                description: 'Échanges et entraînements extérieurs',
                href: joining.discordUrl,
              },
              {
                title: 'Formulaire d’intérêt',
                description: `Rejoindre le club en ${joining.season}`,
                href: joining.formUrl,
              },
              {
                title: 'Formulaire animation',
                description: 'Événement et demande de devis',
                href: contact.animationFormUrl,
              },
            ],
          },
          address: {
            eyebrow: 'La tanière',
            title: 'Université Paul-Sabatier.',
            lines: [
              site.name,
              site.address.street,
              `${site.address.postalCode} ${site.address.city}`,
            ],
            image: image(
              '/images/home-pyramid.webp',
              'Les Wolves réalisent plusieurs portés synchronisés',
            ),
            action: {
              label: 'Ouvrir l’itinéraire',
              href: contact.mapsUrl,
              variant: 'primary',
              newWindow: true,
              arrow: 'external',
            },
          },
        },
      }),
      block({
        id: 'contact:faq',
        type: 'faq',
        variant: 'default',
        sortOrder: 2,
        anchor: 'faq',
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Questions fréquentes',
          title: 'Avant de nous écrire.',
          description:
            'Les principales réponses sur la discipline, les équipes, la rentrée et les animations.',
          items: faqBlocks,
          openFirst: true,
        },
      }),
    ],
  },
  {
    id: 'page:club',
    path: '/club',
    title: 'Le club',
    seo: {
      title: 'Le club et son palmarès',
      description:
        'Découvre l’histoire des Wolves Toulouse, le bureau, le coaching et le palmarès du club de cheerleading depuis 2014.',
      image: image('/images/home-team.webp', ''),
    },
    blocks: [
      block({
        id: 'club:hero',
        type: 'hero',
        variant: 'page-image',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'La meute depuis 2014',
          title: 'Une histoire écrite ensemble.',
          description:
            'Nés à l’Université Paul-Sabatier, les Wolves ont grandi sans perdre ce qui les unit : la confiance, le travail et le goût du collectif.',
          image: image(
            '/images/home-team.webp',
            'Les athlètes des Wolves Toulouse réunis en photo de club',
          ),
          actions: [
            {
              label: 'Comprendre le cheerleading',
              href: '/club/cheerleading',
              variant: 'primary',
            },
            { label: 'Voir les équipes', href: '/equipes', variant: 'ghost' },
          ],
        },
      }),
      block({
        id: 'club:history',
        type: 'split_content',
        variant: 'default',
        sortOrder: 1,
        anchor: 'histoire',
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Notre histoire',
          title: 'De Paul-Sabatier aux scènes internationales.',
          paragraphs: [
            `Fondé en septembre ${site.founded} à l’initiative d’étudiants de l’Université Paul-Sabatier, le club n’a cessé d’évoluer. Les Wolves se sont structurés autour d’une pratique senior qui accueille la découverte comme la haute compétition.`,
            'La meute compte aujourd’hui six sections : loisir, novice, médian, avancé, All Girl Élite et COED Premier. Selon l’équipe, les athlètes s’entraînent une à deux fois par semaine et disposent aussi de créneaux libres pour travailler technique, renforcement et souplesse.',
          ],
          quote: 'Se faire confiance pour monter plus haut — sur le praticable comme en dehors.',
          image: image(
            '/images/home-huddle.webp',
            'Les athlètes des Wolves se regroupent avant leur passage',
          ),
          imageSide: 'right',
        },
      }),
      block({
        id: 'club:palmares',
        type: 'palmares_timeline',
        variant: 'timeline',
        sortOrder: 2,
        anchor: 'palmares',
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Palmarès',
          title: 'Le travail de la meute, en résultats.',
          description:
            'Qualifications, finales françaises et scènes internationales : quelques repères des trois dernières saisons.',
          seasons: palmares,
          action: {
            label: 'Voir les routines sur YouTube',
            href: socials[2]!.url,
            variant: 'ghost',
            newWindow: true,
            arrow: 'external',
          },
        },
      }),
      block({
        id: 'club:staff',
        type: 'staff_directory',
        variant: 'default',
        sortOrder: 3,
        anchor: 'staff',
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Saison 2026–2027',
          title: 'Le bureau & le coaching.',
          description:
            'Une équipe bénévole et des coachs engagés font vivre chaque section de la meute.',
          season: '2026–2027',
          groups: [
            {
              title: 'Le bureau',
              members: board.map(({ role, name }) => ({ role, name })),
            },
            {
              title: 'Direction sportive',
              members: sportsLeadership.map(({ role, name }) => ({ role, name })),
            },
            {
              title: 'Coachs des équipes & animations',
              members: coachingGroups.map((group) => ({
                role: `${group.team}${group.level ? ` · ${group.level}` : ''}`,
                name: group.coaches.join(' · '),
                support: group.support?.length ? group.support.join(' · ') : undefined,
              })),
            },
          ],
        },
      }),
      block({
        id: 'club:cta',
        type: 'cta_band',
        variant: 'compact',
        sortOrder: 4,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          title: 'Écris la prochaine page avec nous.',
          content:
            'Six équipes, du loisir au niveau international, cherchent leurs prochains athlètes.',
          action: {
            label: 'Rejoindre les Wolves',
            href: '/rejoindre',
            variant: 'light',
            arrow: 'right',
          },
        },
      }),
    ],
  },
  {
    id: 'page:cheerleading',
    path: '/club/cheerleading',
    title: 'Le cheerleading',
    seo: {
      title: 'Le cheerleading, c’est quoi ?',
      description:
        'Stunts, tumbling, sauts, danse et scand : comprends les composantes du cheerleading avec les Wolves Toulouse.',
      image: image('/images/home-stunt.webp', ''),
    },
    blocks: [
      block({
        id: 'cheerleading:hero',
        type: 'hero',
        variant: 'page-image',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Découvrir la discipline',
          title: 'Le cheer, bien plus que des pompons.',
          description:
            'Un sport collectif complet qui combine force, souplesse, coordination, technique et endurance dans une routine de haute intensité.',
          image: image(
            '/images/home-stunt.webp',
            'Les flyers des Wolves en équilibre pendant une routine',
          ),
          actions: [
            { label: 'Faire un essai', href: '/rejoindre', variant: 'primary' },
            { label: 'Voir les niveaux', href: '/equipes', variant: 'ghost' },
          ],
        },
      }),
      block({
        id: 'cheerleading:intro',
        type: 'split_content',
        variant: 'default',
        sortOrder: 1,
        theme: 'light',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Un sport à part entière',
          title: 'Une place pour chaque profil.',
          paragraphs: [
            'Même s’il se développe rapidement en France, le cheerleading est encore souvent réduit à l’image des « pom-pom girls ». La réalité est bien plus athlétique : une routine exige rigueur, force, souplesse, coordination, endurance et engagement collectif.',
            'La discipline est mixte. Les équipes COED réunissent femmes et hommes, tandis que la catégorie All Girl est exclusivement féminine. Flyers, bases et backspots occupent des rôles différents : taille, force, mobilité et technique peuvent toutes devenir un avantage.',
          ],
          quote:
            'Une routine réussie, c’est une addition de talents différents au service d’un même mouvement.',
          image: image(
            '/images/home-tumbling.webp',
            'Une athlète des Wolves réalise une figure de tumbling',
          ),
          imageSide: 'right',
        },
      }),
      block({
        id: 'cheerleading:disciplines',
        type: 'indexed_card_grid',
        variant: 'disciplines',
        sortOrder: 2,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Dans une routine',
          title: 'Quatre langages, une seule énergie.',
          description:
            'Chaque élément a sa technique. Leur enchaînement raconte la personnalité de l’équipe en quelques minutes.',
          cards: [
            {
              index: '01',
              title: 'Les stunts',
              content:
                'Les portés sont le cœur du cheerleading. Bases et flyers enchaînent montées, changements de jambes, rotations, pyramides et descentes avec une confiance totale.',
            },
            {
              index: '02',
              title: 'Le tumbling',
              content:
                'De la roulade au salto et à la vrille selon les niveaux : la gymnastique au sol demande technique, explosivité, endurance et beaucoup de répétition.',
            },
            {
              index: '03',
              title: 'Sauts & danse',
              content:
                'Les sauts, les motions et les transitions relient les éléments techniques pour composer une routine fluide, rythmée et harmonieuse.',
            },
            {
              index: '04',
              title: 'Le scand',
              content:
                'Ce cri de guerre propre à l’équipe ouvre généralement la routine. Pompons, pancartes et drapeaux accompagnent moins d’une minute d’énergie collective.',
            },
          ],
        },
      }),
      block({
        id: 'cheerleading:progression',
        type: 'split_content',
        variant: 'default',
        sortOrder: 3,
        theme: 'raised',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Apprendre en sécurité',
          title: 'La progression avant la performance.',
          paragraphs: [
            'Chaque élément se construit par étapes : placement, gainage, timing, prises, parade et descente. Les coachs adaptent les exercices au niveau du groupe avant d’ajouter de la difficulté.',
            'Débuter n’est donc pas un frein. L’envie d’apprendre, l’écoute et la régularité sont les premières qualités attendues.',
          ],
          image: image(
            '/images/home-pyramid.webp',
            'Plusieurs groupes de stunt des Wolves en synchronisation',
          ),
          imageSide: 'left',
          actions: [{ label: 'Trouver mon équipe', href: '/rejoindre', variant: 'primary' }],
        },
      }),
    ],
  },
  {
    id: 'page:legal-notice',
    path: '/mentions-legales',
    title: 'Mentions légales',
    seo: {
      title: 'Mentions légales',
      description: 'Mentions légales du site Wolves Toulouse Cheerleading.',
      noindex: true,
    },
    blocks: [
      block({
        id: 'legal-notice:content',
        type: 'rich_text',
        variant: 'legal',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Informations du site',
          title: 'Mentions légales',
          introduction: [
            {
              text: 'Cette page doit être complétée par le responsable du club avant la mise en production, notamment avec la forme juridique, le numéro d’enregistrement, le responsable de publication et l’hébergeur final.',
              style: 'notice',
            },
          ],
          sections: [
            {
              title: 'Éditeur',
              paragraphs: [
                {
                  text: 'Wolves Toulouse Cheerleading\n249 cours Rosalind Franklin\n31400 Toulouse, France',
                  style: 'address',
                },
              ],
            },
            {
              title: 'Responsable de publication',
              paragraphs: [{ text: 'À compléter par le club.' }],
            },
            {
              title: 'Hébergement',
              paragraphs: [
                {
                  text: 'À compléter lorsque l’hébergeur et le domaine définitifs sont choisis.',
                },
              ],
            },
            {
              title: 'Propriété intellectuelle',
              paragraphs: [
                {
                  text: 'Les textes, photographies, marques et éléments graphiques présentés sur ce site restent la propriété de leurs titulaires respectifs. Toute reproduction non autorisée est interdite.',
                },
              ],
            },
            {
              title: 'Crédits photo',
              paragraphs: [
                {
                  text: 'Photographies issues du site officiel existant des Wolves Toulouse. Les crédits individuels sont à préciser par le club.',
                },
              ],
            },
          ],
        },
      }),
    ],
  },
  {
    id: 'page:privacy',
    path: '/politique-de-confidentialite',
    title: 'Politique de confidentialité',
    seo: {
      title: 'Politique de confidentialité',
      description: 'Politique de confidentialité du site Wolves Toulouse Cheerleading.',
      noindex: true,
    },
    blocks: [
      block({
        id: 'privacy:content',
        type: 'rich_text',
        variant: 'legal',
        sortOrder: 0,
        theme: 'default',
        enabled: true,
        schemaVersion: 1,
        data: {
          eyebrow: 'Vie privée',
          title: 'Politique de confidentialité',
          introduction: [
            {
              text: 'Le site public ne dépose aucun traceur publicitaire. Les espaces d’administration et membre traitent uniquement les données nécessaires à leur sécurité, à la gestion des accès et aux inscriptions aux activités du club.',
            },
          ],
          sections: [
            {
              title: 'Formulaires externes',
              paragraphs: [
                {
                  text: 'Les formulaires d’intérêt et de demande d’animation sont hébergés par Google Forms. En les ouvrant, tu quittes ce site et les données transmises sont traitées selon les conditions du service externe et les modalités définies par le club.',
                },
              ],
            },
            {
              title: 'Administration et connexion Discord',
              paragraphs: [
                {
                  text: 'La connexion Discord transmet au site un identifiant numérique Discord, le nom d’utilisateur et le nom affiché. Pour les comptes autorisés à administrer le site, le rôle, l’état du compte, les dates de connexion et les actions éditoriales sont aussi conservés afin de sécuriser les accès et de tracer les publications. Le site ne reçoit jamais le mot de passe Discord.',
                },
                {
                  text: 'Une session technique chiffrée est déposée après la connexion. Elle est strictement nécessaire au fonctionnement des espaces privés et n’est pas utilisée à des fins publicitaires.',
                },
              ],
            },
            {
              title: 'Espace membre, inscriptions et alertes',
              paragraphs: [
                {
                  text: 'L’espace membre associe l’identifiant Discord de la session aux inscriptions enregistrées par BigBadBot. Dans « Mes participations », chaque membre consulte ses propres agrégats d’inscription, ses inscriptions actuellement annulées et, lorsque la date du créneau peut être déterminée, les annulations effectuées moins de vingt-quatre heures avant celui-ci. Ces informations décrivent des inscriptions et non des présences confirmées.',
                },
                {
                  text: 'Pour afficher une annonce d’entraînement ou traiter une demande, BigBadBot vérifie au moment de l’action que le membre appartient toujours au serveur et possède les permissions du salon concerné. Une inscription faite depuis le site et son éventuelle annulation sont enregistrées par BigBadBot afin de tenir compte de la capacité du créneau.',
                },
                {
                  text: 'Lorsqu’un membre active volontairement une alerte sur un créneau complet, BigBadBot conserve cet abonnement jusqu’à sa désactivation, sa notification ou la fin du créneau. Si une place se libère, le bot tente d’envoyer un message privé Discord. Cette alerte ne réserve aucune place et sa réception dépend des réglages Discord du membre.',
                },
                {
                  text: 'Pour le suivi des inscriptions par l’encadrement, les coachs d’équipe, les Head Coaches et les administrateurs autorisés peuvent consulter les statistiques agrégées par équipe et par année civile. Le détail nominatif présente le nom affiché et le pseudonyme Discord des membres, leurs inscriptions par activité, leurs annulations et leurs semaines avec une inscription. Ce détail est accessible uniquement aux coachs de l’équipe concernée, aux Head Coaches et aux administrateurs autorisés. Les accès sont vérifiés côté serveur à partir des rôles Discord et des droits d’administration.',
                },
                {
                  text: 'Les équipes de ces tableaux correspondent aux rôles Discord actuels Pentagone, Polygone, Hexagone, Heptagone, Octogone et Octolady ; le rôle Rentrée n’est pas utilisé. Les statistiques d’une année passée portent sur les inscriptions de cet effectif actuel et ne reconstituent pas les anciennes équipes. L’historique conservé par BigBadBot peut être partiel, notamment pour les anciennes annulations. Une donnée absente ne prouve pas une absence d’activité et une inscription ne confirme pas une présence.',
                },
              ],
            },
            {
              title: 'Créneaux et liste des inscrits',
              paragraphs: [
                {
                  text: 'La page « Créneaux » est réservée aux membres ayant le rôle Wolves et les permissions de lecture du salon d’annonces d’entraînement. Pour un créneau sélectionné dans la dernière annonce publiée, ces membres peuvent voir la liste des inscrits, leur nom affiché et leur pseudonyme Discord, leurs équipes actuelles hors rôles Rentrée et leur statut Flyer lorsqu’il est connu. Cette page présente les inscriptions du créneau sélectionné, et non les statistiques annuelles des membres. Une inscription ne confirme pas une présence. Cette page privée est exclue de la mesure d’audience Matomo.',
                },
              ],
            },
            {
              title: 'Réseaux sociaux',
              paragraphs: [
                {
                  text: 'Les liens vers Instagram, Facebook, YouTube, TikTok et Discord ouvrent des services tiers susceptibles de traiter des données conformément à leurs propres politiques de confidentialité.',
                },
              ],
            },
            {
              title: 'Mesure d’audience',
              paragraphs: [
                {
                  text: 'Matomo est auto-hébergé sur une infrastructure privée administrée par l’éditeur et mesure uniquement l’audience des pages publiques afin d’en améliorer les contenus, l’ergonomie et les performances techniques. Les mesures portent sur les pages consultées, leur titre, le domaine de provenance, des caractéristiques techniques minimisées, les performances de chargement, le temps de visite, des seuils de défilement et les catégories de liens utilisés. Les destinations sont réduites à un chemin public, un type de contact, un format de téléchargement ou un nom de domaine. Les espaces d’administration, d’authentification, d’inscription et de participation sont exclus. Le site ne transmet ni nom, ni adresse e-mail, ni identifiant Discord, ni paramètres de recherche présents dans l’URL.',
                },
                {
                  text: 'La mesure d’audience est configurée dans le mode d’exemption prévu par la CNIL : aucun cookie de mesure, aucun identifiant de compte ou identifiant persistant, aucun suivi entre domaines et aucune attribution marketing ne sont utilisés. Les adresses IP sont masquées avant leur enregistrement. La consultation ou l’export des journaux et profils individuels, les cartes de chaleur, les enregistrements de session et les tests A/B sont désactivés.',
                },
                {
                  text: 'Chaque site suivi possède un identifiant de mesure séparé. Les données des Wolves ne sont ni rapprochées de celles d’autres sites, ni communiquées à des fins publicitaires. Les données détaillées sont supprimées au plus tard après 180 jours et les statistiques agrégées au plus tard après vingt-quatre mois.',
                },
                {
                  text: 'Tu peux t’opposer à cette mesure à tout moment avec le contrôle disponible ci-dessous. Cette opposition est mémorisée pendant 180 jours dans un cookie technique qui ne contient aucun identifiant et sert uniquement à empêcher l’envoi de nouvelles statistiques.',
                },
              ],
            },
            {
              title: 'Contact et droits',
              paragraphs: [
                {
                  text: 'Les coordonnées du responsable de traitement doivent être ajoutées par le club avant la mise en production.',
                },
              ],
            },
          ],
        },
      }),
    ],
  },
] as const

export function seedCmsDatabase(
  database: BetterSqlite3.Database,
  now: () => string = () => new Date().toISOString(),
): CmsSeedResult {
  const existingMarker = database
    .prepare('SELECT 1 FROM settings WHERE key = ?')
    .get(CMS_SEED_MARKER)
  if (existingMarker) {
    return { applied: false, pages: 0, blocks: 0, media: 0 }
  }

  const pageCount = database.prepare('SELECT COUNT(*) AS count FROM pages').get() as {
    count: number
  }
  if (pageCount.count > 0) {
    return { applied: false, pages: 0, blocks: 0, media: 0 }
  }

  const insertMedia = database.prepare(`
    INSERT INTO media (
      id, storage_kind, original_path, original_filename, mime_type,
      byte_size, width, height, checksum, created_by, created_at, updated_at
    ) VALUES (
      @id, 'bundled', @path, @filename, @mimeType,
      NULL, @width, @height, NULL, NULL, @createdAt, @updatedAt
    )
    ON CONFLICT(original_path) DO NOTHING
  `)
  const insertSetting = database.prepare(`
    INSERT INTO settings (key, value_json, updated_by, updated_at)
    VALUES (@key, @valueJson, NULL, @updatedAt)
    ON CONFLICT(key) DO NOTHING
  `)
  const insertPage = database.prepare(`
    INSERT INTO pages (
      id, path, status, draft_revision_id, published_revision_id,
      created_at, updated_at, published_at
    ) VALUES (
      @id, @path, 'published', NULL, NULL,
      @createdAt, @updatedAt, @publishedAt
    )
  `)
  const insertRevision = database.prepare(`
    INSERT INTO revisions (
      id, page_id, revision_number, title, seo_title, seo_description,
      seo_image_id, seo_noindex, change_note, created_by, created_at
    ) VALUES (
      @id, @pageId, 1, @title, @seoTitle, @seoDescription,
      @seoImageId, @seoNoindex, @changeNote, NULL, @createdAt
    )
  `)
  const insertBlock = database.prepare(`
    INSERT INTO blocks (
      revision_id, id, type, variant, sort_order, anchor,
      theme, enabled, schema_version, data_json
    ) VALUES (
      @revisionId, @id, @type, @variant, @sortOrder, @anchor,
      @theme, @enabled, @schemaVersion, @dataJson
    )
  `)
  const publishPage = database.prepare(`
    UPDATE pages
    SET draft_revision_id = ?, published_revision_id = ?
    WHERE id = ?
  `)

  const seed = database.transaction(() => {
    const timestamp = now()

    for (const media of cmsSeedMedia) {
      insertMedia.run({
        ...media,
        filename: media.path.split('/').at(-1) ?? media.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }

    for (const [key, value] of Object.entries(cmsSeedSettings)) {
      insertSetting.run({ key, valueJson: JSON.stringify(value), updatedAt: timestamp })
    }

    let blockCount = 0
    for (const page of cmsSeedPages) {
      const revisionId = `revision:${page.id}:1`
      insertPage.run({
        id: page.id,
        path: page.path,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: timestamp,
      })
      insertRevision.run({
        id: revisionId,
        pageId: page.id,
        title: page.title,
        seoTitle: page.seo.title,
        seoDescription: page.seo.description,
        seoImageId: page.seo.image?.mediaId ?? null,
        seoNoindex: page.seo.noindex ? 1 : 0,
        changeNote: 'Import initial du site vitrine',
        createdAt: timestamp,
      })

      for (const pageBlock of page.blocks) {
        insertBlock.run({
          revisionId,
          id: pageBlock.id,
          type: pageBlock.type,
          variant: pageBlock.variant ?? null,
          sortOrder: pageBlock.sortOrder,
          anchor: pageBlock.anchor ?? null,
          theme: pageBlock.theme ?? 'default',
          enabled: pageBlock.enabled ? 1 : 0,
          schemaVersion: pageBlock.schemaVersion,
          dataJson: JSON.stringify(pageBlock.data),
        })
        blockCount += 1
      }

      publishPage.run(revisionId, revisionId, page.id)
    }

    insertSetting.run({
      key: CMS_SEED_MARKER,
      valueJson: JSON.stringify({ version: CMS_SEED_VERSION, appliedAt: timestamp }),
      updatedAt: timestamp,
    })

    return blockCount
  })

  const blockCount = seed()
  return {
    applied: true,
    pages: cmsSeedPages.length,
    blocks: blockCount,
    media: cmsSeedMedia.length,
  }
}
