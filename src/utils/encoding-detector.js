// Encoding signatures (BOMs)
const ENCODING_SIGNATURES = {
    UTF16LE: new Uint8Array([0xFF, 0xFE]),
    UTF16BE: new Uint8Array([0xFE, 0xFF]),
    UTF8: new Uint8Array([0xEF, 0xBB, 0xBF])
  };
  
  export class EncodingInfo {
    constructor(encoding, hasBOM, originalBOM, xmlEncoding) {
      this.encoding = encoding;
      this.hasBOM = hasBOM;
      this.originalBOM = originalBOM;
      this.xmlEncoding = xmlEncoding;
    }
  
    toString() {
      return `EncodingInfo(encoding=${this.encoding}, hasBOM=${this.hasBOM}, xmlEncoding=${this.xmlEncoding})`;
    }
  }
  
  export function detectFileEncoding(buffer) {
    // First check for BOM markers
    let bomInfo = detectBOM(buffer);
    
    // Then check XML declaration
    let xmlInfo = detectXMLEncoding(buffer, bomInfo);
    
    // If we have both BOM and XML declaration, validate they match
    if (bomInfo && xmlInfo) {
      if (!areEncodingsCompatible(bomInfo.encoding, xmlInfo)) {
        console.warn(`BOM encoding (${bomInfo.encoding}) differs from XML declaration (${xmlInfo})`);
      }
      // BOM takes precedence over XML declaration
      return new EncodingInfo(bomInfo.encoding, true, bomInfo.bom, xmlInfo);
    }
    
    // If we have BOM but no XML declaration
    if (bomInfo) {
      return new EncodingInfo(bomInfo.encoding, true, bomInfo.bom, null);
    }
    
    // If we have XML declaration but no BOM
    if (xmlInfo) {
      return new EncodingInfo(normalizeEncoding(xmlInfo), false, null, xmlInfo);
    }
    
    // If no explicit encoding is found, analyze content
    const analyzedEncoding = analyzeContent(buffer);
    return new EncodingInfo(analyzedEncoding, false, null, null);
  }
  
  function detectBOM(buffer) {
    if (buffer.length >= 2) {
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return { encoding: 'utf-16le', bom: ENCODING_SIGNATURES.UTF16LE };
      }
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return { encoding: 'utf-16be', bom: ENCODING_SIGNATURES.UTF16BE };
      }
      if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return { encoding: 'utf-8', bom: ENCODING_SIGNATURES.UTF8 };
      }
    }
    return null;
  }
  
  function detectXMLEncoding(buffer, bomInfo) {
    try {
      // If we have a BOM, use its encoding to read the XML declaration
      const decoder = new TextDecoder(bomInfo?.encoding || 'utf-8');
      const sample = decoder.decode(buffer.slice(0, Math.min(500, buffer.length)));
      
      // Look for XML declaration with encoding
      const xmlDeclMatch = sample.match(/<\?xml[^>]+encoding=["']([^"']+)["'][^>]*\?>/i);
      if (xmlDeclMatch) {
        return xmlDeclMatch[1].toLowerCase();
      }
    } catch (error) {
      console.warn('Failed to detect XML encoding:', error);
    }
    return null;
  }
  
  function analyzeContent(buffer) {
    if (buffer.length >= 4) {
      let oddZeros = 0;
      let evenZeros = 0;
      
      // Analyze a larger sample for more accurate detection
      const checkLength = Math.min(buffer.length, 8192);
      for (let i = 0; i < checkLength - 1; i += 2) {
        if (buffer[i] === 0) evenZeros++;
        if (buffer[i + 1] === 0) oddZeros++;
      }
      
      // Calculate zero byte distribution
      const evenZeroRatio = evenZeros / (checkLength / 2);
      const oddZeroRatio = oddZeros / (checkLength / 2);
      
      if (evenZeroRatio > 0.3 && evenZeroRatio > oddZeroRatio * 3) {
        return 'utf-16le';
      }
      if (oddZeroRatio > 0.3 && oddZeroRatio > evenZeroRatio * 3) {
        return 'utf-16be';
      }
    }
    
    // Default to UTF-8 if no clear pattern is found
    return 'utf-8';
  }
  
  function areEncodingsCompatible(bomEncoding, xmlEncoding) {
    const normalized = {
      bom: normalizeEncoding(bomEncoding),
      xml: normalizeEncoding(xmlEncoding)
    };
    return normalized.bom === normalized.xml;
  }
  
  function normalizeEncoding(encoding) {
    const normalized = encoding.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Map common encoding variations
    const mappings = {
      'utf8': 'utf-8',
      'utf16': 'utf-16',
      'utf16le': 'utf-16le',
      'utf16be': 'utf-16be',
      'usascii': 'ascii',
      'iso88591': 'iso-8859-1'
    };
    
    return mappings[normalized] || encoding.toLowerCase();
  }
  
  export function decodeWithEncoding(buffer, encodingInfo) {
    try {
      // Remove BOM if present
      const content = encodingInfo.hasBOM 
        ? buffer.slice(encodingInfo.originalBOM.length)
        : buffer;
  
      // Create decoder with detected encoding
      const decoder = new TextDecoder(encodingInfo.encoding);
      const decoded = decoder.decode(content);
      
      // Validate decoded content
      if (!decoded || decoded.length === 0) {
        throw new Error('Decoded content is empty');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Failed to decode content with encoding ${encodingInfo.encoding}: ${error.message}`);
    }
  }
  
  export function encodeWithEncoding(text, encodingInfo) {
    try {
      // For UTF-16, we need to handle the encoding manually
      if (encodingInfo.encoding.startsWith('utf-16')) {
        return encodeUTF16(text, encodingInfo);
      }
      
      // For other encodings, use TextEncoder
      const encoder = new TextEncoder();
      const content = encoder.encode(text);
      
      // Add BOM if original had it
      if (encodingInfo.hasBOM && encodingInfo.originalBOM) {
        const finalBuffer = new Uint8Array(encodingInfo.originalBOM.length + content.length);
        finalBuffer.set(encodingInfo.originalBOM);
        finalBuffer.set(content, encodingInfo.originalBOM.length);
        return finalBuffer;
      }
      
      return content;
    } catch (error) {
      throw new Error(`Failed to encode content to ${encodingInfo.encoding}: ${error.message}`);
    }
  }
  
  function encodeUTF16(text, encodingInfo) {
    const isLE = encodingInfo.encoding === 'utf-16le';
    const utf16Array = new Uint8Array(text.length * 2 + (encodingInfo.hasBOM ? 2 : 0));
    let offset = 0;
    
    // Add BOM if needed
    if (encodingInfo.hasBOM) {
      utf16Array[0] = isLE ? 0xFF : 0xFE;
      utf16Array[1] = isLE ? 0xFE : 0xFF;
      offset = 2;
    }
    
    // Encode text
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (isLE) {
        utf16Array[offset + i * 2] = charCode & 0xFF;
        utf16Array[offset + i * 2 + 1] = charCode >> 8;
      } else {
        utf16Array[offset + i * 2] = charCode >> 8;
        utf16Array[offset + i * 2 + 1] = charCode & 0xFF;
      }
    }
    
    return utf16Array;
  }