import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export function escapeXML(text) {
  if (!text || typeof text !== 'string') return text;
  
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  
  return text.replace(/[&<>"']/g, char => entities[char]);
}

export function createXMLParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    trimValues: false,
    parseAttributeValue: false,
    parseTagValue: false,
    parseNodeValue: false,
    parseTrueNumberOnly: false,
    arrayMode: true,
    processEntities: false,
    cdataPropName: "__cdata",
    htmlEntities: false,
    isArray: (name) => ['tu', 'tuv', 'prop'].includes(name),
    tagValueProcessor: (tagName, tagValue, jPath, hasAttributes, isLeafNode) => {
      if (tagName === 'seg' && jPath.includes('x-context')) {
        return tagValue;
      }
      return tagValue;
    }
  });
}

export function createXMLBuilder() {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    preserveOrder: true,
    suppressEmptyNode: false,
    processEntities: false,
    indentBy: "  ",
    cdataPropName: "__cdata",
    tagValueProcessor: (tagName, tagValue) => {
      if (tagName === 'prop' && tagValue.includes('<seg>')) {
        return tagValue;
      }
      return escapeXML(tagValue);
    }
  });
}

export function validateXML(text) {
  try {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    const parser = createXMLParser();
    const result = parser.parse(text);
    
    return result && typeof result === 'object';
  } catch (error) {
    console.error('XML validation error:', error);
    return false;
  }
}

export function preserveXMLContent(content) {
  return content.replace(
    /(<prop type="x-context-[^"]*">)(.*?)(<\/prop>)/g,
    (match, openTag, content, closeTag) => {
      if (content.trim().startsWith('<seg>')) {
        return match;
      }
      return `${openTag}<seg>${escapeXML(content.trim())}</seg>${closeTag}`;
    }
  );
}

export function formatXMLOutput(content, indentSize = 2) {
  const lines = content.split('\n');
  let indent = 0;
  const indentStr = ' '.repeat(indentSize);
  
  return lines.map(line => {
    line = line.trim();
    if (!line) return '';
    
    // Decrease indent for closing tags
    if (line.startsWith('</')) {
      indent--;
    }
    
    // Add current indentation
    const currentIndent = indentStr.repeat(Math.max(0, indent));
    const formattedLine = currentIndent + line;
    
    // Increase indent for opening tags (not self-closing)
    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
      indent++;
    }
    
    return formattedLine;
  }).join('\n');
}