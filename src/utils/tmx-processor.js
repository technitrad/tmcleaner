import { createXMLParser, createXMLBuilder } from './xml-utils.js';
import { detectEncoding, decodeBuffer, encodeText } from './encoding-utils.js';

export async function processTMX(file, priorities, onProgress) {
  try {
    const buffer = await file.arrayBuffer();
    const encoding = detectEncoding(new Uint8Array(buffer));
    const text = decodeBuffer(buffer, encoding);
    
    const parser = createXMLParser();
    const data = parser.parse(text);
    
    // Process the TMX data based on priorities
    const { processedData, duplicateGroups, deletedSegments } = await processWithProgress(
      data,
      priorities,
      onProgress
    );
    
    const builder = createXMLBuilder();
    const outputXML = builder.build(processedData);
    
    return {
      content: outputXML,
      encoding,
      duplicateGroups,
      deletedSegments
    };
  } catch (error) {
    console.error('Error processing TMX:', error);
    throw new Error('Failed to process TMX file');
  }
}

async function processWithProgress(data, priorities, onProgress) {
  const body = data.find(node => node.body);
  if (!body || !body.body.tu) return { processedData: data, duplicateGroups: [], deletedSegments: [] };

  const tuMap = new Map();
  const duplicateGroups = new Map();
  const deletedSegments = [];
  const total = body.body.tu.length;
  let processed = 0;

  // First pass: Group duplicates
  body.body.tu.forEach(tu => {
    const key = getTUKey(tu);
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key).push({
      ...tu,
      sourceText: tu.tuv.find(tuv => tuv['@_xml:lang'] === 'en-ca')?.seg,
      targetText: tu.tuv.find(tuv => tuv['@_xml:lang'] === 'fr-ca')?.seg,
      creationId: tu['@_creationid'],
      changeId: tu['@_changeid'],
      creationDate: tu['@_creationdate'],
      changeDate: tu['@_changedate']
    });
  });

  // Second pass: Process and track progress
  body.body.tu = await new Promise(resolve => {
    const result = body.body.tu.filter(tu => {
      const key = getTUKey(tu);
      
      processed++;
      if (processed % 10 === 0) { // Update progress every 10 items
        onProgress(processed, total);
      }

      if (!tuMap.has(key)) {
        tuMap.set(key, tu);
        duplicateGroups.get(key).forEach(dupTu => {
          dupTu.isKept = dupTu === tu;
          if (!dupTu.isKept) {
            deletedSegments.push(dupTu);
          }
        });
        return true;
      }
      
      const existingTU = tuMap.get(key);
      if (shouldReplaceTU(existingTU, tu, priorities)) {
        tuMap.set(key, tu);
        duplicateGroups.get(key).forEach(dupTu => {
          dupTu.isKept = dupTu === tu;
          if (!dupTu.isKept) {
            deletedSegments.push(dupTu);
          }
        });
        return true;
      }
      
      return false;
    });
    
    onProgress(total, total); // Ensure we reach 100%
    resolve(result);
  });

  // Convert duplicateGroups map to array format for component
  const duplicateGroupsArray = Array.from(duplicateGroups.entries())
    .filter(([_, translations]) => translations.length > 1)
    .map(([sourceText, translations]) => ({
      sourceText,
      translations
    }));

  return { 
    processedData: data, 
    duplicateGroups: duplicateGroupsArray,
    deletedSegments 
  };
}

function getTUKey(tu) {
  const sourceText = tu.tuv.find(tuv => tuv['@_xml:lang'] === 'en-ca')?.seg;
  const targetText = tu.tuv.find(tuv => tuv['@_xml:lang'] === 'fr-ca')?.seg;
  return `${sourceText}|${targetText}`;
}

function shouldReplaceTU(existingTU, newTU, priorities) {
  const { creationId, changeId, changeDate, creationDate } = priorities;

  if (creationId && newTU['@_creationid'] === creationId) {
    return true;
  }

  if (changeId && newTU['@_changeid'] === changeId) {
    return true;
  }

  if (changeDate && newTU['@_changedate'] > existingTU['@_changedate']) {
    return true;
  }

  if (creationDate && newTU['@_creationdate'] > existingTU['@_creationdate']) {
    return true;
  }

  return false;
}