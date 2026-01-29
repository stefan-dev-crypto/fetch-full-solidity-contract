/**
 * Test: Comment Stripping
 * 
 * Tests the Solidity comment stripping functionality
 */

import { parseSourceCode, saveSourceFiles, createOutputDirectory } from '../modules/sourceParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test cases for comment stripping
const TEST_CASES = [
  {
    name: 'Single-line comments',
    input: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// This is a comment
contract Test {
    // Another comment
    uint256 public value; // Inline comment
}`,
    shouldNotContain: ['// SPDX', '// This is', '// Another', '// Inline']
  },
  {
    name: 'Multi-line comments',
    input: `/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.0;

/*
 * Multi-line comment
 * with multiple lines
 */
contract Test {
    /* Inline multi-line */ uint256 public value;
}`,
    shouldNotContain: ['/* SPDX', '/*', ' * Multi', ' * with', ' */']
  },
  {
    name: 'NatSpec comments',
    input: `/// @title Test Contract
pragma solidity ^0.8.0;

/**
 * @dev This is a NatSpec comment
 * @param x The parameter
 */
contract Test {
    /// @notice Function comment
    function test(uint256 x) public {}
}`,
    shouldNotContain: ['/// @title', '/**', ' * @dev', ' * @param', ' */', '/// @notice']
  },
  {
    name: 'Mixed comments',
    input: `// Single line
/* Multi-line */ pragma solidity ^0.8.0;

contract Test {
    // Comment 1
    uint256 public value; /* Comment 2 */
    /// Comment 3
    function test() public {
        // Inside function
        value = 1;
    }
}`,
    shouldNotContain: ['// Single', '/* Multi', '// Comment', '/* Comment', '/// Comment', '// Inside']
  },
  {
    name: 'Comments in strings (should preserve)',
    input: `pragma solidity ^0.8.0;

contract Test {
    string public msg1 = "This // is not a comment";
    string public msg2 = 'This /* is also */ not a comment';
    string public msg3 = "Quote: \\"text\\"";
}`,
    shouldContain: ['This // is not a comment', 'This /* is also */ not a comment']
  },
  {
    name: 'Edge cases',
    input: `pragma solidity ^0.8.0;

contract Test {
    string public url = "https://example.com";
    uint256 public ratio = 100 / 2; // Division operator
    // Comment before function
    function test() public returns (string memory) {
        return "Result: // not a comment";
    }
}`,
    shouldContain: ['https://example.com', 'Result: // not a comment'],
    shouldNotContain: ['// Division', '// Comment before']
  }
];

function testCommentStripping() {
  console.log('\n========================================');
  console.log('Test: Comment Stripping');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      // Create a mock source data structure
      const mockSourceData = {
        chainName: 'ethereum',
        contractAddress: '0x0000000000000000000000000000000000000001',
        contractName: 'TestContract',
        isVerified: true,
        sourceCode: JSON.stringify({
          sources: {
            'Test.sol': {
              content: testCase.input
            }
          }
        })
      };
      
      // Parse the source
      const parsedSource = parseSourceCode(mockSourceData.sourceCode);
      
      // Create temp output directory
      const tempDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-comment-strip');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Save the file (which should strip comments)
      const testAddress = 'test-address-' + Date.now() + '-' + Math.random().toString(36).substring(7);
      const saveResult = saveSourceFiles('test-chain', testAddress, parsedSource, 'TestContract', 'main', 'Test.sol');
      
      // Read back the saved file
      const testChainDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-chain');
      let savedContent = null;
      
      if (fs.existsSync(testChainDir)) {
        const filePath = path.join(testChainDir, testAddress, 'Test.sol');
        if (fs.existsSync(filePath)) {
          savedContent = fs.readFileSync(filePath, 'utf8');
        }
      }
      
      if (!savedContent) {
        console.log(`  ✗ FAILED: Could not find saved file`);
        failed++;
        continue;
      }
      
      // Check that comments are stripped
      let testPassed = true;
      
      if (testCase.shouldNotContain) {
        for (const text of testCase.shouldNotContain) {
          if (savedContent.includes(text)) {
            console.log(`  ✗ FAILED: Found text that should be removed: "${text}"`);
            testPassed = false;
          }
        }
      }
      
      if (testCase.shouldContain) {
        for (const text of testCase.shouldContain) {
          if (!savedContent.includes(text)) {
            console.log(`  ✗ FAILED: Missing text that should be preserved: "${text}"`);
            testPassed = false;
          }
        }
      }
      
      if (testPassed) {
        console.log(`  ✓ PASSED`);
        passed++;
      } else {
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
  
  // Cleanup test directories
  const testChainDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-chain');
  if (fs.existsSync(testChainDir)) {
    fs.rmSync(testChainDir, { recursive: true, force: true });
  }
  
  return failed === 0;
}

async function main() {
  const success = testCommentStripping();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
