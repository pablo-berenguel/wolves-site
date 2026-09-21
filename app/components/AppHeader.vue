<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const { data: globals } = await useCmsGlobals()
const site = computed(() => globals.value?.site)
const navigation = computed(() => globals.value?.navigation || [])

const route = useRoute()
const isOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const mobileNavigation = ref<HTMLElement | null>(null)
let desktopMedia: MediaQueryList | undefined

function closeMenu(restoreFocus = false) {
  isOpen.value = false
  if (restoreFocus) {
    nextTick(() => menuButton.value?.focus())
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
    return
  }

  if (event.key !== 'Tab' || !mobileNavigation.value) return

  const focusable = Array.from(
    mobileNavigation.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
  )

  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

function handleDesktopChange(event: MediaQueryListEvent) {
  if (event.matches) {
    closeMenu()
  }
}

watch(isOpen, async (open) => {
  if (!import.meta.client) return
  document.body.classList.toggle('menu-open', open)
  if (open) {
    await nextTick()
    mobileNavigation.value?.querySelector<HTMLElement>('a[href]')?.focus()
  }
})

watch(
  () => route.fullPath,
  () => closeMenu(),
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  desktopMedia = window.matchMedia('(min-width: 68rem)')
  desktopMedia.addEventListener('change', handleDesktopChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  desktopMedia?.removeEventListener('change', handleDesktopChange)
  document.body.classList.remove('menu-open')
})
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <NuxtLink class="brand" to="/" :aria-label="`${site?.name || 'Wolves Toulouse'} — Accueil`">
        <img
          class="brand__logo"
          :src="site?.logo || '/images/logo-wolves.webp'"
          alt=""
          width="76"
          height="76"
        />
      </NuxtLink>

      <nav class="desktop-nav" aria-label="Navigation principale">
        <ul class="nav-list">
          <li v-for="item in navigation" :key="item.to">
            <NuxtLink
              class="nav-link"
              :class="{ 'nav-link--cta': item.to === '/rejoindre' }"
              :to="item.to"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink class="nav-link nav-link--member" to="/mes-participations">
              Mes participations
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <button
        ref="menuButton"
        class="menu-toggle"
        type="button"
        :aria-expanded="isOpen"
        aria-controls="navigation-mobile"
        :aria-label="isOpen ? 'Fermer le menu' : 'Ouvrir le menu'"
        @click="isOpen = !isOpen"
      >
        <span class="menu-toggle__lines" aria-hidden="true" />
      </button>
    </div>

    <Teleport to="body">
      <Transition name="menu">
        <nav
          v-if="isOpen"
          id="navigation-mobile"
          ref="mobileNavigation"
          class="mobile-nav"
          aria-label="Navigation mobile"
        >
          <ul class="nav-list">
            <template v-for="item in navigation" :key="item.to">
              <li>
                <NuxtLink
                  class="nav-link"
                  :class="{ 'nav-link--cta': item.to === '/rejoindre' }"
                  :to="item.to"
                >
                  {{ item.label }}
                </NuxtLink>
              </li>
              <li
                v-for="child in item.children || []"
                :key="child.to"
                class="mobile-nav__secondary"
              >
                <NuxtLink class="nav-link" :to="child.to">
                  {{ child.label }}
                </NuxtLink>
              </li>
            </template>
            <li class="mobile-nav__member">
              <NuxtLink class="nav-link nav-link--member" to="/mes-participations">
                Mes participations
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </Transition>
    </Teleport>
  </header>
</template>
