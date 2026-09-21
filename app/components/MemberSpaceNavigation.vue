<template>
  <nav class="member-space-navigation" aria-label="Espace membre">
    <NuxtLink to="/inscriptions">
      <span class="member-space-navigation__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" focusable="false">
          <rect x="3.5" y="5" width="17" height="16" rx="3" />
          <path d="M7.5 3v4M16.5 3v4M3.5 10h17M8.5 15.5l2.5 2.5 4.5-5" />
        </svg>
      </span>
      <span class="member-space-navigation__desktop-label">Mes inscriptions</span>
      <span class="member-space-navigation__mobile-label">Inscriptions</span>
    </NuxtLink>
    <NuxtLink to="/creneaux">
      <span class="member-space-navigation__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" focusable="false">
          <circle cx="9" cy="7.5" r="3.5" />
          <path
            d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20M16 4.2a3.5 3.5 0 0 1 0 6.6M18 13a5.5 5.5 0 0 1 3.5 5.1V20"
          />
        </svg>
      </span>
      <span class="member-space-navigation__desktop-label">Créneaux et participants</span>
      <span class="member-space-navigation__mobile-label">Qui vient ?</span>
    </NuxtLink>
    <NuxtLink to="/mes-participations">
      <span class="member-space-navigation__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" focusable="false">
          <path d="M4 3.5v17h17M8.5 15.5v-4M13.5 15.5v-8M18.5 15.5v-11" />
        </svg>
      </span>
      <span class="member-space-navigation__desktop-label">Mes participations</span>
      <span class="member-space-navigation__mobile-label">Mon suivi</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.member-space-navigation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.member-space-navigation a {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  color: var(--paper);
  background: rgb(255 255 255 / 3%);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.member-space-navigation a:hover,
.member-space-navigation a:focus-visible {
  border-color: var(--orange);
}

.member-space-navigation a:focus-visible {
  outline: 0.15rem solid var(--orange);
  outline-offset: 0.15rem;
}

.member-space-navigation a.router-link-exact-active {
  border-color: var(--orange);
  color: var(--orange);
  background: rgb(255 132 39 / 8%);
}

.member-space-navigation__icon {
  display: grid;
  flex: none;
  place-items: center;
}

.member-space-navigation__icon svg {
  width: 1.2rem;
  height: 1.2rem;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.member-space-navigation__mobile-label {
  display: none;
}

@media (max-width: 700px) {
  .member-space-navigation {
    position: fixed;
    z-index: 80;
    inset: auto 0 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.4rem max(0.5rem, env(safe-area-inset-right))
      calc(0.4rem + env(safe-area-inset-bottom, 0px)) max(0.5rem, env(safe-area-inset-left));
    border-top: 0.06rem solid var(--line);
    background: rgb(11 18 56 / 96%);
    box-shadow: 0 -0.5rem 2rem rgb(0 0 0 / 16%);
    backdrop-filter: blur(1rem);
  }

  .member-space-navigation a {
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    min-height: 3.8rem;
    padding: 0.3rem 0.15rem;
    border-color: transparent;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--silver);
    font-size: 0.7rem;
    line-height: 1.3;
    text-align: center;
  }

  .member-space-navigation a::before {
    position: absolute;
    top: -0.43rem;
    width: 1.5rem;
    height: 0.18rem;
    border-radius: 999px;
    background: transparent;
    content: '';
  }

  .member-space-navigation a:hover,
  .member-space-navigation a:focus-visible {
    border-color: transparent;
    background: rgb(255 255 255 / 5%);
    color: var(--paper);
  }

  .member-space-navigation a.router-link-exact-active {
    border-color: transparent;
    background: transparent;
    color: var(--orange);
  }

  .member-space-navigation a.router-link-exact-active::before {
    background: var(--orange);
  }

  .member-space-navigation__icon {
    width: 3.25rem;
    height: 1.9rem;
    border-radius: 999px;
    transition: background-color 160ms ease;
  }

  .member-space-navigation a.router-link-exact-active .member-space-navigation__icon {
    background: var(--navy);
  }

  .member-space-navigation__icon svg {
    width: 1.45rem;
    height: 1.45rem;
  }

  .member-space-navigation__desktop-label {
    display: none;
  }

  .member-space-navigation__mobile-label {
    display: inline;
  }
}

@layer components {
  @media (max-width: 700px) {
    :global(.site-shell:has(.member-space-navigation)) {
      padding-bottom: calc(5.75rem + env(safe-area-inset-bottom, 0px));
    }

    :global(html:has(.member-space-navigation)) {
      scroll-padding-bottom: calc(5.75rem + env(safe-area-inset-bottom, 0px));
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-space-navigation a,
  .member-space-navigation__icon {
    transition: none;
  }
}
</style>
