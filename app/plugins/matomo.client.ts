import {
  MATOMO_PREFERENCE_EVENT,
  classifyMatomoLink,
  getLegacyAnalyticsCookieExpiryValues,
  getNewMatomoScrollThresholds,
  isMatomoOptedOut,
  normalizeMatomoSiteId,
  normalizeMatomoUrl,
  sanitizeMatomoReferrer,
  shouldTrackAnalyticsPath,
  type MatomoPreferenceDetail,
} from '~/utils/matomo'

const MATOMO_SCRIPT_ID = 'wolves-matomo'
const MATOMO_HEARTBEAT_SECONDS = 15

export default defineNuxtPlugin((nuxtApp) => {
  for (const value of getLegacyAnalyticsCookieExpiryValues(
    document.cookie,
    window.location.hostname,
    window.location.protocol === 'https:',
  )) {
    document.cookie = value
  }

  const runtimeConfig = useRuntimeConfig()
  const matomoUrl = normalizeMatomoUrl(runtimeConfig.public.matomoUrl)
  const siteId = normalizeMatomoSiteId(runtimeConfig.public.matomoSiteId)
  if (!matomoUrl || !siteId) return

  const router = nuxtApp.$router
  let trackerStarted = false
  let lastFinishedPath: string | null = null
  let trackedPath: string | null = null
  let lastReportedScrollDepth = 0
  let scrollFrame: number | null = null
  let sessionOptOutOverride: boolean | null = null

  const queue = () => (window._paq ??= [])

  const stopPageTracking = () => {
    trackedPath = null
    lastReportedScrollDepth = 0
    if (trackerStarted) queue().push(['disableHeartBeatTimer'])
  }

  const loadTrackerScript = () => {
    if (document.querySelector(`#${MATOMO_SCRIPT_ID}`)) return

    const script = document.createElement('script')
    script.id = MATOMO_SCRIPT_ID
    script.src = new URL('matomo.js', matomoUrl).href
    script.async = true
    script.referrerPolicy = 'strict-origin'
    document.head.append(script)
  }

  const configureTracker = () => {
    if (trackerStarted) return

    queue().push(
      ['disableCookies'],
      ['setDoNotTrack', true],
      ['disableCampaignParameters'],
      ['discardHashTag', true],
      ['setRequestMethod', 'POST'],
      ['setTrackerUrl', new URL('matomo.php', matomoUrl).href],
      ['setSiteId', siteId],
    )
    trackerStarted = true
    loadTrackerScript()
  }

  const trackPage = (path: string) => {
    const isOptedOut = sessionOptOutOverride ?? isMatomoOptedOut()
    if (!shouldTrackAnalyticsPath(path) || isOptedOut) {
      stopPageTracking()
      return
    }

    configureTracker()
    trackedPath = path
    lastReportedScrollDepth = 0
    queue().push(
      ['setCustomUrl', `${window.location.origin}${path}`],
      ['setReferrerUrl', sanitizeMatomoReferrer(document.referrer)],
      ['setDocumentTitle', document.title],
      ['trackPageView'],
      ['enableHeartBeatTimer', MATOMO_HEARTBEAT_SECONDS],
    )
  }

  const canTrackInteraction = () => {
    const isOptedOut = sessionOptOutOverride ?? isMatomoOptedOut()
    return trackedPath === router.currentRoute.value.path && !isOptedOut
  }

  const handleDocumentClick = (event: MouseEvent) => {
    if (!canTrackInteraction() || !(event.target instanceof Element)) return

    const link = event.target.closest<HTMLAnchorElement>('a[href]')
    if (!link) return

    const interaction = classifyMatomoLink(
      link.getAttribute('href') ?? '',
      window.location.origin,
      link.hasAttribute('download'),
    )
    if (!interaction) return

    queue().push(['trackEvent', 'Fonctionnalité', interaction.action, interaction.name])
  }

  const trackScrollDepth = () => {
    scrollFrame = null
    if (!canTrackInteraction()) return

    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
    if (scrollableHeight <= 0) return

    const depth = Math.round(
      ((Math.max(0, window.scrollY) + window.innerHeight) / document.documentElement.scrollHeight) *
        100,
    )
    const thresholds = getNewMatomoScrollThresholds(depth, lastReportedScrollDepth)
    for (const threshold of thresholds) {
      queue().push(['trackEvent', 'Engagement', 'Profondeur de lecture', `${threshold} %`])
      lastReportedScrollDepth = threshold
    }
  }

  const handleScroll = () => {
    if (scrollFrame !== null) return
    scrollFrame = window.requestAnimationFrame(trackScrollDepth)
  }

  const finishPage = (path: string, force = false) => {
    if (!force && path === lastFinishedPath) return

    lastFinishedPath = path
    trackPage(path)
  }

  const handlePreference = (event: Event) => {
    const { optedOut, persisted } = (event as CustomEvent<MatomoPreferenceDetail>).detail ?? {}
    if (typeof optedOut !== 'boolean' || typeof persisted !== 'boolean') return

    sessionOptOutOverride = persisted ? null : optedOut
    if (optedOut) {
      stopPageTracking()
      return
    }

    finishPage(router.currentRoute.value.path, true)
  }

  window.addEventListener(MATOMO_PREFERENCE_EVENT, handlePreference)
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', handleDocumentClick)
  const removeRouteGuard = router.beforeEach((to, from) => {
    if (to.path !== from.path) stopPageTracking()
  })
  nuxtApp.hook('app:mounted', () => finishPage(router.currentRoute.value.path))
  nuxtApp.hook('page:finish', () => finishPage(router.currentRoute.value.path))
  nuxtApp.vueApp.onUnmount(() => {
    window.removeEventListener(MATOMO_PREFERENCE_EVENT, handlePreference)
    window.removeEventListener('scroll', handleScroll)
    document.removeEventListener('click', handleDocumentClick)
    removeRouteGuard()
    if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
    stopPageTracking()
  })
})
