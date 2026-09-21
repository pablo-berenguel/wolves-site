<script setup lang="ts">
const currentYear = new Date().getFullYear()
const { data: globals } = await useCmsGlobals()
const site = computed(() => globals.value?.site)
const footerLinks = computed(() => globals.value?.footerLinks || [])
</script>

<template>
  <footer class="site-footer">
    <div class="site-footer__main">
      <div class="site-footer__brand">
        <NuxtLink class="brand" to="/" :aria-label="`${site?.name || 'Wolves Toulouse'} — Accueil`">
          <img
            class="brand__logo"
            :src="site?.logo || '/images/logo-wolves.webp'"
            alt=""
            width="88"
            height="88"
            loading="lazy"
          />
        </NuxtLink>
        <p>{{ site?.footerDescription }}</p>
      </div>

      <nav aria-label="Liens utiles">
        <p class="site-footer__title">Explorer</p>
        <ul class="site-footer__links">
          <li v-for="item in footerLinks" :key="item.to">
            <NuxtLink :to="item.to">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <p class="site-footer__title">La tanière</p>
        <address>
          {{ site?.name }}<br />
          {{ site?.address.street }}<br />
          {{ site?.address.postalCode }} {{ site?.address.city }}
        </address>
        <div class="mt-lg">
          <SocialLinks compact />
        </div>
      </div>
    </div>

    <div class="site-footer__bottom">
      <p>© {{ currentYear }} {{ site?.name }}</p>
      <a
        class="site-footer__credit"
        href="https://berenguel.fr"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="By Pablo BERENGUEL — nouvel onglet"
      >
        <img src="/images/logo-pablo-berenguel.svg" alt="" width="40" height="40" loading="lazy" />
        <span>By <span class="site-footer__credit-name">Pablo BERENGUEL</span></span>
        <svg
          class="site-footer__credit-arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.25"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 20 20 4M12 4h8v8" />
        </svg>
      </a>
      <nav aria-label="Informations légales et confidentialité">
        <ul class="site-footer__legal-links">
          <li><NuxtLink to="/politique-de-confidentialite">Confidentialité</NuxtLink></li>
          <li><NuxtLink to="/mentions-legales">Mentions légales</NuxtLink></li>
          <li>
            <NuxtLink to="/politique-de-confidentialite#mesure-audience">
              Mesure d’audience
            </NuxtLink>
          </li>
          <li><NuxtLink to="/admin">Administration</NuxtLink></li>
        </ul>
      </nav>
    </div>
  </footer>
</template>
