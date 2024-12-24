import { XMLParser } from 'fast-xml-parser';

export function parseTMXContent(content) {
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
  if (!data?.tmx) {
    throw new Error('Invalid TMX: Missing root element');
  }

  if (!data.tmx.header) {
    throw new Error('Invalid TMX: Missing header');
  }

  if (!data.tmx.body?.tu) {
    throw new Error('Invalid TMX: Missing translation units');
  }

  return true;
}

export function extractTUContent(tu) {
  if (!isValidTU(tu)) {
    throw new Error('Invalid translation unit structure');
  }

  return {
    sourceText: getTUText(tu, 'en'),
    targetText: getTUText(tu, 'fr'),
    creationId: tu['@_creationid'] || '-',
    changeId: tu['@_changeid'] || '-',
    creationDate: tu['@_creationdate'] || '-',
    changeDate: tu['@_changedate'] || '-'
  };
}

export function isValidTU(tu) {
  if (!tu || !Array.isArray(tu.tuv) || tu.tuv.length !== 2) {
    return false;
  }

  return tu.tuv.every(tuv => 
    tuv &&
    tuv['@_xml:lang'] &&
    typeof tuv.seg === 'string' &&
    tuv.seg.trim().length > 0
  );
}

function getTUText(tu, langPrefix) {
  const tuv = tu.tuv.find(t => 
    t['@_xml:lang'].toLowerCase().startsWith(langPrefix.toLowerCase())
  );
  
  if (!tuv?.seg) {
    throw new Error(`Missing ${langPrefix} text`);
  }
  
  return tuv.seg.trim();
}

export function normalizeTUText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[.,!?;:]/g, ''); // Remove common punctuation
}