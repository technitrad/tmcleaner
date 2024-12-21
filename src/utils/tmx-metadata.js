export function extractMetadata(tus) {
    try {
      const uniqueCreationIds = new Set();
      const uniqueChangeIds = new Set();
      const translations = [];
  
      tus.forEach(tu => {
        // Extract IDs
        if (tu['@_creationid']) uniqueCreationIds.add(tu['@_creationid']);
        if (tu['@_changeid']) uniqueChangeIds.add(tu['@_changeid']);
  
        // Extract translations
        const sourceSegment = extractSegment(tu, 'en-ca');
        const targetSegment = extractSegment(tu, 'fr-ca');
  
        if (sourceSegment && targetSegment) {
          translations.push({
            sourceText: sourceSegment,
            targetText: targetSegment,
            creationId: tu['@_creationid'] || '',
            changeId: tu['@_changeid'] || '',
            creationDate: tu['@_creationdate'] || '',
            changeDate: tu['@_changedate'] || ''
          });
        }
      });
  
      return {
        creationIds: Array.from(uniqueCreationIds),
        changeIds: Array.from(uniqueChangeIds),
        translations,
        totalSegments: translations.length
      };
    } catch (error) {
      console.error('Metadata extraction error:', error);
      throw new Error('Failed to extract TMX metadata');
    }
  }
  
  function extractSegment(tu, lang) {
    try {
      const tuv = tu.tuv?.find?.(tuv => tuv['@_xml:lang'] === lang);
      return tuv?.seg || null;
    } catch (error) {
      console.error('Segment extraction error:', error);
      return null;
    }
  }