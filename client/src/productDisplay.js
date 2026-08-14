const numericPrice = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const reportSize = (report) => report?.size_text || report?.product_default_size_text || report?.unit_price_label || ''

export const productSize = (product, report) => product?.default_size_text || reportSize(report) || 'Size varies'

export const isRenderableProduct = (product) => Boolean(product && typeof product === 'object' && product.id && product.display_name)

export const productCardViewModel = (product, bestReport) => {
  const safeProduct = product && typeof product === 'object' ? product : {}
  const hasCurrentPrice = numericPrice(safeProduct.best_price) !== null && Boolean(
    safeProduct.has_current_price === true || Number(safeProduct.approved_price_count || 0) > 0
  )

  return {
    product: safeProduct,
    renderable: isRenderableProduct(safeProduct),
    displayName: safeProduct.display_name || 'Product unavailable',
    category: safeProduct.category || 'other',
    size: productSize(safeProduct, bestReport),
    hasCurrentPrice,
    imageUrl: safeProduct.image_url || safeProduct.product_image_url || safeProduct.photo_url || ''
  }
}
