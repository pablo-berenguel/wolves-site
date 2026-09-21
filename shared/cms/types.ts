export const cmsBlockTypes = [
  'hero',
  'value_ticker',
  'split_content',
  'team_grid',
  'photo_rail',
  'feature_card',
  'link_card_grid',
  'social_follow',
  'cta_band',
  'indexed_card_grid',
  'season_card',
  'comparison_card_grid',
  'faq',
  'palmares_timeline',
  'staff_directory',
  'contact_directory',
  'rich_text',
] as const

export type CmsBlockType = (typeof cmsBlockTypes)[number]
export type CmsBlockTheme = 'default' | 'light' | 'raised'
export type CmsActionVariant = 'primary' | 'ghost' | 'light'

export interface CmsAction {
  label: string
  href: string
  variant?: CmsActionVariant
  newWindow?: boolean
  arrow?: 'none' | 'right' | 'external'
}

export interface CmsImage {
  mediaId?: string
  src: string
  alt: string
  width?: number
  height?: number
  focalX?: number
  focalY?: number
  decorative?: boolean
}

export interface CmsSectionHeading {
  eyebrow?: string
  title: string
  description?: string
}

export interface CmsHeroBlockData {
  eyebrow?: string
  title: string
  titleLines?: Array<{
    text: string
    style?: 'solid' | 'outline'
  }>
  description?: string
  image?: CmsImage
  video?: {
    src: string
    mimeType?: string
    poster?: CmsImage
  }
  aside?: string
  size?: 'compact' | 'default' | 'large'
  actions?: CmsAction[]
}

export interface CmsValueTickerBlockData {
  label?: string
  values: Array<{ title: string }>
}

export interface CmsSplitContentBlockData extends CmsSectionHeading {
  paragraphs: string[]
  image?: CmsImage
  imageSide?: 'left' | 'right'
  badge?: string
  quote?: string
  listLabel?: string
  listItems?: string[]
  stats?: Array<{ value: string; label: string }>
  actions?: CmsAction[]
}

export interface CmsTeamGridBlockData extends CmsSectionHeading {
  teams: Array<{
    slug: string
    name: string
    division: string
    level: string
    program: string
    description: string
    image: CmsImage
    accent?: string
  }>
  actions?: CmsAction[]
}

export interface CmsPhotoRailBlockData extends CmsSectionHeading {
  label?: string
  photos: Array<{ image: CmsImage; caption?: string }>
}

export interface CmsFeatureCardBlockData extends CmsSectionHeading {
  heading?: CmsSectionHeading
  image?: CmsImage
  paragraphs: string[]
  actions?: CmsAction[]
}

export interface CmsLinkCardGridBlockData extends CmsSectionHeading {
  cards: Array<{
    index?: string
    title: string
    content: string
    linkLabel: string
    href: string
    image?: CmsImage
    variant?: 'practice' | 'events' | 'default'
  }>
}

export interface CmsSocialFollowBlockData extends CmsSectionHeading {
  links: Array<{
    platform: 'Instagram' | 'Facebook' | 'YouTube' | 'TikTok'
    label: string
    url: string
  }>
  compact?: boolean
}

export interface CmsCtaBandBlockData {
  title: string
  content?: string
  action?: CmsAction
}

export interface CmsIndexedCardGridBlockData extends CmsSectionHeading {
  cards: Array<{
    index?: string
    title: string
    content: string
  }>
}

export interface CmsSeasonCardBlockData {
  season: string
  title: string
  content: string
  note?: string
  actions?: CmsAction[]
}

export interface CmsComparisonCardGridBlockData extends CmsSectionHeading {
  cards: Array<{
    tag?: string
    title: string
    content: string
    items?: string[]
  }>
}

export interface CmsFaqBlockData extends CmsSectionHeading {
  items: Array<{
    question: string
    answer: string
    category?: 'Cheerleading' | 'Club' | 'Inscription' | 'Animations'
  }>
  openFirst?: boolean
}

export interface CmsPalmaresTimelineBlockData extends CmsSectionHeading {
  seasons: Array<{
    season: string
    highlights: Array<{
      competition: string
      date?: string
      results: string[]
    }>
  }>
  action?: CmsAction
}

