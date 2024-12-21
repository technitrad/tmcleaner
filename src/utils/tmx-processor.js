import { detectFileEncoding, decodeWithEncoding, encodeWithEncoding } from './encoding-detector.js';
import { parseTMXContent, extractTUContent, isValidTU } from './tmx-core.js';
import { buildTMXContent } from './tmx-builder.js';

export async function processTMX(file, priorities, userDuplicates) {
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file input');
  }

  try {
    // Read file and detect encoding
    const buffer = await file.arrayBuffer();
    const encodingInfo = detectFileEncoding(new Uint8Array(buffer));
    console.log('Detected encoding:', encodingInfo);

    // Decode content
    const content = decodeWithEncoding(new Uint8Array(buffer), encodingInfo);
    
    // Parse and process TMX
    const tmxData = parseTMXContent(content);
    
    // Filter duplicates
    const filteredTUs = filterDuplicates(tmxData.tmx.body.tu, userDuplicates);
    tmxData.tmx.body.tu = filteredTUs;

    // Build output preserving original structure
    const outputXML = buildTMXContent(tmxData);
    
    // Encode with original encoding
    const encodedContent = encodeWithEncoding(outputXML, encodingInfo);
    
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
    throw new Error(`Failed to process TMX file: ${error.message}`);
  }
}

function filterDuplicates(tus, userDuplicates) {
  if (!Array.isArray(userDuplicates)) {
    return tus;
  }

  const duplicatesToRemove = new Map();
  userDuplicates.forEach(dup => {
    if (dup.status === 'delete') {
      const key = `${dup.sourceText}|${dup.targetText}|${dup.creationId}|${dup.changeId}`;
      duplicatesToRemove.set(key, true);
    }
  });

  return tus.filter(tu => {
    try {
      if (!isValidTU(tu)) {
        console.warn('Skipping invalid TU:', tu);
        return false;
      }

      const content = extractTUContent(tu);
      const key = `${content.sourceText}|${content.targetText}|${content.creationId}|${content.changeId}`;
      
      return !duplicatesToRemove.has(key);
    } catch (error) {
      console.warn('Error processing TU:', error);
      return false;
    }
  });
}

function generateFileName(originalName) {
  const baseName = originalName.replace(/\.tmx$/i, '');
  return `${baseName}_processed.tmx`;
}