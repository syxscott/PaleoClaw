/**
 * Minimal XML envelope parser/serializer for the WeCom callback format.
 *
 * WeCom callback payloads are strictly flat, one-level documents:
 *   <xml><Encrypt><![CDATA[base64]]></Encrypt><MsgSignature>hex</MsgSignature>..</xml>
 * and decrypted messages follow the same shape
 * (<ToUserName><FromUserName><MsgType><Content>...).
 *
 * fast-xml-parser is not a root dependency, so this ~50-line parser handles
 * exactly what WeCom emits: one root element, flat text/CDATA children,
 * XML entities. It is not a general-purpose XML parser.
 */

export function decodeXmlText(raw: string): string {
  const text = raw.trim();
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata?.[1] !== undefined) {
    return cdata[1];
  }
  return decodeXmlEntities(text);
}

export function decodeXmlEntities(text: string): string {
  let out = text.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
  out = out.replace(/&#([0-9]+);/g, (_m, dec: string) =>
    String.fromCodePoint(Number.parseInt(dec, 10)),
  );
  out = out
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  // &amp; must be decoded last so "&amp;lt;" collapses to "&lt;" (literal text).
  out = out.replace(/&amp;/g, "&");
  return out;
}

export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Element name → decoded text content, for a flat one-level XML document. */
export function parseXmlEnvelope(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      break;
    }
    // Skip declarations, comments, processing instructions.
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<?", lt) || xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    const gt = xml.indexOf(">", lt);
    if (gt < 0) {
      break;
    }
    const rawTag = xml.slice(lt + 1, gt).trim();
    const tagName = rawTag.split(/\s+/)[0] ?? "";
    i = gt + 1;
    if (!tagName || rawTag.startsWith("/") || rawTag.endsWith("/")) {
      continue; // closing / self-closing tag
    }
    const closeTag = `</${tagName}>`;
    const close = xml.indexOf(closeTag, i);
    if (close < 0) {
      continue; // malformed child; ignore
    }
    const inner = xml.slice(i, close);
    const isCdataLeaf = /^\s*<!\[CDATA\[[\s\S]*?\]\]>\s*$/.test(inner);
    if (isCdataLeaf || !inner.includes("<")) {
      // Leaf node: record it and jump past the closing tag.
      out[tagName] = decodeXmlText(inner);
      i = close + closeTag.length;
    } else {
      // Container (e.g. the <xml> root): keep scanning its children.
      // i already points just past the opening tag.
    }
  }
  return out;
}

/** Serialize a flat `<xml>` envelope with escaped text children. */
export function buildXmlEnvelope(fields: Record<string, string | number>): string {
  const children = Object.entries(fields)
    .map(([key, value]) => `<${key}>${escapeXmlText(String(value))}</${key}>`)
    .join("");
  return `<xml>${children}</xml>`;
}
