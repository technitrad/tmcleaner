import { parseTMX } from './tmx-parser.js';
import { validateTMX } from './tmx-validator.js';
import { detectEncoding, decodeBuffer } from './encoding-utils.js';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_BATCH_MEMORY = 1.5 * 1024 * 1024; // 1.5MB max batch memory
let currentBatchSize = 1000; // Will adjust dynamically

export async function processTMXFile(file, onProgress) {
  if (!file) {
    throw new Error('No file provided for processing');
  }

  const cleanupHandles = new Set();
  let worker = null;
  const abortController = new AbortController();

  try {
    // Register cleanup on page unload
    window.addEventListener('beforeunload', handleAbort);
    window.addEventListener('unload', handleAbort);

    // Detect encoding from first chunk
    let encodingSample = await readFileSlice(file, 0, Math.min(CHUNK_SIZE, file.size), abortController.signal);
    if (!encodingSample) {
      throw new Error('Failed to read file sample for encoding detection');
    }

    const encoding = detectEncoding(new Uint8Array(encodingSample));
    if (!encoding) {
      throw new Error('Unable to detect file encoding');
    }

    encodingSample = null; // Allow GC

    // Initialize streaming parser with abort support
    const parser = new AdaptiveTMXStreamParser(onProgress, abortController.signal);
    let processedBytes = 0;

    // Stream file in chunks with abort support
    for (let position = 0; position < file.size; position += CHUNK_SIZE) {
      if (abortController.signal.aborted) {
        throw new Error('Processing aborted');
      }

      let chunk = await readFileSlice(
        file, 
        position, 
        Math.min(position + CHUNK_SIZE, file.size),
        abortController.signal
      );
      
      if (!chunk) {
        throw new Error(`Failed to read chunk at position ${position}`);
      }

      let decodedChunk = await decodeBuffer(chunk, encoding);
      if (!decodedChunk) {
        throw new Error(`Failed to decode chunk at position ${position}`);
      }
      
      await parser.processChunk(decodedChunk);
      processedBytes += chunk.byteLength;
      
      onProgress?.({
        type: 'loading',
        processed: processedBytes,
        total: file.size,
        stage: 'reading'
      });

      await cleanupMemory();
      registerCleanup(() => {
        chunk = null;
        decodedChunk = null;
      });
    }

    // Finalize parsing
    const tmxData = await parser.finalize();
    if (!tmxData || !tmxData.tmx) {
      throw new Error('Failed to parse TMX data');
    }

    const metadata = await extractMetadataWithAdaptiveBatching(tmxData, abortController.signal);
    if (!metadata) {
      throw new Error('Failed to extract metadata');
    }

    return { content: tmxData, metadata };
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error('File processing was aborted');
    }
    throw new Error(`Failed to process TMX file: ${error.message}`);
  } finally {
    window.removeEventListener('beforeunload', handleAbort);
    window.removeEventListener('unload', handleAbort);
    if (worker) {
      worker.terminate();
    }
    await performCleanup(cleanupHandles);
    abortController.abort(); // Ensure all operations are stopped
  }

  function handleAbort() {
    abortController.abort();
    performCleanup(cleanupHandles);
  }
}

class AdaptiveTMXStreamParser {
  constructor(onProgress, abortSignal) {
    if (!abortSignal) {
      throw new Error('Abort signal is required for parser initialization');
    }

    this.header = null;
    this.tus = [];
    this.buffer = '';
    this.onProgress = onProgress;
    this.tuCount = 0;
    this.currentBatchSize = 0;
    this.currentBatch = [];
    this.abortSignal = abortSignal;
    this.failedTUs = 0;
  }

  async processChunk(chunk) {
    if (this.abortSignal.aborted) {
      throw new Error('Processing aborted');
    }

    if (typeof chunk !== 'string') {
      throw new Error('Invalid chunk format: expected string');
    }

    this.buffer += chunk;
    
    // Extract and process header if not done yet
    if (!this.header) {
      const headerEnd = this.buffer.indexOf('</header>');
      if (headerEnd !== -1) {
        const headerContent = this.buffer.substring(0, headerEnd + 9);
        this.header = this.parseHeader(headerContent);
        if (!this.header) {
          throw new Error('Failed to parse TMX header');
        }
        this.buffer = this.buffer.substring(headerEnd + 9);
      }
    }

    await this.processBufferedTUs();
  }

