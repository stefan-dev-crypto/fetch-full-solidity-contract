/**
 * Source Parser Module
 * Parses contract source code from Etherscan and saves to file structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Output directory is outside the project for use by other projects
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts');
// Path to blacklist configuration file
const BLACKLIST_CONFIG_PATH = path.join(__dirname, '..', 'config', 'contract-blacklist.json');

// ============================================================================
// AUDIT EXCLUSION PATTERNS - Production-Grade Security Audit Configuration
// ============================================================================

// 1️⃣ Core Ethereum / DeFi Libraries (Widely Audited - Safe to Exclude)
// const VENDOR_LIBRARIES = [
//   // OpenZeppelin (all variants)
//   '@openzeppelin-contracts/',
//   'openzeppelin-contracts/',
//   'openzeppelin-upgradeable/',
//   '@openzeppelin/contracts/',
//   '@openzeppelin/contracts-upgradeable/',
//   '@openzeppelin-4/',
//   '@openzeppelin/',
  
//   // Math & Utility Libraries
//   '@prb/math/',
//   'prb-math/',
//   '@rari-capital/solmate/',
//   'solady/',
//   '@transmissions11/solmate/',
//   'solmate/',
  
//   // AMMs / DEXs / Liquidity
//   '@uniswap/v3-core/',
//   '@uniswap/v3-periphery/',
//   '@uniswap/v2-core/',
//   '@uniswap/v2-periphery/',
//   '@uniswap/',
//   'sushiswap/',
//   'pancakeswap/',
//   '@curvefi/',
//   'curve/',
//   '@balancer/',
  
//   // Lending / Yield Protocols
//   'aave-v2/',
//   'aave-v3/',
//   '@aave/core-v3/',
//   '@aave/',
//   '@yearn/',
//   'compound-protocol/',
//   '@compound/',
//   '@venusprotocol/',
  
//   // Oracles
//   'chainlink/',
//   '@chainlink/contracts/',
//   '@chainlink/',
//   'api3/',
//   '@api3/',
//   '@uma/',
  
//   // Other Protocols
//   '@gnosis/',
//   '@ensdomains/',
//   '@eth-optimism/',
//   'arbitrum/',
//   '@matterlabs/',
// ];

// 2️⃣ Testing, Scripting, Dev Tooling (Always Exclude)
const DEV_TOOLING_PATTERNS = [
  /\btest\//i,
  /\btests\//i,
  /\bscripts\//i,
  /\bdeploy\//i,
  /\bdeployment\//i,
  /\bmocks\//i,
  /\bmock\//i,
  /\bexample\//i,
  /\bexamples\//i,
  /\bdemo\//i,
  /\bbenchmarks\//i,
  /\bforge-std\//i,
  /\bdapp-tools\//i,
  /\bds-test\//i,
  /\bhardhat\//i,
  /\bfoundry\//i,
];

// 3️⃣ Build Artifacts (Never Audit)
const BUILD_ARTIFACTS_PATTERNS = [
  /\bout\//i,
  /\bartifacts\//i,
  /\bcache\//i,
  /\btypechain\//i,
  /\babi\//i,
  /\babis\//i,
  /\bbuild\//i,
  /\bcoverage\//i,
  /\bnode_modules\//i,
];

// 4️⃣ Interfaces & Pure Type Definitions (Mostly Excludable)
// const INTERFACE_PATTERNS = [
//   /^I[A-Z].*\.sol$/,  // Files starting with I and capital letter (IERC20.sol)
//   /\binterface\/.*\.sol$/,
//   /\binterfaces\/.*\.sol$/,
//   /\btypes\/.*\.sol$/,
// ];

// 5️⃣ Common Safe Patterns by Filename
const SAFE_FILENAME_PATTERNS = [
  /Test\.sol$/,
  /\.t\.sol$/,        // Foundry test files
  /Mock\.sol$/,
  /Harness\.sol$/,
  /Script\.sol$/,
  /Deploy\.sol$/,
  /Helper\.sol$/,
  /Utils\.sol$/,
];

// 🚨 RED FLAGS - Paths that indicate COPIED/MODIFIED vendor code
// Files in these locations should NEVER be auto-excluded, even if they match vendor patterns
// Note: These patterns specifically target PROJECT directories, not vendor packages
const RED_FLAG_PATHS = [
  /^contracts\/lib\//i,
  /^contracts\/vendor\//i,
  /^contracts\/external\//i,
  /^contracts\/utils\//i,       // Project's utils (not @openzeppelin/contracts/utils)
  /^contracts\/libraries\//i,   // Custom libs, not vendor
  /^src\/lib\//i,
  /^src\/vendor\//i,
  /^src\/external\//i,
  /^lib\//i,                    // Root-level lib folder
  /^vendor\//i,                 // Root-level vendor folder
  /^external\//i,               // Root-level external folder
];

/**
 * Load contract file blacklist from JSON configuration file
 * @returns {string[]} Array of blacklist patterns
 */
