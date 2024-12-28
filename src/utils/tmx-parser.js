import { XMLParser } from 'fast-xml-parser';

export function parseTMX(content) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseNodeValue: false,
    trimValues: false,
    isArray: (name) => ['tu', 'tuv', 'prop'].includes(name),
  });

  try {
    return parser.parse(content);
  } catch (error) {
    throw new Error(`Error while parsing TMX content: ${error.message}`);
  }
}
