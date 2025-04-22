const productPatterns = [/\/products\//,/\/product\//, /\/p\//, /\/item\//,/\/p-.+/ ];

export function isProductUrl(url) {
  return productPatterns.some((pattern) => pattern.test(url));
}
export function normalizeUrl(rawUrl) {
  try {
    const urlObj = new URL(rawUrl);
    urlObj.search = '';
    urlObj.hash = '';
    return urlObj.toString();
  } catch (e) {
    return rawUrl;
  }
}

