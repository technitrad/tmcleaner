import { XMLParser } from 'fast-xml-parser';

export function validateTMX(content) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      parseNodeValue: false,
      trimValues: false
    });
    
    const result = parser.parse(content);

    if (!result.tmx) {
      throw new Error('Invalid TMX: Missing root element');
    }

    if (!result.tmx.header) {
      throw new Error('Invalid TMX: Missing header');
    }

    if (!result.tmx.body) {
      throw new Error('Invalid TMX: Missing body');
    }

    if (!result.tmx.body.tu) {
      throw new Error('Invalid TMX: No translation units found');
    }

    return { isValid: true, data: result };
  } catch (error) {
    return { 
      isValid: false, 
      error: error.message || 'Invalid TMX format'
    };
  }
}