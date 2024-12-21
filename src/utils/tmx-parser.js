import { XMLParser } from 'fast-xml-parser';

export function parseTMX(content) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseNodeValue: false,
    trimValues: false,
    isArray: (name) => ['tu', 'tuv', 'prop'].includes(name)
  });
  
  return parser.parse(content);
}