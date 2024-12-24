import { detectFileEncoding, decodeWithEncoding, encodeWithEncoding } from './encoding-detector.js';
import { parseTMXContent, extractTUContent, isValidTU } from './tmx-core.js';
import { buildTMXContent } from './tmx-builder.js';
import { FILE_PROCESSING } from './constants.js';

// Match batch size with worker.js
const BATCH_SIZE = 1000;
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for file reading
const CLEANUP_THRESHOLD = 5000; // Match worker.js cleanup threshold

export async function processTMX(file, priorities, userDuplicates) {
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file input');
  }

  try {
    // Read file in chunks and detect encoding
    const buffer = await readFileInChunks(file, (progress) => {
      dispatchProgress(FILE_PROCESSING.PHASES.READING, progress);
    });

    const encodingInfo = detectFileEncoding(buffer);
    console.log('Detected encoding:', encodingInfo);

    dispatchProgress(FILE_PROCESSING.PHASES.DECODING, 0);
    // Decode content with validation
    const content = decodeWithEncoding(buffer, encodingInfo);
    if (!content) {
      throw new Error('Failed to decode file content');
    }
    dispatchProgress(FILE_PROCESSING.PHASES.DECODING, 100);
    
    dispatchProgress(FILE_PROCESSING.PHASES.PARSING, 0);
    // Parse TMX content with validation
    const tmxData = parseTMXContent(content);
    if (!tmxData?.tmx?.body?.tu) {
      throw new Error('Invalid TMX structure: missing translation units');
    }

    // Ensure tu is always an array
    if (!Array.isArray(tmxData.tmx.body.tu)) {
      tmxData.tmx.body.tu = [tmxData.tmx.body.tu];
    }
    dispatchProgress(FILE_PROCESSING.PHASES.PARSING, 100);
    
    dispatchProgress(FILE_PROCESSING.PHASES.FILTERING, 0);
    // Filter duplicates with batch processing
    const filteredTUs = await filterDuplicatesInBatches(
      tmxData.tmx.body.tu, 
      userDuplicates,
      (progress) => dispatchProgress(FILE_PROCESSING.PHASES.FILTERING, progress)
    );
    if (!Array.isArray(filteredTUs)) {
      throw new Error('Failed to process translation units');
    }
    tmxData.tmx.body.tu = filteredTUs;

    dispatchProgress(FILE_PROCESSING.PHASES.BUILDING, 0);
    // Build output preserving original structure
    const outputXML = await buildTMXContent(tmxData);
    if (!outputXML) {
      throw new Error('Failed to build output XML');
    }
    dispatchProgress(FILE_PROCESSING.PHASES.BUILDING, 100);
    
    dispatchProgress(FILE_PROCESSING.PHASES.ENCODING, 0);
    // Encode with original encoding
    const encodedContent = encodeWithEncoding(outputXML, encodingInfo);
    if (!encodedContent) {
      throw new Error('Failed to encode output content');
    }
    dispatchProgress(FILE_PROCESSING.PHASES.ENCODING, 100);
    
    // Create blob with correct encoding
    const blob = new Blob([encodedContent], { 
      type: `application/xml;charset=${encodingInfo.encoding}` 
    });

    return {
      blob,
      downloadName: generateFileName(file.name)
    };
  } catch (error) {
    console.error('TMX processing error:', error);
    dispatchProgress(FILE_PROCESSING.PHASES.ERROR, 0);
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

async function filterDuplicatesInBatches(tus, userDuplicates, progressCallback) {
  // Validate inputs
  if (!Array.isArray(tus)) {
    console.warn('Invalid TUs input: not an array');
    return tus;
  }

  if (!Array.isArray(userDuplicates)) {
    return tus;
  }

  const duplicatesToRemove = new Map();
  userDuplicates.forEach(dup => {
    if (dup?.status === 'delete') {
      try {
        const key = `${dup.sourceText}|${dup.targetText}|${dup.creationId}|${dup.changeId}`;
        duplicatesToRemove.set(key, true);
      } catch (error) {
        console.warn('Invalid duplicate entry:', error);
      }
    }
  });

  const filteredTUs = [];
  const totalBatches = Math.ceil(tus.length / BATCH_SIZE);
  const processedGroups = new Map();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, tus.length);
    const batch = tus.slice(start, end);

    const filteredBatch = batch.filter(tu => {
      try {
        // Validate TU structure
        if (!tu || typeof tu !== 'object') {
          console.warn('Invalid TU: not an object', tu);
          return false;
        }

        if (!isValidTU(tu)) {
          console.warn('Invalid TU structure:', tu);
          return false;
        }

        // Extract and validate content
        const content = extractTUContent(tu);
        if (!content || !content.sourceText || !content.targetText) {
          console.warn('Invalid TU content:', content);
          return false;
        }

        const key = `${content.sourceText}|${content.targetText}|${content.creationId}|${content.changeId}`;
        
        // Track unique groups for memory management
        if (!processedGroups.has(key)) {
          processedGroups.set(key, true);
        }

        // Cleanup if needed
        if (processedGroups.size >= CLEANUP_THRESHOLD) {
          processedGroups.clear();
        }

        return !duplicatesToRemove.has(key);
      } catch (error) {
        console.warn('Error processing TU:', error);
        return false;
      }
    });

    filteredTUs.push(...filteredBatch);
    
    const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
    progressCallback(progress);

    // Allow UI to update between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return filteredTUs;
}

function dispatchProgress(phase, progress) {
  window.dispatchEvent(new CustomEvent('tmxProcessProgress', {
    detail: { 
      phase, 
      progress,
      timestamp: Date.now()
    }
  }));
}

function generateFileName(originalName) {
  if (!originalName) {
    return 'processed.tmx';
  }
  const baseName = originalName.replace(/\.tmx$/i, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${baseName}_processed_${timestamp}.tmx`;
}