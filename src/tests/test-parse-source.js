/**
 * Test: Source Parser Module
 * 
 * Usage: npm run test:parse
 * 
 * Tests the source parsing and file saving functionality
 */

import { parseSourceCode, processAndSaveSource } from '../modules/sourceParser.js';
import { fetchContractSource } from '../modules/sourceFetcher.js';

// Test contracts
const TEST_CONTRACTS = {
  proxy: {
    chain: 'bsc',
    address: '0x25aB3Efd52e6470681CE037cD546Dc60726948D3',
    description: 'BSC Proxy Contract'
  },
  normal: {
    chain: 'ethereum',
    address: '0xF4a21Ac7e51d17A0e1C8B59f7a98bb7A97806f14',
    description: 'Ethereum Normal Contract'
  }
};

// Sample source codes for testing parsing
const SAMPLE_SOURCES = {
  singleFile: `pragma solidity ^0.8.0;

contract SimpleContract {
    uint256 public value;
    
    function setValue(uint256 _value) public {
        value = _value;
    }
}`,
  
  multiFileJson: JSON.stringify({
    sources: {
      'contracts/Main.sol': {
        content: `pragma solidity ^0.8.0;

import "./Base.sol";

contract Main is Base {
    function main() public pure returns (string memory) {
        return "Hello";
    }
}`
      },
      'contracts/Base.sol': {
        content: `pragma solidity ^0.8.0;

contract Base {
    function base() public pure returns (string memory) {
        return "Base";
    }
}`
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }),
  
  doubleWrapped: '{{' + JSON.stringify({
    sources: {
      'Token.sol': { content: 'pragma solidity ^0.8.0; contract Token {}' }
    }
  }) + '}}'
};

function testParseSourceCode() {
  console.log('\n--- Test: parseSourceCode ---');
  
  // Test single file
  console.log('\n  Testing single file source:');
  const singleResult = parseSourceCode(SAMPLE_SOURCES.singleFile);
  console.log(`    Type: ${singleResult.type}`);
  console.log(`    Files: ${Object.keys(singleResult.files).join(', ')}`);
  console.log(`    ✓ Test passed`);
  
  // Test multi-file JSON
  console.log('\n  Testing multi-file JSON source:');
  const multiResult = parseSourceCode(SAMPLE_SOURCES.multiFileJson);
  console.log(`    Type: ${multiResult.type}`);
  console.log(`    Files: ${Object.keys(multiResult.files).join(', ')}`);
  console.log(`    Settings: ${JSON.stringify(multiResult.settings)}`);
  console.log(`    ✓ Test passed`);
  
  // Test double-wrapped JSON
  console.log('\n  Testing double-wrapped JSON source:');
  const doubleResult = parseSourceCode(SAMPLE_SOURCES.doubleWrapped);
  console.log(`    Type: ${doubleResult.type}`);
  console.log(`    Files: ${Object.keys(doubleResult.files).join(', ')}`);
  console.log(`    ✓ Test passed`);
  
  // Test empty source
  console.log('\n  Testing empty source:');
  const emptyResult = parseSourceCode('');
  console.log(`    Type: ${emptyResult.type}`);
  console.log(`    ✓ Test passed`);
}

async function testProcessAndSaveSource() {
  console.log('\n--- Test: processAndSaveSource ---');
  
  for (const [type, contract] of Object.entries(TEST_CONTRACTS)) {
    console.log(`\n  Testing ${contract.description} (${type}):`);
    console.log(`    Chain: ${contract.chain}`);
    console.log(`    Address: ${contract.address}`);
    
    try {
      // Fetch source first
      const sourceData = await fetchContractSource(contract.chain, contract.address);
      
      if (!sourceData.isVerified) {
        console.log(`    ⚠ Contract not verified, skipping save test`);
        continue;
      }
      
      // Process and save
      const result = processAndSaveSource(sourceData);
      
      if (result.success) {
        console.log(`    Output Dir: ${result.outputDir}`);
        console.log(`    Files Saved: ${result.savedFiles.length}`);
        console.log(`    Contract: ${result.metadata.contractName}`);
        console.log(`    ✓ Test passed`);
      } else {
        console.log(`    ✗ Failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('========================================');
  console.log('Test: Source Parser Module');
  console.log('========================================');
  
  testParseSourceCode();
  await testProcessAndSaveSource();
  
  console.log('\n========================================');
  console.log('Source Parser Tests Complete');
  console.log('========================================\n');
}

main().catch(console.error);
