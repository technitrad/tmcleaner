import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { unlink } from 'fs/promises';

export class FileProcessor {
  static CHUNK_SIZE = 64 * 1024; // 64KB chunks

  static async processLargeFile(inputPath, outputPath, transformFn) {
    if (!inputPath || !outputPath) {
      throw new Error('Input and output paths are required');
    }

    const transform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          const processed = transformFn(chunk.toString());
          callback(null, processed);
        } catch (error) {
          callback(error);
        }
      }
    });

    const readStream = createReadStream(inputPath, {
      highWaterMark: this.CHUNK_SIZE,
      encoding: 'utf8'
    });

    const writeStream = createWriteStream(outputPath);

    try {
      await pipeline(readStream, transform, writeStream);
    } catch (error) {
      throw new Error(`File processing failed: ${error.message}`);
    } finally {
      readStream.destroy();
      writeStream.destroy();
    }
  }

  static async cleanup(filePath) {
    try {
      await unlink(filePath);
    } catch (error) {
      console.error(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}