  async processBufferedTUs() {
    const tuRegex = /<tu\b[^>]*>[\s\S]*?<\/tu>/g;
    let match;

    while ((match = tuRegex.exec(this.buffer)) !== null) {
      if (this.abortSignal.aborted) {
        throw new Error('Processing aborted during TU parsing');
      }

      const tuContent = match[0];
      const tuSize = tuContent.length * 2; // UTF-16

      if (this.currentBatchSize + tuSize > MAX_BATCH_MEMORY) {
        await this.processBatch();
        this.currentBatch = [];
        this.currentBatchSize = 0;
      }

      try {
        const tu = this.parseTU(tuContent);
        if (tu) {
          this.currentBatch.push(tu);
          this.currentBatchSize += tuSize;
        }
      } catch (error) {
        this.failedTUs++;
        console.warn('Failed to parse TU:', error);
      }
    }

    // Keep only unprocessed content in buffer
    const lastTuEnd = this.buffer.lastIndexOf('</tu>');
    if (lastTuEnd !== -1) {
      this.buffer = this.buffer.substring(lastTuEnd + 5);
    }
  }

  async processBatch() {
    if (this.currentBatch.length === 0) {
      return;
    }

    let processedInBatch = 0;
    for (const tu of this.currentBatch) {
      try {
        this.tus.push(tu);
        this.tuCount++;
        processedInBatch++;
      } catch (error) {
        this.failedTUs++;
        console.error('Error processing TU in batch:', error);
      }
    }

    if (processedInBatch === 0) {
      console.warn('No TUs processed in current batch');
    }

    currentBatchSize = Math.floor(this.currentBatch.length * (MAX_BATCH_MEMORY / this.currentBatchSize));
    await cleanupMemory();
  }

  parseHeader(content) {
    if (!content) {
      throw new Error('Empty header content');
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      const headerElem = doc.querySelector('header');
      
      if (!headerElem) {
        throw new Error('No header element found');
      }

      return this.parseAttributes(headerElem);
    } catch (error) {
      throw new Error(`Header parsing failed: ${error.message}`);
    }
  }

  parseTU(content) {
    if (!content) {
      throw new Error('Empty TU content');
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      const tuElem = doc.querySelector('tu');
      
      if (!tuElem) {
        throw new Error('No TU element found');
      }

      const tu = {
        ...this.parseAttributes(tuElem),
        tuv: []
      };

      const tuvs = tuElem.querySelectorAll('tuv');
      if (tuvs.length === 0) {
        throw new Error('No TUV elements found');
      }

      tuvs.forEach(tuvElem => {
        const tuv = {
          ...this.parseAttributes(tuvElem),
          seg: tuvElem.querySelector('seg')?.textContent || ''
        };
        tu.tuv.push(tuv);
      });

      if (!this.validateTU(tu)) {
        throw new Error('TU validation failed');
      }

      return tu;
    } catch (error) {
      throw new Error(`TU parsing failed: ${error.message}`);
    }
  }

  parseAttributes(element) {
    if (!element || !element.attributes) {
      throw new Error('Invalid element for attribute parsing');
    }

    const attrs = {};
    try {
      for (const attr of element.attributes) {
        attrs[`@_${attr.name}`] = attr.value;
      }
      return attrs;
    } catch (error) {
      throw new Error(`Attribute parsing failed: ${error.message}`);
    }
  }

  validateTU(tu) {
    return tu && 
           Array.isArray(tu.tuv) && 
           tu.tuv.length === 2 &&
           tu.tuv.every(tuv => tuv['@_xml:lang'] && tuv.seg);
  }

