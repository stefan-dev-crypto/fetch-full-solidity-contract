#!/usr/bin/env node
/**
 * Fetch Solidity Contract - Main Entry Point
 * 
 * Usage:
 *   node src/index.js <chain> <contractAddress>
 * 
 * Example:
 *   node src/index.js ethereum 0x1234...
 *   node src/index.js bsc 0x5678...
 */

import { getChainConfig, getSupportedChains, isChainSupported } from './modules/chainConfig.js';
import { detectProxy } from './modules/proxyDetector.js';
import { fetchContractSource } from './modules/sourceFetcher.js';
import { processAndSaveSource, createOutputDirectory } from './modules/sourceParser.js';
import fs from 'fs';
import path from 'path';

/**
 * Main orchestrator function to fetch and process contract
 * @param {string} chainName - Name of the chain
 * @param {string} contractAddress - Address of the contract
 * @returns {Promise<Object>} Processing result
 */
export async function fetchContract(chainName, contractAddress) {
  console.log('\n========================================');
  console.log('Fetch Solidity Contract');
  console.log('========================================\n');
  
  // Validate chain
  if (!isChainSupported(chainName)) {
    throw new Error(`Unsupported chain: ${chainName}. Supported chains: ${getSupportedChains().join(', ')}`);
  }
  
  const chainConfig = getChainConfig(chainName);
  console.log(`Chain: ${chainConfig.name} (ID: ${chainConfig.chainId})`);
  console.log(`Contract: ${contractAddress}`);
  console.log('');
  
  const result = {
    chainName,
    contractAddress,
    chainConfig,
    proxyInfo: null,
    sourceResults: []
  };
  
  // Step 1: Fetch source first to enable enhanced proxy detection
  console.log('Step 1: Fetching contract source for analysis...');
  let mainSourceData = null;
  try {
    mainSourceData = await fetchContractSource(chainName, contractAddress);
    if (mainSourceData.isVerified) {
      console.log(`  ✓ Contract verified: ${mainSourceData.contractName}`);
    } else {
      console.log(`  ℹ Contract not verified (will attempt decompilation later)`);
    }
  } catch (error) {
    console.log(`  ⚠ Could not fetch source: ${error.message}`);
  }
  console.log('');
  
  // Step 2: Detect if contract is a proxy (with source data for enhanced detection)
  console.log('Step 2: Detecting proxy...');
  const proxyInfo = await detectProxy(chainName, contractAddress, mainSourceData);
  result.proxyInfo = proxyInfo;
  
  if (proxyInfo.isProxy) {
    console.log(`  ✓ Contract IS a proxy`);
    console.log(`    Proxy Address: ${proxyInfo.proxyAddress}`);
    console.log(`    Implementation: ${proxyInfo.implementationAddress}`);
    if (proxyInfo.detectionMethod) {
      console.log(`    Detection Method: ${proxyInfo.detectionMethod}`);
    }
  } else {
    console.log(`  ✓ Contract is NOT a proxy`);
  }
  console.log('');
  
  // Step 3: Determine which addresses to fetch
  const addressesToFetch = proxyInfo.isProxy
    ? [
        { address: proxyInfo.proxyAddress, type: 'proxy', sourceData: mainSourceData },
        { address: proxyInfo.implementationAddress, type: 'implementation', sourceData: null }
      ]
    : [{ address: contractAddress, type: 'main', sourceData: mainSourceData }];
  
  // Step 4: Process and save source for each address
  // All contracts saved in flattened structure at contract address root level
  console.log('Step 3: Processing contract sources...');
  
  for (const item of addressesToFetch) {
    console.log(`  Processing ${item.type} (${item.address})...`);
    
    try {
      // Use cached source data if available, otherwise fetch
      const sourceData = item.sourceData || await fetchContractSource(chainName, item.address);
      
      if (sourceData.isVerified) {
        console.log(`    ✓ Contract verified: ${sourceData.contractName}`);
        
        // Process and save source
        // All files saved flattened at root level with contract type suffix for metadata
        // Always use the target contract address as base directory
        const baseAddress = contractAddress;
        const saveResult = processAndSaveSource(sourceData, item.type, baseAddress);
        
        if (saveResult.success) {
          console.log(`    ✓ Source saved to: ${saveResult.outputDir}`);
          console.log(`    ✓ Files saved: ${saveResult.savedFiles.length}`);
        }
        
        result.sourceResults.push({
          ...item,
          verified: true,
          ...saveResult
        });
      } else {
        console.log(`    ✗ Contract not verified - skipping (only verified contracts are supported)`);
        
        result.sourceResults.push({
          ...item,
          verified: false,
          success: false,
          error: 'Contract source code is not verified on block explorer'
        });
      }
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
      result.sourceResults.push({
        ...item,
        error: error.message
      });
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('Processing Complete');
  console.log('========================================');
  
  // Print minimal audit info
  console.log('\n📄 Audit Manifests:');
  for (const sourceResult of result.sourceResults) {
    if (sourceResult.auditManifest) {
      const manifest = sourceResult.auditManifest;
      console.log(`   ${sourceResult.type}: ${manifest.mainContract} (${manifest.mainContractPath})`);
    }
  }
  console.log('');
  
  return result;
}

// CLI Entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node src/index.js <chain> <contractAddress>');
    console.log('');
    console.log('Supported chains:', getSupportedChains().join(', '));
    console.log('');
    console.log('Examples:');
    console.log('  node src/index.js ethereum 0xF4a21Ac7e51d17A0e1C8B59f7a98bb7A97806f14');
    console.log('  node src/index.js bsc 0x25aB3Efd52e6470681CE037cD546Dc60726948D3');
    process.exit(1);
  }
  
  const [chainName, contractAddress] = args;
  
  try {
    await fetchContract(chainName, contractAddress);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly (check if this file is the main entry point)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export default { fetchContract };
