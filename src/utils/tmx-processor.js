const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_BATCH_MEMORY = 1.5 * 1024 * 1024; // 1.5MB per batch
const MAX_BLOB_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB max blob chunk
let currentBatchSize = 1000; // Initial size, will adjust

export async function processTMX(file, priorities, duplicates, onProgress) {
  if (!file) {
    throw new Error('No file provided for processing');
  }
  if (!priorities) {
    throw new Error('No priorities specified for TMX processing');
  }
  if (!Array.isArray(duplicates)) {
    throw new Error('Invalid duplicates data: expected array');
  }

  try {
    const xmlWriter = new XMLStreamWriter();
    const duplicateMap = new Map(
      duplicates.map(d => {
        if (!d || typeof d !== 'object') {
          throw new Error('Invalid duplicate entry: expected object');
        }
        const key = generateTUKey(d);
        if (!key) {
          throw new Error('Failed to generate key for duplicate entry');
        }
        return [key, d.status];
      })
    );

    const fileContent = await readFileInChunks(file, onProgress);
    const parser = createParser();
    const tmxData = parser.parse(fileContent);

    if (!tmxData?.tmx?.body?.tu || !Array.isArray(tmxData.tmx.body.tu)) {
      throw new Error('Invalid TMX structure: missing or invalid translation units');
    }

    const totalSegments = tmxData.tmx.body.tu.length;

    // Write XML structure
    xmlWriter.startDocument();
    xmlWriter.writeDTD();
    xmlWriter.startElement('tmx', { 'version': '1.4' });
    
    if (!tmxData.tmx.header) {
      throw new Error('Invalid TMX structure: missing header');
    }
    xmlWriter.writeHeader(tmxData.tmx.header);
    xmlWriter.startElement('body');

    // Process TUs with adaptive batching
    let processedCount = 0;
    let currentBatch = [];
    let currentMemorySize = 0;
    let failedTUs = 0;

    for (let i = 0; i < tmxData.tmx.body.tu.length; i++) {
      const tu = tmxData.tmx.body.tu[i];
      if (!tu || !Array.isArray(tu.tuv)) {
        failedTUs++;
        console.warn(`Skipping invalid TU at index ${i}`);
        continue;
      }

      try {
        const tuSize = estimateTUSize(tu);

        if (currentMemorySize + tuSize > MAX_BATCH_MEMORY) {
          await processBatch(currentBatch, duplicateMap, xmlWriter);
          processedCount += currentBatch.length;
          onProgress(processedCount, totalSegments, 'processing segments');

          currentBatchSize = Math.floor(currentBatch.length * (MAX_BATCH_MEMORY / currentMemorySize));
          currentBatch = [tu];
          currentMemorySize = tuSize;
          await cleanupMemory();
        } else {
          currentBatch.push(tu);
          currentMemorySize += tuSize;
        }
      } catch (error) {
        failedTUs++;
        console.error(`Error processing TU at index ${i}:`, error);
      }
    }

    if (currentBatch.length > 0) {
      await processBatch(currentBatch, duplicateMap, xmlWriter);
      processedCount += currentBatch.length;
      onProgress(processedCount, totalSegments, 'processing segments');
    }

    if (failedTUs > 0) {
      console.warn(`Total failed TUs: ${failedTUs}`);
    }

    if (processedCount === 0) {
      throw new Error('No valid translation units were processed');
    }

    xmlWriter.endElement(); // body
    xmlWriter.endElement(); // tmx
    xmlWriter.endDocument();

    const blob = await createBlobInChunks(xmlWriter.getChunks());
    if (!blob) {
      throw new Error('Failed to create output file');
    }

    const downloadName = file.name.replace('.tmx', '_processed.tmx');
    return { blob, downloadName };
  } catch (error) {
    throw new Error(`TMX processing failed: ${error.message}`);
  }
}

class XMLStreamWriter {
  constructor() {
    this.chunks = [];
    this.indentLevel = 0;
    this.currentChunkSize = 0;
  }

  startDocument() {
    this.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  }

  writeDTD() {
    this.write('<!DOCTYPE tmx SYSTEM "tmx11.dtd">\n');
  }

