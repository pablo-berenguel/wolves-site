<script setup lang="ts">
import { siFacebook, siInstagram, siTiktok, siYoutube, type SimpleIcon } from 'simple-icons'
import type { SocialPlatform } from '~/data/site'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const { data: globals } = await useCmsGlobals()
const socials = computed(() => globals.value?.socials || [])

const icons: Record<SocialPlatform, SimpleIcon> = {
  Instagram: siInstagram,
  Facebook: siFacebook,
  YouTube: siYoutube,
  TikTok: siTiktok,
}
</script>

<template>
  <nav aria-label="Réseaux sociaux des Wolves">
    <ul class="social-links" :class="{ 'social-links--compact': compact }">
      <li v-for="social in socials" :key="social.url">
        <a
          class="social-link"
          :href="social.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${social.label} — nouvel onglet`"
        >
          <span class="social-link__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path :d="icons[social.platform].path" />
            </svg>
          </span>
          <span>{{ social.platform }}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </li>
    </ul>
  </nav>
</template>
