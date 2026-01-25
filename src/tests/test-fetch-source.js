/**
 * Test: Source Fetcher Module
 * 
 * Usage: npm run test:fetch
 * 
 * Tests the contract source fetching from Etherscan
 */

import { fetchContractSource, isContractVerified, fetchMultipleContractSources } from '../modules/sourceFetcher.js';

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
  },
  unverified: {
    chain: 'bsc',
    address: '0xC38e4e6A15593f908255214653d3D947CA1c2338',
    description: 'BSC Unverified Contract'
  }
};

async function testFetchContractSource() {
  console.log('\n--- Test: fetchContractSource ---');
  
  for (const [type, contract] of Object.entries(TEST_CONTRACTS)) {
    console.log(`\n  Testing ${contract.description} (${type}):`);
    console.log(`    Chain: ${contract.chain}`);
    console.log(`    Address: ${contract.address}`);
    
    try {
      const result = await fetchContractSource(contract.chain, contract.address);
      console.log(`    Verified: ${result.isVerified}`);
      
      if (result.isVerified) {
        console.log(`    Contract Name: ${result.contractName}`);
        console.log(`    Compiler: ${result.compilerVersion}`);
        console.log(`    Optimization: ${result.optimizationUsed ? 'Yes' : 'No'} (${result.runs} runs)`);
        console.log(`    Source Type: ${result.sourceCode.startsWith('{') ? 'Multi-file JSON' : 'Single file'}`);
        console.log(`    Source Length: ${result.sourceCode.length} chars`);
        console.log(`    Is Proxy (Etherscan): ${result.isProxy}`);
        if (result.implementation) {
          console.log(`    Implementation (Etherscan): ${result.implementation}`);
        }
      } else {
        console.log(`    ABI: ${result.abi}`);
      }
      
      console.log(`    ✓ Test passed`);
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function testIsContractVerified() {
  console.log('\n--- Test: isContractVerified ---');
  
  for (const [type, contract] of Object.entries(TEST_CONTRACTS)) {
    console.log(`\n  Testing ${contract.description} (${type}):`);
    
    try {
      const verified = await isContractVerified(contract.chain, contract.address);
      console.log(`    Verified: ${verified}`);
      console.log(`    ✓ Test passed`);
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function testFetchMultipleContractSources() {
  console.log('\n--- Test: fetchMultipleContractSources ---');
  
  const addresses = Object.values(TEST_CONTRACTS)
    .filter(c => c.chain === 'bsc')
    .map(c => c.address);
  
  console.log(`\n  Fetching ${addresses.length} BSC contracts simultaneously...`);
  
  try {
    const results = await fetchMultipleContractSources('bsc', addresses);
    
    for (const result of results) {
      console.log(`    ${result.contractAddress}: ${result.isVerified ? 'Verified' : 'Not Verified'}`);
    }
    
    console.log(`    ✓ Test passed`);
  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('Test: Source Fetcher Module');
  console.log('========================================');
  
  await testFetchContractSource();
  await testIsContractVerified();
  await testFetchMultipleContractSources();
  
  console.log('\n========================================');
  console.log('Source Fetcher Tests Complete');
  console.log('========================================\n');
}

main().catch(console.error);