  startElement(name, attributes = {}) {
    if (!name) {
      throw new Error('Element name is required');
    }
    this.writeIndent();
    this.write(`<${name}`);
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        if (!key) {
          throw new Error('Invalid attribute key');
        }
        this.write(` ${key}="${escapeXml(value)}"`);
      });
    } catch (error) {
      throw new Error(`Error writing element attributes: ${error.message}`);
    }
    this.write('>\n');
    this.indentLevel++;
  }

  endElement() {
    this.indentLevel--;
    if (this.indentLevel < 0) {
      throw new Error('XML structure error: too many closing tags');
    }
    this.writeIndent();
    this.write('</tmx>\n');
  }

  writeHeader(header) {
    if (!header) {
      throw new Error('Header data is required');
    }
    this.writeIndent();
    this.write('<header');
    try {
      Object.entries(header).forEach(([key, value]) => {
        if (key.startsWith('@_')) {
          this.write(` ${key.substring(2)}="${escapeXml(value)}"`);
        }
      });
    } catch (error) {
      throw new Error(`Error writing header: ${error.message}`);
    }
    this.write('>\n');
    
    if (header.prop) {
      if (!Array.isArray(header.prop)) {
        throw new Error('Invalid header properties format');
      }
      header.prop.forEach(prop => {
        try {
          this.writeIndent();
          this.write(`  <prop type="${escapeXml(prop['@_type'])}">${escapeXml(prop['#text'])}</prop>\n`);
        } catch (error) {
          console.warn('Error writing header property:', error);
        }
      });
    }
    
    this.write('</header>\n');
  }

  writeTU(tu) {
    if (!tu || !Array.isArray(tu.tuv)) {
      throw new Error('Invalid TU structure');
    }
    
    try {
      const tuContent = this.generateTUContent(tu);
      this.write(tuContent);

      if (this.currentChunkSize > CHUNK_SIZE) {
        this.flushChunk();
      }
    } catch (error) {
      throw new Error(`Error writing TU: ${error.message}`);
    }
  }

  generateTUContent(tu) {
    let content = '';
    content += '  '.repeat(this.indentLevel) + '<tu';
    
    try {
      Object.entries(tu).forEach(([key, value]) => {
        if (key.startsWith('@_')) {
          content += ` ${key.substring(2)}="${escapeXml(value)}"`;
        }
      });
      content += '>\n';

      tu.tuv.forEach(tuv => {
        if (!tuv['@_xml:lang']) {
          throw new Error('Missing language attribute in TUV');
        }
        content += '  '.repeat(this.indentLevel + 1);
        content += `<tuv xml:lang="${escapeXml(tuv['@_xml:lang'])}">`;
        content += `<seg>${escapeXml(tuv.seg || '')}</seg></tuv>\n`;
      });

      content += '  '.repeat(this.indentLevel) + '</tu>\n';
    } catch (error) {
      throw new Error(`Error generating TU content: ${error.message}`);
    }

    return content;
  }

  writeIndent() {
    this.write('  '.repeat(this.indentLevel));
  }

  write(text) {
    if (typeof text !== 'string') {
      throw new Error('Invalid write: expected string content');
    }
    this.chunks.push(text);
    this.currentChunkSize += text.length * 2; // UTF-16
    
    if (this.currentChunkSize > CHUNK_SIZE) {
      this.flushChunk();
    }
  }

  flushChunk() {
    try {
      const content = this.chunks.join('');
      this.chunks = [content];
      this.currentChunkSize = content.length * 2;
    } catch (error) {
      throw new Error(`Error flushing chunk: ${error.message}`);
    }
  }

  getChunks() {
    return this.chunks;
  }
}

async function processBatch(batch, duplicateMap, xmlWriter) {
  if (!Array.isArray(batch)) {
    throw new Error('Invalid batch: expected array');
  }

  let processedCount = 0;
  for (const tu of batch) {
    try {
      const key = generateTUKey(tu);
      if (!duplicateMap.has(key) || duplicateMap.get(key) === 'keep') {
        xmlWriter.writeTU(tu);
        processedCount++;
      }
    } catch (error) {
      console.error('Error processing TU in batch:', error);
    }
  }

  if (processedCount === 0) {
    console.warn('No TUs processed in batch');
  }

  return processedCount;
}

async function createBlobInChunks(chunks) {
  if (!Array.isArray(chunks)) {
    throw new Error('Invalid chunks: expected array');
  }

  try {
    const blobParts = [];
    let currentPart = [];
    let currentSize = 0;

    for (const chunk of chunks) {
      const chunkSize = chunk.length * 2; // UTF-16

      if (currentSize + chunkSize > MAX_BLOB_CHUNK_SIZE) {
        const blob = new Blob(currentPart, { type: 'text/xml' });
        if (!blob) {
          throw new Error('Failed to create blob part');
        }
        blobParts.push(blob);
        currentPart = [chunk];
        currentSize = chunkSize;
        await cleanupMemory();
      } else {
        currentPart.push(chunk);
        currentSize += chunkSize;
      }
    }

    if (currentPart.length > 0) {
      const blob = new Blob(currentPart, { type: 'text/xml' });
      if (!blob) {
        throw new Error('Failed to create final blob part');
      }
      blobParts.push(blob);
    }

    currentPart = null;
    await cleanupMemory();

    if (blobParts.length === 1) {
      return blobParts[0];
    }

    const finalBlob = await mergeBlobsInChunks(blobParts);
    blobParts.length = 0;
    await cleanupMemory();
    
    return finalBlob;
  } catch (error) {
    throw new Error(`Error creating blob: ${error.message}`);
  }
}

