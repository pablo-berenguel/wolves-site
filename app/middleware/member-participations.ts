export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo(
      {
        path: '/admin/login',
        query: { redirect: '/mes-participations' },
      },
      { replace: true },
    )
  }
})
