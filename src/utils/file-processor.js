import { parseTMX } from './tmx-parser.js';
import { validateTMX } from './tmx-validator.js';
import { detectEncoding, decodeBuffer } from './encoding-utils.js';
import { FILE_PROCESSING } from './constants.js';

// Constants for file processing
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for file reading
const BATCH_SIZE = 1000; // Batch size for processing
const CLEANUP_THRESHOLD = 5000; // Memory cleanup threshold

export async function processTMXFile(file) {
  try {
    // Read file in chunks with progress tracking
    const buffer = await readFileInChunks(file, (progress) => {
      dispatchProgress(FILE_PROCESSING.PHASES.READING, progress);
    });

    dispatchProgress(FILE_PROCESSING.PHASES.DETECTING, 0);
    const encoding = detectEncoding(buffer);
    dispatchProgress(FILE_PROCESSING.PHASES.DETECTING, 100);

    dispatchProgress(FILE_PROCESSING.PHASES.DECODING, 0);
    const content = await decodeBuffer(buffer, encoding);
    if (!content) {
      throw new Error('Failed to decode file content');
    }
    dispatchProgress(FILE_PROCESSING.PHASES.DECODING, 100);
    
    dispatchProgress(FILE_PROCESSING.PHASES.VALIDATING, 0);
    const validation = validateTMX(content);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    dispatchProgress(FILE_PROCESSING.PHASES.VALIDATING, 100);

    dispatchProgress(FILE_PROCESSING.PHASES.PARSING, 0);
    const tmxData = parseTMX(content);
    if (!tmxData?.tmx?.body?.tu) {
      throw new Error('Invalid TMX structure: missing translation units');
    }

    // Ensure tu is always an array
    if (!Array.isArray(tmxData.tmx.body.tu)) {
      tmxData.tmx.body.tu = [tmxData.tmx.body.tu];
    }
    
    const metadata = await extractMetadataInBatches(tmxData, (progress) => {
      dispatchProgress(FILE_PROCESSING.PHASES.PARSING, 50 + (progress / 2));
    });

    dispatchProgress(FILE_PROCESSING.PHASES.COMPLETE, 100);

    return {
      content: tmxData,
      metadata
    };
  } catch (error) {
    console.error('File processing error:', error);
    dispatchProgress(FILE_PROCESSING.PHASES.ERROR, 0, error.message);
    throw new Error(`Failed to process TMX file: ${error.message}`);
  }
}

async function readFileInChunks(file, progressCallback) {
  const chunks = [];
  let offset = 0;
  const reader = new FileReader();

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });

    chunks.push(new Uint8Array(arrayBuffer));
    offset += chunk.length;
    
    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    progressCallback(progress);
    
    // Allow UI to update between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Combine chunks
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const combinedBuffer = new Uint8Array(totalLength);
  let position = 0;

  chunks.forEach(chunk => {
    combinedBuffer.set(chunk, position);
    position += chunk.length;
  });

  return combinedBuffer;
}

async function extractMetadataInBatches(tmxData, progressCallback) {
  const header = tmxData.tmx.header;
  const translationUnits = tmxData.tmx.body.tu;
  const totalUnits = translationUnits.length;

  const creationIds = new Set();
  const changeIds = new Set();
  const processedIds = new Set();

  // Process translation units in batches
  for (let i = 0; i < totalUnits; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, totalUnits);
    const batch = translationUnits.slice(i, batchEnd);

    batch.forEach(tu => {
      if (tu['@_creationid']) {
        creationIds.add(tu['@_creationid']);
        processedIds.add(tu['@_creationid']);
      }
      if (tu['@_changeid']) {
        changeIds.add(tu['@_changeid']);
        processedIds.add(tu['@_changeid']);
      }

      // Memory cleanup if needed
      if (processedIds.size >= CLEANUP_THRESHOLD) {
        processedIds.clear();
      }
    });

    const progress = Math.round((batchEnd / totalUnits) * 100);
    progressCallback(progress);

    // Allow UI to update between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return {
    sourceLanguage: header['@_srclang'] || '',
    targetLanguage: header.prop?.find(p => p['@_type'] === 'targetlang')?.['#text'] || '',
    creationTool: header['@_creationtool'] || '',
    creationToolVersion: header['@_creationtoolversion'] || '',
    segmentType: header['@_segtype'] || '',
    creationIds: Array.from(creationIds),
    changeIds: Array.from(changeIds),
    totalSegments: totalUnits
  };
}

function dispatchProgress(phase, progress, errorMessage = '') {
  window.dispatchEvent(new CustomEvent('fileProcessProgress', {
    detail: {
      phase,
      progress,
      error: errorMessage,
      timestamp: Date.now()
    }
  }));
}