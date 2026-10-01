/** Trigger a browser download for a blob response from the reports API. */

export function downloadBlob(response, fallbackName = 'report') {
  const disposition = response.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : fallbackName

  const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
