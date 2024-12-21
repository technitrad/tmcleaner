import { XMLBuilder } from 'fast-xml-parser';
import { escapeXML } from './xml-utils.js';

export function buildTMXContent(tmxData) {
  // Create XML declaration and DOCTYPE
  const xmlDeclaration = '<?xml version="1.0" encoding="utf-16"?>\n';
  const doctypeDeclaration = '<!DOCTYPE tmx SYSTEM "tmx14.dtd">\n';

  // Build TMX content
  let content = '<tmx version="1.4">\n';

  // Build header
  content += buildHeader(tmxData.tmx.header);

  // Build body
  content += '<body>\n';
  content += buildTranslationUnits(tmxData.tmx.body.tu);
  content += '</body>\n';
  content += '</tmx>';

  return xmlDeclaration + doctypeDeclaration + content;
}

function buildHeader(header) {
  let content = '<header';
  
  // Add header attributes
  const attributes = [
    'creationtool',
    'creationtoolversion',
    'segtype',
    'adminlang',
    'creationid',
    'srclang',
    'o-tmf',
    'datatype'
  ];

  attributes.forEach(attr => {
    if (header[`@_${attr}`]) {
      content += ` ${attr}="${escapeXML(header[`@_${attr}`])}"`;
    }
  });
  content += '>\n';

  // Add header properties
  if (Array.isArray(header.prop)) {
    header.prop.forEach(prop => {
      content += `  <prop type="${escapeXML(prop['@_type'])}">${escapeXML(prop['#text'] || '')}</prop>\n`;
    });
  }

  content += '</header>\n';
  return content;
}

function buildTranslationUnits(tus) {
  let content = '';

  tus.forEach(tu => {
    content += '  <tu';
    
    // Add TU attributes
    ['changedate', 'creationdate', 'creationid', 'changeid'].forEach(attr => {
      if (tu[`@_${attr}`]) {
        content += ` ${attr}="${escapeXML(tu[`@_${attr}`])}"`;
      }
    });
    content += '>\n';

    // Add TU properties
    if (Array.isArray(tu.prop)) {
      tu.prop.forEach(prop => {
        const propType = escapeXML(prop['@_type']);
        let propContent = prop['#text'] || '';
        
        // Special handling for context properties
        if (propType.startsWith('x-context-')) {
          // Keep the escaped XML format for context properties
          content += `    <prop type="${propType}">&lt;seg&gt;${escapeXML(propContent)}&lt;/seg&gt;</prop>\n`;
        } else {
          content += `    <prop type="${propType}">${escapeXML(propContent)}</prop>\n`;
        }
      });
    }

    // Add TUVs
    tu.tuv.forEach(tuv => {
      content += `    <tuv xml:lang="${escapeXML(tuv['@_xml:lang'])}">\n`;
      
      // Add TUV properties
      if (Array.isArray(tuv.prop)) {
        tuv.prop.forEach(prop => {
          const propType = escapeXML(prop['@_type']);
          let propContent = prop['#text'] || '';
          
          // Special handling for context properties
          if (propType.startsWith('x-context-')) {
            content += `      <prop type="${propType}">&lt;seg&gt;${escapeXML(propContent)}&lt;/seg&gt;</prop>\n`;
          } else {
            content += `      <prop type="${propType}">${escapeXML(propContent)}</prop>\n`;
          }
        });
      }
      
      content += `      <seg>${escapeXML(tuv.seg)}</seg>\n`;
      content += '    </tuv>\n';
    });

    content += '  </tu>\n';
  });

  return content;
}