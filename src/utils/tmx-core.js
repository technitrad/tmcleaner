import { XMLParser } from 'fast-xml-parser';

export function parseTMXContent(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid TMX content: Content must be a non-empty string');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseNodeValue: false,
    trimValues: false,
    isArray: (name) => ['tu', 'tuv', 'prop'].includes(name)
  });

  try {
    const result = parser.parse(content);
    validateTMXStructure(result);
    return result;
  } catch (error) {
    throw new Error(`TMX parsing error: ${error.message}`);
  }
}

export function validateTMXStructure(data) {
  if (!data) {
    throw new Error('Invalid TMX: No data provided');
  }

  if (!data.tmx) {
    throw new Error('Invalid TMX: Missing root element');
  }

  if (!data.tmx.header) {
    throw new Error('Invalid TMX: Missing header element');
  }

  if (!data.tmx.body) {
    throw new Error('Invalid TMX: Missing body element');
  }

  if (!Array.isArray(data.tmx.body.tu)) {
    throw new Error('Invalid TMX: Missing or invalid translation units');
  }

  // Validate header structure
  validateHeader(data.tmx.header);

  // Validate all TUs
  data.tmx.body.tu.forEach((tu, index) => {
    if (!isValidTU(tu)) {
      throw new Error(`Invalid translation unit at index ${index}`);
    }
  });

  return true;
}

function validateHeader(header) {
  if (!header['@_srclang']) {
    throw new Error('Invalid TMX header: Missing source language');
  }

  if (header.prop && !Array.isArray(header.prop)) {
    throw new Error('Invalid TMX header: Properties must be an array');
  }

  if (header.prop) {
    header.prop.forEach((prop, index) => {
      if (!prop['@_type'] || !prop['#text']) {
        throw new Error(`Invalid header property at index ${index}`);
      }
    });
  }
}

export function extractTUContent(tu) {
  if (!tu) {
    throw new Error('Invalid translation unit: No data provided');
  }

  if (!isValidTU(tu)) {
    throw new Error('Invalid translation unit structure');
  }

  try {
    return {
      sourceText: getTUText(tu, 'en'),
      targetText: getTUText(tu, 'fr'),
      creationId: validateAttribute(tu['@_creationid']) || '-',
      changeId: validateAttribute(tu['@_changeid']) || '-',
      creationDate: validateAttribute(tu['@_creationdate']) || '-',
      changeDate: validateAttribute(tu['@_changedate']) || '-'
    };
  } catch (error) {
    throw new Error(`Failed to extract TU content: ${error.message}`);
  }
}

export function isValidTU(tu) {
  if (!tu || typeof tu !== 'object') {
    return false;
  }

  if (!Array.isArray(tu.tuv) || tu.tuv.length !== 2) {
    return false;
  }

  return tu.tuv.every(tuv => 
    tuv &&
    typeof tuv === 'object' &&
    typeof tuv['@_xml:lang'] === 'string' &&
    tuv['@_xml:lang'].trim().length > 0 &&
    typeof tuv.seg === 'string' &&
    tuv.seg.trim().length > 0
  );
}

function getTUText(tu, langPrefix) {
  if (!tu || !Array.isArray(tu.tuv)) {
    throw new Error(`Cannot get ${langPrefix} text: Invalid TU structure`);
  }

  const tuv = tu.tuv.find(t => 
    t && t['@_xml:lang'] && 
    t['@_xml:lang'].toLowerCase().startsWith(langPrefix.toLowerCase())
  );
  
  if (!tuv) {
    throw new Error(`Missing ${langPrefix} translation unit variant`);
  }

  if (!tuv.seg) {
    throw new Error(`Missing ${langPrefix} segment text`);
  }
  
  const text = tuv.seg.trim();
  if (text.length === 0) {
    throw new Error(`Empty ${langPrefix} segment text`);
  }

  return text;
}

function validateAttribute(attr) {
  if (attr === undefined || attr === null) {
    return '';
  }
  
  if (typeof attr !== 'string') {
    throw new Error(`Invalid attribute type: expected string, got ${typeof attr}`);
  }

  return attr.trim();
}

export function normalizeTUText(text) {
  if (typeof text !== 'string') {
    throw new Error('Invalid text for normalization: expected string');
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[.,!?;:]/g, ''); // Remove common punctuation
}