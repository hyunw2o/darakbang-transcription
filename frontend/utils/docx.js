import { buildZipFile } from './zip'

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

export const buildDocxBlob = (title, text) => {
  const paragraphs = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === '' && idx === arr.length - 1))
    .map((line) => {
      const safe = escapeXml(line === '' ? ' ' : line)
      return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`
    })
    .join('')

  const safeTitle = escapeXml(title || 'mallog24')
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
</w:document>`

  const zipBytes = buildZipFile([
    { path: '[Content_Types].xml', content: CONTENT_TYPES_XML },
    { path: '_rels/.rels', content: RELS_XML },
    { path: 'word/document.xml', content: documentXml },
  ])

  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
