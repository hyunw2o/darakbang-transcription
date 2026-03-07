function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function utf8Encode(text) {
  const value = String(text || "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  const encoded = encodeURIComponent(value);
  const out = [];
  for (let i = 0; i < encoded.length; i += 1) {
    const ch = encoded[i];
    if (ch === "%") {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(ch.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const idx = (crc ^ bytes[i]) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[idx];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUInt32LE(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function concatUint8Arrays(arrays) {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((arr) => {
    out.set(arr, offset);
    offset += arr.length;
  });
  return out;
}

function buildZipFile(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach((file) => {
    const nameBytes = utf8Encode(file.path);
    const dataBytes = utf8Encode(file.content);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUInt32LE(localView, 0, 0x04034b50);
    writeUInt16LE(localView, 4, 20);
    writeUInt16LE(localView, 6, 0);
    writeUInt16LE(localView, 8, 0);
    writeUInt16LE(localView, 10, 0);
    writeUInt16LE(localView, 12, 0);
    writeUInt32LE(localView, 14, crc);
    writeUInt32LE(localView, 18, dataBytes.length);
    writeUInt32LE(localView, 22, dataBytes.length);
    writeUInt16LE(localView, 26, nameBytes.length);
    writeUInt16LE(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUInt32LE(centralView, 0, 0x02014b50);
    writeUInt16LE(centralView, 4, 20);
    writeUInt16LE(centralView, 6, 20);
    writeUInt16LE(centralView, 8, 0);
    writeUInt16LE(centralView, 10, 0);
    writeUInt16LE(centralView, 12, 0);
    writeUInt16LE(centralView, 14, 0);
    writeUInt32LE(centralView, 16, crc);
    writeUInt32LE(centralView, 20, dataBytes.length);
    writeUInt32LE(centralView, 24, dataBytes.length);
    writeUInt16LE(centralView, 28, nameBytes.length);
    writeUInt16LE(centralView, 30, 0);
    writeUInt16LE(centralView, 32, 0);
    writeUInt16LE(centralView, 34, 0);
    writeUInt16LE(centralView, 36, 0);
    writeUInt32LE(centralView, 38, 0);
    writeUInt32LE(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + dataBytes.length;
  });

  const centralDirectory = concatUint8Arrays(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUInt32LE(endView, 0, 0x06054b50);
  writeUInt16LE(endView, 4, 0);
  writeUInt16LE(endView, 6, 0);
  writeUInt16LE(endView, 8, files.length);
  writeUInt16LE(endView, 10, files.length);
  writeUInt32LE(endView, 12, centralDirectory.length);
  writeUInt32LE(endView, 16, localOffset);
  writeUInt16LE(endView, 20, 0);

  return concatUint8Arrays([...localParts, centralDirectory, end]);
}

function uint8ToBase64(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += chars[(triple >> 18) & 0x3f];
    output += chars[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : "=";
    output += i + 2 < bytes.length ? chars[triple & 0x3f] : "=";
  }
  return output;
}

function buildDocxBase64(title, text) {
  const paragraphs = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === "" && idx === arr.length - 1))
    .map((line) => {
      const safe = escapeXml(line === "" ? " " : line);
      return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    })
    .join("");

  const safeTitle = escapeXml(title || "mallog24");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${safeTitle}</w:t></w:r></w:p>
    ${paragraphs || '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>'}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zipBytes = buildZipFile([
    { path: "[Content_Types].xml", content: contentTypes },
    { path: "_rels/.rels", content: rels },
    { path: "word/document.xml", content: documentXml },
  ]);

  return uint8ToBase64(zipBytes);
}

export { buildDocxBase64 };
