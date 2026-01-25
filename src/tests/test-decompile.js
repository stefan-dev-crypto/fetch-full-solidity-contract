/**
 * Test: Decompiler Module
 * 
 * Usage: npm run test:decompile
 * 
 * Tests the bytecode decompilation functionality using Panoramix
 */

import { decompileContract, decompileWithPanoramix } from '../modules/decompiler.js';
import { getBytecode } from '../modules/proxyDetector.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test contracts
const TEST_CONTRACTS = {
  unverified: {
    chain: 'bsc',
    address: '0xC38e4e6A15593f908255214653d3D947CA1c2338',
    description: 'BSC Unverified Contract'
  }
};

async function testGetBytecode() {
  console.log('\n--- Test: getBytecode for decompilation ---');
  
  const contract = TEST_CONTRACTS.unverified;
  console.log(`\n  Testing ${contract.description}:`);
  console.log(`    Chain: ${contract.chain}`);
  console.log(`    Address: ${contract.address}`);
  
  try {
    const bytecode = await getBytecode(contract.chain, contract.address);
    console.log(`    Bytecode size: ${bytecode.length / 2} bytes`);
    console.log(`    First 100 chars: ${bytecode.slice(0, 100)}...`);
    console.log(`    ✓ Test passed`);
    return bytecode;
  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
    return null;
  }
}

async function testDecompileContract() {
  console.log('\n--- Test: decompileContract ---');
  
  const contract = TEST_CONTRACTS.unverified;
  console.log(`\n  Testing ${contract.description}:`);
  console.log(`    Chain: ${contract.chain}`);
  console.log(`    Address: ${contract.address}`);
  
  try {
    const result = await decompileContract(contract.chain, contract.address);
    
    console.log(`    Decompilation success: ${result.success}`);
    console.log(`    Pseudo-decompiled: ${result.pseudoDecompiled || false}`);
    console.log(`    Output path: ${result.outputPath}`);
    
    if (result.metadata) {
      console.log(`    Bytecode size: ${result.metadata.bytecodeSize} bytes`);
    }
    
    // Check if output file exists
    if (fs.existsSync(result.outputPath)) {
      const content = fs.readFileSync(result.outputPath, 'utf8');
      console.log(`    Output file size: ${content.length} chars`);
      console.log(`    First 200 chars of output:`);
      console.log(`    ${content.slice(0, 200).replace(/\n/g, '\n    ')}...`);
    }
    
    console.log(`    ✓ Test passed`);
    return result;
  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
    return null;
  }
}

async function testManualDecompile() {
  console.log('\n--- Test: Manual decompilation flow ---');
  
  // This test demonstrates the manual flow for decompilation
  const contract = TEST_CONTRACTS.unverified;
  
  try {
    // 1. Get bytecode
    console.log('\n  Step 1: Getting bytecode...');
    const bytecode = await getBytecode(contract.chain, contract.address);
    console.log(`    Got ${bytecode.length / 2} bytes`);
    
    // 2. Create temp directory
    console.log('\n  Step 2: Creating temp directory...');
    const tempDir = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts', 'test-decompile');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    console.log(`    Created: ${tempDir}`);
    
    // 3. Attempt decompilation
    console.log('\n  Step 3: Attempting decompilation...');
    const result = await decompileWithPanoramix(bytecode, tempDir);
    
    console.log(`    Success: ${result.success}`);
    console.log(`    Output: ${result.outputPath}`);
    
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
    
    console.log(`    ✓ Test passed`);
  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('Test: Decompiler Module');
  console.log('========================================');
  
  await testGetBytecode();
  await testDecompileContract();
  await testManualDecompile();
  
  console.log('\n========================================');
  console.log('Decompiler Tests Complete');
  console.log('========================================\n');
}

main().catch(console.error);
