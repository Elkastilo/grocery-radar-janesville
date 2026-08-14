const publicStaticRoutes = new Map([
  ['/', { screen: 'home' }],
  ['/products', { screen: 'search' }],
  ['/stores', { screen: 'stores' }],
  ['/savings', { screen: 'deals', savingsSection: 'home' }],
  ['/savings/price-drops', { screen: 'deals', savingsSection: 'drops' }],
  ['/savings/showdown', { screen: 'deals', savingsSection: 'showdown' }],
  ['/savings/categories', { screen: 'deals', savingsSection: 'categories' }],
  ['/my-list', { screen: 'cart' }],
  ['/my-list/compare', { screen: 'cart', compare: true }],
  ['/submit', { screen: 'submit' }],
  ['/my-submissions', { screen: 'submissions' }],
  ['/privacy', { screen: 'privacy' }],
  ['/terms', { screen: 'terms' }],
  ['/updates', { screen: 'updates' }],
  ['/legacy-account', { screen: 'profile' }],
  ['/leaderboard', { screen: 'leaderboard' }],
])

const screenPaths = {
  home: '/',
  search: '/products',
  stores: '/stores',
  deals: '/savings',
  cart: '/my-list',
  submit: '/submit',
  submissions: '/my-submissions',
  privacy: '/privacy',
  terms: '/terms',
  updates: '/updates',
  profile: '/legacy-account',
  leaderboard: '/leaderboard',
}

const validWindows = new Set(['today', 'week', 'last7'])
const validOfferModes = new Set(['all', 'unconditional'])
const validDropSorts = new Set(['newest', 'percent', 'dollars', 'ending'])
const validCategories = new Set(['produce', 'meat', 'dairy', 'frozen', 'bakery', 'pantry', 'snacks', 'drinks', 'prepared food', 'household', 'personal care', 'baby', 'pet', 'other'])

function positiveId(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanPathname(pathname = '/') {
  const path = String(pathname || '/').replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return path || '/'
}

export function parsePublicRoute(pathname = window.location.pathname, search = window.location.search) {
  const path = cleanPathname(pathname)
  const params = new URLSearchParams(search)
  const productMatch = path.match(/^\/products\/(\d+)$/)
  if (productMatch) return { screen: 'product', productId: positiveId(productMatch[1]), path, params }
  const storeMatch = path.match(/^\/stores\/(\d+)$/)
  if (storeMatch) return { screen: 'store', storeId: positiveId(storeMatch[1]), path, params }

  // Legacy public links are normalized by the app with replaceState.
  if (path === '/' && positiveId(params.get('product'))) return { screen: 'product', productId: positiveId(params.get('product')), path, params, legacy: true }
  if (path === '/' && params.get('q')) return { screen: 'search', path, params, legacy: true }
  if (path === '/' && params.get('section') === 'proof' && params.get('proof')) return { screen: 'profile', proofId: params.get('proof'), path, params, legacy: true }
  const staticRoute = publicStaticRoutes.get(path)
  if (staticRoute) return { ...staticRoute, path, params }
  return { screen: 'notFound', path, params }
}

export function publicPathFor(screen, options = {}) {
  if (screen === 'product') return positiveId(options.productId) ? `/products/${positiveId(options.productId)}` : '/products'
  if (screen === 'store') return positiveId(options.storeId) ? `/stores/${positiveId(options.storeId)}` : '/stores'
  if (screen === 'deals') {
    const section = options.savingsSection || options.section || 'home'
    return { drops: '/savings/price-drops', showdown: '/savings/showdown', categories: '/savings/categories' }[section] || '/savings'
  }
  return screenPaths[screen] || '/'
}

export function legacyReplacement(route) {
  if (!route.legacy) return ''
  const path = publicPathFor(route.screen, route)
  const params = new URLSearchParams(route.params)
  for (const key of ['product', 'tab', 'section', 'proof', 'store', 'report']) params.delete(key)
  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}`
}

export function savingsControlsFromParams(params) {
  const windowValue = params.get('window')
  const mode = params.get('offers') || params.get('mode')
  const sort = params.get('sort')
  const storeId = positiveId(params.get('store'))
  return {
    window: validWindows.has(windowValue) ? windowValue : 'week',
    mode: validOfferModes.has(mode) ? mode : 'all',
    store_id: storeId || '',
    category: validCategories.has(params.get('category')) ? params.get('category') : '',
    sort: validDropSorts.has(sort) ? sort : 'newest',
  }
}

export function savingsUrl(pathname, controls) {
  const params = new URLSearchParams()
  if (controls.window && controls.window !== 'week') params.set('window', controls.window)
  if (controls.mode && controls.mode !== 'all') params.set('offers', controls.mode)
  if (positiveId(controls.store_id)) params.set('store', String(positiveId(controls.store_id)))
  if (controls.category) params.set('category', String(controls.category).slice(0, 60))
  if (controls.sort && controls.sort !== 'newest') params.set('sort', controls.sort)
  return `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
}

export const publicRoutePaths = [...publicStaticRoutes.keys()]
