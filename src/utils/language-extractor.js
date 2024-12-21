export function extractLanguages(tmxData) {
    const header = tmxData.tmx.header;
    const sourceLanguage = header['@_srclang'] || '';
    
    // Find target language in header props
    const targetLangProp = header.prop.find(p => p['@_type'] === 'targetlang');
    const targetLanguage = targetLangProp?.['#text'] || '';
  
    return {
      sourceLanguage,
      targetLanguage
    };
  }