export interface CmsStaffDirectoryBlockData extends CmsSectionHeading {
  season?: string
  groups: Array<{
    title: string
    members: Array<{
      role: string
      name: string
      support?: string
    }>
  }>
}

export interface CmsContactDirectoryBlockData {
  contact: {
    eyebrow?: string
    title: string
    content?: string
    channels: Array<{
      title: string
      description: string
      href: string
    }>
  }
  address: {
    eyebrow?: string
    title: string
    lines: string[]
    image?: CmsImage
    action?: CmsAction
  }
}

export interface CmsRichTextBlockData {
  eyebrow?: string
  title: string
  introduction?: Array<{
    text: string
    style?: 'default' | 'notice'
  }>
  sections: Array<{
    title?: string
    paragraphs?: Array<{
      text: string
      style?: 'default' | 'notice' | 'address'
    }>
    list?: {
      ordered?: boolean
      items: string[]
    }
  }>
}

export interface CmsBlockDataByType {
  hero: CmsHeroBlockData
  value_ticker: CmsValueTickerBlockData
  split_content: CmsSplitContentBlockData
  team_grid: CmsTeamGridBlockData
  photo_rail: CmsPhotoRailBlockData
  feature_card: CmsFeatureCardBlockData
  link_card_grid: CmsLinkCardGridBlockData
  social_follow: CmsSocialFollowBlockData
  cta_band: CmsCtaBandBlockData
  indexed_card_grid: CmsIndexedCardGridBlockData
  season_card: CmsSeasonCardBlockData
  comparison_card_grid: CmsComparisonCardGridBlockData
  faq: CmsFaqBlockData
  palmares_timeline: CmsPalmaresTimelineBlockData
  staff_directory: CmsStaffDirectoryBlockData
  contact_directory: CmsContactDirectoryBlockData
  rich_text: CmsRichTextBlockData
}

export interface CmsBlockBase<TType extends CmsBlockType> {
  id: string
  type: TType
  variant?: string
  sortOrder: number
  anchor?: string
  theme?: CmsBlockTheme
  enabled: boolean
  schemaVersion: 1
}

export type CmsBlock = {
  [TType in CmsBlockType]: CmsBlockBase<TType> & {
    data: CmsBlockDataByType[TType]
  }
}[CmsBlockType]

export type CmsBlockOfType<TType extends CmsBlockType> = Extract<CmsBlock, { type: TType }>

export interface CmsPageSeo {
  title: string
  description: string
  image?: CmsImage
  noindex?: boolean
}

export interface CmsPage {
  id: string
  path: string
  title: string
  status: 'draft' | 'published'
  seo: CmsPageSeo
  blocks: CmsBlock[]
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
}

export type CmsScalarFieldKind =
  'text' | 'textarea' | 'url' | 'image' | 'boolean' | 'select' | 'number'

export type CmsImageFieldPreset = 'master' | 'hero' | 'card' | 'square' | 'thumbnail'
export type CmsImagePreset = CmsImageFieldPreset

interface CmsFieldSchemaBase {
  label: string
  description?: string
  required?: boolean
}

export interface CmsScalarFieldSchema extends CmsFieldSchemaBase {
  kind: CmsScalarFieldKind
  imagePreset?: CmsImageFieldPreset
  imageAltRequired?: boolean
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
  maxLength?: number
}

export interface CmsObjectFieldSchema extends CmsFieldSchemaBase {
  kind: 'object'
  fields: Record<string, CmsFieldSchema>
}

export interface CmsListFieldSchema extends CmsFieldSchemaBase {
  kind: 'list'
  item: CmsFieldSchema
  minItems?: number
  maxItems?: number
}

export type CmsFieldSchema = CmsScalarFieldSchema | CmsObjectFieldSchema | CmsListFieldSchema

export interface CmsBlockDefinition<TType extends CmsBlockType = CmsBlockType> {
  type: TType
  label: string
  description: string
  variants: readonly string[]
  fields: Record<string, CmsFieldSchema>
  defaultData: CmsBlockDataByType[TType]
}
