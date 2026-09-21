import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { compileScript, parse } from 'vue/compiler-sfc'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

const require = createRequire(import.meta.url)
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Compile the real SFCs without adding a browser test framework. The only
// injected imports are the Vue helpers normally auto-imported by Nuxt.
function component(path: string): Component {
  const { descriptor } = parse(source(path), { filename: path })
  const script = compileScript(descriptor, { id: path, inlineTemplate: true })
  const compiled = transpileModule(script.content, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} as { default: Component } }
  new Function('require', 'exports', 'ref', 'onMounted', 'onBeforeUnmount', compiled)(
    require,
    module.exports,
    ref,
    onMounted,
    onBeforeUnmount,
  )
  return module.exports.default
}

describe('états de chargement accessibles', () => {
  const status = component('app/components/AppLoadingStatus.vue')
  const skeleton = component('app/components/AppLoadingState.vue')

  it.each(['cards', 'list', 'detail'] as const)(
    'rend un squelette %s stable dès SSR',
    async (variant) => {
      const app = createSSRApp({
        render: () =>
          h(skeleton, {
            label: 'Chargement des équipes…',
            description: 'Vérification des accès.',
            variant,
            count: 4,
          }),
      })
      app.component('AppLoadingStatus', status)
      const html = await renderToString(app)
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('Chargement des équipes…')
      expect(html.match(/class="loading-state__card"/g)).toHaveLength(4)
      expect(html).not.toContain('Cela prend un peu plus de temps')
      expect(html).not.toContain('<button')
      if (variant === 'detail') expect(html).toContain('loading-state__chart')
    },
  )

  it('réduit les animations et nettoie le minuteur de patience', () => {
    const statusSource = source('app/components/AppLoadingStatus.vue')
    expect(statusSource).toContain('onBeforeUnmount(() => clearTimeout(patienceTimer))')
    for (const path of ['AppLoadingStatus.vue', 'AppLoadingState.vue']) {
      expect(source(`app/components/${path}`)).toContain('prefers-reduced-motion: reduce')
      expect(source(`app/components/${path}`)).toContain('animation: none')
    }
  })

  it('ne retient pas les annonces de chargement sous un parent aria-busy', () => {
    for (const path of [
      'app/pages/creneaux.vue',
      'app/pages/inscriptions.vue',
      'app/pages/mes-participations.vue',
      'app/components/admin/TeamStatisticsFrame.vue',
    ]) {
      expect(source(path)).not.toContain(':aria-busy=')
    }
  })
})

describe('chargement différé des pages privées', () => {
  it.each([
    'app/pages/admin/statistiques/index.vue',
    'app/pages/admin/statistiques/[team].vue',
    'app/pages/creneaux.vue',
    'app/pages/inscriptions.vue',
    'app/pages/mes-participations.vue',
    'app/pages/admin/annonces.vue',
    'app/pages/admin/evenements.vue',
  ])('%s livre un squelette sans attendre le bridge en SSR', (path) => {
    const page = source(path)
    expect(page).toContain('server: false')
    expect(page).toContain('lazy: true')
    expect(page).toContain('retry: 0')
    expect(page).toContain('timeout: 60_000')
    expect(page).toContain("=== 'idle'")
    expect(page).toContain('AppLoadingState')
    expect(page).toContain('getCachedData:')
    expect(page).toContain('onBeforeUnmount(')
    expect(page).toMatch(/Réessayer|Recharger la dernière annonce/)
  })

  it('diffère seulement les capacités du menu, pas les autorisations des pages', () => {
    const layout = source('app/layouts/admin.vue')
    expect(layout).toContain('Promise.allSettled(')
    expect(layout.indexOf('onMounted(')).toBeLessThan(layout.indexOf('requestFetch<'))
    expect(layout).toContain('onBeforeUnmount(() => navigationRequests?.abort())')
    for (const middleware of [
      'team-statistics-admin',
      'training-announcements-admin',
      'animation-events-admin',
    ]) {
      const guard = source(`app/middleware/${middleware}.ts`)
      expect(guard).toContain('nuxtApp.isHydrating')
      expect(guard).toContain('nuxtApp.payload.serverRendered')
      expect(guard).toContain('import.meta.client')
      expect(guard).toContain('await useRequestFetch()')
      expect(guard).toContain('statusCode: 403')
    }
  })
})

describe('réutilisation strictement limitée à l’hydratation autorisée', () => {
  for (const middleware of [
    'team-statistics-admin',
    'training-announcements-admin',
    'animation-events-admin',
  ]) {
    it.each([
      { client: true, hydrating: true, serverRendered: true, allowed: true, requests: 0 },
      { client: false, hydrating: true, serverRendered: true, allowed: true, requests: 1 },
      { client: true, hydrating: false, serverRendered: true, allowed: true, requests: 1 },
      { client: true, hydrating: true, serverRendered: false, allowed: true, requests: 1 },
      { client: true, hydrating: true, serverRendered: true, allowed: false, requests: 1 },
    ])(`${middleware} : %j`, async ({ client, hydrating, serverRendered, allowed, requests }) => {
      const fetchAccess = vi.fn().mockResolvedValue({
        canAccess: true,
        canManage: true,
        detailTeamKeys: ['penta'],
      })
      const access = {
        value: { canAccess: allowed, canManage: allowed, detailTeamKeys: ['penta'] },
      }
      const compiled = transpileModule(
        source(`app/middleware/${middleware}.ts`).replaceAll('import.meta.client', String(client)),
        { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } },
      ).outputText
      const module = {
        exports: {} as { default: (route: { params: Record<string, string> }) => Promise<unknown> },
      }
      new Function(
        'exports',
        'defineNuxtRouteMiddleware',
        'useNuxtApp',
        'useState',
        'useRequestFetch',
        compiled,
      )(
        module.exports,
        (guard: unknown) => guard,
        () => ({ isHydrating: hydrating, payload: { serverRendered } }),
        () => access,
        () => fetchAccess,
      )
      await module.exports.default({ params: { team: 'penta' } })
      expect(fetchAccess).toHaveBeenCalledTimes(requests)
    })
  }
})
