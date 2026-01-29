/**
 * Test: Contract File Blacklist
 * 
 * Tests the blacklist functionality to ensure vendor library files are not saved
 */

import { isBlacklisted, parseSourceCode, saveSourceFiles } from '../modules/sourceParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test cases for blacklist
const TEST_CASES = [
  {
    name: 'OpenZeppelin contract',
    filePath: '@openzeppelin-contracts/contracts/token/ERC20/ERC20.sol',
    shouldBeBlacklisted: true
  },
  {
    name: 'OpenZeppelin upgradeable',
    filePath: 'openzeppelin-upgradeable/contracts/proxy/Proxy.sol',
    shouldBeBlacklisted: true
  },
  {
    name: 'Uniswap V3 core',
    filePath: '@uniswap/v3-core/contracts/UniswapV3Pool.sol',
    shouldBeBlacklisted: true
  },
  {
    name: 'Chainlink contract',
    filePath: 'chainlink/contracts/src/v0.8/AggregatorV3Interface.sol',
    shouldBeBlacklisted: true
  },
  {
    name: 'Aave contract',
    filePath: 'aave-v3/core/contracts/protocol/lendingpool/LendingPool.sol',
    shouldBeBlacklisted: true
  },
  {
    name: 'Custom contract (not blacklisted)',
    filePath: 'contracts/MyCustomContract.sol',
    shouldBeBlacklisted: false
  },
  {
    name: 'Custom contract in src',
    filePath: 'src/Token.sol',
    shouldBeBlacklisted: false
  },
  {
    name: 'Contract with openzeppelin in path but not pattern',
    filePath: 'contracts/openzeppelin-wrapper.sol',
    shouldBeBlacklisted: false
  }
];

function testBlacklistFunction() {
  console.log('\n========================================');
  console.log('Test: Contract File Blacklist');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`  File path: ${testCase.filePath}`);
    
    try {
      const result = isBlacklisted(testCase.filePath);
      const expected = testCase.shouldBeBlacklisted;
      
      if (result === expected) {
        console.log(`  ✓ PASSED (blacklisted: ${result})`);
        passed++;
      } else {
        console.log(`  ✗ FAILED (expected: ${expected}, got: ${result})`);
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);
  
  return failed === 0;
}

async function testBlacklistInSaveProcess() {
  console.log('\n========================================');
  console.log('Test: Blacklist in Save Process');
  console.log('========================================\n');
  
  try {
    // Create mock source with blacklisted and non-blacklisted files
    const mockSourceData = {
      chainName: 'ethereum',
      contractAddress: '0x0000000000000000000000000000000000000001',
      contractName: 'TestContract',
      isVerified: true,
      sourceCode: JSON.stringify({
        sources: {
          'contracts/MyContract.sol': {
            content: 'pragma solidity ^0.8.0; contract MyContract {}'
          },
          '@openzeppelin-contracts/contracts/token/ERC20/ERC20.sol': {
            content: 'pragma solidity ^0.8.0; contract ERC20 {}'
          },
          'contracts/AnotherContract.sol': {
            content: 'pragma solidity ^0.8.0; contract AnotherContract {}'
          },
          'chainlink/contracts/AggregatorV3Interface.sol': {
            content: 'pragma solidity ^0.8.0; interface AggregatorV3Interface {}'
          }
        }
      })
    };
    
    // Parse the source
    const parsedSource = parseSourceCode(mockSourceData.sourceCode);
    
    // Create temp output directory
    const testAddress = 'test-blacklist-' + Date.now();
    const saveResult = saveSourceFiles(
      'test-chain',
      testAddress,
      parsedSource,
      'TestContract',
      'main',
      'MyContract.sol'
    );
    
    // Check results
    console.log('Save result:');
    console.log(`  Blacklisted files: ${saveResult.blacklistedFiles.length}`);
    console.log(`  Saved files: ${saveResult.savedFiles.length}`);
    console.log(`  Kept files: ${saveResult.keptFiles.length}`);
    
    // Verify blacklisted files
    const expectedBlacklisted = [
      '@openzeppelin-contracts/contracts/token/ERC20/ERC20.sol',
      'chainlink/contracts/AggregatorV3Interface.sol'
    ];
    
    let allFound = true;
    for (const expected of expectedBlacklisted) {
      if (!saveResult.blacklistedFiles.includes(expected)) {
        console.log(`  ✗ FAILED: Expected blacklisted file not found: ${expected}`);
        allFound = false;
      } else {
        console.log(`  ✓ Found blacklisted file: ${expected}`);
      }
    }
    
    // Verify saved files don't include blacklisted ones
    const testChainDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-chain', testAddress);
    if (fs.existsSync(testChainDir)) {
      const savedFiles = fs.readdirSync(testChainDir, { recursive: true });
      const solFiles = savedFiles.filter(f => f.endsWith('.sol'));
      
      console.log(`  Saved .sol files: ${solFiles.length}`);
      
      // Check that blacklisted files are NOT saved
      for (const blacklisted of expectedBlacklisted) {
        const fileName = path.basename(blacklisted);
        if (solFiles.some(f => f.includes(fileName))) {
          console.log(`  ✗ FAILED: Blacklisted file was saved: ${fileName}`);
          allFound = false;
        } else {
          console.log(`  ✓ Blacklisted file not saved: ${fileName}`);
        }
      }
      
      // Check that non-blacklisted files ARE saved
      const expectedSaved = ['MyContract.sol', 'AnotherContract.sol'];
      for (const expected of expectedSaved) {
        if (solFiles.some(f => f.includes(expected))) {
          console.log(`  ✓ Non-blacklisted file saved: ${expected}`);
        } else {
          console.log(`  ✗ FAILED: Expected file not saved: ${expected}`);
          allFound = false;
        }
      }
    }
    
    // Cleanup
    if (fs.existsSync(testChainDir)) {
      fs.rmSync(testChainDir, { recursive: true, force: true });
    }
    const testChainBaseDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-chain');
    if (fs.existsSync(testChainBaseDir)) {
      const testDirs = fs.readdirSync(testChainBaseDir);
      if (testDirs.length === 0) {
        fs.rmdirSync(testChainBaseDir);
      }
    }
    
    if (allFound) {
      console.log('\n  ✓ All tests passed');
      return true;
    } else {
      console.log('\n  ✗ Some tests failed');
      return false;
    }
    
  } catch (error) {
    console.error(`  ✗ FAILED: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  const test1 = testBlacklistFunction();
  const test2 = await testBlacklistInSaveProcess();
  
  const success = test1 && test2;
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
