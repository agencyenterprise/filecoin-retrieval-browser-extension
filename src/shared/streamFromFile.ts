import { Buffer } from 'buffer'

const chunkSize = 1024 * 1024

export async function* streamFromFile(file) {
  const reader = new FileReader()
  let offset = 0

  const getNextChunk = () =>
    new Promise((resolve, reject) => {
      reader.onloadend = (e) => {
        const data = e.target.result as ArrayBuffer
        resolve(data.byteLength === 0 ? null : data)
      }
      reader.onerror = reject

      const end = offset + chunkSize
      const slice = file.slice(offset, end)
      reader.readAsArrayBuffer(slice)
      offset = end
    })

  while (true) {
    const data = await getNextChunk()

    if (data == null) {
      return
    }

    yield Buffer.from(data)
  }
}
