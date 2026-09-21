<script setup lang="ts">
import type { Team } from '~/data/site'
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'team_grid'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
const safeAccent = (accent: string | undefined) =>
  accent && /^#[\da-f]{3,8}$/i.test(accent) ? accent : '#2a3890'
const teams = computed<Team[]>(() =>
  props.block.data.teams.map((team) => ({
    slug: team.slug,
    name: team.name,
    division: team.division,
    level: team.level,
    program: team.program,
    description: team.description,
    image: team.image.src,
    imageAlt: team.image.decorative ? '' : team.image.alt,
    imageWidth: team.image.width,
    imageHeight: team.image.height,
    imagePosition: `${team.image.focalX ?? 50}% ${team.image.focalY ?? 50}%`,
    accent: safeAccent(team.accent),
  })),
)
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <div class="teams-grid">
        <TeamCard v-for="team in teams" :key="team.slug" :team="team" />
      </div>
      <div v-if="block.data.actions?.length" class="button-group mt-lg">
        <CmsActionLink v-for="action in block.data.actions" :key="action.href" :action="action" />
      </div>
    </div>
  </section>
</template>
