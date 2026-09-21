<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsBackgroundStyle, cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'contact_directory'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container contact-grid">
      <article class="contact-panel">
        <p v-if="block.data.contact.eyebrow" class="eyebrow">
          {{ block.data.contact.eyebrow }}
        </p>
        <h2>{{ block.data.contact.title }}</h2>
        <p v-if="block.data.contact.content">{{ block.data.contact.content }}</p>
        <div class="contact-actions">
          <a
            v-for="channel in block.data.contact.channels"
            :key="channel.href"
            class="contact-action"
            :href="channel.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <strong>{{ channel.title }}</strong>
              <span>{{ channel.description }}</span>
            </span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </article>

      <article
        class="contact-address"
        :style="
          cmsBackgroundStyle(
            block.data.address.image,
            'linear-gradient(0deg, rgb(11 18 56 / 92%), rgb(11 18 56 / 18%))',
          )
        "
      >
        <p v-if="block.data.address.eyebrow" class="eyebrow">
          {{ block.data.address.eyebrow }}
        </p>
        <h2>{{ block.data.address.title }}</h2>
        <address>
          <template v-for="(line, index) in block.data.address.lines" :key="`${line}-${index}`">
            {{ line }}<br v-if="index < block.data.address.lines.length - 1" />
          </template>
        </address>
        <div v-if="block.data.address.action" class="button-group mt-lg">
          <CmsActionLink :action="block.data.address.action" />
        </div>
      </article>
    </div>
  </section>
</template>
