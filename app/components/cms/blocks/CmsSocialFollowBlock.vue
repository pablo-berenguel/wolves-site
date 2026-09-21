<script setup lang="ts">
import { siFacebook, siInstagram, siTiktok, siYoutube, type SimpleIcon } from 'simple-icons'
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'social_follow'>
}>()

const sectionClass = computed(() => [...cmsSectionClasses(props.block.theme), 'social-section'])

const icons: Record<string, SimpleIcon> = {
  Instagram: siInstagram,
  Facebook: siFacebook,
  YouTube: siYoutube,
  TikTok: siTiktok,
}
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container social-section__grid">
      <div>
        <p v-if="block.data.eyebrow" class="eyebrow">{{ block.data.eyebrow }}</p>
        <h2>{{ block.data.title }}</h2>
        <p v-if="block.data.description">{{ block.data.description }}</p>
      </div>
      <nav aria-label="Réseaux sociaux des Wolves">
        <ul class="social-links" :class="{ 'social-links--compact': block.data.compact }">
          <li v-for="link in block.data.links" :key="link.url">
            <a
              class="social-link"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`${link.label} — nouvel onglet`"
            >
              <span class="social-link__mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path :d="icons[link.platform]?.path" />
                </svg>
              </span>
              <span>{{ link.platform }}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </section>
</template>
