import { TextDecoder } from 'text-encoding';
import { createXMLParser } from './xml-utils.js';
import { validateTMX } from './tmx-validator.js';

export async function readTMXFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-16le');
    const content = decoder.decode(buffer);

    if (!content) {
      throw new Error('Failed to decode file content');
    }

    if (!validateTMX(content)) {
      throw new Error('Invalid TMX format');
    }

    return { content, encoding: 'utf-16le' };
  } catch (error) {
    console.error('TMX reading error:', error);
    throw new Error(`Failed to read TMX file: ${error.message}`);
  }
}

export function extractTranslationUnits(content) {
  try {
    const parser = createXMLParser();
    const result = parser.parse(content);

    if (!result?.tmx?.body?.tu) {
      throw new Error('No translation units found in TMX');
    }

    const tus = Array.isArray(result.tmx.body.tu) 
      ? result.tmx.body.tu 
      : [result.tmx.body.tu];

    return tus.map(tu => ({
      ...tu,
      sourceText: extractSegment(tu, 'en-ca'),
      targetText: extractSegment(tu, 'fr-ca')
    }));
  } catch (error) {
    console.error('Translation unit extraction error:', error);
    throw new Error('Failed to extract translation units');
  }
}

function extractSegment(tu, lang) {
  try {
    const tuv = Array.isArray(tu.tuv) 
      ? tu.tuv.find(t => t['@_xml:lang'] === lang)
      : tu.tuv;
    return tuv?.seg || '';
  } catch (error) {
    console.error('Segment extraction error:', error);
    return '';
  }
}