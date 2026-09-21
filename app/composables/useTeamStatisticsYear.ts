export function useTeamStatisticsYear() {
  const route = useRoute()
  const query = computed(() => {
    const value = Array.isArray(route.query.year) ? route.query.year[0] : route.query.year
    return value ? { year: value } : {}
  })

  function selectYear(year: number) {
    return navigateTo({ path: route.path, query: { year: String(year) } })
  }

  return { query, selectYear }
}
