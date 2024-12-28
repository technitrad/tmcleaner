import { XMLParser } from 'fast-xml-parser';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_BATCH_MEMORY = 1.5 * 1024 * 1024; // 1.5MB per batch
let currentBatchSize = 2000; // Initial batch size, will adjust dynamically

self.onmessage = async function(e) {
  console.log('Worker received message:', e.data);  // ADD THIS LINE
  const { type, data } = e.data;

  if (type === 'analyzeDuplicates') {
    try {
      console.log('Starting duplicate analysis in worker');  // ADD THIS LINE
      if (!data || !data.tmxData || !data.priorities || !data.options) {
        throw new Error('Invalid input data for duplicate analysis');
      }

      const { tmxData, priorities, options } = data;
      
      if (!tmxData.tmx?.body?.tu) {
        throw new Error('Invalid TMX structure: Missing translation units');
      }

      const total = tmxData.tmx.body.tu.length;
      const duplicateGroups = new Map();
      let processed = 0;
      let currentBatch = [];
      let batchMemorySize = 0;

      // First pass: Group duplicates with adaptive batch size
      for (let i = 0; i < total; i++) {
        const tu = tmxData.tmx.body.tu[i];
        if (!tu) {
          console.warn(`Invalid TU at index ${i}, skipping`);
          continue;
        }

        try {
          const tuSize = estimateTUSize(tu);

          if (batchMemorySize + tuSize > MAX_BATCH_MEMORY) {
            const failedTUs = await processBatch(currentBatch, duplicateGroups, options);
            processed += currentBatch.length - failedTUs.length;
            
            if (failedTUs.length > 0) {
              console.warn(`Failed to process ${failedTUs.length} TUs in batch starting at index ${i - currentBatch.length}`);
            }
            
            self.postMessage({
              type: 'progress',
              data: { 
                processed,
                total,
                stage: 'grouping duplicates'
              }
            });

            // Adjust batch size based on memory usage and failures
            if (failedTUs.length > currentBatch.length * 0.1) {
              currentBatchSize = Math.max(100, Math.floor(currentBatchSize * 0.8));
              console.warn(`Reduced batch size to ${currentBatchSize} due to high failure rate`);
            } else {
              currentBatchSize = Math.floor(currentBatch.length * (MAX_BATCH_MEMORY / batchMemorySize));
            }
            
            currentBatch = [tu];
            batchMemorySize = tuSize;
            await checkAndCleanMemory();
            
            // Clear single-entry groups to save memory
            let clearedCount = 0;
            for (const [key, units] of duplicateGroups) {
              if (units.length === 1) {
                duplicateGroups.delete(key);
                clearedCount++;
              }
            }
            if (clearedCount > 0) {
              console.log(`Cleared ${clearedCount} single-entry groups to optimize memory`);
            }
          } else {
            currentBatch.push(tu);
            batchMemorySize += tuSize;
          }
        } catch (error) {
          console.error(`Error processing TU at index ${i}:`, error);
          // Continue with next TU
        }
      }

      // Process any remaining TUs
      if (currentBatch.length > 0) {
        const failedTUs = await processBatch(currentBatch, duplicateGroups, options);
        processed += currentBatch.length - failedTUs.length;
      }

      // Second pass: Process duplicates
      const duplicatesList = [];
      let groupsProcessed = 0;
      const entries = Array.from(duplicateGroups.entries());
      const totalGroups = entries.length;
      currentBatch = [];
      batchMemorySize = 0;

      for (const entry of entries) {
        const [key, units] = entry;
        try {
          const entrySize = estimateGroupSize(units);

          if (batchMemorySize + entrySize > MAX_BATCH_MEMORY) {
            await processGroupBatch(currentBatch, duplicatesList, priorities);
            groupsProcessed += currentBatch.length;

            self.postMessage({
              type: 'progress',
              data: { 
                processed: groupsProcessed,
                total: totalGroups,
                stage: 'sorting duplicates'
              }
            });

            currentBatch = [[key, units]];
            batchMemorySize = entrySize;
            await checkAndCleanMemory();
          } else {
            currentBatch.push([key, units]);
            batchMemorySize += entrySize;
          }
        } catch (error) {
          console.error(`Error processing duplicate group for key ${key}:`, error);
          // Continue with next group
        }
      }

      // Process remaining groups
      if (currentBatch.length > 0) {
        await processGroupBatch(currentBatch, duplicatesList, priorities);
      }

      // Final cleanup
      duplicateGroups.clear();
      await checkAndCleanMemory();

      if (duplicatesList.length === 0) {
        throw new Error('No valid duplicates found in the analysis');
      }

      self.postMessage({
        type: 'complete',
        data: duplicatesList
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        data: `Duplicate analysis failed: ${error.message}`
      });
    }
  } else {
    self.postMessage({
      type: 'error',
      data: `Unknown command type: ${type}`
    });
  }
};

