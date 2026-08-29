/**
 * Trigger a browser download for a URL's contents. Fetches the resource and
 * saves it via an object URL — the bare `download` attribute is ignored for
 * cross-origin hrefs (the QR endpoint lives on the API origin), so a plain
 * <a download> would just navigate instead.
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  URL.revokeObjectURL(objectUrl)
}
