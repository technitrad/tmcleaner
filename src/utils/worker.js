// Web Worker for processing TMX files
self.onmessage = async function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'analyzeDuplicates':
      try {
        let processed = 0;
        const { tmxData, priorities, options } = data;
        const total = tmxData.tmx.body.tu.length;
        const duplicateGroups = new Map();

        // Process in chunks to avoid blocking
        for (let i = 0; i < total; i += 100) {
          const chunk = tmxData.tmx.body.tu.slice(i, i + 100);
          
          // Process chunk
          chunk.forEach(tu => {
            try {
              // Extract and validate content
              const content = extractTUContent(tu);
              if (!content.sourceText || !content.targetText) {
                console.warn('Invalid TU content:', tu);
                return;
              }

              // Group translation units
              const key = getTUKey(content, options);
              if (!duplicateGroups.has(key)) {
                duplicateGroups.set(key, []);
              }
              duplicateGroups.get(key).push({ ...content, originalTU: tu });
            } catch (error) {
              console.warn('Error processing TU:', error);
            }
          });

          processed += chunk.length;
          
          // Report progress
          self.postMessage({
            type: 'progress',
            data: { processed, total }
          });

          // Allow other tasks to run
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Process duplicates
        const duplicatesList = [];
        duplicateGroups.forEach((units, key) => {
          if (units.length > 1) {
            units.sort((a, b) => compareTUs(a.originalTU, b.originalTU, priorities));
            units.forEach((unit, index) => {
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

        self.postMessage({
          type: 'complete',
          data: duplicatesList
        });
      } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
          type: 'error',
          data: error.message
        });
      }
      break;
  }
};

function getTUKey(content, options) {
  const { matchMode, caseSensitive, ignorePunctuation, ignoreWhitespace } = options;
  
  let sourceText = content.sourceText.toString();
  let targetText = content.targetText.toString();

  if (!caseSensitive) {
    sourceText = sourceText.toLowerCase();
    targetText = targetText.toLowerCase();
  }

  if (ignoreWhitespace) {
    sourceText = sourceText.replace(/\s+/g, ' ').trim();
    targetText = targetText.replace(/\s+/g, ' ').trim();
  }

  if (ignorePunctuation) {
    sourceText = sourceText.replace(/[.,!?;:]/g, '');
    targetText = targetText.replace(/[.,!?;:]/g, '');
  }

  switch (matchMode) {
    case 'targetsEqual':
      return targetText;
    case 'bothEqual':
      return `${sourceText}|${targetText}`;
    default: // sourcesEqual
      return sourceText;
  }
}

function extractTUContent(tu) {
  const sourceText = getTUVText(tu, 'en');
  const targetText = getTUVText(tu, 'fr');

  if (!sourceText || !targetText) {
    throw new Error('Missing source or target text');
  }

  return {
    sourceText,
    targetText,
    creationId: tu['@_creationid'] || '',
    changeId: tu['@_changeid'] || '',
    creationDate: tu['@_creationdate'] || '',
    changeDate: tu['@_changedate'] || ''
  };
}

function getTUVText(tu, langPrefix) {
  try {
    const tuv = tu.tuv.find(t => t['@_xml:lang'].toLowerCase().startsWith(langPrefix));
    return tuv?.seg?.toString().trim() || '';
  } catch (error) {
    console.warn(`Error extracting ${langPrefix} text:`, error);
    return '';
  }
}

function compareTUs(a, b, priorities) {
  const { creationId, changeId, changeDate, creationDate, priorityOrder } = priorities;

  if (priorityOrder === 'dates') {
    if (changeDate) {
      const comp = (b['@_changedate'] || '').localeCompare(a['@_changedate'] || '');
      if (comp !== 0) return comp;
    }
    if (creationDate) {
      const comp = (b['@_creationdate'] || '').localeCompare(a['@_creationdate'] || '');
      if (comp !== 0) return comp;
    }
  }

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

  if (priorityOrder !== 'dates') {
    if (changeDate) {
      const comp = (b['@_changedate'] || '').localeCompare(a['@_changedate'] || '');
      if (comp !== 0) return comp;
    }
    if (creationDate) {
      const comp = (b['@_creationdate'] || '').localeCompare(a['@_creationdate'] || '');
      if (comp !== 0) return comp;
    }
  }

  return 0;
}