async function processBatch(batch, duplicateGroups, options) {
  if (!Array.isArray(batch)) {
    throw new Error('Invalid batch: Expected array of TUs');
  }

  const failedTUs = [];
  
  for (const tu of batch) {
    try {
      if (!tu || !Array.isArray(tu.tuv)) {
        failedTUs.push({ tu, error: 'Invalid TU structure' });
        continue;
      }

      const content = extractTUContent(tu);
      if (!content.sourceText || !content.targetText) {
        failedTUs.push({ tu, error: 'Missing source or target text' });
        continue;
      }

      const key = getTUKey(content, options);
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key).push({ ...content, originalTU: tu });
    } catch (error) {
      console.warn('Error processing TU:', error);
      failedTUs.push({ tu, error: error.message });
    }
  }

  return failedTUs;
}

async function processGroupBatch(groupBatch, duplicatesList, priorities) {
  if (!Array.isArray(groupBatch)) {
    throw new Error('Invalid group batch: Expected array of groups');
  }

  for (const [key, units] of groupBatch) {
    if (!Array.isArray(units) || units.length < 2) {
      console.warn(`Skipping invalid group for key: ${key}`);
      continue;
    }

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
      console.error(`Error processing group ${key}:`, error);
      // Continue with next group
    }
  }
}

function estimateTUSize(tu) {
  if (!tu || typeof tu !== 'object') {
    throw new Error('Invalid TU: Expected object');
  }

  let size = 0;
  Object.entries(tu).forEach(([key, value]) => {
    size += key.length * 2;
    if (typeof value === 'string') {
      size += value.length * 2;
    }
  });

  if (Array.isArray(tu.tuv)) {
    tu.tuv.forEach(tuv => {
      if (tuv && typeof tuv === 'object') {
        Object.entries(tuv).forEach(([key, value]) => {
          size += key.length * 2;
          if (typeof value === 'string') {
            size += value.length * 2;
          }
        });
      }
    });
  }

  return size;
}

function estimateGroupSize(units) {
  if (!Array.isArray(units)) {
    throw new Error('Invalid units: Expected array');
  }

  return units.reduce((size, unit) => {
    try {
      return size + estimateTUSize(unit.originalTU) + 
             (unit.sourceText?.length || 0) * 2 +
             (unit.targetText?.length || 0) * 2;
    } catch (error) {
      console.warn('Error estimating unit size:', error);
      return size;
    }
  }, 0);
}

async function checkAndCleanMemory() {
  if (globalThis.gc) {
    globalThis.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 20));
}

function getTUKey(content, options) {
  if (!content || !options) {
    throw new Error('Invalid arguments for getTUKey');
  }

  const { matchMode, caseSensitive, ignorePunctuation, ignoreWhitespace } = options;
  
  let sourceText = content.sourceText?.toString() || '';
  let targetText = content.targetText?.toString() || '';

  if (!sourceText || !targetText) {
    throw new Error('Missing source or target text for key generation');
  }

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
    case 'sourcesEqual':
      return sourceText;
    default:
      throw new Error(`Invalid match mode: ${matchMode}`);
  }
}

function extractTUContent(tu) {
  if (!tu || !Array.isArray(tu.tuv)) {
    throw new Error('Invalid TU structure for content extraction');
  }

  const sourceText = getTUVText(tu, 'en');
  const targetText = getTUVText(tu, 'fr');

  if (!sourceText || !targetText) {
    throw new Error('Missing source or target text in TU');
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
  if (!tu || !Array.isArray(tu.tuv)) {
    throw new Error(`Invalid TU structure for ${langPrefix} text extraction`);
  }

  try {
    const tuv = tu.tuv.find(t => t['@_xml:lang']?.toLowerCase().startsWith(langPrefix));
    if (!tuv) {
      throw new Error(`No ${langPrefix} translation found`);
    }
    return tuv?.seg?.toString().trim() || '';
  } catch (error) {
    console.warn(`Error extracting ${langPrefix} text:`, error);
    return '';
  }
}

function compareTUs(a, b, priorities) {
  if (!a || !b || !priorities) {
    throw new Error('Invalid arguments for TU comparison');
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