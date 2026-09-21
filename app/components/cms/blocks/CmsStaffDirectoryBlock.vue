<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'staff_directory'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading
        :heading="{
          eyebrow: block.data.eyebrow || block.data.season,
          title: block.data.title,
          description: block.data.description,
        }"
      />
      <section
        v-for="(group, groupIndex) in block.data.groups"
        :key="group.title"
        class="staff-group"
        :aria-labelledby="`${block.id}-staff-${groupIndex}`"
      >
        <h3 :id="`${block.id}-staff-${groupIndex}`">{{ group.title }}</h3>
        <div class="staff-grid">
          <article
            v-for="member in group.members"
            :key="`${member.role}-${member.name}`"
            class="staff-card"
          >
            <p class="staff-card__role">{{ member.role }}</p>
            <p class="staff-card__name">{{ member.name }}</p>
            <p v-if="member.support" class="staff-card__support">
              <strong>Support :</strong> {{ member.support }}
            </p>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
