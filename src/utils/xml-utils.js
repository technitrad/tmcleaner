import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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
    arrayMode: (tagName) => ['tu', 'tuv'].includes(tagName),
    processEntities: false,
    cdataPropName: "__cdata",
    htmlEntities: false
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
    htmlEntities: false
  });
}

export function validateXML(text) {
  try {
    const parser = createXMLParser();
    parser.parse(text);
    return true;
  } catch (error) {
    console.error('XML validation error:', error);
    return false;
  }
}