import chalk from 'chalk';
import { checkFileExists, ensureDirectoryExists } from './utils/file-utils.js';
import { createXMLParser, createXMLBuilder } from './utils/xml-utils.js';
import { detectFileEncoding, readFileWithEncoding, writeFileWithEncoding } from './utils/encoding-utils.js';

export async function processTMXFile(inputPath, outputPath, priorityManager) {
  // Check if input file exists
  if (!(await checkFileExists(inputPath))) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Ensure output directory exists
  await ensureDirectoryExists(outputPath);

  // Detect and use the correct encoding
  const encoding = await detectFileEncoding(inputPath);
  const xmlData = await readFileWithEncoding(inputPath, encoding);
  
  const parser = createXMLParser();
  const parsedData = parser.parse(xmlData);
  const processedTUs = removeDuplicates(parsedData, priorityManager);
  
  const builder = createXMLBuilder();
  const outputXML = builder.build(processedTUs);
  
  await writeFileWithEncoding(outputPath, outputXML, encoding);

  // Log statistics
  const stats = getProcessingStats(parsedData, processedTUs);
  console.log(chalk.blue('\nProcessing Statistics:'));
  console.log(chalk.gray(`- Original TUs: ${stats.originalCount}`));
  console.log(chalk.gray(`- Unique TUs: ${stats.uniqueCount}`));
  console.log(chalk.gray(`- Duplicates removed: ${stats.duplicatesRemoved}`));
}

function getProcessingStats(originalData, processedData) {
  const originalCount = originalData.find(node => node.body)?.body?.tu?.length || 0;
  const uniqueCount = processedData.find(node => node.body)?.body?.tu?.length || 0;
  return {
    originalCount,
    uniqueCount,
    duplicatesRemoved: originalCount - uniqueCount
  };
}

function removeDuplicates(tmxData, priorityManager) {
  const tuMap = new Map();
  const body = tmxData.find(node => node.body);
  
  if (!body || !body.body.tu) {
    return tmxData;
  }

  body.body.tu = body.body.tu.filter(tu => {
    const key = getTUKey(tu);
    
    if (!tuMap.has(key)) {
      tuMap.set(key, tu);
      return true;
    }
    
    const existingTU = tuMap.get(key);
    const shouldReplace = priorityManager.compareTranslationUnits(existingTU, tu);
    
    if (shouldReplace) {
      tuMap.set(key, tu);
      return true;
    }
    
    return false;
  });

  return tmxData;
}

function getTUKey(tu) {
  const sourceText = tu.tuv.find(tuv => tuv['@_xml:lang'] === 'en-ca')?.seg;
  const targetText = tu.tuv.find(tuv => tuv['@_xml:lang'] === 'fr-ca')?.seg;
  return `${sourceText}|${targetText}`;
}
