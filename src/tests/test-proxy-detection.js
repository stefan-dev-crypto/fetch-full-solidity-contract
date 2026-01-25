/**
 * Test: Proxy Detection Module
 * 
 * Usage: npm run test:proxy
 * 
 * Tests the proxy detection functionality using ethers-proxies
 */

import { detectProxy, createProvider, getBytecode } from '../modules/proxyDetector.js';
import { getSupportedChains } from '../modules/chainConfig.js';

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

async function testCreateProvider() {
  console.log('\n--- Test: createProvider ---');
  
  for (const chain of getSupportedChains()) {
    try {
      const provider = createProvider(chain);
      const network = await provider.getNetwork();
      console.log(`  ✓ ${chain}: Connected (Chain ID: ${network.chainId})`);
    } catch (error) {
      console.log(`  ✗ ${chain}: ${error.message}`);
    }
  }
}

async function testDetectProxy() {
  console.log('\n--- Test: detectProxy ---');
  
  for (const [type, contract] of Object.entries(TEST_CONTRACTS)) {
    console.log(`\n  Testing ${contract.description} (${type}):`);
    console.log(`    Chain: ${contract.chain}`);
    console.log(`    Address: ${contract.address}`);
    
    try {
      const result = await detectProxy(contract.chain, contract.address);
      console.log(`    Is Proxy: ${result.isProxy}`);
      
      if (result.isProxy) {
        console.log(`    Implementation: ${result.implementationAddress}`);
      }
      
      console.log(`    ✓ Test passed`);
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function testGetBytecode() {
  console.log('\n--- Test: getBytecode ---');
  
  for (const [type, contract] of Object.entries(TEST_CONTRACTS)) {
    console.log(`\n  Testing ${contract.description} (${type}):`);
    
    try {
      const bytecode = await getBytecode(contract.chain, contract.address);
      console.log(`    Bytecode size: ${bytecode.length / 2} bytes`);
      console.log(`    First 50 chars: ${bytecode.slice(0, 50)}...`);
      console.log(`    ✓ Test passed`);
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('========================================');
  console.log('Test: Proxy Detection Module');
  console.log('========================================');
  
  await testCreateProvider();
  await testDetectProxy();
  await testGetBytecode();
  
  console.log('\n========================================');
  console.log('Proxy Detection Tests Complete');
  console.log('========================================\n');
}

main().catch(console.error);
