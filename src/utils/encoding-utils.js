export function detectEncoding(buffer) {
    // Check for BOM markers
    if (buffer.length >= 2) {
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf-16le';
      }
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf-16be';
      }
    }
    
    // Try to detect UTF-16 without BOM
    if (buffer.length >= 4) {
      let oddZeros = 0;
      let evenZeros = 0;
      
      // Check first 100 bytes for UTF-16 pattern
      const checkLength = Math.min(buffer.length, 100);
      for (let i = 0; i < checkLength; i += 2) {
        if (buffer[i] === 0) evenZeros++;
        if (i + 1 < buffer.length && buffer[i + 1] === 0) oddZeros++;
      }
      
      // If we have significantly more zeros in even positions, likely UTF-16LE
      if (evenZeros > oddZeros * 2) return 'utf-16le';
      // If we have significantly more zeros in odd positions, likely UTF-16BE
      if (oddZeros > evenZeros * 2) return 'utf-16be';
    }
    
    return 'utf-8';
  }
  
  export function decodeBuffer(buffer, encoding) {
    try {
      // Handle the buffer as a Uint8Array
      const uint8Array = new Uint8Array(buffer);
      
      // Remove BOM if present
      let startOffset = 0;
      if (uint8Array.length >= 2) {
        if ((uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) || 
            (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF)) {
          startOffset = 2;
        }
      }
  
      // Create a view without BOM
      const contentArray = uint8Array.slice(startOffset);
      
      // Use TextDecoder with the correct encoding
      const decoder = new TextDecoder(encoding.toLowerCase());
      return decoder.decode(contentArray);
    } catch (error) {
      console.error('Decoding error:', error);
      throw new Error(`Failed to decode content with encoding ${encoding}`);
    }
  }
  
  export function encodeText(text, encoding) {
    try {
      // For UTF-16, we need to handle the encoding manually
      if (encoding.startsWith('utf-16')) {
        // Create a UTF-16 TextEncoder
        const encoder = new TextEncoder();
        const utf8Array = encoder.encode(text);
        
        // Convert UTF-8 to UTF-16
        const utf16Array = new Uint8Array(utf8Array.length * 2);
        
        if (encoding === 'utf-16le') {
          // Add BOM for UTF-16LE
          utf16Array[0] = 0xFF;
          utf16Array[1] = 0xFE;
          
          // Convert to UTF-16LE
          for (let i = 0; i < utf8Array.length; i++) {
            utf16Array[i * 2 + 2] = utf8Array[i];
            utf16Array[i * 2 + 3] = 0;
          }
        } else {
          // Add BOM for UTF-16BE
          utf16Array[0] = 0xFE;
          utf16Array[1] = 0xFF;
          
          // Convert to UTF-16BE
          for (let i = 0; i < utf8Array.length; i++) {
            utf16Array[i * 2 + 2] = 0;
            utf16Array[i * 2 + 3] = utf8Array[i];
          }
        }
        
        return utf16Array;
      }
      
      // For UTF-8, use standard TextEncoder
      const encoder = new TextEncoder();
      return encoder.encode(text);
    } catch (error) {
      console.error('Encoding error:', error);
      throw new Error(`Failed to encode content to ${encoding}`);
    }
  }