function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_CONFIG_PATH)) {
      const blacklistData = JSON.parse(fs.readFileSync(BLACKLIST_CONFIG_PATH, 'utf8'));
      return blacklistData.contractFileNames || [];
    }
  } catch (error) {
    console.warn(`Warning: Could not load blacklist from ${BLACKLIST_CONFIG_PATH}: ${error.message}`);
  }
  return [];
}

/**
 * Check if a file path matches the contract file blacklist
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file matches blacklist and should not be saved
 */
export function isBlacklisted(filePath) {
  if (!filePath) {
    return false;
  }
  
  const blacklist = loadBlacklist();
  if (blacklist.length === 0) {
    return false;
  }
  
  // Normalize path for comparison (use forward slashes)
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Check if file path contains any blacklist pattern
  for (const pattern of blacklist) {
    if (normalizedPath.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Parse Etherscan source code response
 * Handles both simple source code and JSON-formatted multi-file sources
 * @param {string} sourceCode - Raw source code from Etherscan
 * @returns {Object} Parsed source files
 */
export function parseSourceCode(sourceCode) {
  if (!sourceCode || sourceCode === '') {
    return {
      type: 'empty',
      files: {}
    };
  }

  // Check if source code is JSON formatted (multi-file source)
  // Etherscan sometimes wraps JSON in double braces {{ }}
  let trimmedSource = sourceCode.trim();
  
  // Handle double-wrapped JSON format from Etherscan
  if (trimmedSource.startsWith('{{') && trimmedSource.endsWith('}}')) {
    trimmedSource = trimmedSource.slice(1, -1);
  }

  // Try to parse as JSON
  if (trimmedSource.startsWith('{')) {
    try {
      const jsonSource = JSON.parse(trimmedSource);
      
      // Handle standard Solidity JSON input format
      if (jsonSource.sources) {
        const files = {};
        for (const [filePath, fileData] of Object.entries(jsonSource.sources)) {
          files[filePath] = fileData.content || '';
        }
        return {
          type: 'multi-file',
          files,
          settings: jsonSource.settings || {},
          language: jsonSource.language || 'Solidity'
        };
      }
      
      // Handle object format with file paths as keys
      const files = {};
      for (const [filePath, content] of Object.entries(jsonSource)) {
        if (typeof content === 'string') {
          files[filePath] = content;
        } else if (content.content) {
          files[filePath] = content.content;
        }
      }
      
      return {
        type: 'multi-file',
        files
      };
    } catch (e) {
      // Not valid JSON, treat as single file
    }
  }

  // Single file source code
  return {
    type: 'single-file',
    files: {
      'contract.sol': sourceCode
    }
  };
}

/**
 * Check if a file should be excluded from audit
 * @param {string} filePath - Path to the file
 * @returns {Object} { shouldExclude: boolean, reason: string, warning?: string }
 */
export function shouldExcludeFromAudit(filePath) {
  return { shouldExclude: false, reason: 'custom-contract' };
}
// export function shouldExcludeFromAudit(filePath) {
//   // 🚨 CRITICAL: Check for RED FLAGS first
//   // If file is in a red flag directory, NEVER exclude it (likely modified vendor code)
//   for (const pattern of RED_FLAG_PATHS) {
//     if (pattern.test(filePath)) {
//       return { 
//         shouldExclude: false, 
//         reason: 'red-flag-path',
//         warning: '⚠️ CRITICAL: File in contracts/lib, contracts/vendor, or contracts/utils - likely modified vendor code. Must audit!'
//       };
//     }
//   }
  
//   // 1️⃣ Check build artifacts (highest priority after red flags)
//   for (const pattern of BUILD_ARTIFACTS_PATTERNS) {
//     if (pattern.test(filePath)) {
//       return { shouldExclude: true, reason: 'build-artifact', pattern: pattern.toString() };
//     }
//   }
  
//   // 2️⃣ Check dev tooling / test files
//   for (const pattern of DEV_TOOLING_PATTERNS) {
//     if (pattern.test(filePath)) {
//       return { shouldExclude: true, reason: 'dev-tooling', pattern: pattern.toString() };
//     }
//   }
  
//   // 3️⃣ Check safe filename patterns
//   for (const pattern of SAFE_FILENAME_PATTERNS) {
//     if (pattern.test(filePath)) {
//       return { shouldExclude: true, reason: 'test-file', pattern: pattern.toString() };
//     }
//   }
  
//   // 4️⃣ Check vendor library patterns
//   for (const pattern of VENDOR_LIBRARIES) {
//     if (filePath.includes(pattern)) {
//       return { shouldExclude: true, reason: 'vendor-library', pattern };
//     }
//   }
  
//   // 5️⃣ Check interface patterns (lowest priority - can contain logic)
//   // for (const pattern of INTERFACE_PATTERNS) {
//   //   if (pattern.test(filePath)) {
//   //     // Additional check: if interface is in a custom path, keep it
//   //     if (filePath.includes('contracts/') || filePath.includes('src/')) {
//   //       return { 
//   //         shouldExclude: true, 
//   //         reason: 'interface', 
//   //         pattern: pattern.toString(),
//   //         note: 'Pure interface - review if it defines custom callbacks or hooks'
//   //       };
//   //     }
//   //   }
//   // }
  
//   return { shouldExclude: false, reason: 'custom-contract' };
// }

/**
 * Strip all comments from Solidity source code
 * Handles single-line, multi-line, and NatSpec comments
 * Preserves strings and doesn't strip comment-like syntax inside string literals
 * @param {string} source - Solidity source code
 * @returns {string} Source code without comments
 */
function stripSolidityComments(source) {
  let result = '';
  let i = 0;
  const len = source.length;
  
  while (i < len) {
    const char = source[i];
    const nextChar = i + 1 < len ? source[i + 1] : '';
    
    // Handle string literals (single quotes)
    if (char === "'" && (i === 0 || source[i - 1] !== '\\')) {
      result += char;
      i++;
      // Copy everything until the closing quote
      while (i < len) {
        result += source[i];
        if (source[i] === "'" && source[i - 1] !== '\\') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    
    // Handle string literals (double quotes)
    if (char === '"' && (i === 0 || source[i - 1] !== '\\')) {
      result += char;
      i++;
      // Copy everything until the closing quote
      while (i < len) {
        result += source[i];
        if (source[i] === '"' && source[i - 1] !== '\\') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    
    // Handle multi-line comments /* */ and /** */
    if (char === '/' && nextChar === '*') {
      i += 2;
      // Skip until we find */
      while (i < len - 1) {
        if (source[i] === '*' && source[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    
    // Handle single-line comments // and ///
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < len && source[i] !== '\n') {
        i++;
      }
      // Keep the newline
      if (i < len && source[i] === '\n') {
        result += '\n';
        i++;
      }
      continue;
    }
    
    // Regular character
    result += char;
    i++;
  }
  
  // Clean up excessive blank lines (more than 2 consecutive newlines)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Trim trailing whitespace on each line
  result = result.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Trim leading/trailing whitespace from the entire file
  return result.trim() + '\n';
}

/**
 * Analyze file to determine if it's a pure interface
 * @param {string} content - File content
 * @returns {boolean} True if it's a pure interface
 */
function isPureInterface(content) {
  // Remove comments
  const withoutComments = stripSolidityComments(content);
  
  // Check if it contains "interface" keyword
  if (!/\binterface\s+\w+/.test(withoutComments)) {
    return false;
  }
  
  // Check if it contains implementation (function bodies with code)
  // Pure interfaces only have function signatures, no implementations
  const hasFunctionBodies = /function\s+\w+[^;]*\{[^}]+\}/.test(withoutComments);
  
  return !hasFunctionBodies;
}

/**
 * Detect the main contract file from a list of files
 * @param {Object} files - Map of file paths to content
 * @param {string} contractName - Name of the main contract
 * @param {string} contractFileName - Main contract file name from Etherscan (preferred)
 * @returns {string|null} Path to the main contract file
 */
export function detectMainContract(files, contractName, contractFileName = null) {
  const fileEntries = Object.entries(files);
  
  // Strategy 1: Use ContractFileName from Etherscan (most reliable)
  if (contractFileName) {
    // ContractFileName might be just the filename or a path
    for (const [filePath] of fileEntries) {
      // Check if the file path ends with the ContractFileName
      if (filePath.endsWith(contractFileName)) {
        return filePath;
      }
      // Check if just the filename matches
      const fileName = path.basename(filePath);
      if (fileName === contractFileName) {
        return filePath;
      }
    }
  }
  
  // Strategy 2: Find file containing the contract name
  if (contractName) {
    for (const [filePath, content] of fileEntries) {
      // Check if filename matches contract name
      const fileName = path.basename(filePath, '.sol');
      if (fileName === contractName) {
        return filePath;
      }
      
      // Check if file contains contract definition with this name
      const contractPattern = new RegExp(`\\b(?:contract|library)\\s+${contractName}\\b`);
      if (contractPattern.test(content)) {
        return filePath;
      }
    }
  }
  
  // Strategy 3: Find largest non-excluded file (likely the main contract)
  let largestFile = null;
  let largestSize = 0;
  
  for (const [filePath, content] of fileEntries) {
    const exclusion = shouldExcludeFromAudit(filePath);
    if (exclusion.shouldExclude) continue;
    
    if (content.length > largestSize) {
      largestSize = content.length;
      largestFile = filePath;
    }
  }
  
  // Strategy 4: Find file with most external/public functions
  if (!largestFile) {
    let mostFunctions = 0;
    
    for (const [filePath, content] of fileEntries) {
      const exclusion = shouldExcludeFromAudit(filePath);
      if (exclusion.shouldExclude) continue;
      
      const publicFunctions = (content.match(/function\s+\w+[^{]*(?:external|public)/g) || []).length;
      if (publicFunctions > mostFunctions) {
        mostFunctions = publicFunctions;
        largestFile = filePath;
      }
    }
  }
  
  return largestFile;
}

/**
 * Categorize files for audit purposes
 * @param {Object} files - Map of file paths to content
 * @param {string} mainContract - Path to main contract
 * @returns {Object} Categorized files
 */
export function categorizeFilesForAudit(files, mainContract) {
  const categories = {
    mainContract: mainContract,
    criticalFiles: [],
    redFlagFiles: [],      // Files in suspicious locations (modified vendor code)
    dependencies: [],
    interfaces: [],
    excluded: [],
    excludedReasons: {},
    warnings: []
  };
  
  for (const [filePath, content] of Object.entries(files)) {
    const exclusion = shouldExcludeFromAudit(filePath);
    
    // Check for red flag warnings
    if (exclusion.warning) {
      categories.warnings.push({
        file: filePath,
        warning: exclusion.warning,
        reason: exclusion.reason
      });
      categories.redFlagFiles.push(filePath);
      categories.criticalFiles.push(filePath); // Also add to critical for auditing
    } else if (exclusion.shouldExclude) {
      categories.excluded.push(filePath);
      categories.excludedReasons[filePath] = exclusion.reason;
    } else if (filePath === mainContract) {
      // Already marked as main
    } else if (isPureInterface(content)) {
      categories.interfaces.push(filePath);
      if (exclusion.note) {
        categories.warnings.push({
          file: filePath,
          warning: exclusion.note,
          reason: 'interface-review'
        });
      }
    } else {
      categories.criticalFiles.push(filePath);
    }
  }
  
  return categories;
}

/**
 * Generate audit metadata
 * @param {Object} files - Map of file paths to content
 * @param {string} contractName - Name of the contract
 * @param {string} contractFileName - Main contract file name from Etherscan
 * @returns {Object} Audit metadata
 */
export function generateAuditMetadata(files, contractName, contractFileName = null) {
  const mainContract = detectMainContract(files, contractName, contractFileName);
  const categories = categorizeFilesForAudit(files, mainContract);
  
  const totalFiles = Object.keys(files).length;
  const auditFiles = 1 + categories.criticalFiles.length; // main + critical
  const excludedFiles = categories.excluded.length;
  const hasWarnings = categories.warnings.length > 0;
  const hasRedFlags = categories.redFlagFiles.length > 0;
  
  return {
    mainContract: mainContract ? path.basename(mainContract) : 'Unknown',
    mainContractPath: mainContract || null,
    contractFileName: contractFileName || null,
    totalFiles,
    auditFiles,
    excludedFiles,
    reductionPercentage: totalFiles > 0 ? Math.round((excludedFiles / totalFiles) * 100) : 0,
    
    // 🚨 Critical warnings
    warnings: categories.warnings,
    hasWarnings,
    hasRedFlags,
    redFlagFiles: categories.redFlagFiles,
    
    categories: {
      critical: [mainContract, ...categories.criticalFiles].filter(Boolean),
      redFlags: categories.redFlagFiles,
      interfaces: categories.interfaces,
      excluded: categories.excluded
    },
    excludedReasons: categories.excludedReasons,
    auditPriority: {
      critical: categories.redFlagFiles.length > 0 ? categories.redFlagFiles : [],  // Red flags get highest priority
      high: mainContract ? [mainContract] : [],
      medium: categories.criticalFiles.filter(f => !categories.redFlagFiles.includes(f)), // Exclude red flags already in critical
      low: categories.interfaces,
      excluded: categories.excluded
    }
  };
}

/**
 * Create output directory structure for a contract
 * @param {string} chainName - Chain name
 * @param {string} contractAddress - Contract address
 * @returns {string} Path to the contract output directory
 */
export function createOutputDirectory(chainName, contractAddress) {
  const contractDir = path.join(OUTPUT_DIR, chainName, contractAddress);
  
  if (!fs.existsSync(contractDir)) {
    fs.mkdirSync(contractDir, { recursive: true });
  }
  
  return contractDir;
}

/**
 * Clean up empty directories recursively
 * @param {string} directory - Directory to clean up
 */
function cleanupEmptyDirectories(directory) {
  try {
    if (!fs.existsSync(directory)) {
      return;
    }
    
    const files = fs.readdirSync(directory);
    
    // Recursively clean subdirectories first
    for (const file of files) {
      const fullPath = path.join(directory, file);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          cleanupEmptyDirectories(fullPath);
          
          // After cleaning subdirectory, check if it's now empty
          const subFiles = fs.readdirSync(fullPath);
          if (subFiles.length === 0) {
            fs.rmdirSync(fullPath);
          }
        }
      } catch (err) {
        // Skip if file was already deleted or inaccessible
      }
    }
    
    // Check if directory is now empty
    if (fs.existsSync(directory)) {
      const remainingFiles = fs.readdirSync(directory);
      
      // Don't delete the base contract directory, proxy, or implementation folders
      const baseName = path.basename(directory);
      const isBaseDir = directory.match(/0x[a-fA-F0-9]{40}$/);
      const isSpecialDir = baseName === 'proxy' || baseName === 'implementation';
      
      if (remainingFiles.length === 0 && !isBaseDir && !isSpecialDir) {
        fs.rmdirSync(directory);
      }
    }
  } catch (err) {
    // Ignore errors during cleanup
  }
}

/**
 * Save parsed source files to disk
 * @param {string} chainName - Chain name
 * @param {string} contractAddress - Contract address
 * @param {Object} parsedSource - Parsed source from parseSourceCode
 * @param {string} contractName - Name of the contract
 * @param {string} contractType - Type of contract (e.g., 'proxy', 'implementation', 'main')
 * @param {string} contractFileName - Main contract file name from Etherscan
 * @returns {Object} Information about saved files
 */
export function saveSourceFiles(chainName, contractAddress, parsedSource, contractName, contractType = '', contractFileName = null) {
  const baseDir = createOutputDirectory(chainName, contractAddress);
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  const savedFiles = [];
  
  // Determine the subdirectory based on contract type
  // For proxy contracts: save in proxy/ or implementation/ subdirectories
  // For regular contracts: save directly in base directory
  let subDir = '';
  if (contractType === 'proxy') {
    subDir = 'proxy';
  } else if (contractType === 'implementation') {
    subDir = 'implementation';
  }
  // For 'main' type, subDir remains empty (save directly)
  
  const excludedFiles = [];
  const excludedReasons = {};
  const keptFiles = [];
  const blacklistedFiles = [];
  
  for (const [filePath, content] of Object.entries(parsedSource.files)) {
    // Normalize file path - remove leading slashes
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1);
    }
    
    // Check if file is blacklisted - if so, skip saving entirely
    if (isBlacklisted(normalizedPath)) {
      blacklistedFiles.push(normalizedPath);
      excludedFiles.push(normalizedPath);
      excludedReasons[normalizedPath] = 'blacklisted-vendor-library';
      continue; // Skip this file - don't save it
    }
    
    // Check if file should be excluded from audit
    const exclusion = shouldExcludeFromAudit(normalizedPath);
    
    // Build the full path
    // If subDir is set (proxy/implementation), prepend it
    // Otherwise, save directly to base directory
    const fullPath = subDir 
      ? path.join(baseDir, subDir, normalizedPath)
      : path.join(baseDir, normalizedPath);
    
    const fileDir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Strip all comments from Solidity files before saving
    let processedContent = content;
    if (normalizedPath.endsWith('.sol')) {
      processedContent = stripSolidityComments(content);
    }
    
    // Write file
    fs.writeFileSync(fullPath, processedContent, 'utf8');
    savedFiles.push(fullPath);
    
    // Track exclusion status
    if (exclusion.shouldExclude && !exclusion.warning) {
      // File should be excluded and is not a red flag
      excludedFiles.push(normalizedPath);
      excludedReasons[normalizedPath] = exclusion.reason;
    } else {
      // File should be kept for audit
      keptFiles.push(normalizedPath);
    }
  }
  
  // Delete excluded files from disk (keep only files that need to be audited)
  const deletedFiles = [];
  for (const excludedFile of excludedFiles) {
    const fullPath = subDir 
      ? path.join(baseDir, subDir, excludedFile)
      : path.join(baseDir, excludedFile);
    
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deletedFiles.push(excludedFile);
        
        // Remove from savedFiles array
        const savedIndex = savedFiles.findIndex(f => {
          const relativePath = subDir 
            ? path.relative(path.join(baseDir, subDir), f)
            : path.relative(baseDir, f);
          return relativePath === excludedFile;
        });
        if (savedIndex > -1) {
          savedFiles.splice(savedIndex, 1);
        }
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not delete ${excludedFile}: ${err.message}`);
    }
  }
  
  // Clean up empty directories after deletion
  if (subDir) {
    cleanupEmptyDirectories(path.join(baseDir, subDir));
  } else {
    cleanupEmptyDirectories(baseDir);
  }
  
  if (blacklistedFiles.length > 0) {
    console.log(`   🚫 Skipped ${blacklistedFiles.length} blacklisted vendor library file(s)`);
  }
  
  if (deletedFiles.length > 0) {
    console.log(`   🗑️  Deleted ${deletedFiles.length} excluded file(s)`);
  }
  
  // Detect main contract
  const mainContractPath = detectMainContract(parsedSource.files, contractName, contractFileName);
  const mainContractFileName = mainContractPath ? path.basename(mainContractPath) : contractName;
  
  // Create minimal audit manifest (only main contract info)
  const auditManifest = {
    mainContract: mainContractFileName,
    mainContractPath: mainContractPath,
    contractType: contractType
  };
  
  // Save minimal audit-manifest.json only
  const auditManifestPath = subDir 
    ? path.join(baseDir, subDir, 'audit-manifest.json')
    : path.join(baseDir, 'audit-manifest.json');
  fs.writeFileSync(auditManifestPath, JSON.stringify(auditManifest, null, 2), 'utf8');
  
  return {
    outputDir: baseDir,
    savedFiles,
    deletedFiles,
    blacklistedFiles,
    keptFiles,
    excludedReasons,
    auditManifest
  };
}

/**
 * Save contract ABI to disk
 * @param {string} chainName - Chain name
 * @param {string} contractAddress - Contract address
 * @param {string} abi - Contract ABI (JSON string)
 * @param {string} contractType - Type of contract (e.g., 'proxy', 'implementation', 'main')
 */
export function saveABI(chainName, contractAddress, abi, contractType = 'main') {
  const baseDir = createOutputDirectory(chainName, contractAddress);
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  // For proxy/implementation, save inside their respective folders
  // For main, save in base directory
  let abiPath;
  if (contractType === 'proxy') {
    const proxyDir = path.join(baseDir, 'proxy');
    if (!fs.existsSync(proxyDir)) {
      fs.mkdirSync(proxyDir, { recursive: true });
    }
    abiPath = path.join(proxyDir, 'abi.json');
  } else if (contractType === 'implementation') {
    const implDir = path.join(baseDir, 'implementation');
    if (!fs.existsSync(implDir)) {
      fs.mkdirSync(implDir, { recursive: true });
    }
    abiPath = path.join(implDir, 'abi.json');
  } else {
    abiPath = path.join(baseDir, 'abi.json');
  }
  
  // Try to parse and format ABI if it's a string
  let abiContent = abi;
  if (typeof abi === 'string') {
    try {
      const parsed = JSON.parse(abi);
      abiContent = JSON.stringify(parsed, null, 2);
    } catch (e) {
      abiContent = abi;
    }
  } else {
    abiContent = JSON.stringify(abi, null, 2);
  }
  
  fs.writeFileSync(abiPath, abiContent, 'utf8');
  return abiPath;
}

/**
 * Save compiler settings for contract verification/deployment
 * @param {string} chainName - Chain name
 * @param {string} contractAddress - Contract address
 * @param {Object} settings - Compiler settings
 * @param {string} contractType - Type of contract (e.g., 'proxy', 'implementation', 'main')
 */
export function saveCompilerSettings(chainName, contractAddress, settings, contractType = 'main') {
  const baseDir = createOutputDirectory(chainName, contractAddress);
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  // For proxy/implementation, save inside their respective folders
  // For main, save in base directory
  let settingsPath;
  if (contractType === 'proxy') {
    const proxyDir = path.join(baseDir, 'proxy');
    if (!fs.existsSync(proxyDir)) {
      fs.mkdirSync(proxyDir, { recursive: true });
    }
    settingsPath = path.join(proxyDir, 'compiler-settings.json');
  } else if (contractType === 'implementation') {
    const implDir = path.join(baseDir, 'implementation');
    if (!fs.existsSync(implDir)) {
      fs.mkdirSync(implDir, { recursive: true });
    }
    settingsPath = path.join(implDir, 'compiler-settings.json');
  } else {
    settingsPath = path.join(baseDir, 'compiler-settings.json');
  }
  
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settingsPath;
}

/**
 * Process and save complete contract source
 * @param {Object} sourceData - Source data from sourceFetcher
 * @param {string} contractType - Type of contract (e.g., 'proxy', 'implementation', 'main')
 * @param {string} baseContractAddress - Optional base contract address (for proxy contracts, use proxy address)
 * @returns {Object} Processing result
 */
export function processAndSaveSource(sourceData, contractType = 'main', baseContractAddress = null) {
  if (!sourceData.isVerified) {
    return {
      success: false,
      error: 'Contract is not verified',
      contractAddress: sourceData.contractAddress,
      chainName: sourceData.chainName
    };
  }
  
  // Use base contract address if provided (for implementation contracts saved with proxy address)
  const saveAddress = baseContractAddress || sourceData.contractAddress;
  
  // Parse source code
  const parsedSource = parseSourceCode(sourceData.sourceCode);
  
  // Use contract name for single file
  if (parsedSource.type === 'single-file' && sourceData.contractName) {
    const oldKey = Object.keys(parsedSource.files)[0];
    const newKey = `${sourceData.contractName}.sol`;
    parsedSource.files[newKey] = parsedSource.files[oldKey];
    delete parsedSource.files[oldKey];
  }
  
  // Save source files - all flattened to root level
  const saveResult = saveSourceFiles(
    sourceData.chainName,
    saveAddress,
    parsedSource,
    sourceData.contractName,
    contractType,
    sourceData.contractFileName // Pass main contract file name from Etherscan
  );
  
  // Only save minimal audit-manifest.json (no ABI, no compiler settings, no metadata)
  
  return {
    success: true,
    ...saveResult,
    contractType,
    originalContractAddress: sourceData.contractAddress
  };
}

export default {
  parseSourceCode,
  createOutputDirectory,
  saveSourceFiles,
  saveABI,
  saveCompilerSettings,
  processAndSaveSource
};
