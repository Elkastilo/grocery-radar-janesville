import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Home,
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
  UserRound,
  UsersRound,
} from 'lucide-react'
import { apiFetch, getJson, postJson, putJson } from './api'

const categories = [
  { label: 'Dairy', value: 'dairy' },
  { label: 'Meat', value: 'meat' },
  { label: 'Produce', value: 'produce' },
  { label: 'Pantry', value: 'pantry' },
  { label: 'Frozen', value: 'frozen' },
  { label: 'Drinks', value: 'drinks' },
  { label: 'Household', value: 'household' },
  { label: 'Baby', value: 'baby' },
  { label: 'Bathroom', value: 'personal care' },
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
const reportSize = (report) => report.size_text || report.product_default_size_text || report.unit_price_label || ''
const isApprovedReport = (report) => report?.status === 'approved'
const numericPrice = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const hasNumericApprovedReportPrice = (report) => isApprovedReport(report) && numericPrice(report?.price) !== null
const hasApprovedProductPrice = (product) => Number(product?.approved_price_count || 0) > 0 && numericPrice(product?.best_price) !== null
const isDealReport = (report) => Boolean(report?.sale_price || report?.proof_type === 'weekly_ad')
const productPrice = (product) => hasApprovedProductPrice(product)
  ? product?.best_price_label || money(product.best_price)
  : ''
const reportSortPrice = (report) => numericPrice(report?.unit_price) ?? numericPrice(report?.price) ?? Number.POSITIVE_INFINITY
const compareCountLabel = (count = 0) => {
  const number = Number(count || 0)
  if (!number) return 'No stores compared yet'
  return `${number} store${number === 1 ? '' : 's'} compared`
}
const checkedDateLabel = (value) => {
  const label = shortDate(value)
  return label ? `Checked ${label}` : 'Check date pending'
}
const savingsForReport = (report) => {
  const regular = numericPrice(report?.regular_price)
  const price = numericPrice(report?.price)
  if (regular !== null && price !== null && regular > price) {
    return regular - price
  }
  return 0
}
const dealSavingsLabel = (report) => {
  const savings = savingsForReport(report)
  return savings > 0 ? `Save ${money(savings)}` : ''
}
const bestReportForProduct = (product, reports = []) => {
  if (!product?.id) return null
  return reports
    .filter((report) => String(report.product_id || '') === String(product.id) && hasNumericApprovedReportPrice(report))
    .sort((a, b) => reportSortPrice(a) - reportSortPrice(b))[0] || null
}
const productSize = (product, report) => product?.default_size_text || reportSize(report) || 'Size varies'
const productImageUrl = (item = {}) => item.image_url || item.product_image_url || item.photo_url || ''
const productBrand = (item = {}, report = null) => item.preferred_brand || item.brand || report?.brand || ''

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
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
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
      {showLink && report.source_url ? (
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
    </div>
  )
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
        alt=""
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
      <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">{title}</h1>
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

function StoreCard({ store }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
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
    </article>
  )
}

function ProductCard({ product, bestReport, onOpen, onAddToCart }) {
  const hasPrice = hasApprovedProductPrice(product)
  const storeName = bestReport?.store_name || product.best_store_name || ''
  const brand = productBrand(product, bestReport)

  return (
    <article className="rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lift">
      <button type="button" onClick={() => onOpen(product.id)} className="w-full text-left">
        <div className="flex items-start gap-3">
          <ProductVisual item={product} label={product.display_name} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-950">{displayText(product.display_name)}</p>
            {brand ? <p className="mt-0.5 text-sm font-black text-emerald-700">{displayText(brand)}</p> : null}
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {titleCase(product.category)} | {productSize(product, bestReport)}
            </p>
          </div>
          <div className={`rounded-2xl px-3 py-2 text-right shadow-sm ${
            hasPrice ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <p className="text-xs font-bold">{hasPrice ? 'Lowest' : 'Waiting'}</p>
            <p className={`${hasPrice ? 'text-xl' : 'max-w-24 text-sm leading-tight'} font-black`}>
              {hasPrice ? productPrice(product) : 'No approved price yet'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {bestReport ? (
            <StatusPill report={bestReport} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              No approved price yet
            </span>
          )}
          {storeName ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {storeName}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            {compareCountLabel(product.approved_price_count)}
          </span>
          {product.last_reported_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              <Clock3 className="h-3.5 w-3.5" />
              {checkedDateLabel(product.last_reported_at)}
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
          onClick={() => onAddToCart(product)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-800"
        >
          <Plus className="h-5 w-5 text-emerald-700" />
          Add to My List
        </button>
      ) : null}
    </article>
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

function HomeScreen({ browse, stores, loading, error, searchTerm, setSearchTerm, openScreen, openProduct, addToCart }) {
  const reports = (browse.recently_approved_reports || []).filter(hasNumericApprovedReportPrice)
  const products = (browse.products || []).filter(hasApprovedProductPrice)
  const dealReports = reports.filter(isDealReport)
  const bestCards = dealReports.slice(0, 4)
  const hasApprovedPrices = reports.length > 0 || products.length > 0
  const approvedCount = reports.length || products.length
  const quickActions = [
    { label: 'Find the Cheapest Price', icon: Search, screen: 'search', tone: 'primary' },
    { label: "Browse This Week's Deals", icon: Tag, screen: 'deals' },
    { label: 'Compare My Grocery List', icon: ShoppingCart, screen: 'cart' },
    { label: 'Submit Proof', icon: Upload, screen: 'submit' },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
      <section className="rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-emerald-100 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
              <MapPin className="h-4 w-4" />
              Janesville, Wisconsin
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              Find the cheapest groceries near you.
            </h1>
            <p className="mt-3 text-xl font-bold text-slate-600">
              Search local approved prices, compare stores, and build a smarter grocery list.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SearchBox value={searchTerm} onChange={setSearchTerm} onFocus={() => openScreen('search')} />
        </div>

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
      </section>

      {error ? <div className="mt-5"><ApiError message={error} /></div> : null}

      <section className="mt-5 rounded-2xl bg-emerald-700 p-5 text-white shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-100">Approved price data</p>
            <p className="mt-2 text-4xl font-black">{approvedCount}</p>
            <p className="mt-1 text-base font-semibold text-emerald-50">
              approved price{approvedCount === 1 ? '' : 's'} available now.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <CircleDollarSign className="h-8 w-8" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => openScreen('search')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-black text-emerald-800"
        >
          <Search className="h-5 w-5" />
          Compare prices
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
  const filterFood = (item) => activeFilter !== 'food' || foodCategorySet.has(item.category)
  const reports = (activeFilter === 'deals'
    ? approvedReports.filter(isDealReport)
    : approvedReports).filter(filterFood)
  const products = (searchData.products || []).filter(hasApprovedProductPrice).filter(filterFood)
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
          <EmptyState title="No approved matches yet" body="Try another search, or submit proof once you are signed in." icon={Search} />
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

function ProductDetailScreen({ detail, loading, error, openScreen, addToCart, reload }) {
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
  const chartReports = reports.slice(0, 8)
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
        onClick={() => openScreen('search')}
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
                    <p className="mt-1 text-5xl font-black">{cheapest.price_label || money(cheapest.price)}</p>
                    <p className="mt-2 text-lg font-bold">{cheapest.store_name}</p>
                  </div>
                  <StoreLogo store={{ name: cheapest.store_name }} size="lg" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill report={cheapest} />
                </div>
                <SourceTrust report={cheapest} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-900">
                <p className="font-black">No approved price yet</p>
                <p className="mt-1 font-semibold">Submit proof after signing in to help fill this gap.</p>
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
            <SectionHeader title="Store comparison" />
            {storeGroups.length ? (
              <div className="space-y-3">
                {storeGroups.map((group) => {
                  const best = [...group.reports].sort((a, b) => reportSortPrice(a) - reportSortPrice(b))[0]
                  return (
                    <div key={group.store_id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <StoreLogo store={{ name: group.store_name }} />
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950">{group.store_name}</p>
                            <p className="text-sm font-semibold text-slate-500">
                              {group.reports.length} approved report{group.reports.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-emerald-700">BEST HERE</p>
                          <p className="text-2xl font-black text-slate-950">{best?.price_label || money(best?.price)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill report={best} />
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                          {best?.unit_price_label || best?.size_text}
                        </span>
                      </div>
                      <SourceTrust report={best} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="No comparison yet" body="Approved store reports will appear here." icon={Store} />
            )}
          </section>

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <SectionHeader title="Recent approved prices" />
            {chartReports.length ? (
              <>
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
                  Based on approved prices for this item.
                </p>
              </>
            ) : (
              <EmptyState title="No price trend yet" body="More approved reports are needed for this product." icon={Clock3} />
            )}
          </section>
        </>
      ) : null}
    </div>
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

function DealsScreen({ reports, loading, error, addToCart, openProduct, reload }) {
  const [storeFilter, setStoreFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [couponFilter, setCouponFilter] = useState('all')
  const [sortMode, setSortMode] = useState('expires')
  const approvedReports = reports.filter(hasNumericApprovedReportPrice)
  const dealReports = approvedReports.filter(isDealReport)
  const baseReports = dealReports.length ? dealReports : approvedReports
  const storesWithDeals = [...new Set(baseReports.map((report) => report.store_name).filter(Boolean))].sort()
  const categoriesWithDeals = [...new Set(baseReports.map((report) => report.category).filter(Boolean))].sort()
  const displayReports = baseReports
    .filter((report) => !storeFilter || report.store_name === storeFilter)
    .filter((report) => !categoryFilter || report.category === categoryFilter)
    .filter((report) => {
      if (couponFilter === 'coupon') return Boolean(report.coupon_required)
      if (couponFilter === 'no_coupon') return !report.coupon_required
      return true
    })
    .sort((a, b) => {
      if (sortMode === 'lowest') return reportSortPrice(a) - reportSortPrice(b)
      if (sortMode === 'savings') return savingsForReport(b) - savingsForReport(a)
      const aDate = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY
      const bDate = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY
      return aDate - bDate
    })

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="Deals near you"
        title="This Week's Deals"
        subtitle="Approved sale prices, weekly ads, and store deals for Janesville shoppers."
      />
      <section className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm font-black text-slate-600">Store</span>
            <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="field py-3 text-base">
              <option value="">All stores</option>
              {storesWithDeals.map((store) => <option key={store} value={store}>{store}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-black text-slate-600">Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field py-3 text-base">
              <option value="">All categories</option>
              {categoriesWithDeals.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-black text-slate-600">Coupon</span>
            <select value={couponFilter} onChange={(event) => setCouponFilter(event.target.value)} className="field py-3 text-base">
              <option value="all">All offers</option>
              <option value="no_coupon">No coupon required</option>
              <option value="coupon">Coupon required</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-black text-slate-600">Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="field py-3 text-base">
              <option value="expires">Expiration date</option>
              <option value="lowest">Lowest price</option>
              <option value="savings">Largest savings</option>
            </select>
          </label>
        </div>
      </section>
      {loading ? <LoadingCard label="Loading approved deals..." /> : null}
      {error ? <ApiError message={error} onRetry={reload} /> : null}
      {!loading && !displayReports.length ? (
        <EmptyState title="No approved deals found" body="Try different filters, or check back after new proofs are reviewed." icon={Tag} />
      ) : null}
      {!dealReports.length && displayReports.length ? (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4 font-bold text-amber-900 ring-1 ring-amber-100">
          No active sale-tagged reports found yet. Showing recent approved prices instead.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayReports.map((report) => (
          <article key={report.id} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <StoreLogo store={{ name: report.store_name }} />
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                  {report.proof_type === 'weekly_ad' ? 'Weekly ad' : report.sale_price ? 'Sale' : 'Approved'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${report.coupon_required ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {report.coupon_required ? 'Coupon required' : 'No coupon required'}
                </span>
                {report.regular_price ? (
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
                    Was {money(report.regular_price)}
                  </span>
                ) : null}
                {dealSavingsLabel(report) ? (
                  <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800">
                    {dealSavingsLabel(report)}
                  </span>
                ) : null}
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">{reportTitle(report)}</h2>
            <p className="mt-1 font-semibold text-slate-500">
              {report.store_name} | {reportSize(report)}
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">Approved price</p>
                <p className="text-4xl font-black text-emerald-700">{report.price_label || money(report.price)}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{report.unit_price_label}</p>
              </div>
              <StatusPill report={report} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                <Clock3 className="h-4 w-4 text-emerald-700" />
                {report.expires_at ? `Expires ${new Date(report.expires_at).toLocaleDateString()}` : timeAgo(report.submitted_at)}
              </div>
              <button
                type="button"
                onClick={() => addToCart(report)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white"
              >
                <Plus className="h-4 w-4" />
                Add to My List
              </button>
            </div>
            <SourceTrust report={report} />
            {report.product_id ? (
              <button
                type="button"
                onClick={() => openProduct(report.product_id)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-800"
              >
                View product
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}

function AuthGate({ me, onAuthChanged, title = 'Sign in to continue', body = 'Sign in to save My List, submit proof, and track points.' }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [status, setStatus] = useState({ loading: false, error: '', message: '' })

  const submit = async (event) => {
    event.preventDefault()
    setStatus({ loading: true, error: '', message: '' })
    try {
      if (mode === 'login') {
        await postJson('/api/auth/login', { email: form.email, password: form.password })
      } else {
        await postJson('/api/auth/register', {
          username: form.username,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
        })
      }
      setStatus({ loading: false, error: '', message: mode === 'login' ? 'Logged in.' : 'Account created.' })
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

      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        {['login', 'register'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`rounded-xl px-4 py-3 font-black capitalize ${
              mode === item ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === 'register' ? (
          <input
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold outline-none focus:border-emerald-500"
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
          />
        ) : null}
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
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' ? (
          <input
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold outline-none focus:border-emerald-500"
            placeholder="Confirm password"
            aria-label="Confirm password"
            type="password"
            autoComplete="new-password"
          />
        ) : null}
        {status.error ? <p className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-800">{status.error}</p> : null}
        {status.message ? <p className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">{status.message}</p> : null}
        <button
          type="submit"
          disabled={status.loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-lift disabled:opacity-60"
        >
          {status.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </section>
  )
}

function CartScreen({ me, cart, comparison, cartMode, setCartMode, loading, error, openScreen, reload, onAuthChanged, updateCartItem, removeCartItem, clearCart }) {
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

function SubmitScreen({ me, stores, selectedProduct, onAuthChanged, openScreen, setSelectedProofId }) {
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

  if (!me.loggedIn) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
        <AuthGate me={me} onAuthChanged={onAuthChanged} title="Log in to submit proof" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
      <ScreenTitle
        eyebrow="Submit Proof"
        title="Submit Proof"
        subtitle="Upload a receipt, shelf tag, weekly ad, screenshot, or source link. We will review it and add useful prices."
      />

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
            <p className="mt-1 text-sm text-emerald-700">You will receive a notification after it is reviewed.</p>
            {status.result?.batch_id ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedProofId(String(status.result.batch_id))
                  openScreen('profile')
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

function ProfileScreen({ me, profileStats, reports, verifications, rewards, notifications, unreadNotifications, loading, error, onAuthChanged, openScreen, openProduct, onNotificationsChanged, selectedProofId, setSelectedProofId }) {
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState((me.user || me).username || '')
  const [proofState, setProofState] = useState({ loading: false, error: '', proof: null })

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

  const markNotificationRead = async (notificationId) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
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
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800">
              {unreadNotifications} unread
            </span>
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

function DataBanner({ openScreen, unreadNotifications = 0 }) {
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
        <button
          type="button"
          onClick={() => openScreen('profile')}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
          aria-label="Open account"
        >
          <UserRound className="h-6 w-6" />
          {unreadNotifications ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-black text-white ring-2 ring-white">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}

function BottomNav({ active, openScreen, unreadNotifications = 0 }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'deals', label: 'Deals', icon: Tag },
    { id: 'cart', label: 'My List', icon: ShoppingCart },
    { id: 'submit', label: 'Submit Proof', icon: Upload },
    { id: 'profile', label: 'Account', icon: UserRound },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-4xl grid-cols-6 px-1 py-2">
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
                {item.id === 'profile' && unreadNotifications ? (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-black text-white ring-2 ring-white">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                ) : null}
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
  const [screen, setScreen] = useState('home')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('cheapest')
  const [activeCategory, setActiveCategory] = useState('')
  const [stores, setStores] = useState([])
  const [browse, setBrowse] = useState({ products: [], recently_approved_reports: [], needs_prices: [] })
  const [browseState, setBrowseState] = useState({ loading: true, error: '' })
  const [searchData, setSearchData] = useState({ products: [], reports: [] })
  const [searchState, setSearchState] = useState({ loading: false, error: '' })
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [productDetail, setProductDetail] = useState(null)
  const [productState, setProductState] = useState({ loading: false, error: '' })
  const [dealReports, setDealReports] = useState([])
  const [dealState, setDealState] = useState({ loading: false, error: '' })
  const [me, setMe] = useState({ loading: true, loggedIn: false })
  const [cart, setCart] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [cartMode, setCartMode] = useState('cheapest_split')
  const [cartState, setCartState] = useState({ loading: false, error: '' })
  const [profileStats, setProfileStats] = useState(null)
  const [profileReports, setProfileReports] = useState([])
  const [profileVerifications, setProfileVerifications] = useState([])
  const [profileNotifications, setProfileNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [rewards, setRewards] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardView, setLeaderboardView] = useState('week')
  const [leaderboardState, setLeaderboardState] = useState({ loading: false, error: '' })
  const [profileState, setProfileState] = useState({ loading: false, error: '' })
  const [selectedProofId, setSelectedProofId] = useState('')
  const [toast, setToast] = useState('')

  const openScreen = useCallback((nextScreen, options = {}) => {
    if (options.category) setActiveCategory(options.category)
    if (options.proofId) setSelectedProofId(options.proofId)
    setScreen(nextScreen)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
    } catch (error) {
      setProductState({ loading: false, error: error.message })
    }
  }, [selectedProductId])

  const loadDeals = useCallback(async () => {
    setDealState({ loading: true, error: '' })
    try {
      const data = await getJson('/api/search?sort=newest_report')
      setDealReports(data.reports || [])
      setDealState({ loading: false, error: '' })
    } catch (error) {
      setDealState({ loading: false, error: error.message })
    }
  }, [])

  const loadCart = useCallback(async () => {
    if (!me.loggedIn) return
    setCartState({ loading: true, error: '' })
    try {
      const [cartData, compareData] = await Promise.all([
        getJson('/api/cart'),
        getJson(`/api/cart/compare?mode=${encodeURIComponent(cartMode)}`),
      ])
      setCart(cartData)
      setComparison(compareData)
      setCartState({ loading: false, error: '' })
    } catch (error) {
      setCartState({ loading: false, error: error.message })
    }
  }, [cartMode, me.loggedIn])

  const loadProfile = useCallback(async () => {
    if (!me.loggedIn) return
    setProfileState({ loading: true, error: '' })
    try {
      const user = me.user || me
      const [reportsData, verificationsData, rewardsData, statsData, notificationsData] = await Promise.all([
        getJson('/api/account/reports'),
        getJson('/api/account/verifications'),
        getJson('/api/rewards'),
        user.username ? getJson(`/api/users/${encodeURIComponent(user.username)}`) : Promise.resolve(null),
        getJson('/api/notifications'),
      ])
      setProfileReports(reportsData.reports || [])
      setProfileVerifications(verificationsData.verifications || [])
      setRewards(rewardsData)
      setProfileStats(statsData)
      setProfileNotifications(notificationsData.notifications || [])
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
    getJson('/api/rewards').then(setRewards).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'proof' && params.get('proof')) {
      setSelectedProofId(params.get('proof'))
      setScreen('profile')
    }
  }, [loadMe, loadStores])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    loadBrowse()
  }, [loadBrowse])

  useEffect(() => {
    if (screen === 'search') loadSearch()
  }, [screen, loadSearch])

  useEffect(() => {
    if (screen === 'product') loadProductDetail()
  }, [screen, loadProductDetail])

  useEffect(() => {
    if (screen === 'deals') loadDeals()
  }, [screen, loadDeals])

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
    setSelectedProductId(productId)
    openScreen('product')
  }

  const addToCart = async (item) => {
    if (!me.loggedIn) {
      setToast('Log in to add items to My List.')
      openScreen('cart')
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
      await apiFetch(`/api/cart/${id}`, { method: 'DELETE' })
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const updateCartItem = async (item, quantityNeeded) => {
    try {
      await putJson(`/api/cart/${item.id}`, {
        ...item,
        quantity_needed: String(quantityNeeded),
      })
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const clearCart = async () => {
    try {
      await apiFetch('/api/cart', { method: 'DELETE' })
      await loadCart()
    } catch (error) {
      setToast(error.message)
    }
  }

  const activeNav = useMemo(() => {
    if (['home', 'search', 'deals', 'cart', 'submit', 'profile'].includes(screen)) return screen
    if (screen === 'leaderboard') return 'profile'
    if (screen === 'product') return 'search'
    return ''
  }, [screen])

  const selectedProduct = productDetail?.product

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <DataBanner openScreen={openScreen} unreadNotifications={unreadNotifications} />
      {toast ? (
        <button
          type="button"
          onClick={() => setToast('')}
          className="fixed left-4 right-4 top-12 z-50 rounded-2xl bg-slate-950 px-4 py-3 text-left font-bold text-white shadow-soft sm:left-auto sm:right-6 sm:w-96"
        >
          {toast}
        </button>
      ) : null}
      <main className="safe-bottom">
        {screen === 'home' ? (
          <HomeScreen
            browse={browse}
            stores={stores}
            loading={browseState.loading}
            error={browseState.error}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            openScreen={openScreen}
            openProduct={openProduct}
            addToCart={addToCart}
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
        {screen === 'product' ? (
          <ProductDetailScreen
            detail={productDetail}
            loading={productState.loading}
            error={productState.error}
            openScreen={openScreen}
            addToCart={addToCart}
            reload={loadProductDetail}
          />
        ) : null}
        {screen === 'deals' ? (
          <DealsScreen
            reports={dealReports}
            loading={dealState.loading}
            error={dealState.error}
            addToCart={addToCart}
            openProduct={openProduct}
            reload={loadDeals}
          />
        ) : null}
        {screen === 'cart' ? (
          <CartScreen
            me={me}
            cart={cart}
            comparison={comparison}
            cartMode={cartMode}
            setCartMode={setCartMode}
            loading={cartState.loading}
            error={cartState.error}
            openScreen={openScreen}
            reload={loadCart}
            onAuthChanged={loadMe}
            updateCartItem={updateCartItem}
            removeCartItem={removeCartItem}
            clearCart={clearCart}
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
        {screen === 'profile' ? (
          <ProfileScreen
            me={me}
            profileStats={profileStats}
            reports={profileReports}
            verifications={profileVerifications}
            rewards={rewards}
            notifications={profileNotifications}
            unreadNotifications={unreadNotifications}
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
      <BottomNav active={activeNav} openScreen={openScreen} unreadNotifications={unreadNotifications} />
    </div>
  )
}

export default App
