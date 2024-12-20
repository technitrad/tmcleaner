import iconv from 'iconv-lite';
import jschardet from 'jschardet';

export function detectEncoding(buffer) {
  // Check for BOM markers first
  if (buffer.length >= 2) {
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf16le';
    }
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf16be';
    }
  }

  // Use jschardet for detection
  const result = jschardet.detect(buffer);
  if (result && result.encoding) {
    const encoding = result.encoding.toLowerCase();
    
    // Map common encoding names
    const encodingMap = {
      'utf-16le': 'utf16le',
      'utf-16be': 'utf16be',
      'utf-8': 'utf8',
      'ascii': 'ascii'
    };

    return encodingMap[encoding] || encoding;
  }

  // Default to UTF-8 if detection fails
  return 'utf8';
}

export function decodeBuffer(buffer, encoding) {
  try {
    // Create a DataView for the buffer
    const view = new DataView(buffer);
    
    // Handle UTF-16 specially
    if (encoding === 'utf16le') {
      const decoder = new TextDecoder('utf-16le');
      return decoder.decode(buffer);
    }
    if (encoding === 'utf16be') {
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(buffer);
    }

    // For other encodings, use iconv-lite with Uint8Array
    const uint8Array = new Uint8Array(buffer);
    return iconv.decode(uint8Array, encoding);
  } catch (error) {
    console.error('Decoding error:', error);
    throw new Error(`Failed to decode content with encoding ${encoding}`);
  }
}

export function encodeText(text, encoding) {
  try {
    // Handle UTF-16 specially
    if (encoding === 'utf16le' || encoding === 'utf16be') {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(text);
      return iconv.encode(iconv.decode(uint8Array, 'utf8'), encoding);
    }

    // For other encodings, use iconv-lite
    return iconv.encode(text, encoding);
  } catch (error) {
    console.error('Encoding error:', error);
    throw new Error(`Failed to encode content to ${encoding}`);
  }
}