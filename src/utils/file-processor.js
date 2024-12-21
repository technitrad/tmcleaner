import { FileProcessor } from './file-handling.js';
import { TMXStreamProcessor } from './stream-processor.js';
import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';
import { detectEncoding } from './encoding-utils.js';
import { FILE_PROCESSING } from './constants.js';

export async function processTMXFile(file) {
  let outputPath = null;
  let processingStarted = false;

  try {
    if (!file?.path) {
      throw new Error('Invalid file input');
    }

    // Validate file extension
    if (!file.path.toLowerCase().endsWith('.tmx')) {
      throw new Error('Invalid file type. Only TMX files are supported.');
    }

    const processor = new TMXStreamProcessor();
    let metadata = null;

    // Create temporary output file path
    outputPath = join(process.cwd(), FILE_PROCESSING.TEMP_DIR, `${file.name}.processed`);
    
    // Ensure temp directory exists
    await mkdir(dirname(outputPath), { recursive: true });
    
    // Detect file encoding
    const encoding = await detectEncoding(file.path);
    if (!encoding) {
      throw new Error('Unable to detect file encoding');
    }

    processingStarted = true;
    
    // Process the file using FileProcessor
    await FileProcessor.processLargeFile(
      file.path,
      outputPath,
      (chunk) => {
        processor.processChunk(chunk);
        if (!metadata && processor.metadata.totalSegments > 0) {
          metadata = processor.getMetadata();
        }
        return chunk;
      }
    );

    return {
      outputPath,
      metadata
    };

  } catch (error) {
    if (outputPath) {
      await FileProcessor.cleanup(outputPath);
    }
    throw new Error(`Failed to process TMX file: ${error.message}`);
  }
}