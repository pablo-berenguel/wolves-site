<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'rich_text'>
}>()

const isLegalPage = computed(() => props.block.variant === 'legal')
const sectionClass = computed(() =>
  isLegalPage.value ? 'legal-page' : cmsSectionClasses(props.block.theme),
)
</script>

<template>
  <component
    :is="isLegalPage ? 'article' : 'section'"
    :id="block.anchor"
    :class="sectionClass"
    :aria-labelledby="isLegalPage ? undefined : `${block.id}-title`"
  >
    <div :class="isLegalPage ? undefined : 'container'">
      <template v-if="isLegalPage">
        <p v-if="block.data.eyebrow" class="eyebrow">{{ block.data.eyebrow }}</p>
        <h1>{{ block.data.title }}</h1>
      </template>
      <CmsSectionHeading v-else :heading="block.data" :heading-id="`${block.id}-title`" />
      <div class="prose" :class="{ 'prose--section': !isLegalPage }">
        <p
          v-for="(paragraph, index) in block.data.introduction"
          :key="`intro-${index}`"
          :class="paragraph.style === 'notice' ? 'notice' : undefined"
        >
          {{ paragraph.text }}
        </p>

        <section v-for="(section, sectionIndex) in block.data.sections" :key="sectionIndex">
          <component :is="isLegalPage ? 'h2' : 'h3'" v-if="section.title">
            {{ section.title }}
          </component>
          <template v-for="(paragraph, paragraphIndex) in section.paragraphs" :key="paragraphIndex">
            <address v-if="paragraph.style === 'address'">
              <template
                v-for="(line, lineIndex) in paragraph.text.split('\n')"
                :key="`${line}-${lineIndex}`"
              >
                {{ line }}<br v-if="lineIndex < paragraph.text.split('\n').length - 1" />
              </template>
            </address>
            <p v-else :class="paragraph.style === 'notice' ? 'notice' : undefined">
              {{ paragraph.text }}
            </p>
          </template>
          <ol v-if="section.list?.ordered">
            <li v-for="item in section.list.items" :key="item">{{ item }}</li>
          </ol>
          <ul v-else-if="section.list">
            <li v-for="item in section.list.items" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>
    </div>
  </component>
</template>
