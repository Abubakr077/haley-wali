// Only published article media leaves D1; no prices, supplier metadata or customer data.
export const publishedImageQuery = `
SELECT image_url AS imageUrl, gallery_json AS galleryJson
FROM manual_products
WHERE publish_status = 'published' AND selling_price_pkr > 0
UNION ALL
SELECT sp.image_url AS imageUrl, sp.gallery_json AS galleryJson
FROM catalog_products cp
JOIN supplier_products sp ON sp.id = cp.supplier_product_id
WHERE cp.category = 'pret' AND cp.publish_status = 'published' AND cp.selling_price_pkr > 0`;

export function imageSourcesFromD1(payload) {
  if (!Array.isArray(payload) || !payload.length || payload.some(result => result.success !== true || !Array.isArray(result.results))) {
    throw new Error('Published image query did not return a successful result.');
  }
  return [...new Set(payload.flatMap(result => result.results).flatMap(row => {
    const gallery = JSON.parse(row.galleryJson || '[]');
    if (!Array.isArray(gallery)) throw new Error('Invalid published article gallery.');
    return [row.imageUrl, ...gallery].filter(value => typeof value === 'string' && value.length);
  }))];
}

export async function loadImageSources({ file, api, required = false, readFile, fetcher = fetch }) {
  if (file) {
    const sources = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(sources) || sources.some(source => typeof source !== 'string')) {
      throw new Error('Invalid published image source file.');
    }
    return sources;
  }
  try {
    const response = await fetcher(`${api}/api/catalog/articles`, {
      headers: { accept: 'application/json', 'user-agent': 'HaleyWali-ImageBuild/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.products)) throw new Error('Invalid catalogue response');
    return payload.products.flatMap(product => [product.imageUrl, ...(product.gallery || [])]).filter(Boolean);
  } catch (error) {
    if (required) throw new Error('Required catalogue image preparation failed.', { cause: error });
    console.warn('Responsive images: catalogue unavailable; remote images retain original URLs.');
    return [];
  }
}
