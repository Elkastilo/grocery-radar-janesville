import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Trash2,
  Upload,
  UsersRound,
} from 'lucide-react'
import { apiFetch, getJson, postJson, putJson } from './api'
import { isRenderableProduct, productCardViewModel, reportSize } from './productDisplay'
import { legacyReplacement, parsePublicRoute, publicPathFor, savingsControlsFromParams, savingsUrl } from './routes'

const categories = [
  { label: 'Fresh Produce', value: 'produce' },
  { label: 'Meat & Seafood', value: 'meat' },
  { label: 'Dairy & Eggs', value: 'dairy' },
  { label: 'Frozen', value: 'frozen' },
  { label: 'Bakery', value: 'bakery' },
  { label: 'Pantry', value: 'pantry' },
  { label: 'Snacks', value: 'snacks' },
  { label: 'Beverages', value: 'drinks' },
  { label: 'Prepared Food', value: 'prepared food' },
  { label: 'Household', value: 'household' },
  { label: 'Health & Personal Care', value: 'personal care' },
  { label: 'Baby', value: 'baby' },
  { label: 'Pet', value: 'pet' },
  { label: 'Other', value: 'other' },
]

const filters = ['cheapest', 'verified', 'deals', 'food', 'household']

const proofLabels = {
  shelf_tag_photo: 'Shelf tag',
  receipt_photo: 'Receipt',
  receipt: 'Receipt',
  shelf_tag: 'Shelf tag',
  weekly_ad: 'Weekly ad',
  store_page: 'Source',
  no_photo: 'Source',
}

const proofTypeLabel = (value) => proofLabels[value] || titleCase(String(value || 'proof').replace(/_/g, ' '))

const rankForPoints = (points = 0) => {
  if (points >= 1500) return 'Community Helper'
  if (points >= 500) return 'Consistent Proof Helper'
  if (points >= 100) return 'Trusted Price Helper'
  if (points >= 25) return 'Proof Spotter'
  return 'New Contributor'
}

const money = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : '$0.00'
}

const titleCase = (value = '') =>
  String(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const displayText = (value = '') => {
  const text = String(value || '').trim()
  return text && text === text.toLowerCase() ? titleCase(text) : text
}

const notificationMessage = (notification) => {
  if (Number(notification?.points_awarded) === 1) {
    return String(notification.message || '').replace(/\b1 points\b/g, '1 point')
  }

  return notification?.message || ''
}

const visitorId = () => {
  const key = 'groceryRadarVisitorId'
  let value = window.localStorage.getItem(key)
  if (!value) {
    value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, value)
  }
  return value
}

const submissionStorageKey = 'groceryRadar.submissions.v1'
const listStorageKey = 'groceryRadar.list.v1'
const substitutionPreferenceKey = 'groceryRadar.substitutePreferences.v1'
const readLocalList = () => {
  try { const items = JSON.parse(window.localStorage.getItem(listStorageKey) || '[]'); return Array.isArray(items) ? items : [] } catch { return [] }
}
const writeLocalList = (items) => window.localStorage.setItem(listStorageKey, JSON.stringify(items.slice(0, 100)))
const readTrackedSubmissions = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(submissionStorageKey) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item?.token) : []
  } catch { return [] }
}
const saveTrackedSubmission = (entry) => {
  const current = readTrackedSubmissions().filter((item) => item.token !== entry.token)
  window.localStorage.setItem(submissionStorageKey, JSON.stringify([entry, ...current].slice(0, 100)))
}

