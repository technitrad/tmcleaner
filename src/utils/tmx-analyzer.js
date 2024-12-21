import { readTMXFile, extractTranslationUnits } from './tmx-reader.js';
import { extractMetadata } from './tmx-metadata.js';

export async function analyzeTMX(file) {
  try {
    // Step 1: Read and validate the TMX file
    const { content, encoding } = await readTMXFile(file);

    // Step 2: Extract translation units
    const tus = extractTranslationUnits(content);

    // Step 3: Extract metadata and translations
    const metadata = extractMetadata(tus);

    return {
      ...metadata,
      encoding
    };
  } catch (error) {
    console.error('TMX analysis error:', error);
    throw new Error(error.message || 'Failed to analyze TMX file');
  }
}