async function mergeBlobsInChunks(blobs) {
  if (!Array.isArray(blobs)) {
    throw new Error('Invalid blobs array');
  }

  try {
    const totalSize = blobs.reduce((size, blob) => size + blob.size, 0);
    if (totalSize < MAX_BLOB_CHUNK_SIZE * 2) {
      return new Blob(blobs, { type: 'text/xml' });
    }

    const mergedBlobs = [];
    let currentGroup = [];
    let currentSize = 0;

    for (const blob of blobs) {
      if (currentSize + blob.size > MAX_BLOB_CHUNK_SIZE) {
        const mergedBlob = new Blob(currentGroup, { type: 'text/xml' });
        if (!mergedBlob) {
          throw new Error('Failed to merge blob group');
        }
        mergedBlobs.push(mergedBlob);
        currentGroup = [blob];
        currentSize = blob.size;
        await cleanupMemory();
      } else {
        currentGroup.push(blob);
        currentSize += blob.size;
      }
    }

    if (currentGroup.length > 0) {
      const finalGroupBlob = new Blob(currentGroup, { type: 'text/xml' });
      if (!finalGroupBlob) {
        throw new Error('Failed to create final group blob');
      }
      mergedBlobs.push(finalGroupBlob);
    }

    const finalBlob = new Blob(mergedBlobs, { type: 'text/xml' });
    if (!finalBlob) {
      throw new Error('Failed to create final merged blob');
    }
    return finalBlob;
  } catch (error) {
    throw new Error(`Error merging blobs: ${error.message}`);
  }
}

async function readFileInChunks(file, onProgress) {
  if (!file) {
    throw new Error('No file provided for reading');
  }

  const chunks = [];
  let offset = 0;
  let processedBytes = 0;
  
  try {
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const content = await readChunk(chunk);
      if (!content) {
        throw new Error(`Failed to read chunk at offset ${offset}`);
      }
      chunks.push(content);
      
      processedBytes += chunk.size;
      onProgress?.(processedBytes, file.size, 'reading file');

      offset += CHUNK_SIZE;
      await cleanupMemory();
    }

    const result = chunks.join('');
    chunks.length = 0;
    await cleanupMemory();
    return result;
  } catch (error) {
    throw new Error(`Error reading file in chunks: ${error.message}`);
  }
}

function readChunk(chunk) {
  if (!chunk || !(chunk instanceof Blob)) {
    throw new Error('Invalid chunk provided');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read chunk: ' + reader.error));
    reader.readAsText(chunk);
  });
}

function generateTUKey(tu) {
  if (!tu) {
    throw new Error('Invalid TU for key generation');
  }

  try {
    const sourceText = getTUVText(tu, 'en');
    const targetText = getTUVText(tu, 'fr');
    if (!sourceText || !targetText) {
      throw new Error('Missing source or target text for key generation');
    }
    return `${sourceText}|${targetText}`;
  } catch (error) {
    throw new Error(`Failed to generate TU key: ${error.message}`);
  }
}

function getTUVText(tu, langPrefix) {
  if (!tu || typeof tu !== 'object') {
    throw new Error(`Invalid TU structure for ${langPrefix} text extraction`);
  }

  if (typeof tu.sourceText === 'string' && langPrefix === 'en') return tu.sourceText;
  if (typeof tu.targetText === 'string' && langPrefix === 'fr') return tu.targetText;

  try {
    if (!Array.isArray(tu.tuv)) {
      throw new Error('Invalid TU: missing tuv array');
    }

    const tuv = tu.tuv.find(t => t && t['@_xml:lang']?.toLowerCase().startsWith(langPrefix));
    if (!tuv) {
      throw new Error(`No ${langPrefix} translation found`);
    }
    
    const text = tuv?.seg?.toString().trim();
    if (!text) {
      throw new Error(`Empty ${langPrefix} segment`);
    }
    
    return text;
  } catch (error) {
    console.warn(`Error extracting ${langPrefix} text:`, error);
    return '';
  }
}

function estimateTUSize(tu) {
  if (!tu || typeof tu !== 'object') {
    throw new Error('Invalid TU for size estimation');
  }

  try {
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
  } catch (error) {
    throw new Error(`Failed to estimate TU size: ${error.message}`);
  }
}

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  
  try {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  } catch (error) {
    console.error('Error escaping XML:', error);
    return '';
  }
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

function createParser() {
  try {
    return new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true
    });
  } catch (error) {
    throw new Error(`Failed to create XML parser: ${error.message}`);
  }
}