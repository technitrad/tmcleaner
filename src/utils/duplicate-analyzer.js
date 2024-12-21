import { extractTUContent, isValidTU, normalizeTUText } from './tmx-core.js';

export function analyzeDuplicates(tmxData, priorities, options = {}) {
  if (!tmxData?.tmx?.body?.tu || !Array.isArray(tmxData.tmx.body.tu)) {
    throw new Error('Invalid TMX data structure');
  }

  const {
    matchMode = 'sourcesEqual',
    caseSensitive = false,
    ignorePunctuation = false,
    ignoreWhitespace = true,
    tagStrictness = 'permissive'
  } = options;

  try {
    const duplicateGroups = new Map();
    const duplicatesList = [];

    // First pass: Group translation units
    tmxData.tmx.body.tu.forEach((tu, index) => {
      if (!isValidTU(tu)) {
        console.warn(`Skipping invalid TU at index ${index}`);
        return;
      }

      const content = extractTUContent(tu);
      
      // Create all possible matching keys based on options
      const keys = generateMatchingKeys(content, {
        matchMode,
        caseSensitive,
        ignorePunctuation,
        ignoreWhitespace
      });

      keys.forEach(key => {
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        
        // Check tag compatibility
        if (isTagCompatible(tu, duplicateGroups.get(key)[0]?.originalTU, tagStrictness)) {
          duplicateGroups.get(key).push({
            ...content,
            originalTU: tu,
            normalizedKey: key
          });
        }
      });
    });

    // Second pass: Process duplicates
    duplicateGroups.forEach((units, key) => {
      if (units.length > 1) {
        // Sort units based on priorities
        const sortedUnits = units.sort((a, b) => 
          compareTUs(a.originalTU, b.originalTU, priorities)
        );

        // Add all units in the group to the duplicates list
        sortedUnits.forEach((unit, index) => {
          duplicatesList.push({
            sourceText: unit.sourceText,
            targetText: unit.targetText,
            creationId: unit.creationId,
            changeId: unit.changeId,
            creationDate: unit.creationDate,
            changeDate: unit.changeDate,
            status: index === 0 ? 'keep' : 'delete'
          });
        });
      }
    });

    console.log(`Found ${duplicatesList.length} total duplicates`);
    return duplicatesList;
  } catch (error) {
    console.error('Error analyzing duplicates:', error);
    throw new Error('Failed to analyze duplicates');
  }
}

function generateMatchingKeys(content, options) {
  const keys = new Set();
  const { matchMode, caseSensitive, ignorePunctuation, ignoreWhitespace } = options;

  // Generate variations of source and target text
  const sourceVariations = generateTextVariations(
    content.sourceText,
    caseSensitive,
    ignorePunctuation,
    ignoreWhitespace
  );

  const targetVariations = generateTextVariations(
    content.targetText,
    caseSensitive,
    ignorePunctuation,
    ignoreWhitespace
  );

  // Create keys based on match mode
  switch (matchMode) {
    case 'targetsEqual':
      targetVariations.forEach(target => keys.add(target));
      break;
    case 'bothEqual':
      sourceVariations.forEach(source => {
        targetVariations.forEach(target => {
          keys.add(`${source}|${target}`);
        });
      });
      break;
    default: // sourcesEqual
      sourceVariations.forEach(source => keys.add(source));
  }

  return Array.from(keys);
}

function generateTextVariations(text, caseSensitive, ignorePunctuation, ignoreWhitespace) {
  const variations = new Set();
  let processed = text;

  // Case sensitivity
  if (!caseSensitive) {
    processed = processed.toLowerCase();
  }

  // Add original or case-processed version
  variations.add(processed);

  // Add version with normalized whitespace
  if (ignoreWhitespace) {
    const normalizedSpace = processed.replace(/\s+/g, ' ').trim();
    variations.add(normalizedSpace);
  }

  // Add version without punctuation
  if (ignorePunctuation) {
    const noPunctuation = processed.replace(/[.,!?;:]/g, '');
    variations.add(noPunctuation);
    
    // Also add version with both normalized whitespace and no punctuation
    if (ignoreWhitespace) {
      const normalizedNoPunctuation = noPunctuation.replace(/\s+/g, ' ').trim();
      variations.add(normalizedNoPunctuation);
    }
  }

  return Array.from(variations);
}

function isTagCompatible(newTU, existingTU, strictness) {
  if (!existingTU) return true;

  const getTagInfo = (tu) => {
    const tags = [];
    tu.tuv.forEach(tuv => {
      const matches = tuv.seg.match(/<[^>]+>/g) || [];
      tags.push(...matches);
    });
    return tags;
  };

  const newTags = getTagInfo(newTU);
  const existingTags = getTagInfo(existingTU);

  switch (strictness) {
    case 'permissive':
      return newTags.length === existingTags.length;
    
    case 'medium':
      if (newTags.length !== existingTags.length) return false;
      return newTags.every((tag, i) => {
        const isClosing = tag.startsWith('</');
        const isEmptyElement = tag.endsWith('/>');
        const existingIsClosing = existingTags[i].startsWith('</');
        const existingIsEmptyElement = existingTags[i].endsWith('/>');
        return isClosing === existingIsClosing && isEmptyElement === existingIsEmptyElement;
      });
    
    case 'strict':
      return JSON.stringify(newTags) === JSON.stringify(existingTags);
    
    default:
      return true;
  }
}

function compareTUs(a, b, priorities) {
  const { creationId, changeId, changeDate, creationDate, priorityOrder } = priorities;

  if (priorityOrder === 'dates') {
    // Check dates first
    if (changeDate) {
      const aDate = a['@_changedate'] || '';
      const bDate = b['@_changedate'] || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    }

    if (creationDate) {
      const aDate = a['@_creationdate'] || '';
      const bDate = b['@_creationdate'] || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    }

    // Then check IDs
    if (creationId.length > 0) {
      const aIndex = creationId.indexOf(a['@_creationid']);
      const bIndex = creationId.indexOf(b['@_creationid']);
      if (aIndex !== bIndex) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
    }

    if (changeId.length > 0) {
      const aIndex = changeId.indexOf(a['@_changeid']);
      const bIndex = changeId.indexOf(b['@_changeid']);
      if (aIndex !== bIndex) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
    }
  } else {
    // Check IDs first
    if (creationId.length > 0) {
      const aIndex = creationId.indexOf(a['@_creationid']);
      const bIndex = creationId.indexOf(b['@_creationid']);
      if (aIndex !== bIndex) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
    }

    if (changeId.length > 0) {
      const aIndex = changeId.indexOf(a['@_changeid']);
      const bIndex = changeId.indexOf(b['@_changeid']);
      if (aIndex !== bIndex) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
    }

    // Then check dates
    if (changeDate) {
      const aDate = a['@_changedate'] || '';
      const bDate = b['@_changedate'] || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    }

    if (creationDate) {
      const aDate = a['@_creationdate'] || '';
      const bDate = b['@_creationdate'] || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    }
  }

  return 0;
}