  async finalize() {
    if (this.failedTUs > 0) {
      console.warn(`Total failed TUs during parsing: ${this.failedTUs}`);
    }

    // Process any remaining TUs in the current batch
    if (this.currentBatch.length > 0) {
      await this.processBatch();
    }

    // Process any remaining content in buffer
    if (this.buffer.length > 0) {
      await this.processBufferedTUs();
      if (this.currentBatch.length > 0) {
        await this.processBatch();
      }
    }

    if (this.tuCount === 0) {
      throw new Error('No valid translation units were parsed');
    }

    if (!this.header) {
      throw new Error('No valid header was parsed');
    }

    return {
      tmx: {
        header: this.header,
        body: { tu: this.tus }
      }
    };
  }
}

async function readFileSlice(file, start, end, abortSignal) {
  if (start < 0 || end > file.size || start >= end) {
    throw new Error('Invalid slice parameters');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`File read error: ${reader.error}`));
    
    abortSignal.addEventListener('abort', () => {
      reader.abort();
      reject(new Error('File reading aborted'));
    });

    reader.readAsArrayBuffer(file.slice(start, end));
  });
}

async function extractMetadataWithAdaptiveBatching(tmxData, abortSignal) {
  if (!tmxData?.tmx?.header) {
    throw new Error('Invalid TMX data: missing header');
  }
  if (!tmxData.tmx.body?.tu) {
    throw new Error('Invalid TMX data: missing translation units');
  }

  const header = tmxData.tmx.header;
  const translationUnits = tmxData.tmx.body.tu;
  const creationIds = new Set();
  const changeIds = new Set();
  let currentBatch = [];
  let currentBatchSize = 0;
  let processedTUs = 0;

  for (const tu of translationUnits) {
    if (abortSignal.aborted) {
      throw new Error('Metadata extraction aborted');
    }

    try {
      const tuSize = estimateTUSize(tu);
      
      if (currentBatchSize + tuSize > MAX_BATCH_MEMORY) {
        await processBatchMetadata(currentBatch, creationIds, changeIds);
        processedTUs += currentBatch.length;
        currentBatch = [tu];
        currentBatchSize = tuSize;
        await cleanupMemory();
      } else {
        currentBatch.push(tu);
        currentBatchSize += tuSize;
      }
    } catch (error) {
      console.warn(`Error processing TU metadata: ${error.message}`);
    }
  }

  if (currentBatch.length > 0) {
    await processBatchMetadata(currentBatch, creationIds, changeIds);
    processedTUs += currentBatch.length;
  }

  if (processedTUs === 0) {
    throw new Error('No valid TUs processed for metadata extraction');
  }

  return {
    sourceLanguage: header['@_srclang'] || '',
    targetLanguage: header.prop?.find(p => p['@_type'] === 'targetlang')?.['#text'] || '',
    creationTool: header['@_creationtool'] || '',
    creationToolVersion: header['@_creationtoolversion'] || '',
    segmentType: header['@_segtype'] || '',
    creationIds: Array.from(creationIds),
    changeIds: Array.from(changeIds),
    totalSegments: translationUnits.length
  };
}

function processBatchMetadata(batch, creationIds, changeIds) {
  if (!Array.isArray(batch)) {
    throw new Error('Invalid batch format');
  }

  batch.forEach(tu => {
    try {
      if (tu['@_creationid']) creationIds.add(tu['@_creationid']);
      if (tu['@_changeid']) changeIds.add(tu['@_changeid']);
    } catch (error) {
      console.warn(`Error extracting IDs: ${error.message}`);
    }
  });
}

function estimateTUSize(tu) {
  if (!tu || typeof tu !== 'object') {
    throw new Error('Invalid TU for size estimation');
  }

  let size = 0;
  try {
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
  } catch (error) {
    throw new Error(`Size estimation failed: ${error.message}`);
  }

  return size;
}

function registerCleanup(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Cleanup handler must be a function');
  }
  cleanupHandles.add(fn);
}

async function performCleanup(handles) {
  if (!handles || !(handles instanceof Set)) {
    throw new Error('Invalid cleanup handles');
  }

  for (const handle of handles) {
    try {
      await handle();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
  handles.clear();
}

async function cleanupMemory() {
  try {
    if (globalThis.gc) {
      globalThis.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  } catch (error) {
    console.warn('Memory cleanup failed:', error);
  }
}