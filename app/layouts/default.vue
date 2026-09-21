<template>
  <div class="site-shell">
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <AppHeader />
    <main id="contenu">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
