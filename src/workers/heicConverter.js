import heic2any from 'heic2any'

self.onmessage = async ({ data: { buffer, name } }) => {
  try {
    const blob = new Blob([buffer], { type: 'image/heic' })
    const result = await heic2any({ blob, toType: 'image/jpeg', quality: 0.82 })
    const outBuffer = await result.arrayBuffer()
    self.postMessage(
      { success: true, buffer: outBuffer, name: name.replace(/\.(heic|heif)$/i, '.jpg') },
      [outBuffer]
    )
  } catch (err) {
    self.postMessage({ success: false, error: err.message })
  }
}
