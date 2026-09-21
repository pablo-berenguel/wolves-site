<script setup lang="ts">
import {
  MATOMO_OPT_OUT_MAX_AGE_DAYS,
  MATOMO_PREFERENCE_EVENT,
  isMatomoOptedOut,
  normalizeMatomoSiteId,
  normalizeMatomoUrl,
  setMatomoOptOut,
  type MatomoPreferenceDetail,
} from '~/utils/matomo'

const runtimeConfig = useRuntimeConfig()
const isEnabled = Boolean(
  normalizeMatomoUrl(runtimeConfig.public.matomoUrl) &&
  normalizeMatomoSiteId(runtimeConfig.public.matomoSiteId),
)
const optedOut = ref(false)
const isReady = ref(false)
const persistenceError = ref(false)

onMounted(() => {
  optedOut.value = isMatomoOptedOut()
  isReady.value = true
})

function updatePreference(nextOptedOut: boolean) {
  const persisted = setMatomoOptOut(nextOptedOut)
  persistenceError.value = !persisted
  optedOut.value = nextOptedOut
  window.dispatchEvent(
    new CustomEvent<MatomoPreferenceDetail>(MATOMO_PREFERENCE_EVENT, {
      detail: { optedOut: nextOptedOut, persisted },
    }),
  )
}
</script>

<template>
  <section id="mesure-audience" class="analytics-opt-out" aria-labelledby="mesure-audience-title">
    <p class="eyebrow">Ton choix</p>
    <h2 id="mesure-audience-title">Préférence de mesure d’audience</h2>
    <p>
      {{
        isEnabled
          ? 'Matomo nous fournit des statistiques anonymes pour améliorer les pages publiques. Aucun cookie de mesure n’est utilisé.'
          : 'La mesure d’audience est actuellement inactive sur ce site.'
      }}
    </p>
    <p v-if="isEnabled && isReady" class="analytics-opt-out__status" aria-live="polite">
      {{
        optedOut
          ? 'La mesure d’audience est actuellement désactivée sur ce navigateur.'
          : 'La mesure d’audience est actuellement active sur ce navigateur.'
      }}
    </p>
    <p v-if="persistenceError" class="notice" role="alert">
      Ton navigateur empêche de mémoriser ce choix. Il reste appliqué jusqu’au prochain rechargement
      de la page.
    </p>
    <button
      v-if="isEnabled && isReady"
      type="button"
      class="button button--secondary"
      @click="updatePreference(!optedOut)"
    >
      {{ optedOut ? 'Autoriser la mesure d’audience' : 'Désactiver la mesure d’audience' }}
    </button>
    <p v-if="isEnabled" class="analytics-opt-out__note">
      Une désactivation est mémorisée pendant {{ MATOMO_OPT_OUT_MAX_AGE_DAYS }} jours dans un cookie
      technique sans identifiant.
    </p>
  </section>
</template>
