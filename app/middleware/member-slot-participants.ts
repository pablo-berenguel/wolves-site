export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo({ path: '/admin/login', query: { redirect: '/creneaux' } }, { replace: true })
  }
  // The page API rechecks the exact Wolves role before returning any roster.
  // Historical participation or a CMS/coach role alone never grants access.
})
