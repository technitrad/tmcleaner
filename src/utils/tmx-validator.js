import { XMLParser } from 'fast-xml-parser';

export function validateTMX(text) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseNodeValue: false,
      trimValues: false
    });
    
    const result = parser.parse(text);

    // Check for required TMX structure
    if (!result.tmx) {
      throw new Error('Missing TMX root element');
    }

    if (!result.tmx.header) {
      throw new Error('Missing TMX header');
    }

    if (!result.tmx.body) {
      throw new Error('Missing TMX body');
    }

    if (!result.tmx.body.tu || !Array.isArray(result.tmx.body.tu)) {
      throw new Error('Missing or invalid translation units');
    }

    return true;
  } catch (error) {
    console.error('TMX validation error:', error);
    return false;
  }
}

export function extractTMXMetadata(tmx) {
  if (!tmx?.header) return null;
  
  return {
    creationTool: tmx.header['@_creationtool'] || '',
    creationToolVersion: tmx.header['@_creationtoolversion'] || '',
    segType: tmx.header['@_segtype'] || '',
    sourceLanguage: tmx.header['@_srclang'] || '',
    targetLanguage: tmx.header['@_targetlang'] || '',
    dataType: tmx.header['@_datatype'] || ''
  };
}