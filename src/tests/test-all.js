/**
 * Test: All Modules - Comprehensive Test Suite
 * 
 * Usage: npm run test:all
 * 
 * Tests the complete workflow with all three test contracts:
 * - Proxy contract (BSC)
 * - Normal contract (Ethereum)
 * - Unverified contract (BSC)
 */

import { fetchContract } from '../index.js';
import { detectProxy } from '../modules/proxyDetector.js';
import { fetchContractSource } from '../modules/sourceFetcher.js';
import { isContractVerified } from '../modules/sourceFetcher.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Output directory is outside the project
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'evm-chain-contracts');

// Test contracts provided by user
const TEST_CONTRACTS = {
  proxy: {
    chain: 'bsc',
    address: '0x25aB3Efd52e6470681CE037cD546Dc60726948D3',
    description: 'BSC Proxy Contract',
    expectedProxy: true
  },
  normal: {
    chain: 'ethereum',
    address: '0xF4a21Ac7e51d17A0e1C8B59f7a98bb7A97806f14',
    description: 'Ethereum Normal Contract',
    expectedProxy: false
  },
  unverified: {
    chain: 'bsc',
    address: '0xC38e4e6A15593f908255214653d3D947CA1c2338',
    description: 'BSC Unverified Contract',
    expectedProxy: false
  }
};

async function testProxyContract() {
  console.log('\n========================================');
  console.log('TEST 1: Proxy Contract (BSC)');
  console.log('========================================');
  
  const contract = TEST_CONTRACTS.proxy;
  console.log(`\nContract: ${contract.address}`);
  console.log(`Chain: ${contract.chain}`);
  console.log(`Expected: Proxy contract with implementation\n`);
  
  try {
    // Test proxy detection
    console.log('1. Testing proxy detection...');
    const proxyResult = await detectProxy(contract.chain, contract.address);
    console.log(`   Is Proxy: ${proxyResult.isProxy}`);
    if (proxyResult.implementationAddress) {
      console.log(`   Implementation: ${proxyResult.implementationAddress}`);
    }
    
    // Test full fetch workflow
    console.log('\n2. Running full fetch workflow...');
    const result = await fetchContract(contract.chain, contract.address);
    
    // Verify output
    console.log('\n3. Verifying output...');
    const outputDir = path.join(OUTPUT_DIR, contract.chain, contract.address);
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir, { recursive: true });
      console.log(`   Output directory exists: ✓`);
      console.log(`   Files created: ${files.length}`);
    } else {
      console.log(`   Output directory: ✗ Not created`);
    }
    
    console.log('\n✓ Proxy contract test complete');
    return result;
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    return null;
  }
}

async function testNormalContract() {
  console.log('\n========================================');
  console.log('TEST 2: Normal Contract (Ethereum)');
  console.log('========================================');
  
  const contract = TEST_CONTRACTS.normal;
  console.log(`\nContract: ${contract.address}`);
  console.log(`Chain: ${contract.chain}`);
  console.log(`Expected: Regular verified contract\n`);
  
  try {
    // Test proxy detection
    console.log('1. Testing proxy detection...');
    const proxyResult = await detectProxy(contract.chain, contract.address);
    console.log(`   Is Proxy: ${proxyResult.isProxy}`);
    
    // Test verification status
    console.log('\n2. Testing verification status...');
    const verified = await isContractVerified(contract.chain, contract.address);
    console.log(`   Verified: ${verified}`);
    
    // Test full fetch workflow
    console.log('\n3. Running full fetch workflow...');
    const result = await fetchContract(contract.chain, contract.address);
    
    // Verify output
    console.log('\n4. Verifying output...');
    const outputDir = path.join(OUTPUT_DIR, contract.chain, contract.address);
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir, { recursive: true });
      console.log(`   Output directory exists: ✓`);
      console.log(`   Files created: ${files.length}`);
      
      // Check for source files
      const solFiles = files.filter(f => f.endsWith('.sol'));
      console.log(`   Solidity files: ${solFiles.length}`);
    } else {
      console.log(`   Output directory: ✗ Not created`);
    }
    
    console.log('\n✓ Normal contract test complete');
    return result;
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    return null;
  }
}

async function testUnverifiedContract() {
  console.log('\n========================================');
  console.log('TEST 3: Unverified Contract (BSC)');
  console.log('========================================');
  
  const contract = TEST_CONTRACTS.unverified;
  console.log(`\nContract: ${contract.address}`);
  console.log(`Chain: ${contract.chain}`);
  console.log(`Expected: Unverified - should attempt decompilation\n`);
  
  try {
    // Test verification status
    console.log('1. Testing verification status...');
    const verified = await isContractVerified(contract.chain, contract.address);
    console.log(`   Verified: ${verified}`);
    
    if (verified) {
      console.log('   Note: Contract appears to be verified now');
    }
    
    // Test full fetch workflow (should trigger decompilation for unverified)
    console.log('\n2. Running full fetch workflow...');
    const result = await fetchContract(contract.chain, contract.address);
    
    // Verify output
    console.log('\n3. Verifying output...');
    const outputDir = path.join(OUTPUT_DIR, contract.chain, contract.address);
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir, { recursive: true });
      console.log(`   Output directory exists: ✓`);
      console.log(`   Files created: ${files.length}`);
      
      // Check for decompiled files
      const decompiledDir = path.join(outputDir, 'decompiled');
      if (fs.existsSync(decompiledDir)) {
        const decompiledFiles = fs.readdirSync(decompiledDir);
        console.log(`   Decompiled files: ${decompiledFiles.length}`);
      }
    } else {
      console.log(`   Output directory: ✗ Not created`);
    }
    
    console.log('\n✓ Unverified contract test complete');
    return result;
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    return null;
  }
}

async function printSummary(results) {
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================\n');
  
  const tests = [
    { name: 'Proxy Contract (BSC)', result: results[0] },
    { name: 'Normal Contract (Ethereum)', result: results[1] },
    { name: 'Unverified Contract (BSC)', result: results[2] }
  ];
  
  for (const test of tests) {
    const status = test.result ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${status} - ${test.name}`);
  }
  
  const passed = results.filter(r => r !== null).length;
  const total = results.length;
  
  console.log(`\n  Results: ${passed}/${total} tests passed`);
  console.log('');
}

async function main() {
  console.log('========================================');
  console.log('COMPREHENSIVE TEST SUITE');
  console.log('Fetch Solidity Contract');
  console.log('========================================');
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log(`Test contracts: ${Object.keys(TEST_CONTRACTS).length}`);
  
  const results = [];
  
  // Run all tests
  results.push(await testProxyContract());
  results.push(await testNormalContract());
  results.push(await testUnverifiedContract());
  
  // Print summary
  await printSummary(results);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
