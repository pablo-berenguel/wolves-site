<script setup lang="ts">
const route = useRoute()

const redirectTarget = computed(() => {
  const value = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect

  return value === '/mes-participations' || value === '/admin/statistiques' || value === '/creneaux'
    ? value
    : null
})
const discordLoginUrl = computed(() =>
  redirectTarget.value
    ? `/auth/discord?returnTo=${encodeURIComponent(redirectTarget.value)}`
    : '/auth/discord',
)

const errorMessage = computed(() => {
  const error = Array.isArray(route.query.error) ? route.query.error[0] : route.query.error

  if (error === 'access_denied') {
    if (redirectTarget.value === '/creneaux') {
      return 'La liste des participants est réservée aux membres ayant le rôle Wolves sur Discord. Un historique d’inscription ou un autre rôle ne suffit pas pour accéder à cette page.'
    }
    if (redirectTarget.value === '/admin/statistiques') {
      return 'Les statistiques sont réservées aux coachs, aux Head Coaches et aux administrateurs. Les accès sont vérifiés à partir de tes rôles Discord et des droits d’administration.'
    }
    return 'Ce compte Discord ne permet pas d’accéder à cet espace. Pour consulter tes participations, il doit avoir accès au salon Wolves ou être associé à un historique BigBadBot.'
  }

  if (error === 'oauth') {
    return 'La connexion Discord a échoué. Réessaie dans quelques instants.'
  }

  if (error === 'stats_unavailable') {
    return 'BigBadBot ne peut pas confirmer tes accès pour le moment. Réessaie dans quelques instants.'
  }

  return ''
})

usePageSeo({
  title: 'Connexion Discord',
  description:
    "Connexion sécurisée aux espaces personnels et d'administration des Wolves Toulouse.",
  path: '/admin/login',
  noindex: true,
})
</script>

<template>
  <section class="admin-login" aria-labelledby="admin-login-title">
    <div class="admin-login__card">
      <p class="eyebrow">Connexion Discord</p>
      <h1 id="admin-login-title">Accéder à ton espace Wolves</h1>
      <p class="admin-login__intro">
        Connecte-toi avec ton compte Discord. Le site ouvre ensuite les participations ou les outils
        de gestion correspondant à tes accès. Aucun mot de passe supplémentaire n’est conservé.
      </p>

      <p v-if="errorMessage" class="admin-login__error" role="alert">
        {{ errorMessage }}
      </p>

      <NuxtLink class="button button--primary admin-login__button" :to="discordLoginUrl" external>
        Continuer avec Discord
        <span class="button__arrow" aria-hidden="true">→</span>
      </NuxtLink>

      <p class="admin-login__notice">
        Les droits Wolves, CMS, coach d’équipe et Head Coach sont vérifiés automatiquement après la
        connexion.
      </p>
    </div>
  </section>
</template>

<style scoped>
.admin-login {
  display: grid;
  min-height: min(46rem, 78dvh);
  place-items: center;
  padding: clamp(3rem, 9vw, 7rem) 1rem;
}

.admin-login__card {
  width: min(100%, 35rem);
  padding: clamp(1.5rem, 5vw, 3rem);
  border: 0.08rem solid rgb(255 255 255 / 16%);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgb(42 56 144 / 26%), transparent 52%), var(--ink-soft);
  box-shadow: var(--shadow);
}

.admin-login h1 {
  max-width: 12ch;
  margin-top: 0.9rem;
  font-family: var(--display);
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  letter-spacing: 0.01em;
  line-height: 0.92;
  text-transform: uppercase;
}

.admin-login__intro {
  max-width: 31rem;
  margin-top: 1.25rem;
  color: var(--muted);
}

.admin-login__error {
  margin-top: 1.25rem;
  padding: 0.85rem 1rem;
  border-left: 0.25rem solid var(--orange);
  border-radius: var(--radius-sm);
  background: rgb(255 132 39 / 12%);
}

.admin-login__button {
  width: 100%;
  margin-top: 1.75rem;
}

.admin-login__notice {
  margin-top: 1rem;
  color: var(--muted);
  font-size: 0.82rem;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .admin-login__button {
    transition: none;
  }
}
</style>
