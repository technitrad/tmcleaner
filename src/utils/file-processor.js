import { parseTMX } from './tmx-parser.js';
import { validateTMX } from './tmx-validator.js';
import { detectEncoding, decodeBuffer } from './encoding-utils.js';

export async function processTMXFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const encoding = detectEncoding(new Uint8Array(buffer));
    const content = await decodeBuffer(buffer, encoding);
    
    const validation = validateTMX(content);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const tmxData = parseTMX(content);
    const metadata = extractMetadata(tmxData);

    return {
      content: tmxData,
      metadata
    };
  } catch (error) {
    throw new Error(`Failed to process TMX file: ${error.message}`);
  }
}

function extractMetadata(tmxData) {
  const header = tmxData.tmx.header;
  const translationUnits = tmxData.tmx.body.tu;

  const creationIds = new Set();
  const changeIds = new Set();

  translationUnits.forEach(tu => {
    if (tu['@_creationid']) creationIds.add(tu['@_creationid']);
    if (tu['@_changeid']) changeIds.add(tu['@_changeid']);
  });

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