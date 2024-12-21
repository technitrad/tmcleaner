import { Transform } from 'stream';

export class TMXStreamProcessor extends Transform {
  constructor(options = {}) {
    super(options);
    this.buffer = '';
    this.metadata = {
      sourceLanguage: '',
      targetLanguage: '',
      creationTool: '',
      creationToolVersion: '',
      segmentType: '',
      creationIds: new Set(),
      changeIds: new Set(),
      totalSegments: 0
    };
  }

  _transform(chunk, encoding, callback) {
    try {
      this.buffer += chunk.toString();
      
      // Process complete XML elements
      const lastCloseTag = this.buffer.lastIndexOf('</tu>');
      if (lastCloseTag !== -1) {
        const processableData = this.buffer.slice(0, lastCloseTag + 5);
        this.buffer = this.buffer.slice(lastCloseTag + 5);
        
        this.processChunk(processableData);
      }
      
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.buffer) {
      this.processChunk(this.buffer);
    }
    this.push(JSON.stringify(this.getMetadata()));
    callback();
  }

  processChunk(data) {
    // Extract and update metadata from translation units
    const tuMatches = data.matchAll(/<tu([^>]*)>/g);
    for (const match of tuMatches) {
      this.metadata.totalSegments++;
      
      const attributes = match[1];
      const creationId = attributes.match(/creationid="([^"]+)"/)?.[1];
      const changeId = attributes.match(/changeid="([^"]+)"/)?.[1];
      
      if (creationId) this.metadata.creationIds.add(creationId);
      if (changeId) this.metadata.changeIds.add(changeId);
    }

    // Process header if present
    if (data.includes('<header')) {
      const headerMatch = data.match(/<header([^>]*)>/);
      if (headerMatch) {
        const headerAttrs = headerMatch[1];
        this.metadata.sourceLanguage = headerAttrs.match(/srclang="([^"]+)"/)?.[1] || '';
        this.metadata.creationTool = headerAttrs.match(/creationtool="([^"]+)"/)?.[1] || '';
        this.metadata.creationToolVersion = headerAttrs.match(/creationtoolversion="([^"]+)"/)?.[1] || '';
        this.metadata.segmentType = headerAttrs.match(/segtype="([^"]+)"/)?.[1] || '';
      }
    }

    this.push(data);
  }

  getMetadata() {
    return {
      ...this.metadata,
      creationIds: Array.from(this.metadata.creationIds),
      changeIds: Array.from(this.metadata.changeIds)
    };
  }
}