const timeAgo = (value) => {
  if (!value) return 'No update time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const shortDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const reportTitle = (report) => displayText(report.product_display_name || report.item_name || 'Price report')
const isApprovedReport = (report) => report?.status === 'approved'
const numericPrice = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const hasNumericApprovedReportPrice = (report) => isApprovedReport(report) && numericPrice(report?.price) !== null
const hasApprovedProductPrice = (product) => Number(product?.approved_price_count || 0) > 0 && numericPrice(product?.best_price) !== null
const isDealReport = (report) => Boolean(report?.sale_price || report?.proof_type === 'weekly_ad' || (report?.price_type && report.price_type !== 'regular'))
const productPrice = (product) => hasApprovedProductPrice(product)
  ? product?.best_price_label || money(product.best_price)
  : ''
const reportSortPrice = (report) => numericPrice(report?.comparison_price) ?? numericPrice(report?.unit_price) ?? numericPrice(report?.price) ?? Number.POSITIVE_INFINITY
const compareCountLabel = (count = 0) => {
  const number = Number(count || 0)
  if (!number) return 'No stores compared yet'
  return `${number} store${number === 1 ? '' : 's'} compared`
}
const checkedDateLabel = (value) => {
  const label = shortDate(value)
  return label ? `Checked ${label}` : 'Check date pending'
}
const bestReportForProduct = (product, reports = []) => {
  if (!product?.id) return null
  return reports
    .filter((report) => String(report.product_id || '') === String(product.id) && hasNumericApprovedReportPrice(report))
    .sort((a, b) => reportSortPrice(a) - reportSortPrice(b))[0] || null
}
const productImageUrl = (item = {}) => item?.image_url || item?.product_image_url || item?.photo_url || ''
const productBrand = (item = {}, report = null) => item?.preferred_brand || item?.brand || report?.brand || ''

function initialsFor(name = '') {
  const parts = String(name).replace(/[^a-z0-9 ]/gi, ' ').split(/\s+/).filter(Boolean)
  if (!parts.length) return 'GR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function StatusPill({ report }) {
  if (!report) return null
  const confident = report.confidence === 'high' || report.confidence === 'medium-high' || report.verification_count > 0

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
        confident ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {confident ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {confident ? 'Verified' : proofTypeLabel(report.proof_type || report.confidence || 'approved')}
    </span>
  )
}

function SourceTrust({ report, showLink = true }) {
  if (!report) return null
  const checkedAt = report.source_checked_at || report.reviewed_at || report.submitted_at
  const validThrough = report.expires_at

  return (
    <details className="mt-3 rounded-xl bg-white/90 p-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-black text-emerald-800">Why do we trust this price?</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black">
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
        {proofTypeLabel(report.proof_type)} proof
      </span>
      {checkedAt ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          Checked {shortDate(checkedAt)}
        </span>
      ) : null}
      {validThrough ? (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
          Valid through {shortDate(validThrough)}
        </span>
      ) : null}
      {report.submitted_by_username ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Submitted by {report.submitted_by_username}</span> : null}
      {report.purchased_at ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Purchased {shortDate(report.purchased_at)}</span> : null}
      {showLink && report.source_url && report.proof_type !== 'receipt_photo' ? (
        <a
          href={report.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-100"
        >
          View source
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      <p className="basis-full font-semibold text-slate-500">{report.trust_explanation || 'A human reviewer checked the submitted proof. Private proof details are not shown.'}</p>
      </div>
    </details>
  )
}

function PromotionDetails({ report, dark = false }) {
  if (!report || !isDealReport(report)) return null
  const typeLabels = { one_day_sale: 'TODAY ONLY', loyalty_price: 'Rewards Card required', digital_coupon: 'Digital coupon required', paper_coupon: 'Paper coupon required', multi_buy: 'Multi-buy offer', bogo: 'Buy one, get one', bundle: 'Bundle offer', manager_special: 'Manager special' }
  const label = report.promotion_schedule_text || typeLabels[report.price_type] || report.display_offer_text || 'Sale'
  const validity = report.valid_from_date && report.valid_through_date && report.valid_from_date === report.valid_through_date
    ? `Valid ${shortDate(report.valid_through_date)}`
    : report.valid_through_date ? `Valid through ${shortDate(report.valid_through_date)}` : ''
  return <div className={`mt-3 rounded-2xl p-3 ${dark ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-950 ring-1 ring-amber-100'}`}>
    <p className="text-sm font-black uppercase">{label}</p>
    {report.promotion_conditions ? <p className="mt-1 font-black">{report.promotion_conditions}</p> : null}
    {validity ? <p className="mt-1 text-sm font-bold">{validity}</p> : null}
  </div>
}

function StoreLogo({ store, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm'
  const tone = store?.store_type === 'convenience'
    ? 'bg-amber-50 text-amber-700 border-amber-100'
    : store?.store_type === 'discount'
      ? 'bg-sky-50 text-sky-700 border-sky-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100'

  return (
    <div className={`${box} flex shrink-0 items-center justify-center rounded-2xl border font-black shadow-sm ${tone}`}>
      {initialsFor(store?.name)}
    </div>
  )
}

function ProductVisual({ item, label = 'Product', compact = false }) {
  const imageUrl = productImageUrl(item)
  const size = compact ? 'h-16 w-16' : 'h-20 w-20'

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={item.image_alt_text || item.image_alt || `${label} product image`}
        className={`${size} shrink-0 rounded-2xl bg-slate-100 object-cover ring-1 ring-slate-100`}
        loading="lazy"
      />
    )
  }

  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100`}>
      <PackageCheck className="h-7 w-7" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-white px-3 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-100"
        >
          {action}
        </button>
      ) : null}
    </div>
  )
}

function SearchBox({ value, onChange, onFocus, compact = false }) {
  return (
    <label
      className={`flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 shadow-soft ${
        compact ? 'py-3' : 'py-4'
      }`}
    >
      <span className="sr-only">Search groceries</span>
      <Search className="h-6 w-6 shrink-0 text-emerald-700" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder="Search milk, eggs, ground beef..."
        className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-slate-950 outline-none placeholder:text-slate-400"
      />
    </label>
  )
}

function ScreenTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-black uppercase text-emerald-700">{eyebrow}</p>
      <h1 data-route-heading tabIndex="-1" className="mt-1 text-3xl font-black text-slate-950 outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-lg font-semibold text-slate-600">{subtitle}</p>
    </div>
  )
}

function EmptyState({ title, body, icon: Icon = AlertTriangle }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-center shadow-soft ring-1 ring-slate-100">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-lg font-black text-slate-950">{title}</p>
      <p className="mt-1 font-semibold text-slate-500">{body}</p>
    </div>
  )
}

function LoadingCard({ label = 'Loading real Grocery Radar data...' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-center gap-3 font-black text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        {label}
      </div>
    </div>
  )
}

function ApiError({ message, onRetry }) {
  return (
    <div className="rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black">Could not load data</p>
          <p className="mt-1 font-semibold">{message}</p>
        </div>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="rounded-full bg-white px-3 py-2 text-sm font-black text-amber-900">
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}

function StoreCard({ store, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen?.(store.id)} className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <StoreLogo store={store} />
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">{store.name}</p>
          <p className="truncate text-sm font-semibold text-slate-500">{titleCase(store.store_type || 'grocery')}</p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-1 text-sm font-bold text-emerald-700">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">{store.address || `${store.city || 'Janesville'}, ${store.state || 'WI'}`}</span>
      </div>
      {store.current_price_count != null ? <p className="mt-2 text-sm font-black text-slate-600">{Number(store.current_price_count)} current prices</p> : null}
    </button>
  )
}

function ProductCard({ product, bestReport, onOpen, onAddToCart }) {
  const card = productCardViewModel(product, bestReport)
  const safeProduct = card.product
  if (!card.renderable) return <article className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><p className="font-black text-slate-700">Product unavailable</p><p className="mt-1 text-sm font-bold text-slate-500">This product card could not be displayed.</p></article>
  const hasPrice = card.hasCurrentPrice
  const storeName = bestReport?.store_name || safeProduct.best_store_name || ''
  const brand = productBrand(safeProduct, bestReport)

  return (
    <article className="rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lift">
      <button type="button" onClick={() => onOpen(safeProduct.id)} className="w-full text-left">
        <div className="flex items-start gap-3">
          <ProductVisual item={safeProduct} label={card.displayName} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-950">{displayText(card.displayName)}</p>
            {brand ? <p className="mt-0.5 text-sm font-black text-emerald-700">{displayText(brand)}</p> : null}
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {titleCase(card.category)} | {card.size}
            </p>
          </div>
          <div className={`rounded-2xl px-3 py-2 text-right shadow-sm ${
            hasPrice ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <p className="text-xs font-bold">{hasPrice ? 'Lowest' : 'Waiting'}</p>
            <p className={`${hasPrice ? 'text-xl' : 'max-w-24 text-sm leading-tight'} font-black`}>
              {hasPrice ? productPrice(safeProduct) : 'Price needed'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {bestReport ? (
            <StatusPill report={bestReport} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              Help verify this price
            </span>
          )}
          {storeName ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {storeName}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            {compareCountLabel(safeProduct.approved_price_count)}
          </span>
          {safeProduct.last_reported_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              <Clock3 className="h-3.5 w-3.5" />
              {checkedDateLabel(safeProduct.last_reported_at)}
            </span>
          ) : null}
        </div>
        {bestReport ? <SourceTrust report={bestReport} showLink={false} /> : null}
      </button>
      {bestReport?.source_url ? (
        <a
          href={bestReport.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100"
        >
          View source
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      {onAddToCart ? (
        <button
          type="button"
          onClick={() => onAddToCart(safeProduct)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-800"
        >
          <Plus className="h-5 w-5 text-emerald-700" />
          Add to My List
        </button>
      ) : null}
    </article>
  )
}

function PriceIssueReporter({ reportId, compact = false }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('price changed')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const triggerRef = useRef(null)
  const reasonRef = useRef(null)
  const formId = `price-issue-${reportId}`

  useEffect(() => {
    if (open) reasonRef.current?.focus()
  }, [open])

  if (!reportId) return null
  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setStatus('')
    setFailed(false)
    try {
      await postJson(`/api/price-reports/${reportId}/issues`, { reason, note })
      setStatus('Thanks. Staff will review this price; it was not changed automatically.')
      setOpen(false)
      setNote('')
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    } catch {
      setFailed(true)
      setStatus("Couldn't send your report. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-xl bg-amber-50 px-3 font-black text-amber-900 ring-1 ring-amber-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
        Price wrong? Report price
      </button>
      {open ? (
        <form id={formId} onSubmit={submit} className="mt-3 space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <label className="block font-black text-slate-900">What is wrong?
            <select ref={reasonRef} className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="price changed">Price changed</option>
              <option value="wrong store">Wrong store</option>
              <option value="wrong item">Wrong item</option>
              <option value="sale ended">Sale ended</option>
              <option value="promotion conditions missing">Promotion conditions missing</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block font-black text-slate-900">Optional note
            <textarea className="field mt-1" rows="2" maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={sending} className="min-h-11 rounded-xl bg-slate-900 px-4 font-black text-white disabled:opacity-60">{sending ? 'Sending…' : 'Send report'}</button>
            <button type="button" disabled={sending} onClick={() => { setOpen(false); window.requestAnimationFrame(() => triggerRef.current?.focus()) }} className="min-h-11 rounded-xl bg-white px-4 font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-60">Cancel</button>
          </div>
        </form>
      ) : null}
      {status ? <p role={failed ? 'alert' : 'status'} aria-live="polite" className={`mt-2 text-sm font-bold ${failed ? 'text-red-700' : 'text-slate-700'}`}>{status}</p> : null}
    </div>
  )
}

function ReportCard({ report, onOpenProduct, onAddToCart, compact = false }) {
  const canOpen = Boolean(report.product_id)
  return (
    <article className="rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-slate-100">
      <button
        type="button"
        onClick={() => canOpen && onOpenProduct(report.product_id)}
        className="w-full text-left"
        disabled={!canOpen}
      >
        <div className="flex items-start gap-3">
          <ProductVisual item={report} label={reportTitle(report)} compact={compact} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-950">{reportTitle(report)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {report.brand ? `${report.brand} | ` : ''}{reportSize(report)}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-600 px-3 py-2 text-right text-white shadow-sm">
            <p className="text-xs font-bold">{report.sale_price ? 'Sale' : 'Price'}</p>
            <p className="text-xl font-black">{report.price_label || money(report.price)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill report={report} />
          {isDealReport(report) ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
              {report.proof_type === 'weekly_ad' ? 'Weekly ad' : 'Sale'}
            </span>
          ) : null}
        </div>

        <div className={`mt-4 flex items-center justify-between gap-3 ${compact ? 'text-sm' : ''}`}>
          <div className="flex min-w-0 items-center gap-3">
            <StoreLogo store={{ name: report.store_name }} />
            <div className="min-w-0">
              <p className="truncate font-black text-slate-900">{report.store_name}</p>
              <p className="truncate text-sm font-semibold text-slate-500">
                {report.unit_price_label || report.unit} | {checkedDateLabel(report.source_checked_at || report.reviewed_at || report.submitted_at)}
              </p>
            </div>
          </div>
          {canOpen ? <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-slate-300" /> : null}
        </div>
        <SourceTrust report={report} showLink={false} />
        <PromotionDetails report={report} />
      </button>
      {report.source_url ? (
        <a
          href={report.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100"
        >
          View source
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      <PriceIssueReporter reportId={report.id} compact={compact} />
      {onAddToCart ? (
        <button
          type="button"
          onClick={() => onAddToCart(report)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-800"
        >
          <Plus className="h-5 w-5 text-emerald-700" />
          Add to My List
        </button>
      ) : null}
    </article>
  )
}

function SummaryCard({ icon: Icon, label, value, note }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 text-sm font-black text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{note}</p>
    </article>
  )
}

const fallbackHomepageService = {
  service: {
    location: { city: 'Janesville', region: 'Wisconsin' },
    service_status: 'online',
    version_label: 'Early Access',
    current_focus: 'Adding and verifying Janesville grocery prices.',
    main_message:
      'Grocery Radar is live, but the radar is still filling up. We are actively adding and verifying grocery prices from Janesville stores using receipts, shelf tags, weekly ads, and community submissions.',
    community_mission_title: 'Help fill the Janesville radar.',
    community_mission_body: 'One receipt, shelf tag, weekly ad, or store link can help shoppers across Janesville.',
    homepage_announcement: '',
    maintenance: { enabled: false },
    updated_at: '',
  },
  patch_notes: [],
  known_issues: [],
  community_counts: {
    verified_prices: 0,
    products_with_active_prices: 0,
    janesville_stores_tracked: 0,
    prices_updated_today: 0,
    community_submissions_awaiting_review: 0,
  },
}

const serviceStatusStyles = {
  online: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  maintenance: 'bg-amber-100 text-amber-900 ring-amber-200',
  degraded: 'bg-rose-100 text-rose-900 ring-rose-200',
  updating: 'bg-sky-100 text-sky-900 ring-sky-200',
}

function ServiceBadge({ status }) {
  const safeStatus = status || 'online'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black ring-1 ${serviceStatusStyles[safeStatus] || serviceStatusStyles.online}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
      {titleCase(safeStatus)}
    </span>
  )
}

function PatchList({ title, items = [] }) {
  if (!items.length) return null

  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <p className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm font-bold text-slate-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MissionCount({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-emerald-100">
      <p className="text-3xl font-black text-emerald-800">{Number(value || 0).toLocaleString()}</p>
      <p className="mt-1 text-sm font-black text-slate-600">{label}</p>
    </div>
  )
}

function LegacyHomeScreen({
  browse,
  stores,
  loading,
  error,
  homepageService,
  homepageServiceState,
  searchTerm,
  setSearchTerm,
  openScreen,
  openProduct,
  addToCart,
}) {
  const live = homepageService || fallbackHomepageService
  const service = live.service || fallbackHomepageService.service
  const maintenance = service.maintenance || {}
  const counts = live.community_counts || fallbackHomepageService.community_counts
  const latestPatch = (live.patch_notes || [])[0]
  const knownIssues = live.known_issues || []
  const reports = (browse.recently_approved_reports || []).filter(hasNumericApprovedReportPrice)
  const products = (browse.products || []).filter(hasApprovedProductPrice)
  const dealReports = reports.filter(isDealReport)
  const bestCards = dealReports.slice(0, 4)
  const hasApprovedPrices = reports.length > 0 || products.length > 0
  const quickActions = [
    { label: 'Find the Cheapest Price', icon: Search, screen: 'search', tone: 'primary' },
    { label: "Browse This Week's Deals", icon: Tag, screen: 'deals' },
    { label: 'Compare My Grocery List', icon: ShoppingCart, screen: 'cart' },
    { label: 'Submit Proof', icon: Upload, screen: 'submit' },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
      <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-soft sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-black text-emerald-100">
              <MapPin className="h-4 w-4" />
              Janesville, Wisconsin
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
              GROCERY RADAR JANESVILLE
            </h1>
            <p className="mt-3 max-w-3xl text-xl font-bold text-slate-200">
              {service.main_message}
            </p>
          </div>
          <ServiceBadge status={service.service_status} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-sm font-black text-slate-300">Current Version</p>
            <p className="mt-1 text-2xl font-black">{service.version_label}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-sm font-black text-slate-300">Current Focus</p>
            <p className="mt-1 text-base font-black">{service.current_focus}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-sm font-black text-slate-300">Last Updated</p>
            <p className="mt-1 text-base font-black">{shortDate(service.updated_at || service.published_at) || 'Update pending'}</p>
          </div>
        </div>

        {service.homepage_announcement ? (
          <div className="mt-5 rounded-2xl bg-emerald-400/15 p-4 font-bold text-emerald-50 ring-1 ring-emerald-300/30">
            {service.homepage_announcement}
          </div>
        ) : null}

        {maintenance.enabled ? (
          <div className="mt-5 rounded-2xl bg-amber-100 p-4 text-amber-950 ring-1 ring-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0" />
              <div>
                <p className="text-lg font-black">{maintenance.title || 'Maintenance Notice'}</p>
                <p className="mt-1 font-bold">{maintenance.message || 'Grocery Radar maintenance is currently posted.'}</p>
                {maintenance.impact ? <p className="mt-2 text-sm font-bold">{maintenance.impact}</p> : null}
                <p className="mt-2 text-sm font-black">
                  {titleCase(maintenance.status || 'monitoring')}
                  {maintenance.expected_end_at ? ` | Expected end ${shortDate(maintenance.expected_end_at)}` : ''}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-emerald-100 sm:p-7">
        <SectionHeader title="Search Grocery Prices" />
        <SearchBox value={searchTerm} onChange={setSearchTerm} onFocus={() => openScreen('search')} />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            const isPrimary = action.tone === 'primary'
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => openScreen(action.screen)}
                className={`flex min-h-24 flex-col items-start justify-between rounded-2xl p-4 text-left font-black shadow-sm ring-1 ${
                  isPrimary
                    ? 'bg-emerald-700 text-white ring-emerald-700'
                    : 'bg-emerald-50 text-emerald-950 ring-emerald-100'
                }`}
              >
                <Icon className={`h-7 w-7 ${isPrimary ? 'text-white' : 'text-emerald-700'}`} />
                <span className="text-base leading-tight">{action.label}</span>
              </button>
            )
          })}
        </div>
        {homepageServiceState?.error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-100">
            Service notes are temporarily unavailable. Search and approved prices can still load below.
          </p>
        ) : null}
      </section>

      {error ? <div className="mt-5"><ApiError message={error} /></div> : null}

      <section className="mt-7 rounded-[2rem] bg-emerald-50 p-5 shadow-soft ring-1 ring-emerald-100 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-800">Current Community Mission</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{service.community_mission_title}</h2>
            <p className="mt-2 text-lg font-bold text-slate-600">{service.community_mission_body}</p>
          </div>
          <div className="rounded-2xl bg-emerald-700 p-3 text-white">
            <UsersRound className="h-8 w-8" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MissionCount label="Verified prices" value={counts.verified_prices} />
          <MissionCount label="Products with active prices" value={counts.products_with_active_prices} />
          <MissionCount label="Janesville stores tracked" value={counts.janesville_stores_tracked} />
          <MissionCount label="Prices updated today" value={counts.prices_updated_today} />
          <MissionCount label="Submissions awaiting review" value={counts.community_submissions_awaiting_review} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button type="button" onClick={() => openScreen('search')} className="rounded-2xl bg-emerald-700 px-4 py-4 font-black text-white">
            Search Prices
          </button>
          <button type="button" onClick={() => openScreen('submit')} className="rounded-2xl bg-white px-4 py-4 font-black text-emerald-900 ring-1 ring-emerald-100">
            Submit Proof
          </button>
          <button type="button" onClick={() => openScreen('profile')} className="rounded-2xl bg-white px-4 py-4 font-black text-emerald-900 ring-1 ring-emerald-100">
            Report a Problem
          </button>
          <button type="button" onClick={() => openScreen('profile')} className="rounded-2xl bg-white px-4 py-4 font-black text-emerald-900 ring-1 ring-emerald-100">
            Suggest an Idea
          </button>
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Latest Patch Notes" />
        {latestPatch ? (
          <article className="rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-7">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
              {latestPatch.version_label} — {latestPatch.title}
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{latestPatch.summary}</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">Published {shortDate(latestPatch.published_at || latestPatch.updated_at) || 'recently'}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <PatchList title="Added" items={latestPatch.added} />
              <PatchList title="Changed" items={latestPatch.changed} />
              <PatchList title="Fixed" items={latestPatch.fixed} />
              <PatchList title="Known Issues" items={latestPatch.known_issues} />
              <PatchList title="Next Focus" items={latestPatch.next_focus} />
            </div>
          </article>
        ) : (
          <EmptyState title="Patch notes are being prepared" body="Service updates will appear here after the Owner publishes them." icon={FileCheck2} />
        )}
      </section>

      <section className="mt-7">
        <SectionHeader title="Known Issues" />
        <div className="grid gap-3 sm:grid-cols-2">
          {knownIssues.length ? knownIssues.map((issue) => (
            <article key={issue.id} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">{issue.title}</h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{titleCase(issue.status)}</span>
              </div>
              <p className="mt-2 font-bold text-slate-600">{issue.description}</p>
              {issue.workaround ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">Workaround: {issue.workaround}</p> : null}
              <p className="mt-3 text-sm font-black text-slate-500">
                Opened {shortDate(issue.opened_at) || 'recently'} | Updated {shortDate(issue.last_updated_at) || 'recently'}
              </p>
            </article>
          )) : (
            <EmptyState title="No published known issues" body="If something looks wrong, send feedback from your account." icon={CheckCircle2} />
          )}
        </div>
      </section>

      <section className="mt-7 rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-7">
        <h2 className="text-2xl font-black text-slate-950">Why am I not seeing many prices yet?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            'Grocery Radar only shows approved prices.',
            'Community submissions must be reviewed before becoming public.',
            'Old, expired, or disputed prices may be hidden.',
            'Some Janesville stores and categories are still being populated.',
            'Prices are continuously updated to keep them useful and current.',
            'We do not publish unverified bulk data simply to make the site look full.',
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p className="font-bold text-slate-700">{item}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold text-slate-500">
          Prices can change at the store. Check size, promotion, membership rules, and availability before purchase.
        </p>
      </section>

      <section className="mt-7 rounded-[2rem] bg-emerald-700 p-5 text-white shadow-lift sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-100">Help Build the Radar</p>
            <h2 className="mt-2 text-3xl font-black">Built in Janesville. Powered by neighbors.</h2>
            <p className="mt-2 text-lg font-bold text-emerald-50">
              Upload a receipt, shelf tag, weekly ad, screenshot, or store link. We review it before any price becomes public.
            </p>
          </div>
          <ReceiptText className="h-10 w-10 text-emerald-100" />
        </div>
        <button
          type="button"
          onClick={() => openScreen('submit')}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-emerald-800"
        >
          <Upload className="h-5 w-5" />
          Submit Proof
        </button>
      </section>

      {!loading && !error && !hasApprovedPrices ? (
        <section className="mt-5">
          <EmptyState
            title="New deals are being added"
            body="No approved prices are public right now. Submit proof to help Janesville shoppers."
            icon={ReceiptText}
          />
        </section>
      ) : null}

      <section className="mt-7">
        <SectionHeader title="Best Deals Near You" action="See all" onAction={() => openScreen('deals')} />
        {loading ? <LoadingCard /> : null}
        {!loading && !error && !bestCards.length ? (
          <EmptyState title="No approved deals yet" body="Sale prices and weekly ad deals will appear here after review." icon={Tag} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {bestCards.map((report) => (
            <ReportCard key={report.id} report={report} onOpenProduct={openProduct} onAddToCart={addToCart} compact />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Recently Checked Prices" action="Search" onAction={() => openScreen('search')} />
        {!loading && !error && hasApprovedPrices && !reports.length ? (
          <EmptyState title="No recent approved prices" body="Newly checked prices will appear here after review." icon={Clock3} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.slice(0, 6).map((report) => (
            <ReportCard key={report.id} report={report} onOpenProduct={openProduct} onAddToCart={addToCart} compact />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Popular Searches" />
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => {
                setSearchTerm(category.label)
                openScreen('search', { category: category.value })
              }}
              className="rounded-full bg-white px-4 py-3 text-base font-black text-slate-800 shadow-sm ring-1 ring-slate-100"
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Janesville Stores" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stores.slice(0, 8).map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </section>
    </div>
  )
}

function CatalogTile({ product, reports, openProduct }) {
  const report = bestReportForProduct(product, reports)
  const storeName = report?.store_name || product.best_store_name || ''
  return (
    <button type="button" onClick={() => openProduct(product.id)} className="min-w-0 rounded-3xl bg-white p-3 text-left shadow-soft ring-1 ring-slate-100 transition focus-visible:ring-4 focus-visible:ring-emerald-300 sm:p-4">
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-emerald-50">
        {productImageUrl(product) ? <img src={productImageUrl(product)} alt={product.image_alt_text || `${product.display_name} product image`} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-emerald-700"><PackageCheck className="h-12 w-12" aria-hidden="true" /><span className="sr-only">Category placeholder for {product.display_name}</span></div>}
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-black text-slate-950 sm:text-lg">{displayText(product.display_name)}</h3>
      <p className="mt-1 text-2xl font-black text-emerald-700">{hasApprovedProductPrice(product) ? productPrice(product) : 'Price needed'}</p>
      <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-600">{storeName || titleCase(product.category)}</p>
      {hasApprovedProductPrice(product) ? <p className="mt-1 text-sm font-bold text-emerald-700">{product.best_price_freshness || 'Recently verified'}</p> : <p className="mt-1 text-sm font-bold text-amber-800">Submit Price</p>}
      {Number(product.other_store_price_count || 0) > 0 ? <p className="mt-1 text-xs font-bold text-slate-500">Other stores available</p> : null}
    </button>
  )
}

function HomeScreen(props) {
  const { browse, stores, loading, error, homepageService, homepageServiceState, searchTerm, setSearchTerm, openScreen, openProduct, openStore, arena } = props
  const service = homepageService?.service || fallbackHomepageService.service
  const products = (browse.products || []).filter(isRenderableProduct)
  const reports = (browse.recently_approved_reports || []).filter(hasNumericApprovedReportPrice)
  const visibleCategories = categories.map((category) => ({ ...category, products: products.filter((product) => product.category === category.value).slice(0, 4) })).filter((category) => category.products.length)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
      <section className="rounded-[2rem] bg-emerald-800 p-5 text-white shadow-soft sm:p-8">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-100">Grocery Radar Janesville</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">Find local grocery prices without the clutter.</h1>
        <div className="mt-6"><SearchBox value={searchTerm} onChange={setSearchTerm} onFocus={() => openScreen('search')} /></div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-emerald-50"><span>{titleCase(service.service_status || 'online')}</span><span aria-hidden="true">·</span><span>{service.main_message}</span></div>
      </section>

      <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-slate-100"><SectionHeader title="Janesville Price Check" action="See all stores" onAction={() => openScreen('deals')} />{arena?.homepage_module_eligible ? <><p className="font-bold text-slate-500">{arena.leaderboard.comparable_product_count} comparable groceries · {arena.window?.label}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{arena.leaderboard.rankings.slice(0,3).map((row) => <div key={row.store_id} className="rounded-xl bg-emerald-50 p-3"><strong>{row.store_name}</strong><p className="text-sm font-bold text-slate-600">Lowest on {row.lowest_count}</p></div>)}</div><p className="mt-3 text-sm font-bold text-slate-500">Based only on products currently verified in Grocery Radar. Coverage varies by store.</p></> : <p className="font-bold text-slate-600">We’re still building store coverage. Product-level comparisons remain available whenever current comparable prices exist.</p>}</section>

      {homepageServiceState?.error ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 font-bold text-amber-900">Service notes are temporarily unavailable. Grocery search is still working.</p> : null}
      {error ? <div className="mt-5"><ApiError message={error} /></div> : null}
      {loading ? <div className="mt-5"><LoadingCard label="Loading products..." /></div> : null}

      {!loading && !error && !products.length ? <div className="mt-6"><EmptyState title="Products are being prepared" body="Search still includes approved prices, and community proof can be submitted now." icon={PackageCheck} /></div> : null}

      {visibleCategories.map((category) => (
        <section key={category.value} className="mt-8" aria-labelledby={`home-category-${category.value.replaceAll(' ', '-')}`}>
          <SectionHeader title={category.label} action="View all" onAction={() => openScreen('search', { category: category.value })} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{category.products.map((product) => <CatalogTile key={product.id} product={product} reports={reports} openProduct={openProduct} />)}</div>
        </section>
      ))}

      <section className="mt-9 rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <SectionHeader title="Janesville Stores" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stores.slice(0, 4).map((store) => <StoreCard key={store.id} store={store} onOpen={openStore} />)}</div>
        <button type="button" onClick={() => openScreen('stores')} className="mt-4 min-h-12 rounded-2xl bg-emerald-50 px-5 font-black text-emerald-800">View all stores</button>
      </section>

      <details className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <summary className="cursor-pointer font-black text-slate-700">Service information and community updates</summary>
        <div className="mt-4"><LegacyHomeScreen {...props} /></div>
      </details>
    </div>
  )
}

function StoresScreen({ stores, openStore }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
      <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Janesville</p>
      <h1 className="mt-2 text-4xl font-black text-slate-950">Stores</h1>
      <p className="mt-2 text-lg font-bold text-slate-600">Local stores currently tracked by Grocery Radar.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stores.map((store) => <StoreCard key={store.id} store={store} onOpen={openStore} />)}</div>
    </div>
  )
}

function SearchScreen({
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
  activeCategory,
  setActiveCategory,
  searchData,
  loading,
  error,
  openProduct,
  addToCart,
  reload,
}) {
  const approvedReports = (searchData.reports || []).filter(hasNumericApprovedReportPrice)
  const foodCategorySet = new Set(['meat', 'dairy', 'produce', 'pantry', 'frozen', 'drinks', 'snacks', 'bakery'])
  const filterFood = (item) => Boolean(item && typeof item === 'object') && (activeFilter !== 'food' || foodCategorySet.has(item.category))
  const reports = (activeFilter === 'deals'
    ? approvedReports.filter(isDealReport)
    : approvedReports).filter(filterFood)
  const products = (searchData.products || []).filter(filterFood)
  const productSectionTitle = activeFilter === 'cheapest' ? 'Lowest approved prices' : 'Approved product matches'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="Browse Janesville"
        title="Search prices"
        subtitle="Search approved local prices and add items to My List."
      />
      <SearchBox value={searchTerm} onChange={setSearchTerm} compact />
      <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setActiveFilter(filter)
              setActiveCategory(filter === 'household' ? 'household' : '')
            }}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-black capitalize shadow-sm ring-1 ${
              activeFilter === filter
                ? 'bg-emerald-700 text-white ring-emerald-700'
                : 'bg-white text-slate-800 ring-emerald-100'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {categories.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setActiveCategory(activeCategory === category.value ? '' : category.value)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-black shadow-sm ring-1 ${
              activeCategory === category.value
                ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
                : 'bg-white text-slate-700 ring-slate-100'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? <LoadingCard label="Searching approved Grocery Radar prices..." /> : null}
        {error ? <ApiError message={error} onRetry={reload} /> : null}
      </div>

      {!loading && !error && !reports.length && !products.length ? (
        <div className="mt-5">
          <EmptyState title="No approved matches yet" body="Try another search, or submit proof to help fill the gap." icon={Search} />
        </div>
      ) : null}

      {products.length ? (
        <section className="mt-5">
          <SectionHeader title={productSectionTitle} />
          <div className="grid gap-4 lg:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                bestReport={bestReportForProduct(product, approvedReports)}
                onOpen={openProduct}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        </section>
      ) : null}

      {reports.length ? (
        <section className="mt-7">
          <SectionHeader title={activeFilter === 'deals' ? 'Approved deals' : 'Recently verified matches'} />
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} onOpenProduct={openProduct} onAddToCart={addToCart} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ProductDetailScreen({ detail, loading, error, openScreen, onBack, addToCart, reload, me }) {
  const product = detail?.product
  const reports = (detail?.reports || []).filter(hasNumericApprovedReportPrice)
  const cheapest = [...reports].sort((a, b) => reportSortPrice(a) - reportSortPrice(b))[0]
  const storeGroups = (detail?.store_groups || [])
    .map((group) => ({ ...group, reports: (group.reports || []).filter(hasNumericApprovedReportPrice) }))
    .filter((group) => group.reports.length)
    .sort((a, b) => {
      const aBest = [...a.reports].sort((left, right) => reportSortPrice(left) - reportSortPrice(right))[0]
      const bBest = [...b.reports].sort((left, right) => reportSortPrice(left) - reportSortPrice(right))[0]
      return reportSortPrice(aBest) - reportSortPrice(bBest)
    })
  const priceHistory = detail?.price_history || { sufficient_history: false, observations: [] }
  const chartReports = priceHistory.sufficient_history ? (priceHistory.observations || []).slice(0, 12) : []
  const maxPrice = Math.max(...chartReports.map((report) => Number(report.price) || 0), 1)
  const brand = productBrand(product, cheapest)
  const nutritionRows = product ? [
    ['Brand', brand],
    ['UPC / barcode', product.upc || product.barcode],
    ['Ingredients', product.ingredients],
    ['Allergens', product.allergen_note],
    ['Nutrition', product.nutrition_summary || product.nutrition_label],
  ].filter(([, value]) => Boolean(value)) : []

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-slate-700 shadow-sm ring-1 ring-slate-100"
      >
        <ChevronLeft className="h-5 w-5" />
        Back
      </button>

      {loading ? <LoadingCard label="Loading product details..." /> : null}
      {error ? <ApiError message={error} onRetry={reload} /> : null}
      {!loading && !product ? <EmptyState title="Product not found" body="We could not find this product yet." /> : null}

      {product ? (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <div className="flex items-start gap-4">
              <ProductVisual item={product} label={product.display_name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase text-emerald-700">{titleCase(product.category)}</p>
                <h1 className="mt-2 text-3xl font-black text-slate-950">{displayText(product.display_name)}</h1>
                {brand ? <p className="mt-1 text-base font-black text-emerald-700">{displayText(brand)}</p> : null}
                <p className="mt-1 text-lg font-semibold text-slate-500">
                  {product.default_size_text || 'Size varies by report'}
                </p>
              </div>
            </div>

            {cheapest ? (
              <div className="mt-5 rounded-2xl bg-emerald-700 p-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-emerald-100">Cheapest approved price</p>
                    <p className="mt-1 text-5xl font-black">{cheapest.primary_price_label || cheapest.price_label || money(cheapest.price)}</p>
                    <p className="mt-2 text-lg font-bold">{cheapest.store_name}</p>
                    <p className="mt-1 font-bold text-emerald-100">{cheapest.freshness_label || 'Recently verified'}</p>
                    {cheapest.estimated_item_price_label ? <p className="mt-2 text-sm font-bold text-emerald-100">{cheapest.estimated_item_price_label}</p> : null}
                    {cheapest.approximate_item_weight_label ? <p className="text-sm font-bold text-emerald-100">{cheapest.approximate_item_weight_label}</p> : null}
                    <PromotionDetails report={cheapest} dark />
                  </div>
                  <StoreLogo store={{ name: cheapest.store_name }} size="lg" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill report={cheapest} />
                </div>
                <SourceTrust report={cheapest} />
                <PriceIssueReporter reportId={cheapest.id} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-900">
                <p className="font-black">No approved price yet</p>
                <p className="mt-1 font-semibold">Help verify this price. Submit proof to help fill this gap.</p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ActionButton label="Add to My List" icon={ShoppingCart} onClick={() => addToCart(product)} />
              <ActionButton label="Submit Proof" icon={Plus} onClick={() => openScreen('submit')} />
              <ActionButton label="See Deals" icon={Tag} onClick={() => openScreen('deals')} />
              <ActionButton label="Search More" icon={Search} onClick={() => openScreen('search')} />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="font-black text-slate-950">Product details</p>
              {nutritionRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {nutritionRows.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
                      <p className="mt-1 font-bold text-slate-700">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-bold text-slate-500">
                  More details like nutrition, ingredients, allergens, and barcodes can be added later.
                </p>
              )}
              {product.ingredient_info_url ? (
                <a href={product.ingredient_info_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                  Ingredient info
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <SectionHeader title="Compare stores" />
            <p className="mb-4 font-bold text-slate-500">{detail?.store_comparison?.comparable_store_count || 0} stores compared. Missing prices are not treated as more expensive.</p>
            {detail?.store_comparison?.stores?.length ? <div className="space-y-3">{detail.store_comparison.stores.map((row) => <article key={row.store_id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><StoreLogo store={{ name: row.store_name }} /><div><h3 className="font-black">{row.store_name}</h3><p className="text-sm font-bold text-slate-500">{row.freshness_label || timeAgo(row.observed_at)}</p></div></div><div className="text-right"><p className="text-2xl font-black">{row.price_label || money(row.price)}</p><p className={`text-sm font-black ${row.is_cheapest ? 'text-emerald-700' : 'text-slate-500'}`}>{row.is_cheapest ? 'CHEAPEST VERIFIED' : `+${money(row.difference_from_cheapest)}`}</p></div></div><PromotionDetails report={row} /><SourceTrust report={row} /></article>)}</div> : <EmptyState title="No comparison yet" body="Current comparable prices from active Janesville stores will appear here." icon={Store} />}
            {detail?.store_comparison?.unavailable_stores?.length ? <details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer font-black">Stores with no current verified price ({detail.store_comparison.unavailable_stores.length})</summary><ul className="mt-2 space-y-1">{detail.store_comparison.unavailable_stores.map((store) => <li key={store.id} className="font-bold text-slate-600">{store.name} — {store.status}</li>)}</ul></details> : null}
          </section>

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <SectionHeader title="Cheaper similar options" />
            <p className="mb-4 font-bold text-slate-500">Substitutes are different products, not identical matches. Grocery Radar only shows human-confirmed relationships.</p>
            {detail?.substitutes?.length ? <div className="grid gap-3 sm:grid-cols-2">{detail.substitutes.map((item) => <article key={item.id} className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black uppercase text-emerald-800">{item.substitution_type === 'alternative' ? 'Alternative' : 'Very similar'}</span><h3 className="mt-3 text-xl font-black">{item.product_name}</h3><p className="font-bold text-slate-500">{item.size_text || 'Package size shown on product'}</p>{item.cheapest ? <><p className="mt-3 text-3xl font-black text-emerald-800">{item.cheapest.price_label || money(item.cheapest.price)}</p><p className="font-bold">{item.cheapest.store_name}</p></> : null}{item.potential_savings ? <p className="mt-2 font-black">Potential savings: {money(item.potential_savings)}</p> : null}<p className="mt-2 text-sm font-bold text-slate-600">Why suggested: {(item.reasons || []).join(' · ') || 'Same confirmed product family and comparable use.'}</p><button type="button" onClick={() => openScreen('product', { productId: item.product_id })} className="mt-4 min-h-11 w-full rounded-xl bg-white font-black ring-1 ring-emerald-200">View alternative</button></article>)}</div> : <EmptyState title="No confirmed substitutes yet" body="Grocery Radar will not guess substitute relationships from text alone." icon={PackageCheck} />}
          </section>

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <SectionHeader title="Price history" />
            {priceHistory.sufficient_history && chartReports.length ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  <SummaryCard icon={CircleDollarSign} label="Current" value={money(priceHistory.current_price)} note={priceHistory.label || 'Recent comparison'} />
                  <SummaryCard icon={Clock3} label="Recent typical" value={money(priceHistory.recent_typical_price)} note={`${priceHistory.observation_count} comparable observations`} />
                  <SummaryCard icon={ChevronLeft} label="Recent low" value={money(priceHistory.recent_low)} note={`${priceHistory.distinct_date_count} different dates`} />
                  <SummaryCard icon={ChevronLeft} label="Recent high" value={money(priceHistory.recent_high)} note="Comparable size and unit only" />
                </div>
                <div className="flex h-28 items-end gap-2 rounded-2xl bg-emerald-50 p-4">
                  {chartReports.map((report) => (
                    <div key={report.id} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-xl bg-emerald-600"
                        style={{ height: `${Math.max(18, (Number(report.price) / maxPrice) * 100)}%` }}
                      />
                      <span className="text-xs font-bold text-slate-500">{money(report.price)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">
                  Based on approved comparable prices within the recent analysis window. Promotion conditions remain attached to their observations.
                </p>
              </>
            ) : (
              <EmptyState title="Not enough price history yet" body="At least four comparable observations across multiple dates are required before Grocery Radar makes a factual price comparison." icon={Clock3} />
            )}
          </section>

          <QualitySection product={product} storeGroups={storeGroups} quality={detail?.quality} me={me} reload={reload} />
        </>
      ) : null}
    </div>
  )
}

function QualitySection({ product, storeGroups, quality = {}, me, reload }) {
  const [open, setOpen] = useState(false)
  const [storeId, setStoreId] = useState(storeGroups[0]?.store_id || '')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState([])
  const [message, setMessage] = useState('')
  const [reportingId, setReportingId] = useState(null)
  const [reportReason, setReportReason] = useState('spam')
  const availableTags = product.category === 'produce'
    ? ['fresh', 'good quality', 'overripe', 'underripe', 'bruised / damaged', 'mold/spoilage observed', 'near expiration', 'great shelf life']
    : product.category === 'prepared food'
      ? ['fresh', 'hot when purchased', 'cold when purchased', 'good quality', 'dry', 'overcooked', 'undercooked concern', 'stale']
      : ['good condition', 'packaging damaged', 'seal issue', 'near expiration', 'good quality']
  const selectedGroup = storeGroups.find((group) => Number(group.store_id) === Number(storeId))
  const linkedReport = selectedGroup?.reports?.[0]
  const submit = async (event) => {
    event.preventDefault()
    try {
      await postJson('/api/quality-reviews', { product_id: product.id, store_id: storeId, price_report_id: linkedReport?.id, rating, tags, comment })
      setMessage('Thanks. Your quality observation is now visible.')
      setOpen(false); setRating(0); setComment(''); setTags([])
      reload()
    } catch (submitError) { setMessage(submitError.message) }
  }
  const markHelpful = async (reviewId) => {
    try { await postJson(`/api/quality-reviews/${reviewId}/helpful`, {}); setMessage('Marked helpful.'); reload() }
    catch (actionError) { setMessage(actionError.message) }
  }
  const reportReview = async (reviewId) => {
    try { await postJson(`/api/quality-reviews/${reviewId}/report`, { reason: reportReason }); setMessage('Review reported for moderation.'); setReportingId(null) }
    catch (actionError) { setMessage(actionError.message) }
  }
  const removeOwnReview = async (reviewId) => {
    if (!window.confirm('Remove your quality review?')) return
    try { await apiFetch(`/api/quality-reviews/${reviewId}`, { method: 'DELETE' }); setMessage('Review removed.'); reload() }
    catch (actionError) { setMessage(actionError.message) }
  }
  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100" aria-labelledby="quality-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="quality-heading" className="text-xl font-black text-slate-950">Quality at these stores</h2><p className="mt-1 font-semibold text-slate-500">Recent conditions are separate from price accuracy.</p></div>
        <button type="button" onClick={() => me?.loggedIn ? setOpen((value) => !value) : setMessage('Sign in to rate your purchase.')} className="rounded-full bg-emerald-700 px-5 py-3 font-black text-white">Rate your purchase</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3" aria-label="Quality rating summary">
        <span className="rounded-full bg-amber-50 px-3 py-2 font-black text-amber-900">Recent: {quality.recent_rating ? `${quality.recent_rating} / 5` : 'No ratings yet'} ({quality.recent_count || 0})</span>
        <span className="rounded-full bg-slate-100 px-3 py-2 font-black text-slate-700">All time: {quality.all_time_rating ? `${quality.all_time_rating} / 5` : 'No ratings yet'} ({quality.all_time_count || 0})</span>
      </div>
      {message ? <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">{message}</p> : null}
      {open ? <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
        <label className="block font-black">Store<select className="field mt-1" value={storeId} onChange={(event) => setStoreId(event.target.value)} required><option value="">Choose store</option>{storeGroups.map((group) => <option key={group.store_id} value={group.store_id}>{group.store_name}</option>)}</select></label>
        <fieldset><legend className="font-black">Quality</legend><div className="mt-2 flex flex-wrap gap-2">{[1,2,3,4,5].map((value) => <label key={value} className={`min-h-12 cursor-pointer rounded-xl px-3 py-3 font-black ring-2 ${rating === value ? 'bg-amber-100 ring-amber-500' : 'bg-white ring-slate-200'}`}><input className="sr-only" type="radio" name="quality-rating" value={value} checked={rating === value} onChange={() => setRating(value)} required />{value} <Star className="inline h-4 w-4" aria-hidden="true" /><span className="sr-only"> out of 5</span></label>)}</div></fieldset>
        <fieldset><legend className="font-black">Optional observations</legend><div className="mt-2 flex flex-wrap gap-2">{availableTags.map((tag) => <label key={tag} className="rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-slate-200"><input type="checkbox" className="mr-2" checked={tags.includes(tag)} onChange={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} />{titleCase(tag)}</label>)}</div></fieldset>
        <label className="block font-black">Short comment (optional)<textarea className="field mt-1" rows="3" maxLength="400" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        <button type="submit" className="min-h-12 rounded-xl bg-emerald-700 px-5 font-black text-white">Submit review</button>
      </form> : null}
      <div className="mt-5 space-y-3">{(quality.reviews || []).map((review) => <article key={review.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{review.username}</strong><span className="font-black" aria-label={review.rating_label}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)} · {review.rating_label}</span></div><p className="mt-1 text-sm font-bold text-slate-500">{review.store_name} · {shortDate(review.review_date)} {review.verified_purchase ? '· ✓ Verified purchase' : ''}</p>{review.comment ? <p className="mt-2 font-semibold text-slate-700">“{review.comment}”</p> : null}{review.tags?.length ? <p className="mt-2 text-sm font-bold text-slate-500">{review.tags.map(titleCase).join(' · ')}</p> : null}<div className="mt-3 flex flex-wrap items-center gap-2">{me?.loggedIn && !review.is_owner ? <><button type="button" onClick={() => markHelpful(review.id)} className="min-h-11 rounded-xl bg-white px-3 font-bold ring-1 ring-slate-200">Helpful ({review.helpful_count || 0})</button><button type="button" onClick={() => setReportingId(reportingId === review.id ? null : review.id)} className="min-h-11 rounded-xl bg-white px-3 font-bold ring-1 ring-slate-200">Report review</button></> : null}{review.is_owner ? <button type="button" onClick={() => removeOwnReview(review.id)} className="min-h-11 rounded-xl bg-white px-3 font-bold text-rose-700 ring-1 ring-rose-200">Remove my review</button> : null}</div>{reportingId === review.id ? <div className="mt-3 flex flex-wrap items-end gap-2"><label className="font-bold">Reason<select className="field mt-1" value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="offensive">Offensive</option><option value="not about this product">Not about this product</option><option value="misleading">Misleading</option><option value="safety concern">Safety concern</option><option value="other">Other</option></select></label><button type="button" onClick={() => reportReview(review.id)} className="min-h-12 rounded-xl bg-slate-800 px-4 font-black text-white">Send report</button></div> : null}</article>)}</div>
      <p className="mt-4 text-sm font-semibold text-slate-500">Quality comments are community observations and may vary by purchase.</p>
    </section>
  )
}

function ActionButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 p-3 text-center font-black text-slate-800 ring-1 ring-slate-100"
    >
      <Icon className="h-6 w-6 text-emerald-700" />
      {label}
    </button>
  )
}

function DealsScreen({ arena, loading, error, openProduct, reload, onControlsChange, controls, section, onSectionChange }) {
  const leaderboard = arena?.leaderboard || {}
  const drops = arena?.price_drops || []
  const routeTitle = { home: 'Savings across every store', drops: 'Price Drops', showdown: 'Janesville Store Showdown', categories: "Who's cheaper by category?" }[section] || 'Savings across every store'
  return <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
    <ScreenTitle eyebrow="Janesville price arena" title={routeTitle} subtitle="All active Janesville stores compete when Grocery Radar has current, comparable, verified prices." />
    {section === 'home' ? <section className="grid gap-4 sm:grid-cols-3" aria-label="Savings destinations">{[['drops','Price Drops','See verified prices that decreased around Janesville.'],['showdown','Store Showdown','Compare which stores had the lowest verified prices.'],['categories','By Category','Compare current store leaders across grocery categories.']].map(([id,title,body]) => <button key={id} type="button" onClick={() => onSectionChange(id)} className="min-h-40 rounded-2xl bg-white p-5 text-left shadow-soft ring-1 ring-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"><p className="text-2xl font-black">{title}</p><p className="mt-2 font-semibold text-slate-600">{body}</p><span className="mt-4 block font-black text-emerald-700">Open page →</span></button>)}</section> : null}
    {section !== 'home' ? <>
    <section className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:grid-cols-2 lg:grid-cols-5">
      <label className="font-black text-slate-700">Time window<select className="field mt-1" value={controls.window} onChange={(event) => onControlsChange({ window: event.target.value })}><option value="today">Today</option><option value="week">This week</option><option value="last7">Last 7 days</option></select></label>
      <label className="font-black text-slate-700">Offer rules<select className="field mt-1" value={controls.mode} onChange={(event) => onControlsChange({ mode: event.target.value })}><option value="all">All valid offers</option><option value="unconditional">No special requirements</option></select></label>
      <label className="font-black text-slate-700">Store<select className="field mt-1" value={controls.store_id} onChange={(event) => onControlsChange({ store_id: event.target.value })}><option value="">All stores</option>{(arena?.eligible_stores || []).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label className="font-black text-slate-700">Category<select className="field mt-1" value={controls.category} onChange={(event) => onControlsChange({ category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
      <label className="font-black text-slate-700">Price-drop order<select className="field mt-1" value={controls.sort} onChange={(event) => onControlsChange({ sort: event.target.value })}><option value="newest">Newest</option><option value="percent">Biggest % drop</option><option value="dollars">Biggest dollar savings</option><option value="ending">Ending soon</option></select></label>
    </section>
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Savings pages">{[['home','Savings Home'],['drops','Price Drops'],['showdown','Store Showdown'],['categories','By Category']].map(([id,label]) => <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => onSectionChange(id)} className={`min-h-12 rounded-full px-5 font-black ${section === id ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{label}</button>)}</nav>
    {loading ? <LoadingCard label="Calculating current verified comparisons..." /> : null}
    {error ? <ApiError message={error} onRetry={reload} /> : null}
    {!loading && section === 'drops' ? <section><SectionHeader title="What got cheaper around Janesville?" />{drops.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{drops.map((drop) => <article key={`${drop.type}-${drop.report.id}`} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><p className="text-xs font-black uppercase text-emerald-700">{drop.label}</p><h2 className="mt-2 text-xl font-black">{drop.report.product_name}</h2><p className="font-bold text-slate-500">{drop.report.store_name}</p><p className="mt-3 text-sm font-bold text-slate-500">Was {money(drop.previous_price)}</p><p className="text-3xl font-black text-emerald-700">Now {money(drop.current_price)}</p><p className="mt-1 font-black">↓ {money(drop.dollar_drop)} / {drop.percent_drop}%</p><PromotionDetails report={drop.report} /><button type="button" onClick={() => openProduct(drop.report.product_id)} className="mt-4 min-h-11 w-full rounded-xl bg-slate-100 font-black">Compare stores</button></article>)}</div> : <EmptyState title="No verified price drops yet" body="A drop appears only after Grocery Radar has a legitimate comparable previous price." icon={Tag} />}</section> : null}
    {!loading && section === 'showdown' ? <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100"><SectionHeader title="Janesville Store Showdown" /><p className="font-bold text-slate-500">{arena?.window?.label} · {leaderboard.comparable_product_count || 0} comparable products</p><div className="mt-4 space-y-2">{(leaderboard.rankings || []).map((row,index) => <div key={row.store_id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="font-black">#{index + 1} {row.store_name}</p><p className="text-sm font-bold text-slate-500">{row.current_price_count} current prices · {row.tied_lowest_count} ties</p></div><p className="text-right font-black text-emerald-800">Lowest on {row.lowest_count}</p></div>)}</div><p className="mt-4 rounded-xl bg-amber-50 p-3 font-bold text-amber-900">{leaderboard.status_message} Based only on products currently verified in Grocery Radar. Coverage varies by store.</p></section> : null}
    {!loading && section === 'categories' ? <section><SectionHeader title="Who's cheaper by category?" /><div className="grid gap-4 sm:grid-cols-2">{(arena?.categories || []).map((category) => <article key={category.category} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><h2 className="text-xl font-black">{titleCase(category.category)}</h2><p className="text-sm font-bold text-slate-500">{category.comparable_product_count} comparable products</p><div className="mt-3 space-y-2">{category.rankings.slice(0,5).map((row) => <div key={row.store_id} className="flex justify-between gap-3"><span className="font-bold">{row.store_name}</span><span className="font-black">Lowest on {row.lowest_count}</span></div>)}</div></article>)}</div>{!arena?.categories?.length ? <EmptyState title="Limited category data" body="Category comparisons appear as comparable verified prices grow." icon={Store} /> : null}</section> : null}
    <p className="mt-5 text-sm font-bold text-slate-500">{arena?.disclaimer || 'Missing store prices are never treated as higher prices.'}</p>
    </> : null}
  </div>
}

function PolicyScreen({ type, openScreen }) {
  const privacy = type === 'privacy'
  return <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
    <button type="button" onClick={() => openScreen('home')} className="mb-4 min-h-11 rounded-full bg-white px-4 font-black ring-1 ring-slate-200">Back to Grocery Radar</button>
    <ScreenTitle eyebrow="Grocery Radar Janesville" title={privacy ? 'Privacy Policy' : 'Terms of Use'} subtitle={privacy ? 'How Grocery Radar handles public shopping, submissions, and operational data.' : 'Plain-language operating terms for this beta price-information service.'} />
    <article className="space-y-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      {privacy ? <>
        <section><h2 className="text-xl font-black">No public shopper account required</h2><p className="mt-1 font-semibold text-slate-600">Anonymous submission tracking and My List data are stored locally in the shopper’s browser. Staff authentication remains separate.</p></section>
        <section><h2 className="text-xl font-black">Proofs and search demand</h2><p className="mt-1 font-semibold text-slate-600">Proof uploads are private moderation evidence. Aggregate search demand stores normalized queries, result counts, counts, and time—not shopper accounts, emails, full IP addresses, or device fingerprints.</p></section>
        <section><h2 className="text-xl font-black">Operational information</h2><p className="mt-1 font-semibold text-slate-600">Data is used to review submissions, publish approved prices, identify catalog gaps, and prevent abuse. This page describes the current architecture and may require formal legal review before broad commercial launch.</p></section>
      </> : <>
        <section><h2 className="text-xl font-black">Prices may change</h2><p className="mt-1 font-semibold text-slate-600">Always verify grocery prices, availability, and promotion conditions at the store before buying.</p></section>
        <section><h2 className="text-xl font-black">Independent service</h2><p className="mt-1 font-semibold text-slate-600">Grocery Radar is not affiliated with or endorsed by listed retailers unless explicitly stated.</p></section>
        <section><h2 className="text-xl font-black">Appropriate use</h2><p className="mt-1 font-semibold text-slate-600">Upload only lawful grocery evidence you may provide. Fabricated prices, spam, private documents, payment information, executable content, and abusive material are prohibited. Formal legal review is recommended before major commercial launch.</p></section>
      </>}
    </article>
  </div>
}

function NotFoundScreen({ openScreen }) {
  return <div className="mx-auto w-full max-w-2xl px-4 pt-10 text-center sm:px-6">
    <ScreenTitle eyebrow="Grocery Radar" title="Page not found" subtitle="That Grocery Radar page does not exist or its link is no longer valid." />
    <button type="button" onClick={() => openScreen('home')} className="min-h-12 rounded-2xl bg-emerald-700 px-6 font-black text-white">Go Home</button>
  </div>
}

function AuthGate({ me, onAuthChanged, title = 'Sign in to continue', body = 'Legacy accounts can still sign in for saved lists and points. Shopping and proof submission need no account.' }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [status, setStatus] = useState({ loading: false, error: '', message: '' })

  const submit = async (event) => {
    event.preventDefault()
    setStatus({ loading: true, error: '', message: '' })
    try {
      await postJson('/api/auth/login', { email: form.email, password: form.password })
      setStatus({ loading: false, error: '', message: 'Logged in.' })
      await onAuthChanged()
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: '' })
    }
  }

  if (me.loading) return <LoadingCard label="Checking account session..." />

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
          <LogIn className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 font-semibold text-slate-600">{body}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <input
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold outline-none focus:border-emerald-500"
          placeholder="Email"
          aria-label="Email"
          type="email"
          autoComplete="email"
        />
        <input
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold outline-none focus:border-emerald-500"
          placeholder="Password"
          aria-label="Password"
          type="password"
          autoComplete="current-password"
        />
        {status.error ? <p className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-800">{status.error}</p> : null}
        {status.message ? <p className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">{status.message}</p> : null}
        <button
          type="submit"
          disabled={status.loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-lift disabled:opacity-60"
        >
          {status.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
          Log in
        </button>
      </form>
    </section>
  )
}

function CartScreen({ cart, comparison, cartMode, setCartMode, offerMode, setOfferMode, loading, error, openScreen, reload, updateCartItem, removeCartItem, clearCart, onUseSubstitute }) {
  const [substituteState, setSubstituteState] = useState({ loading: false, items: [], message: '' })
  const [ignoredSubstitutes, setIgnoredSubstitutes] = useState(() => { try { return JSON.parse(window.localStorage.getItem(substitutionPreferenceKey) || '{}') } catch { return {} } })
  const findSubstitutes = async () => {
    setSubstituteState({ loading: true, items: [], message: '' })
    try {
      const results = await Promise.all((cart?.items || []).filter((item) => item.product_id && !ignoredSubstitutes[item.product_id]).map(async (item) => ({ item, data: await getJson(`/api/savings/products/${item.product_id}/substitutes?mode=${offerMode}`) })))
      const items = results.flatMap(({ item, data }) => (data.substitutes || []).filter((candidate) => candidate.potential_savings).map((candidate) => ({ original: item, candidate })))
      setSubstituteState({ loading: false, items, message: items.length ? '' : 'No cheaper human-confirmed substitutes are available for this list yet.' })
    } catch (findError) { setSubstituteState({ loading: false, items: [], message: findError.message }) }
  }
  const ignore = (productId) => { const next = { ...ignoredSubstitutes, [productId]: true }; setIgnoredSubstitutes(next); window.localStorage.setItem(substitutionPreferenceKey, JSON.stringify(next)); setSubstituteState((current) => ({ ...current, items: current.items.filter((entry) => Number(entry.original.product_id) !== Number(productId)) })) }
  const selected = comparison?.selected
  const one = comparison?.best_one_store
  const two = comparison?.best_two_stores
  const savings = one && selected && one.matched_count === selected.matched_count ? Math.max(0, one.estimated_total - selected.estimated_total) : 0
  return <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
    <ScreenTitle eyebrow="My List · no shopper account required" title="Cheapest Basket" subtitle="Compare one-store, two-store, or all-store plans. Anonymous lists stay on this device; legacy signed-in lists remain supported." />
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Maximum stores">{[['1','One store'],['2','Two stores'],['any','Any stores']].map(([value,label]) => <button key={value} type="button" onClick={() => setCartMode(value)} className={`min-h-12 rounded-full px-5 font-black ${cartMode === value ? 'bg-emerald-700 text-white' : 'bg-white ring-1 ring-slate-200'}`}>{label}</button>)}<button type="button" onClick={() => setOfferMode(offerMode === 'all' ? 'unconditional' : 'all')} className="min-h-12 rounded-full bg-white px-5 font-black ring-1 ring-slate-200">{offerMode === 'all' ? 'Including conditional offers' : 'No special requirements'}</button></div>
    {loading ? <LoadingCard label="Optimizing current verified prices..." /> : null}{error ? <ApiError message={error} onRetry={reload} /> : null}
    <section className="grid gap-3 sm:grid-cols-3"><SummaryCard icon={Store} label="Best one-store" value={one?.stores?.map((store) => store.name).join(' + ') || 'Need prices'} note={one ? `${one.matched_count}/${one.requested_count} matched · ${money(one.estimated_total)}` : 'No comparable plan'} /><SummaryCard icon={Store} label="Best two-store" value={two?.stores?.map((store) => store.name).join(' + ') || 'Need prices'} note={two ? `${two.matched_count}/${two.requested_count} matched · ${money(two.estimated_total)}` : 'No comparable plan'} /><SummaryCard icon={CircleDollarSign} label="Selected plan" value={selected ? money(selected.estimated_total) : '$0.00'} note={savings > 0 ? `${money(savings)} below best one-store plan` : 'Approved current prices only'} /></section>
    {selected ? <section className="mt-5 rounded-2xl bg-emerald-700 p-5 text-white"><p className="text-sm font-black text-emerald-100">CHEAPEST {cartMode === '1' ? 'ONE-STORE' : cartMode === '2' ? 'TWO-STORE' : 'ALL-STORE'} PLAN</p><h2 className="mt-1 text-3xl font-black">{selected.stores?.map((store) => store.name).join(' + ') || 'No matched store'}</h2><p className="mt-2 text-4xl font-black">{money(selected.estimated_total)}</p><p className="mt-2 font-bold">{selected.matched_count} of {selected.requested_count} products matched</p></section> : null}
    {comparison?.coverage_warning ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 font-bold text-amber-900"><AlertTriangle className="mr-2 inline h-5 w-5" />{comparison.coverage_warning}</p> : null}
    {selected?.matches?.length ? <section className="mt-5 space-y-3"><SectionHeader title="Shopping plan" />{selected.matches.map((match) => <article key={`${match.item.product_id}-${match.report.store_id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><div><h3 className="font-black">{displayText(match.item.item_name || match.report.product_name)}</h3><p className="text-sm font-bold text-slate-500">{match.report.store_name} · {match.report.promotion_conditions || 'No special requirement shown'}</p></div><p className="text-xl font-black text-emerald-700">{money(match.line_total)}</p></article>)}</section> : null}
    {comparison?.comparable_subset ? <p className="mt-4 text-sm font-bold text-slate-500">Comparable subset across every participating store: {comparison.comparable_subset.product_count} products. Partial store totals are never ranked as complete totals.</p> : null}
    <section className="mt-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Save with substitutes</h2><p className="font-bold text-slate-500">Different products are always labeled, and your list changes only when you choose.</p></div><button type="button" onClick={findSubstitutes} disabled={substituteState.loading} className="min-h-12 rounded-xl bg-emerald-700 px-5 font-black text-white">{substituteState.loading ? 'Checking…' : 'Find cheaper substitutes'}</button></div>{substituteState.message ? <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 font-bold text-amber-900">{substituteState.message}</p> : null}<div className="mt-3 grid gap-3 sm:grid-cols-2">{substituteState.items.map(({ original, candidate }) => <article key={`${original.id}-${candidate.id}`} className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-800">{candidate.substitution_type === 'alternative' ? 'Alternative product' : 'Very similar product'}</p><p className="mt-2 font-bold text-slate-500">Instead of {original.product_display_name || original.item_name}</p><h3 className="text-xl font-black">{candidate.product_name}</h3><p className="font-bold">{candidate.cheapest?.store_name} · {candidate.cheapest?.price_label || money(candidate.cheapest?.price)}</p><p className="mt-1 font-black text-emerald-800">Potential savings {money(candidate.potential_savings)}</p><p className="mt-2 text-sm font-bold text-slate-600">Why suggested: {(candidate.reasons || []).join(' · ') || 'Human-confirmed comparable product family.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onUseSubstitute(original, candidate)} className="min-h-11 rounded-xl bg-emerald-700 px-4 font-black text-white">Use Substitute</button><button type="button" onClick={() => setSubstituteState((current) => ({ ...current, items: current.items.filter((entry) => !(String(entry.original.id) === String(original.id) && Number(entry.candidate.id) === Number(candidate.id))) }))} className="min-h-11 rounded-xl bg-white px-4 font-black">Keep Original</button><button type="button" onClick={() => ignore(original.product_id)} className="min-h-11 rounded-xl bg-white px-4 font-black">Don’t Suggest Again</button></div></article>)}</div></section>
    <section className="mt-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><div className="flex items-center justify-between"><h2 className="text-xl font-black">My List Items</h2><button type="button" onClick={clearCart} className="min-h-11 rounded-xl bg-slate-100 px-4 font-black"><Trash2 className="mr-2 inline h-4 w-4" />Clear</button></div><div className="mt-3 space-y-2">{(cart?.items || []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate font-black">{item.product_display_name || item.item_name}</p><p className="text-sm font-bold text-slate-500">{item.size_preference || 'Catalog product'}</p></div><div className="flex items-center gap-2"><button type="button" className="h-11 w-11 rounded-full bg-white font-black" aria-label={`Decrease ${item.item_name}`} onClick={() => updateCartItem(item, Math.max(1, Number(item.quantity_needed || 1) - 1))}>−</button><strong>{item.quantity_needed || 1}</strong><button type="button" className="h-11 w-11 rounded-full bg-white font-black" aria-label={`Increase ${item.item_name}`} onClick={() => updateCartItem(item, Number(item.quantity_needed || 1) + 1)}>+</button><button type="button" className="h-11 w-11 rounded-full bg-white" aria-label={`Remove ${item.item_name}`} onClick={() => removeCartItem(item.id)}><Trash2 className="mx-auto h-5 w-5" /></button></div></div>)}{!cart?.items?.length ? <EmptyState title="Your list is empty" body="Add products to compare every active Janesville store." icon={ShoppingCart} /> : null}</div></section>
    <button type="button" onClick={() => openScreen('search')} className="mt-5 min-h-14 w-full rounded-2xl bg-emerald-700 px-5 text-lg font-black text-white">Add another item</button>
  </div>
}

function _LegacyCartScreen({ me, cart, comparison, cartMode, setCartMode, loading, error, openScreen, reload, onAuthChanged, updateCartItem, removeCartItem, clearCart }) {
  if (!me.loggedIn) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
        <AuthGate me={me} onAuthChanged={onAuthChanged} title="Log in to compare My List" />
      </div>
    )
  }

  const selected = comparison?.modes?.[cartMode] || comparison?.cheapest_split_cart
  const split = comparison?.modes?.cheapest_split
  const single = comparison?.modes?.best_one_store
  const plan = comparison?.shopping_plan || {}
  const firstStop = plan.best_first_stop
  const secondStop = plan.second_best_store
  const savings = split && single && single.estimated_total > split.estimated_total
    ? single.estimated_total - split.estimated_total
    : 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="My List"
        title="Compare My Grocery List"
        subtitle="See estimated totals by store using approved prices only."
      />
      {loading ? <LoadingCard label="Loading My List comparison..." /> : null}
      {error ? <ApiError message={error} onRetry={reload} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Store}
          label="Best first stop"
          value={firstStop?.store_name || comparison?.best_single_store_match?.store_name || 'Need prices'}
          note={firstStop ? `${firstStop.matched_count} of ${firstStop.cart_count} items priced` : 'Add approved-price items'}
        />
        <SummaryCard
          icon={ReceiptText}
          label="Estimated total"
          value={firstStop ? money(firstStop.estimated_total) : selected ? money(selected.estimated_total) : '$0.00'}
          note="Approved prices only"
        />
        <SummaryCard
          icon={CircleDollarSign}
          label="Estimated savings"
          value={savings > 0 ? money(savings) : 'Need match'}
          note="Split vs one-store estimate"
        />
      </section>

      <section className="mt-5 rounded-2xl bg-emerald-700 p-5 text-white shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-emerald-100">Best first stop</p>
            <h2 className="mt-1 text-3xl font-black">{firstStop?.store_name || 'No first stop yet'}</h2>
            <p className="mt-2 font-bold text-emerald-50">
              {firstStop?.summary || plan.summary || 'Add products with approved prices to compare stores.'}
            </p>
            <p className="mt-2 text-sm font-black text-emerald-100">{plan.label || 'Estimated from approved prices only.'}</p>
          </div>
          <StoreLogo store={{ name: firstStop?.store_name }} size="lg" />
        </div>
        {firstStop?.items?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {firstStop.items.map((match, index) => (
              <div key={`${match.cart_item?.id || index}-${match.report?.id || index}`} className="rounded-2xl bg-white/12 p-3">
                <p className="font-black">{displayText(match.cart_item?.product_display_name || match.cart_item?.item_name)}</p>
                <p className="text-sm font-bold text-emerald-50">{match.report?.price_label || money(match.report?.price)} | {match.report?.unit_price_label || match.report?.size_text}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {secondStop ? (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <StoreLogo store={{ name: secondStop.store_name }} />
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-slate-400">Second-best store</p>
              <h2 className="truncate text-xl font-black text-slate-950">{secondStop.store_name}</h2>
              <p className="font-semibold text-slate-600">
                {secondStop.matched_count} more item{secondStop.matched_count === 1 ? '' : 's'} with approved prices, estimated {money(secondStop.estimated_total)}.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[
          ['cheapest_split', 'Cheapest'],
          ['best_one_store', 'One store'],
          ['best_balance', 'Balance'],
          ['high_confidence', 'Verified'],
          ['avoid_list_careful', 'Avoid list'],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCartMode(mode)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-black shadow-sm ${
              cartMode === mode ? 'bg-emerald-700 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected?.missing_items?.length ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0" />
            <div>
              <p className="font-black">Missing price warning</p>
              <p className="mt-1 font-semibold">
                {selected.missing_items.length} item{selected.missing_items.length === 1 ? '' : 's'} still {selected.missing_items.length === 1 ? 'needs' : 'need'} approved price data: {selected.missing_items.map((item) => item.product_display_name || item.item_name).join(', ')}.
              </p>
              <p className="mt-1 text-sm font-black">Do not treat this estimate as a complete grocery-list total.</p>
            </div>
          </div>
        </div>
      ) : null}

      {plan.remaining_items?.length ? (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
          <SectionHeader title="Remaining Items" />
          <p className="font-semibold text-slate-600">
            {plan.remaining_items.length} item{plan.remaining_items.length === 1 ? ' is' : 's are'} not covered by the first two store suggestions.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.remaining_items.map((item) => (
              <span key={`${item.id}-${item.item_name}`} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                {displayText(item.product_display_name || item.item_name)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 space-y-4">
        {selected?.store_breakdown?.map((group) => (
          <article key={group.store_id || group.store_name} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <StoreLogo store={{ name: group.store_name }} />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-slate-950">{group.store_name}</h2>
                  <p className="text-sm font-semibold text-slate-500">{group.matched_count} matched item{group.matched_count === 1 ? '' : 's'}</p>
                </div>
              </div>
              <p className="text-xl font-black text-slate-950">{money(group.estimated_total)}</p>
            </div>
            <div className="mt-4 space-y-2">
              {group.items.map((item, index) => (
                <div key={`${item.item_name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="font-black text-slate-900">{item.item_name}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {[item.unit_price_label, item.size_text].filter(Boolean).join(' | ') || 'Approved price'}
                    </p>
                  </div>
                  <p className="text-lg font-black text-emerald-700">{item.price_label}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-950">My List Items</h2>
          <button type="button" onClick={clearCart} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {(cart?.items || []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="truncate font-black text-slate-950">{item.product_display_name || item.item_name}</p>
                <p className="text-sm font-semibold text-slate-500">{titleCase(item.category)} {item.size_preference ? `| ${item.size_preference}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCartItem(item, Math.max(1, Number(item.quantity_needed || 1) - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-slate-700 ring-1 ring-slate-100"
                  aria-label={`Decrease ${item.product_display_name || item.item_name} quantity`}
                >
                  -
                </button>
                <span className="min-w-8 text-center text-lg font-black text-slate-900">{Number(item.quantity_needed || 1)}</span>
                <button
                  type="button"
                  onClick={() => updateCartItem(item, Number(item.quantity_needed || 1) + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-emerald-700 ring-1 ring-emerald-100"
                  aria-label={`Increase ${item.product_display_name || item.item_name} quantity`}
                >
                  +
                </button>
                <button type="button" onClick={() => removeCartItem(item.id)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-100" aria-label={`Remove ${item.product_display_name || item.item_name}`}>
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {!cart?.items?.length ? <EmptyState title="Your list is empty" body="Add products or approved reports to compare stores." icon={ShoppingCart} /> : null}
        </div>
      </section>

      <button
        type="button"
        onClick={() => openScreen('search')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-lift"
      >
        <Search className="h-6 w-6" />
        Add another item
      </button>
    </div>
  )
}

function SubmitScreen({ stores, selectedProduct, openScreen, setSelectedProofId }) {
  const initialForm = {
    store_id: stores[0]?.id || '',
    proof_type: 'receipt',
    notes: '',
    source_url: '',
    item_hint: selectedProduct?.display_name || '',
    price_hint: '',
    proof_photo: null,
  }
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ loading: false, error: '', message: '', result: null })

  useEffect(() => {
    setForm((current) => ({
      ...current,
      store_id: current.store_id || stores[0]?.id || '',
      item_hint: selectedProduct?.display_name || current.item_hint,
    }))
  }, [selectedProduct, stores])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    const sourceUrl = form.source_url.trim()

    if (!form.store_id) {
      setStatus({
        loading: false,
        error: 'Choose a store before submitting proof.',
        message: '',
        result: null,
      })
      return
    }

    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      setStatus({
        loading: false,
        error: 'Source link must start with http:// or https://.',
        message: '',
        result: null,
      })
      return
    }

    if (!form.proof_photo && !sourceUrl) {
      setStatus({
        loading: false,
        error: 'Upload a proof image or add a source link.',
        message: '',
        result: null,
      })
      return
    }

    setStatus({ loading: true, error: '', message: '', result: null })
    try {
      const payload = new FormData()
      payload.append('store_id', form.store_id)
      payload.append('proof_type', form.proof_type)
      payload.append('notes', form.notes)
      payload.append('item_hint', form.item_hint)
      payload.append('price_hint', form.price_hint)
      if (sourceUrl) {
        payload.append('source_url', sourceUrl)
      }
      if (form.proof_photo) {
        payload.append('proof_photo', form.proof_photo)
      }
      const result = await apiFetch('/api/proof-submissions', { method: 'POST', body: payload })
      if (result.tracking_token) saveTrackedSubmission({ token: result.tracking_token, submitted_at: new Date().toISOString(), store_name: stores.find((store) => String(store.id) === String(form.store_id))?.name || '', proof_type: form.proof_type, last_status: 'waiting_for_review' })
      setStatus({
        loading: false,
        error: '',
        message: 'Proof accepted for review.',
        result,
      })
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: '', result: null })
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="Submit Proof"
        title="Submit Proof"
        subtitle="Upload a receipt, shelf tag, weekly ad, screenshot, or source link. We will review it and add useful prices."
      />
      <button type="button" onClick={() => openScreen('submissions')} className="mb-4 min-h-12 rounded-2xl bg-emerald-50 px-4 font-black text-emerald-800 ring-1 ring-emerald-100">My Submissions</button>

      <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="space-y-5">
          <FormStep number="1" label="Choose proof type">
            <select
              value={form.proof_type}
              onChange={(event) => update('proof_type', event.target.value)}
              className="field"
              aria-label="Proof type"
            >
              <option value="receipt">Receipt</option>
              <option value="shelf_tag">Shelf tag</option>
              <option value="weekly_ad">Weekly ad</option>
              <option value="store_page">Screenshot or source link</option>
            </select>
          </FormStep>

          <FormStep number="2" label="Upload image or paste a link">
            <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center font-black text-emerald-800">
              <Upload className="h-8 w-8" />
              {form.proof_photo ? form.proof_photo.name : 'Add receipt, shelf tag, or ad screenshot'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-label="Proof image"
                onChange={(event) => update('proof_photo', event.target.files?.[0] || null)}
              />
            </label>
            <p className="mt-2 text-sm font-bold text-slate-500">Photo is optional if you include a source link.</p>

            <input
              type="url"
              value={form.source_url}
              onChange={(event) => update('source_url', event.target.value)}
              className="field mt-3"
              placeholder="https://store.com/weekly-ad or product page"
              aria-label="Source link optional"
            />
            <p className="mt-2 text-sm font-bold text-slate-500">
              Add a store page, weekly ad, or product link if you have one.
            </p>
          </FormStep>

          <FormStep number="3" label="Store">
            <select
              value={form.store_id}
              onChange={(event) => update('store_id', event.target.value)}
              className="field"
              aria-label="Store"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            <p className="mt-2 text-sm font-bold text-slate-500">Choose the closest match so admin can review the proof faster.</p>
          </FormStep>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormStep number="4" label="Product name optional">
              <input
                value={form.item_hint}
                onChange={(event) => update('item_hint', event.target.value)}
                className="field"
                placeholder="Optional, like eggs or bananas"
                aria-label="Product name optional"
              />
            </FormStep>
            <FormStep number="5" label="Price optional">
              <div className="flex rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-emerald-500">
                <span className="flex items-center px-4 text-xl font-black text-slate-500">$</span>
                <input
                  value={form.price_hint}
                  onChange={(event) => update('price_hint', event.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-4 pr-4 text-lg font-bold text-slate-900 outline-none"
                  placeholder="Optional"
                  inputMode="decimal"
                  aria-label="Price optional"
                />
              </div>
            </FormStep>
          </div>

          <FormStep number="6" label="Notes optional">
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              className="field min-h-28"
              placeholder="Anything that helps the reviewer"
              aria-label="Notes optional"
            />
          </FormStep>
        </div>

        {status.error ? <p className="mt-5 rounded-2xl bg-rose-50 p-4 font-bold text-rose-800">{status.error}</p> : null}
        {status.message ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">
            {status.message}
            <p className="mt-1 text-sm text-emerald-700">It will not appear publicly until an admin reviews it.</p>
            <p className="mt-1 text-sm text-emerald-700">Return to My Submissions in this browser to see the result.</p>
            {status.result?.batch_id ? (
              <button
                type="button"
                onClick={() => {
                  if (status.result.tracking_token) openScreen('submissions')
                  else { setSelectedProofId(String(status.result.batch_id)); openScreen('profile') }
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100"
              >
                View proof status
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            disabled={status.loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-lift disabled:opacity-60"
          >
            {status.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
            Submit for review
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({ ...initialForm, store_id: form.store_id, proof_type: form.proof_type })
              setStatus({ loading: false, error: '', message: '', result: null })
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-4 text-lg font-black text-slate-800"
          >
            <Plus className="h-6 w-6" />
            Submit another proof
          </button>
        </div>
      </form>
    </div>
  )
}

function MySubmissionsScreen({ openScreen }) {
  const [state, setState] = useState({ loading: true, error: '', items: [] })
  const load = useCallback(async () => {
    const tracked = readTrackedSubmissions()
    if (!tracked.length) { setState({ loading: false, error: '', items: [] }); return }
    setState((current) => ({ ...current, loading: true, error: '' }))
    const results = await Promise.all(tracked.map(async (entry) => {
      try { const data = await getJson(`/api/submissions/status/${encodeURIComponent(entry.token)}`); return { ...entry, ...data.submission, unread: Boolean(entry.last_status && entry.last_status !== data.submission.status) } }
      catch { return { ...entry, status: 'unavailable', status_label: 'Status unavailable' } }
    }))
    const nextTracked = tracked.map((entry) => { const result = results.find((item) => item.token === entry.token); return { ...entry, last_status: result?.status || entry.last_status } })
    window.localStorage.setItem(submissionStorageKey, JSON.stringify(nextTracked))
    setState({ loading: false, error: '', items: results })
  }, [])
  useEffect(() => { load() }, [load])
  return <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
    <ScreenTitle eyebrow="Privacy-first tracking" title="My Submissions" subtitle="No account required. Results are available only to this browser using private tracking capabilities." />
    <button type="button" onClick={() => openScreen('submit')} className="mb-4 min-h-12 rounded-2xl bg-slate-100 px-4 font-black text-slate-800">Submit new proof</button>
    {state.loading ? <LoadingCard label="Checking submission results..." /> : null}
    <div className="space-y-4">{state.items.map((item) => <article key={item.token} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-emerald-700">{item.store_name || proofTypeLabel(item.proof_type)}</p><h2 className="mt-1 text-2xl font-black">{item.status_label}</h2>{item.unread ? <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-900">New result</span> : null}<p className="mt-1 font-semibold text-slate-500">Submitted {shortDate(item.submitted_at)}</p></div>{item.status === 'reviewed' ? <BadgeCheck className="h-8 w-8 text-emerald-700" /> : <Clock3 className="h-8 w-8 text-amber-600" />}</div>
      {item.status === 'reviewed' ? <div className="mt-4"><p className="font-black">{item.approved_count} approved · {item.not_approved_count} not approved</p>{item.outcome?.public_reason ? <p className="mt-2 rounded-2xl bg-rose-50 p-3 font-bold text-rose-800">Reason: {displayText(item.outcome.public_reason)}{item.outcome.public_explanation ? ` — ${item.outcome.public_explanation}` : ''}</p> : null}{item.outcome?.approved?.map((row, index) => <div key={`approved-${index}`} className="mt-3 rounded-2xl bg-emerald-50 p-4"><p className="font-black text-emerald-900">APPROVED · {row.product}</p><p className="text-xl font-black">{row.price}</p><p className="font-semibold">{row.store}{row.promotion_conditions ? ` · ${row.promotion_conditions}` : ''}{row.valid_through_date ? ` · Valid through ${shortDate(row.valid_through_date)}` : ''}</p></div>)}{item.outcome?.not_approved?.map((row, index) => <div key={`rejected-${index}`} className="mt-3 rounded-2xl bg-rose-50 p-4"><p className="font-black text-rose-900">NOT APPROVED · {row.product}</p><p className="font-semibold">Reason: {displayText(row.reason)}</p>{row.explanation ? <p>{row.explanation}</p> : null}</div>)}</div> : null}
    </article>)}</div>
    {!state.loading && !state.items.length ? <EmptyState title="No tracked submissions" body="Submit proof anonymously from this browser. Clearing browser storage or changing devices removes local tracking." icon={ReceiptText} /> : null}
  </div>
}

function FormStep({ number, label, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-base font-black text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-sm text-white">
          {number}
        </span>
        {label}
      </label>
      {children}
    </div>
  )
}

function ProofResultCard({ proof, loading, error, onRetry, openProduct }) {
  if (loading) return <LoadingCard label="Loading proof status..." />
  if (error) return <ApiError message={error} onRetry={onRetry} />
  if (!proof) return null

  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-emerald-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-emerald-700">Proof status</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{proof.status_label}</h2>
          <p className="mt-2 font-semibold text-slate-600">{proof.message}</p>
        </div>
        <FileCheck2 className="h-8 w-8 text-emerald-700" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <SummaryCard icon={Store} label="Store" value={proof.store_name || 'Unknown'} note={proofTypeLabel(proof.proof_type)} />
        <SummaryCard icon={Clock3} label="Submitted" value={shortDate(proof.submitted_at) || 'Recent'} note={timeAgo(proof.submitted_at)} />
        <SummaryCard icon={BadgeCheck} label="Reviewed" value={shortDate(proof.reviewed_at) || 'Not yet'} note={proof.status_label || 'Status'} />
        <SummaryCard icon={PackageCheck} label="Approved items" value={proof.approved_count || 0} note="Public after approval" />
        <SummaryCard icon={Star} label="Points earned" value={proof.points_earned || 0} note="Beta proof points" />
      </div>
      {proof.review_reason ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Review note: {proof.review_reason}
        </p>
      ) : null}
      {proof.source_url ? (
        <a href={proof.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
          View source
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      {proof.item_hint || proof.price_hint ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="font-black text-slate-950">Your hint</p>
          <p className="mt-1 font-semibold text-slate-600">
            {[proof.item_hint, proof.price_hint ? `$${proof.price_hint}` : ''].filter(Boolean).join(' | ')}
          </p>
        </div>
      ) : null}
      {proof.needs_resubmit ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-100">
          <p className="font-black">Send an updated proof</p>
          <p className="mt-1 text-sm font-bold">
            Upload a clearer photo or add the missing source link so admin can review it again.
          </p>
        </div>
      ) : null}
      {proof.approved_items?.length ? (
        <div className="mt-5 space-y-3">
          <SectionHeader title="Approved From This Proof" />
          {proof.approved_items.map((report) => (
            <ReportCard key={report.id} report={report} onOpenProduct={openProduct} compact />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
          No public prices have been approved from this proof yet.
        </p>
      )}
      <p className="mt-4 text-sm font-bold text-slate-500">{proof.privacy_note}</p>
    </section>
  )
}

function proofIdFromNotification(notification) {
  const params = new URLSearchParams(String(notification?.target_url || '').split('?')[1] || '')
  return notification?.related_import_batch_id || params.get('proof') || ''
}

function ProfileScreen({
  me,
  profileStats,
  engagement,
  reports,
  verifications,
  rewards,
  notifications,
  unreadNotifications,
  feedbackTickets,
  featureVotes,
  loading,
  error,
  onAuthChanged,
  openScreen,
  openProduct,
  onNotificationsChanged,
  selectedProofId,
  setSelectedProofId,
}) {
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState((me.user || me).username || '')
  const [proofState, setProofState] = useState({ loading: false, error: '', proof: null })
  const [feedbackForm, setFeedbackForm] = useState({
    category: 'bug',
    title: '',
    message: '',
    source_url: '',
  })
  const [feedbackStatus, setFeedbackStatus] = useState({ loading: false, error: '', message: '' })
  const [voteStatus, setVoteStatus] = useState({ loading: false, error: '', message: '' })

  useEffect(() => {
    setUsername((me.user || me).username || '')
  }, [me])

  const loadProof = useCallback(async (proofId = selectedProofId) => {
    if (!proofId || !me.loggedIn) return
    setProofState({ loading: true, error: '', proof: null })
    try {
      const data = await getJson(`/api/proof-submissions/${proofId}`)
      setProofState({ loading: false, error: '', proof: data.proof || null })
    } catch (loadError) {
      setProofState({ loading: false, error: loadError.message, proof: null })
    }
  }, [me.loggedIn, selectedProofId])

  useEffect(() => {
    if (selectedProofId && me.loggedIn) {
      loadProof(selectedProofId)
    }
  }, [loadProof, me.loggedIn, selectedProofId])

  if (!me.loggedIn) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
        <AuthGate me={me} onAuthChanged={onAuthChanged} title="Log in for profile and rewards" />
      </div>
    )
  }

  const user = me.user || me
  const points = Number(user.points || 0)
  const nextRule = (rewards?.reward_rules || []).find((rule) => Number(rule.points) > points)
  const progress = nextRule ? Math.min(100, Math.round((points / Number(nextRule.points)) * 100)) : 100

  const logout = async () => {
    await postJson('/api/auth/logout', {})
    await onAuthChanged()
  }

  const resend = async () => {
    setMessage('')
    try {
      const response = await postJson('/api/auth/resend-verification', {})
      setMessage(response.message || 'Verification email sent.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const saveUsername = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const response = await postJson('/api/account/username', { username })
      setMessage(response.message)
      await onAuthChanged()
    } catch (saveError) {
      setMessage(saveError.message)
    }
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    const sourceUrl = feedbackForm.source_url.trim()

    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      setFeedbackStatus({ loading: false, error: 'Source link must start with http:// or https://.', message: '' })
      return
    }

    setFeedbackStatus({ loading: true, error: '', message: '' })
    try {
      await postJson('/api/feedback', {
        ...feedbackForm,
        source_url: sourceUrl,
      })
      setFeedbackForm({ category: 'bug', title: '', message: '', source_url: '' })
      setFeedbackStatus({ loading: false, error: '', message: 'Feedback sent to Grocery Radar support.' })
      await onNotificationsChanged()
    } catch (submitError) {
      setFeedbackStatus({ loading: false, error: submitError.message, message: '' })
    }
  }

  const voteFeature = async (optionId) => {
    setVoteStatus({ loading: true, error: '', message: '' })
    try {
      await postJson(`/api/feature-votes/${optionId}/vote`, {})
      setVoteStatus({ loading: false, error: '', message: 'Vote saved.' })
      await onNotificationsChanged()
    } catch (voteError) {
      setVoteStatus({ loading: false, error: voteError.message, message: '' })
    }
  }

  const markNotificationRead = async (notificationId) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      await onNotificationsChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }
  const markAllNotificationsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' })
      await onNotificationsChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }
  const openNotification = async (notification) => {
    if (!notification) return
    if (!notification.is_read) {
      await markNotificationRead(notification.id)
    }
    if (notification.target_url?.startsWith('http')) {
      window.open(notification.target_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (notification.target_url?.startsWith('/admin.html')) {
      window.open(notification.target_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (notification.target_url?.includes('section=username') || notification.type === 'username_change_required') {
      openScreen('profile')
      window.setTimeout(() => document.querySelector('#profile-username')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      return
    }
    const proofId = proofIdFromNotification(notification)
    if (proofId) {
      setSelectedProofId(proofId)
      openScreen('profile')
      return
    }
    if (notification.related_report_id || notification.related_type === 'report') {
      openScreen('search')
      return
    }
    openScreen('profile')
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="Account"
        title="Account"
        subtitle="Track points, proof status, notifications, and rewards progress."
      />
      {loading ? <LoadingCard label="Loading profile activity..." /> : null}
      {error ? <ApiError message={error} /> : null}
      <ProofResultCard
        proof={proofState.proof}
        loading={proofState.loading}
        error={proofState.error}
        onRetry={() => loadProof(selectedProofId)}
        openProduct={openProduct}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Star} label="Points" value={points.toLocaleString()} note="Your total" />
        <SummaryCard icon={BadgeCheck} label="Rank" value={profileStats?.rank || rankForPoints(points)} note="Contributor level" />
        <SummaryCard icon={CircleDollarSign} label="This week" value={Number(profileStats?.points_this_week || 0).toLocaleString()} note="Recent earning" />
        <SummaryCard icon={BellRing} label="Unread" value={unreadNotifications} note="Tap updates below" />
      </section>

      <section className="mt-5 rounded-2xl bg-emerald-50 p-5 shadow-soft ring-1 ring-emerald-100">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-800">Visit streak</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{engagement?.streak?.current || 0} day streak</p>
        <p className="mt-2 font-bold text-slate-600">{engagement?.streak?.message || 'Welcome back. Start a new streak today.'}</p>
        <p className="mt-3 text-sm font-bold text-slate-500">Longest streak: {engagement?.streak?.longest || 0} days · Approved prices: {engagement?.contributions?.approved_prices || 0} · Receipts submitted: {engagement?.contributions?.receipts_submitted || 0}</p>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={FileCheck2} label="Proof accepted" value={profileStats?.proof_accepted_count || 0} note="Accepted by review" />
        <SummaryCard icon={PackageCheck} label="Prices helped add" value={profileStats?.approved_prices_from_proof || 0} note="Approved from your proof" />
        <SummaryCard icon={ShieldCheck} label="Trust score" value={`${profileStats?.accuracy_score ?? user.accuracy_score ?? 0}%`} note="Approved activity" />
      </section>

      <section className="mt-5 rounded-2xl bg-emerald-700 p-5 text-white shadow-lift">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-100">Community leaderboard</p>
            <h2 className="mt-1 text-2xl font-black">See top contributors</h2>
            <p className="mt-1 font-bold text-emerald-50">Only public usernames and points are shown.</p>
          </div>
          <button type="button" onClick={() => openScreen('leaderboard')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-lg font-black text-emerald-800">
            <UsersRound className="h-6 w-6" />
            Leaderboard
          </button>
        </div>
      </section>

      <section id="profile-username" className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <SectionHeader title="Public username" />
        <p className="mb-3 text-sm font-bold text-slate-600">
          This is the only account name shown on leaderboards. Emails and private proof details are never shown.
        </p>
        {(user.force_username_change || user.username_status === 'needs_change') ? (
          <p className="mb-3 rounded-2xl bg-amber-100 p-3 font-bold text-amber-900">
            Please choose a different username before appearing on leaderboards.
          </p>
        ) : null}
        <form onSubmit={saveUsername} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]+"
            aria-label="Public username"
            className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 font-bold"
          />
          <button type="submit" className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white">Save username</button>
        </form>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <SectionHeader title="Rewards Progress" />
        <div className="h-5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 font-bold text-slate-600">
          {rewards?.beta_rewards_message || 'Beta points help track trusted proof contributors. They are not cash or guaranteed rewards.'}
        </p>
        <p className="mt-2 text-sm font-bold text-slate-500">
          {nextRule ? `${points} of ${nextRule.points} points toward ${nextRule.label}.` : 'Highest listed beta point tier reached.'}
        </p>
        {!user.is_email_verified ? (
          <button type="button" onClick={resend} className="mt-4 rounded-2xl bg-emerald-700 px-4 py-3 font-black text-white">
            Resend verification email
          </button>
        ) : null}
        {message ? <p className="mt-3 rounded-2xl bg-slate-100 p-3 font-bold text-slate-700">{message}</p> : null}
      </section>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader title="Notifications" />
          {unreadNotifications ? (
            <div className="flex items-center gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800">{unreadNotifications} unread</span><button type="button" onClick={markAllNotificationsRead} className="rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">Mark all read</button></div>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              role="button"
              tabIndex={0}
              onClick={() => openNotification(notification)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openNotification(notification)
                }
              }}
              className={`cursor-pointer rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${notification.is_read ? 'bg-slate-50 ring-slate-100' : 'bg-emerald-50 ring-emerald-100'}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-emerald-800 shadow-sm">
                  {notification.type?.includes('reject') ? <AlertTriangle className="h-5 w-5" /> : notification.points_awarded ? <Star className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{notificationMessage(notification)}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">{timeAgo(notification.created_at)}</p>
                </div>
                {!notification.is_read ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      markNotificationRead(notification.id)
                    }}
                    className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-100"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!notifications.length ? <EmptyState title="No notifications yet" body="Proof updates and points will appear here." icon={BellRing} /> : null}
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <SectionHeader title="Send feedback" />
          <form onSubmit={submitFeedback} className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Category</span>
              <select
                value={feedbackForm.category}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, category: event.target.value }))}
                className="field"
              >
                <option value="bug">Bug</option>
                <option value="feature_request">Feature request</option>
                <option value="wrong_price">Wrong price</option>
                <option value="wrong_product">Wrong product</option>
                <option value="store_issue">Store issue</option>
                <option value="question">Question</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Title</span>
              <input
                value={feedbackForm.title}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, title: event.target.value }))}
                className="field"
                maxLength={160}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Details</span>
              <textarea
                value={feedbackForm.message}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, message: event.target.value }))}
                className="field min-h-28"
                maxLength={2000}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Source link optional</span>
              <input
                type="url"
                value={feedbackForm.source_url}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, source_url: event.target.value }))}
                className="field"
                placeholder="https://store.com/page"
              />
            </label>
            {feedbackStatus.error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{feedbackStatus.error}</p> : null}
            {feedbackStatus.message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{feedbackStatus.message}</p> : null}
            <button
              type="submit"
              disabled={feedbackStatus.loading}
              className="w-full rounded-2xl bg-emerald-700 px-5 py-4 text-lg font-black text-white disabled:opacity-60"
            >
              Send feedback
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {(feedbackTickets || []).slice(0, 3).map((ticket) => (
              <div key={ticket.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="font-black text-slate-950">{ticket.title}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{titleCase(ticket.category.replace(/_/g, ' '))} · {titleCase(ticket.status.replace(/_/g, ' '))}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
          <SectionHeader title="Vote on future tools" />
          {voteStatus.error ? <p className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{voteStatus.error}</p> : null}
          {voteStatus.message ? <p className="mb-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{voteStatus.message}</p> : null}
          <div className="space-y-3">
            {(featureVotes || []).slice(0, 6).map((option) => (
              <article key={option.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{option.title}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{option.description}</p>
                    <p className="mt-2 text-sm font-black text-emerald-800">{Number(option.votes || 0).toLocaleString()} vote{Number(option.votes || 0) === 1 ? '' : 's'}</p>
                  </div>
                  <button
                    type="button"
                    disabled={voteStatus.loading || option.user_has_voted || option.status === 'completed'}
                    onClick={() => voteFeature(option.id)}
                    className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100 disabled:text-slate-400"
                  >
                    {option.user_has_voted ? 'Voted' : 'Vote'}
                  </button>
                </div>
              </article>
            ))}
            {!featureVotes?.length ? <EmptyState title="No feature votes yet" body="Voting options will appear here." icon={Star} /> : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <ActivityList title="Recent price activity" items={reports} type="report" />
        <ActivityList title="Recent verifications" items={verifications} type="verification" />
      </section>

      <section className="mt-5 rounded-2xl bg-slate-950 p-5 text-white shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-300">Account tools</p>
            <h2 className="mt-1 text-2xl font-black">Manage your account</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-lg font-black text-slate-950">
              <LogOut className="h-6 w-6" />
              Log out
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function LeaderboardScreen({ data, view, setView, loading, error, reload }) {
  const tabs = [
    ['week', 'Weekly'], ['month', 'Monthly'], ['all', 'All-time'],
    ['approved_proofs', 'Approved proofs'], ['helpful', 'Helpful proof'],
  ]
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-6">
      <ScreenTitle eyebrow="Community" title="Top contributors" subtitle="Ranked by useful, approved proof—not raw uploads. Only clean public usernames are shown." />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black ${view === id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>
        ))}
      </div>
      <p className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
        Privacy note: only public usernames and point totals show here. Emails and proof photos stay private.
      </p>
      {loading ? <LoadingCard label="Loading contributors..." /> : null}
      {error ? <ApiError message={error} onRetry={reload} /> : null}
      {!loading && !error && !data.length ? <div className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-600">No eligible contributors yet.</div> : null}
      <div className="space-y-3">
        {data.map((row) => (
          <article key={`${view}-${row.rank}-${row.username}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-800">#{row.rank}</div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-black">{row.username}</h3>
              <p className="text-sm font-bold text-slate-500">{row.approved_proof_count} approved proofs · {row.contribution_count} helpful prices</p>
              {row.trust_level ? <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{row.trust_level}</span> : null}
            </div>
            <div className="text-right"><strong className="text-xl text-emerald-800">{Number(row.points || 0)}</strong><p className="text-xs font-bold text-slate-500">points</p></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ActivityList({ title, items, type }) {
  const Icon = type === 'report' ? ReceiptText : ShieldCheck
  return (
    <article className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <SectionHeader title={title} />
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-950">{item.product_display_name || item.item_name}</p>
              <p className="truncate text-sm font-semibold text-slate-500">
                {item.store_name} | {item.price_label || item.verification_type || item.status} | {timeAgo(item.submitted_at || item.created_at)}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700 ring-1 ring-slate-100">
              {item.status || item.report_status || 'Saved'}
            </span>
          </div>
        ))}
        {!items.length ? <EmptyState title="Nothing here yet" body="Your real account activity will appear here." icon={Icon} /> : null}
      </div>
    </article>
  )
}

function StoreDetailScreen({ detail, loading, error, openProduct, onBack }) {
  const store = detail?.store
  const grouped = Object.entries((detail?.products || []).filter(isRenderableProduct).reduce((result, product) => {
    const key = product.category || 'other'; (result[key] ||= []).push(product); return result
  }, {}))
  return <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
    <button type="button" onClick={onBack} className="mb-4 rounded-full bg-white px-4 py-2 font-black ring-1 ring-slate-200">Back to stores</button>
    {loading ? <LoadingCard label="Loading current store prices..." /> : null}
    {error ? <ApiError message={error} /> : null}
    {!loading && !store ? <EmptyState title="Store not found" body="We could not find an active Janesville store for this link." icon={Store} /> : null}
    {store ? <><ScreenTitle eyebrow="Janesville store" title={store.name} subtitle={`${Number(store.current_price_count || 0)} current approved prices · Inventory is not live.`} />
      <section className="mb-6 grid gap-3 sm:grid-cols-4"><SummaryCard icon={CircleDollarSign} label="Current prices" value={store.current_price_count || 0} note="Verified and currently eligible" /><SummaryCard icon={Tag} label="Price drops this week" value={detail?.scorecard?.price_drops || 0} note="Verified decreases" /><SummaryCard icon={Store} label="Lowest among stores" value={detail?.scorecard?.lowest_count || 0} note={`${detail?.scorecard?.comparable_products || 0} comparable products`} /><SummaryCard icon={PackageCheck} label="Strongest observed category" value={titleCase(detail?.scorecard?.strongest_observed_category || 'Limited data')} note="Coverage varies by category" /></section>
      <p className="mb-5 rounded-xl bg-amber-50 p-3 font-bold text-amber-900">{detail?.scorecard?.disclaimer}</p>
      {grouped.map(([category, products]) => <section key={category} className="mt-7"><SectionHeader title={titleCase(category)} /><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{products.map((product) => <CatalogTile key={product.id} product={product} reports={detail.reports || []} openProduct={openProduct} />)}</div></section>)}
      {!grouped.length ? <EmptyState title="Prices needed" body="This store has no current approved product prices yet." icon={Store} /> : null}</> : null}
  </div>
}

function UpdatesScreen({ releases, version, markRead }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
    <ScreenTitle eyebrow="Grocery Radar" title="What's New" subtitle={version ? `Grocery Radar v${version}` : 'Published Grocery Radar updates'} />
    <div className="space-y-4">{releases.map((release) => <article key={release.id} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100" onFocus={() => markRead(release)}>
      <p className="text-sm font-black text-emerald-700">{release.version_label}</p><h2 className="mt-1 text-2xl font-black">{release.title}</h2><p className="mt-2 font-semibold text-slate-600">{release.summary}</p>
      {[['New', release.added], ['Improved', release.improved || release.changed], ['Fixed', release.fixed], ['Known issues', release.known_issues]].map(([label, items]) => items?.length ? <section key={label} className="mt-4"><h3 className="font-black">{label}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul></section> : null)}
      <button type="button" onClick={() => markRead(release)} className="mt-4 min-h-11 rounded-xl bg-emerald-50 px-4 font-black text-emerald-800">Mark as read</button>
    </article>)}</div>
    {!releases.length ? <EmptyState title="No published updates yet" body="Release notes appear here after the Owner verifies and publishes them." icon={FileCheck2} /> : null}
  </div>
}

function DataBanner({ openScreen, openUpdates, unreadNotifications = 0, hasUnreadRelease = false }) {
  return (
    <div className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => openScreen('home')} className="min-w-0 text-left">
          <span className="block truncate text-base font-black text-slate-950">Grocery Radar Janesville</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs font-black text-emerald-700">
            <MapPin className="h-3.5 w-3.5" />
            Janesville, Wisconsin
          </span>
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={openUpdates} className="relative min-h-12 rounded-2xl bg-white px-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">What's New{hasUnreadRelease ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-blue-600" aria-label="New update available" /> : null}</button>
          <button type="button" onClick={() => openScreen('profile')} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" aria-label="Open notifications">
            <BellRing className="h-6 w-6" />
            {unreadNotifications ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-black text-white ring-2 ring-white">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span> : null}
          </button>
          <button type="button" onClick={() => openScreen('submissions')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200" aria-label="Open My Submissions"><ReceiptText className="h-6 w-6" /></button>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ active, openScreen }) {
  const navItems = [
    { id: 'search', label: 'Products', icon: Search },
    { id: 'deals', label: 'Savings', icon: Tag },
    { id: 'stores', label: 'Stores', icon: Store },
    { id: 'cart', label: 'My List', icon: ShoppingCart },
    { id: 'submit', label: 'Submit', icon: Upload },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-4xl grid-cols-5 px-1 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const selected = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openScreen(item.id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-[10px] font-black leading-tight sm:text-xs ${
                selected ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500'
              }`}
            >
              <span className="relative">
                <Icon className="h-6 w-6" />
              </span>
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function App() {
  const initialRouteRef = useRef(null)
  if (!initialRouteRef.current) initialRouteRef.current = parsePublicRoute()
  const [route, setRoute] = useState(initialRouteRef.current)
  const screen = route.screen
  const navigationTypeRef = useRef('initial')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('cheapest')
  const [activeCategory, setActiveCategory] = useState('')
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState(initialRouteRef.current.storeId || null)
  const [storeDetail, setStoreDetail] = useState(null)
  const [storeState, setStoreState] = useState({ loading: initialRouteRef.current.screen === 'store', error: '' })
  const [releaseData, setReleaseData] = useState({ application_version: '', releases: [], has_unread: false })
  const [browse, setBrowse] = useState({ products: [], recently_approved_reports: [], needs_prices: [] })
  const [browseState, setBrowseState] = useState({ loading: true, error: '' })
  const [homepageService, setHomepageService] = useState(fallbackHomepageService)
  const [homepageServiceState, setHomepageServiceState] = useState({ loading: true, error: '' })
  const [searchData, setSearchData] = useState({ products: [], reports: [] })
  const [searchState, setSearchState] = useState({ loading: false, error: '' })
  const [selectedProductId, setSelectedProductId] = useState(initialRouteRef.current.productId || null)
  const [productDetail, setProductDetail] = useState(null)
  const [productState, setProductState] = useState({ loading: initialRouteRef.current.screen === 'product', error: '' })
  const [dealReports, setDealReports] = useState({ leaderboard: {}, categories: [], price_drops: [] })
  const [arenaControls, setArenaControls] = useState(() => savingsControlsFromParams(initialRouteRef.current.params))
  const [dealState, setDealState] = useState({ loading: false, error: '' })
  const [me, setMe] = useState({ loading: true, loggedIn: false })
  const [cart, setCart] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [cartMode, setCartMode] = useState('any')
  const [arenaOfferMode, setArenaOfferMode] = useState('all')
  const [cartState, setCartState] = useState({ loading: false, error: '' })
  const [profileStats, setProfileStats] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [profileReports, setProfileReports] = useState([])
  const [profileVerifications, setProfileVerifications] = useState([])
  const [profileNotifications, setProfileNotifications] = useState([])
  const [profileFeedback, setProfileFeedback] = useState([])
  const [featureVotes, setFeatureVotes] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [rewards, setRewards] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardView, setLeaderboardView] = useState('week')
  const [leaderboardState, setLeaderboardState] = useState({ loading: false, error: '' })
  const [profileState, setProfileState] = useState({ loading: false, error: '' })
  const [selectedProofId, setSelectedProofId] = useState(initialRouteRef.current.proofId || '')
  const [toast, setToast] = useState('')

  const applyRoute = useCallback((nextRoute, navigationType = 'push') => {
    navigationTypeRef.current = navigationType
    setRoute(nextRoute)
    if (nextRoute.productId) {
      setSelectedProductId(Number(nextRoute.productId))
      setProductDetail(null)
      setProductState({ loading: true, error: '' })
    }
    if (nextRoute.storeId) {
      setSelectedStoreId(Number(nextRoute.storeId))
      setStoreDetail(null)
      setStoreState({ loading: true, error: '' })
    }
    if (nextRoute.proofId) setSelectedProofId(nextRoute.proofId)
    if (nextRoute.screen === 'deals') setArenaControls(savingsControlsFromParams(nextRoute.params))
    if (nextRoute.screen === 'search') {
      setSearchTerm(String(nextRoute.params.get('q') || '').slice(0, 120))
      setActiveCategory(String(nextRoute.params.get('category') || '').slice(0, 60))
    }
  }, [])

  const navigateTo = useCallback((url, options = {}) => {
    const target = new URL(url, window.location.origin)
    const currentDepth = Number(window.history.state?.groceryRadarDepth || 0)
    const state = { groceryRadar: true, groceryRadarDepth: options.replace ? currentDepth : currentDepth + 1 }
    window.history[options.replace ? 'replaceState' : 'pushState'](state, '', `${target.pathname}${target.search}`)
    applyRoute(parsePublicRoute(target.pathname, target.search), options.replace ? 'replace' : 'push')
  }, [applyRoute])

  const openScreen = useCallback((nextScreen, options = {}) => {
    if (options.category) setActiveCategory(options.category)
    if (options.proofId) setSelectedProofId(options.proofId)
    if (options.productId) setSelectedProductId(Number(options.productId))
    let path = publicPathFor(nextScreen, options)
    if (nextScreen === 'search' && options.category) path = `${path}?category=${encodeURIComponent(options.category)}`
    navigateTo(path)
  }, [navigateTo])

  const goBack = useCallback((fallbackScreen) => {
    if (Number(window.history.state?.groceryRadarDepth || 0) > 0) window.history.back()
    else openScreen(fallbackScreen)
  }, [openScreen])

  const loadMe = useCallback(async () => {
    setMe((current) => ({ ...current, loading: true }))
    try {
      const data = await getJson('/api/auth/me')
      setMe({ ...data, loading: false })
      if (data.loggedIn) {
        try {
          const notificationsData = await getJson('/api/notifications')
          setProfileNotifications(notificationsData.notifications || [])
          setUnreadNotifications(notificationsData.unread_count || 0)
        } catch {
          setProfileNotifications([])
          setUnreadNotifications(0)
        }
      } else {
        setProfileNotifications([])
        setUnreadNotifications(0)
      }
      return data
    } catch (error) {
      setMe({ loading: false, loggedIn: false, error: error.message })
      setProfileNotifications([])
      setUnreadNotifications(0)
      return { loggedIn: false }
    }
  }, [])

  const loadStores = useCallback(async () => {
    const data = await getJson('/api/stores')
    setStores(data.stores || [])
  }, [])

  const loadReleases = useCallback(async () => {
    try {
      const data = await getJson('/api/releases')
      const seenId = Number(window.localStorage.getItem('groceryRadarSeenReleaseId') || 0)
      setReleaseData({ ...data, has_unread: data.has_unread ?? Boolean(data.newest_release_id && Number(data.newest_release_id) !== seenId) })
    } catch { setReleaseData((current) => ({ ...current, releases: [] })) }
  }, [])

  const loadStoreDetail = useCallback(async () => {
    if (!selectedStoreId) return
    setStoreState({ loading: true, error: '' })
    try { setStoreDetail(await getJson(`/api/stores/${selectedStoreId}`)); setStoreState({ loading: false, error: '' }) }
    catch (error) { setStoreState({ loading: false, error: error.message }) }
  }, [selectedStoreId])

  const loadHomepageService = useCallback(async () => {
    setHomepageServiceState({ loading: true, error: '' })
    try {
      const data = await getJson('/api/homepage-service')
      setHomepageService(data)
      setHomepageServiceState({ loading: false, error: '' })
    } catch (error) {
      setHomepageService(fallbackHomepageService)
      setHomepageServiceState({ loading: false, error: error.message })
    }
  }, [])

  const loadBrowse = useCallback(async () => {
    setBrowseState({ loading: true, error: '' })
    try {
      const params = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''
      const data = await getJson(`/api/browse${params}`)
      setBrowse({
        products: data.products || [],
        recently_approved_reports: data.recently_approved_reports || [],
        needs_prices: data.needs_prices || [],
      })
      setBrowseState({ loading: false, error: '' })
    } catch (error) {
      setBrowseState({ loading: false, error: error.message })
    }
  }, [activeCategory])

  const loadSearch = useCallback(async () => {
    setSearchState({ loading: true, error: '' })
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm.trim()) params.set('q', debouncedSearchTerm.trim())
      if (activeCategory) params.set('category', activeCategory)
      if (activeFilter === 'verified') params.set('sort', 'highest_confidence')
      if (activeFilter === 'cheapest') params.set('sort', 'cheapest_unit_price')
      if (activeFilter === 'deals') params.set('sort', 'newest_report')
      const data = await getJson(`/api/search?${params.toString()}`)
      setSearchData({ products: data.products || [], reports: data.reports || [] })
      setSearchState({ loading: false, error: '' })
    } catch (error) {
      setSearchState({ loading: false, error: error.message })
    }
  }, [activeCategory, activeFilter, debouncedSearchTerm])

  const loadProductDetail = useCallback(async () => {
    if (!selectedProductId) return
    setProductState({ loading: true, error: '' })
    try {
      const data = await getJson(`/api/products/${selectedProductId}`)
      setProductDetail(data)
      setProductState({ loading: false, error: '' })
      if (data.redirected_from_product_id && Number(data.product?.id) !== Number(selectedProductId)) {
        const canonicalUrl = `/products/${data.product.id}`
        window.history.replaceState(window.history.state, '', canonicalUrl)
        setSelectedProductId(Number(data.product.id))
        setRoute(parsePublicRoute(canonicalUrl, ''))
      }
    } catch (error) {
      setProductState({ loading: false, error: error.message })
    }
  }, [selectedProductId])

  const loadDeals = useCallback(async () => {
    setDealState({ loading: true, error: '' })
    try {
      const params = new URLSearchParams(arenaControls)
      const data = await getJson(`/api/savings/overview?${params.toString()}`)
      setDealReports(data)
      setDealState({ loading: false, error: '' })
    } catch (error) {
      setDealState({ loading: false, error: error.message })
    }
  }, [arenaControls])

  const loadCart = useCallback(async () => {
    setCartState({ loading: true, error: '' })
    try {
      const cartData = me.loggedIn ? await getJson('/api/cart') : { items: readLocalList() }
      const items = (cartData.items || []).filter((item) => item.product_id).map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity_needed || 1), item_name: item.product_display_name || item.item_name }))
      const compareData = items.length ? await postJson('/api/savings/basket', { items, max_stores: cartMode, mode: arenaOfferMode }) : null
      setCart(cartData)
      setComparison(compareData)
      setCartState({ loading: false, error: '' })
    } catch (error) {
      setCartState({ loading: false, error: error.message })
    }
  }, [arenaOfferMode, cartMode, me.loggedIn])

  const loadProfile = useCallback(async () => {
    if (!me.loggedIn) return
    setProfileState({ loading: true, error: '' })
    try {
      const user = me.user || me
      const [reportsData, verificationsData, rewardsData, statsData, notificationsData, feedbackData, featureVotesData, engagementData] = await Promise.all([
        getJson('/api/account/reports'),
        getJson('/api/account/verifications'),
        getJson('/api/rewards'),
        user.username ? getJson(`/api/users/${encodeURIComponent(user.username)}`) : Promise.resolve(null),
        getJson('/api/notifications'),
        getJson('/api/account/feedback'),
        getJson('/api/feature-votes'),
        getJson('/api/account/engagement'),
      ])
      setProfileReports(reportsData.reports || [])
      setProfileVerifications(verificationsData.verifications || [])
      setRewards(rewardsData)
      setProfileStats(statsData)
      setProfileNotifications(notificationsData.notifications || [])
      setProfileFeedback(feedbackData.tickets || [])
      setFeatureVotes(featureVotesData.options || [])
      setEngagement(engagementData)
      setUnreadNotifications(notificationsData.unread_count || 0)
      setProfileState({ loading: false, error: '' })
    } catch (error) {
      setProfileState({ loading: false, error: error.message })
    }
  }, [me])

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardState({ loading: true, error: '' })
    try {
      const data = await getJson(`/api/leaderboard?view=${encodeURIComponent(leaderboardView)}`)
      setLeaderboard(data.leaderboard || [])
      setLeaderboardState({ loading: false, error: '' })
    } catch (error) {
      setLeaderboardState({ loading: false, error: error.message })
    }
  }, [leaderboardView])

  useEffect(() => {
    loadMe()
    loadStores().catch((error) => setBrowseState({ loading: false, error: error.message }))
    loadHomepageService()
    loadReleases()
    getJson('/api/rewards').then(setRewards).catch(() => {})
    window.history.scrollRestoration = 'auto'
    const initial = initialRouteRef.current
    if (!window.history.state?.groceryRadar) window.history.replaceState({ groceryRadar: true, groceryRadarDepth: 0 }, '', window.location.href)
    if (initial.params.get('q')) setSearchTerm(initial.params.get('q').slice(0, 120))
    if (initial.params.get('category')) setActiveCategory(initial.params.get('category').slice(0, 60))
    const replacement = legacyReplacement(initial)
    if (replacement) {
      window.history.replaceState({ groceryRadar: true, groceryRadarDepth: 0 }, '', replacement)
      applyRoute(parsePublicRoute(window.location.pathname, window.location.search), 'replace')
    }
  }, [applyRoute, loadMe, loadStores, loadHomepageService, loadReleases])

  useEffect(() => {
    const onPopState = () => applyRoute(parsePublicRoute(), 'pop')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyRoute])

  useEffect(() => {
    if (navigationTypeRef.current === 'pop') return
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
      const heading = document.querySelector('[data-route-heading]')
      if (heading) heading.focus({ preventScroll: true })
      else document.querySelector('#publicRouteMain')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route.path, route.productId, route.storeId, route.savingsSection])

  useEffect(() => {
    let cancelled = false
    const sendHeartbeat = async () => {
      if (cancelled || document.visibilityState === 'hidden') return
      try {
        const data = await apiFetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor_id: visitorId() }),
        })
        if (data.streak && me.loggedIn) {
          setEngagement((current) => current ? { ...current, streak: { ...current.streak, ...data.streak } } : current)
        }
      } catch {
        // Presence is optional operational analytics and must never block the app.
      }
    }
    sendHeartbeat()
    const timer = window.setInterval(sendHeartbeat, 60_000)
    const onVisibility = () => sendHeartbeat()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [me.loggedIn])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (screen === 'home') loadBrowse()
  }, [screen, loadBrowse])

  useEffect(() => {
    if (screen === 'search') loadSearch()
  }, [screen, loadSearch])

  useEffect(() => {
    if (screen === 'product') loadProductDetail()
  }, [screen, loadProductDetail])

  useEffect(() => { if (screen === 'store') loadStoreDetail() }, [screen, loadStoreDetail])

  useEffect(() => {
    if (screen === 'home' || (screen === 'deals' && route.savingsSection !== 'home')) loadDeals()
  }, [screen, route.savingsSection, loadDeals])

  useEffect(() => {
    if (screen !== 'deals' || !arenaControls.store_id || !stores.length) return
    if (stores.some((store) => Number(store.id) === Number(arenaControls.store_id))) return
    setArenaControls((current) => {
      const updated = { ...current, store_id: '' }
      window.history.replaceState(window.history.state, '', savingsUrl(window.location.pathname, updated))
      return updated
    })
  }, [screen, stores, arenaControls.store_id])

  useEffect(() => {
    if (screen === 'cart') loadCart()
  }, [screen, loadCart])

  useEffect(() => {
    if (screen === 'profile') loadProfile()
  }, [screen, loadProfile])

  useEffect(() => {
    if (screen === 'leaderboard') loadLeaderboard()
  }, [screen, loadLeaderboard])

  const openProduct = (productId) => {
    openScreen('product', { productId })
  }

  const openStore = (storeId) => openScreen('store', { storeId })
  const openSavingsSection = (savingsSection) => openScreen('deals', { savingsSection })
  const changeArenaControls = (next) => {
    setArenaControls((current) => {
      const updated = { ...current, ...next }
      const url = savingsUrl(window.location.pathname, updated)
      window.history.replaceState(window.history.state, '', url)
      return updated
    })
  }
  const markReleaseRead = async (release) => {
    window.localStorage.setItem('groceryRadarSeenReleaseId', String(release.id))
    if (me.loggedIn) { try { await postJson(`/api/releases/${release.id}/read`, {}) } catch { /* local seen-state remains available */ } }
    setReleaseData((current) => ({ ...current, has_unread: false, releases: current.releases.map((item) => item.id === release.id ? { ...item, is_read: true } : item) }))
  }
  const openUpdates = () => {
    const newest = releaseData.releases?.[0]
    if (newest) markReleaseRead(newest)
    openScreen('updates')
  }

  const addToCart = async (item) => {
    if (!me.loggedIn) {
      const productId = Number(item.product_id || item.id)
      const current = readLocalList()
      if (current.some((entry) => Number(entry.product_id) === productId)) setToast('Already in My List.')
      else {
        writeLocalList([...current, { id: `local-${productId}`, product_id: productId, product_display_name: item.display_name || item.product_display_name || item.item_name, item_name: item.display_name || item.product_display_name || item.item_name, quantity_needed: '1', size_preference: item.default_size_text || item.size_text || '', category: item.category || '' }])
        setToast('Added to My List on this device.')
      }
      if (screen === 'cart') await loadCart()
      return
    }

    const payload = {
      product_id: item.product_id || item.id || null,
      item_name: item.display_name || item.product_display_name || item.item_name,
      preferred_brand: item.preferred_brand || item.brand || '',
      brand_mode: item.brand ? 'preferred' : 'any',
      quantity_needed: '1',
      size_preference: item.default_size_text || item.size_text || '',
      category: item.category || '',
      source: 'tailwind_frontend',
    }

    try {
      const result = await postJson('/api/cart', payload)
      setToast(result.already_in_cart ? 'Already in My List.' : 'Added to My List.')
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const removeCartItem = async (id) => {
    try {
      if (me.loggedIn) await apiFetch(`/api/cart/${id}`, { method: 'DELETE' })
      else writeLocalList(readLocalList().filter((item) => String(item.id) !== String(id)))
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const updateCartItem = async (item, quantityNeeded) => {
    try {
      if (me.loggedIn) await putJson(`/api/cart/${item.id}`, {
        ...item,
        quantity_needed: String(quantityNeeded),
      })
      else writeLocalList(readLocalList().map((entry) => String(entry.id) === String(item.id) ? { ...entry, quantity_needed: String(quantityNeeded) } : entry))
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const clearCart = async () => {
    try {
      if (me.loggedIn) await apiFetch('/api/cart', { method: 'DELETE' })
      else writeLocalList([])
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const useSubstitute = async (original, candidate) => {
    try {
      if (me.loggedIn) {
        await postJson('/api/cart', { product_id: candidate.product_id, item_name: candidate.product_name, quantity_needed: original.quantity_needed || '1', source: 'human_confirmed_substitute' })
        await apiFetch(`/api/cart/${original.id}`, { method: 'DELETE' })
      } else {
        writeLocalList(readLocalList().map((item) => String(item.id) === String(original.id) ? { ...item, id: `local-${candidate.product_id}`, product_id: candidate.product_id, product_display_name: candidate.product_name, item_name: candidate.product_name, size_preference: candidate.size_text || '', substitution_for_product_id: original.product_id } : item))
      }
      setToast('My List updated with the substitute you chose.'); await loadCart()
    } catch (error) { setToast(error.message) }
  }

  const activeNav = useMemo(() => {
    if (['home', 'search', 'deals', 'stores', 'cart', 'submit', 'profile'].includes(screen)) return screen
    if (screen === 'submissions') return 'submit'
    if (screen === 'store') return 'stores'
    if (screen === 'leaderboard') return 'profile'
    if (screen === 'product') return 'search'
    return ''
  }, [screen])

  const selectedProduct = productDetail?.product

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <DataBanner openScreen={openScreen} openUpdates={openUpdates} unreadNotifications={unreadNotifications} hasUnreadRelease={releaseData.has_unread} />
      {toast ? (
        <button
          type="button"
          onClick={() => setToast('')}
          className="fixed left-4 right-4 top-12 z-50 rounded-2xl bg-slate-950 px-4 py-3 text-left font-bold text-white shadow-soft sm:left-auto sm:right-6 sm:w-96"
        >
          {toast}
        </button>
      ) : null}
      <main id="publicRouteMain" tabIndex="-1" className="safe-bottom outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
        {screen === 'home' ? (
          <HomeScreen
            browse={browse}
            stores={stores}
            loading={browseState.loading}
            error={browseState.error}
            homepageService={homepageService}
            homepageServiceState={homepageServiceState}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            openScreen={openScreen}
            openProduct={openProduct}
            openStore={openStore}
            addToCart={addToCart}
            arena={dealReports}
          />
        ) : null}
        {screen === 'search' ? (
          <SearchScreen
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchData={searchData}
            loading={searchState.loading}
            error={searchState.error}
            openProduct={openProduct}
            addToCart={addToCart}
            reload={loadSearch}
          />
        ) : null}
        {screen === 'stores' ? <StoresScreen stores={stores} openStore={openStore} /> : null}
        {screen === 'store' ? <StoreDetailScreen detail={storeDetail} loading={storeState.loading} error={storeState.error} openProduct={openProduct} onBack={() => goBack('stores')} /> : null}
        {screen === 'updates' ? <UpdatesScreen releases={releaseData.releases || []} version={releaseData.application_version || homepageService.application_version} markRead={markReleaseRead} /> : null}
        {screen === 'product' ? (
          <ProductDetailScreen
            detail={productDetail}
            loading={productState.loading}
            error={productState.error}
            openScreen={openScreen}
            onBack={() => goBack('search')}
            addToCart={addToCart}
            reload={loadProductDetail}
            me={me}
          />
        ) : null}
        {screen === 'deals' ? (
          <DealsScreen
            arena={dealReports}
            loading={dealState.loading}
            error={dealState.error}
            openProduct={openProduct}
            reload={loadDeals}
            controls={arenaControls}
            section={route.savingsSection || 'home'}
            onSectionChange={openSavingsSection}
            onControlsChange={changeArenaControls}
          />
        ) : null}
        {screen === 'cart' ? (
          <CartScreen
            me={me}
            cart={cart}
            comparison={comparison}
            cartMode={cartMode}
            setCartMode={setCartMode}
            offerMode={arenaOfferMode}
            setOfferMode={setArenaOfferMode}
            loading={cartState.loading}
            error={cartState.error}
            openScreen={openScreen}
            reload={loadCart}
            onAuthChanged={loadMe}
            updateCartItem={updateCartItem}
            removeCartItem={removeCartItem}
            clearCart={clearCart}
            onUseSubstitute={useSubstitute}
          />
        ) : null}
        {screen === 'submit' ? (
          <SubmitScreen
            me={me}
            stores={stores}
            selectedProduct={selectedProduct}
            onAuthChanged={loadMe}
            openScreen={openScreen}
            setSelectedProofId={setSelectedProofId}
          />
        ) : null}
        {screen === 'submissions' ? <MySubmissionsScreen openScreen={openScreen} /> : null}
        {screen === 'privacy' ? <PolicyScreen type="privacy" openScreen={openScreen} /> : null}
        {screen === 'terms' ? <PolicyScreen type="terms" openScreen={openScreen} /> : null}
        {screen === 'notFound' ? <NotFoundScreen openScreen={openScreen} /> : null}
        {screen === 'profile' ? (
          <ProfileScreen
            me={me}
            profileStats={profileStats}
            engagement={engagement}
            reports={profileReports}
            verifications={profileVerifications}
            rewards={rewards}
            notifications={profileNotifications}
            unreadNotifications={unreadNotifications}
            feedbackTickets={profileFeedback}
            featureVotes={featureVotes}
            loading={profileState.loading}
            error={profileState.error}
            onAuthChanged={loadMe}
            openScreen={openScreen}
            openProduct={openProduct}
            onNotificationsChanged={loadProfile}
            selectedProofId={selectedProofId}
            setSelectedProofId={setSelectedProofId}
          />
        ) : null}
        {screen === 'leaderboard' ? (
          <LeaderboardScreen
            data={leaderboard}
            view={leaderboardView}
            setView={setLeaderboardView}
            loading={leaderboardState.loading}
            error={leaderboardState.error}
            reload={loadLeaderboard}
          />
        ) : null}
      </main>
      <footer className="pb-28 pt-10 text-center text-sm font-bold text-slate-500">
        <p>Grocery Radar{releaseData.application_version || homepageService.application_version ? ` v${releaseData.application_version || homepageService.application_version}` : ''}</p>
        <p className="mt-3 flex flex-wrap justify-center gap-4"><a className="underline" href="/privacy" onClick={(event) => { event.preventDefault(); openScreen('privacy') }}>Privacy</a><a className="underline" href="/terms" onClick={(event) => { event.preventDefault(); openScreen('terms') }}>Terms &amp; acceptable use</a></p>
        <p className="mx-auto mt-3 max-w-2xl px-4">Grocery Radar is an independent price-information service and is not affiliated with or endorsed by listed retailers unless explicitly stated.</p>
      </footer>
      <BottomNav active={activeNav} openScreen={openScreen} unreadNotifications={unreadNotifications} />
    </div>
  )
}

export default App
