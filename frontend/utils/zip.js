const utf8Encode = (text) => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(text || ''))
  }

  const encoded = encodeURIComponent(String(text || ''))
  const out = []
  for (let i = 0; i < encoded.length; i += 1) {
    const ch = encoded[i]
    if (ch === '%') {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      out.push(ch.charCodeAt(0))
    }
  }
  return new Uint8Array(out)
}

const createCrc32Table = () => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

const CRC32_TABLE = createCrc32Table()

const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    const idx = (crc ^ bytes[i]) & 0xff
    crc = (crc >>> 8) ^ CRC32_TABLE[idx]
  }
  return (crc ^ 0xffffffff) >>> 0
}

const writeUInt16LE = (view, offset, value) => {
  view.setUint16(offset, value & 0xffff, true)
}

const writeUInt32LE = (view, offset, value) => {
  view.setUint32(offset, value >>> 0, true)
}

const concatUint8Arrays = (arrays) => {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  arrays.forEach((arr) => {
    out.set(arr, offset)
    offset += arr.length
  })
  return out
}

export const buildZipFile = (files) => {
  const localParts = []
  const centralParts = []
  let localOffset = 0

  files.forEach((file) => {
    const nameBytes = utf8Encode(file.path)
    const dataBytes = utf8Encode(file.content)
    const crc = crc32(dataBytes)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUInt32LE(localView, 0, 0x04034b50)
    writeUInt16LE(localView, 4, 20)
    writeUInt16LE(localView, 6, 0)
    writeUInt16LE(localView, 8, 0)
    writeUInt16LE(localView, 10, 0)
    writeUInt16LE(localView, 12, 0)
    writeUInt32LE(localView, 14, crc)
    writeUInt32LE(localView, 18, dataBytes.length)
    writeUInt32LE(localView, 22, dataBytes.length)
    writeUInt16LE(localView, 26, nameBytes.length)
    writeUInt16LE(localView, 28, 0)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, dataBytes)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUInt32LE(centralView, 0, 0x02014b50)
    writeUInt16LE(centralView, 4, 20)
    writeUInt16LE(centralView, 6, 20)
    writeUInt16LE(centralView, 8, 0)
    writeUInt16LE(centralView, 10, 0)
    writeUInt16LE(centralView, 12, 0)
    writeUInt16LE(centralView, 14, 0)
    writeUInt32LE(centralView, 16, crc)
    writeUInt32LE(centralView, 20, dataBytes.length)
    writeUInt32LE(centralView, 24, dataBytes.length)
    writeUInt16LE(centralView, 28, nameBytes.length)
    writeUInt16LE(centralView, 30, 0)
    writeUInt16LE(centralView, 32, 0)
    writeUInt16LE(centralView, 34, 0)
    writeUInt16LE(centralView, 36, 0)
    writeUInt32LE(centralView, 38, 0)
    writeUInt32LE(centralView, 42, localOffset)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    localOffset += localHeader.length + dataBytes.length
  })

  const centralDirectory = concatUint8Arrays(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUInt32LE(endView, 0, 0x06054b50)
  writeUInt16LE(endView, 4, 0)
  writeUInt16LE(endView, 6, 0)
  writeUInt16LE(endView, 8, files.length)
  writeUInt16LE(endView, 10, files.length)
  writeUInt32LE(endView, 12, centralDirectory.length)
  writeUInt32LE(endView, 16, localOffset)
  writeUInt16LE(endView, 20, 0)

  return concatUint8Arrays([...localParts, centralDirectory, end])
}
