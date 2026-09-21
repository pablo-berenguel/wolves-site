<script setup lang="ts">
import type { Component } from 'vue'
import type { CmsBlock, CmsBlockType } from '#shared/cms/types'
import CmsComparisonCardGridBlock from './blocks/CmsComparisonCardGridBlock.vue'
import CmsContactDirectoryBlock from './blocks/CmsContactDirectoryBlock.vue'
import CmsCtaBandBlock from './blocks/CmsCtaBandBlock.vue'
import CmsFaqBlock from './blocks/CmsFaqBlock.vue'
import CmsFeatureCardBlock from './blocks/CmsFeatureCardBlock.vue'
import CmsHeroBlock from './blocks/CmsHeroBlock.vue'
import CmsIndexedCardGridBlock from './blocks/CmsIndexedCardGridBlock.vue'
import CmsLinkCardGridBlock from './blocks/CmsLinkCardGridBlock.vue'
import CmsPalmaresTimelineBlock from './blocks/CmsPalmaresTimelineBlock.vue'
import CmsPhotoRailBlock from './blocks/CmsPhotoRailBlock.vue'
import CmsRichTextBlock from './blocks/CmsRichTextBlock.vue'
import CmsSeasonCardBlock from './blocks/CmsSeasonCardBlock.vue'
import CmsSocialFollowBlock from './blocks/CmsSocialFollowBlock.vue'
import CmsSplitContentBlock from './blocks/CmsSplitContentBlock.vue'
import CmsStaffDirectoryBlock from './blocks/CmsStaffDirectoryBlock.vue'
import CmsTeamGridBlock from './blocks/CmsTeamGridBlock.vue'
import CmsValueTickerBlock from './blocks/CmsValueTickerBlock.vue'

defineProps<{
  block: CmsBlock
}>()

const renderers: Record<CmsBlockType, Component> = {
  hero: CmsHeroBlock,
  value_ticker: CmsValueTickerBlock,
  split_content: CmsSplitContentBlock,
  team_grid: CmsTeamGridBlock,
  photo_rail: CmsPhotoRailBlock,
  feature_card: CmsFeatureCardBlock,
  link_card_grid: CmsLinkCardGridBlock,
  social_follow: CmsSocialFollowBlock,
  cta_band: CmsCtaBandBlock,
  indexed_card_grid: CmsIndexedCardGridBlock,
  season_card: CmsSeasonCardBlock,
  comparison_card_grid: CmsComparisonCardGridBlock,
  faq: CmsFaqBlock,
  palmares_timeline: CmsPalmaresTimelineBlock,
  staff_directory: CmsStaffDirectoryBlock,
  contact_directory: CmsContactDirectoryBlock,
  rich_text: CmsRichTextBlock,
}
</script>

<template>
  <component :is="renderers[block.type]" :block="block" />
</template>
