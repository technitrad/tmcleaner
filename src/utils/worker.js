import { FILE_PROCESSING } from './constants.js';

// Web Worker for processing TMX files
const BATCH_SIZE = 1000; // Increased batch size for better performance
const CLEANUP_THRESHOLD = 5000; // Memory cleanup threshold

self.onmessage = async function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'analyzeDuplicates':
      try {
        let processed = 0;
        const { tmxData, priorities, options } = data;
        
        // Validate input structure
        if (!tmxData?.tmx?.body?.tu) {
          throw new Error('Invalid TMX structure: missing translation units');
        }

        // Ensure tu is always an array
        const translationUnits = Array.isArray(tmxData.tmx.body.tu) 
          ? tmxData.tmx.body.tu 
          : [tmxData.tmx.body.tu];

        const total = translationUnits.length;
        const duplicateGroups = new Map();

        // Process in batches to avoid blocking
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const batchEnd = Math.min(i + BATCH_SIZE, total);
          const chunk = translationUnits.slice(i, batchEnd);
          
          // Process chunk
          chunk.forEach(tu => {
            try {
              // Validate TU structure
              if (!tu || typeof tu !== 'object') {
                console.warn('Invalid TU: not an object', tu);
                return;
              }

              // Extract and validate content
              const content = extractTUContent(tu);
              if (!content || !content.sourceText || !content.targetText) {
                console.warn('Invalid TU content:', tu);
                return;
              }

              // Group translation units
              const key = getTUKey(content, options);
              if (!duplicateGroups.has(key)) {
                duplicateGroups.set(key, []);
              }
              duplicateGroups.get(key).push({ ...content, originalTU: tu });

              // Memory cleanup if needed
              if (duplicateGroups.size >= CLEANUP_THRESHOLD) {
                consolidateGroups(duplicateGroups);
              }
            } catch (error) {
              console.warn('Error processing TU:', error);
            }
          });

          processed += chunk.length;
          
          // Report progress
          self.postMessage({
            type: 'progress',
            data: { 
              processed, 
              total,
              phase: FILE_PROCESSING.PHASES.ANALYZING
            }
          });

          // Allow other tasks to run
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Process duplicates
        const duplicatesList = [];
        let groupsProcessed = 0;
        const totalGroups = duplicateGroups.size;

        for (const [_, units] of duplicateGroups) {
          if (units.length > 1) {
            try {
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
            } catch (error) {
              console.warn('Error processing duplicate group:', error);
            }
          }

          // Report progress during final processing
          groupsProcessed++;
          if (groupsProcessed % 100 === 0) {
            self.postMessage({
              type: 'progress',
              data: { 
                processed: total,
                total,
                phase: FILE_PROCESSING.PHASES.FINALIZING,
                subProgress: Math.round((groupsProcessed / totalGroups) * 100)
              }
            });
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

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

function consolidateGroups(duplicateGroups) {
  // Remove single-entry groups to save memory
  const groupsToDelete = [];
  for (const [key, group] of duplicateGroups.entries()) {
    if (group.length === 1) {
      groupsToDelete.push(key);
    }
  }
  groupsToDelete.forEach(key => {
    duplicateGroups.delete(key);
  });
}

function getTUKey(content, options) {
  if (!content || !options) {
    throw new Error('Invalid input for key generation');
  }

  const { matchMode, caseSensitive, ignorePunctuation, ignoreWhitespace } = options;
  
  let sourceText = content.sourceText?.toString() || '';
  let targetText = content.targetText?.toString() || '';

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
  if (!tu || !Array.isArray(tu.tuv)) {
    throw new Error('Invalid translation unit structure');
  }

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
    const tuv = tu.tuv.find(t => 
      t['@_xml:lang']?.toLowerCase().startsWith(langPrefix.toLowerCase())
    );
    return tuv?.seg?.toString().trim() || '';
  } catch (error) {
    console.warn(`Error extracting ${langPrefix} text:`, error);
    return '';
  }
}

function compareTUs(a, b, priorities) {
  if (!a || !b || !priorities) {
    return 0;
  }

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

  if (creationId?.length > 0) {
    const aIndex = creationId.indexOf(a['@_creationid']);
    const bIndex = creationId.indexOf(b['@_creationid']);
    if (aIndex !== bIndex) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
  }

  if (changeId?.length > 0) {
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