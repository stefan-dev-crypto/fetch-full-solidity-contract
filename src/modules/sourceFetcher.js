/**
 * Source Fetcher Module
 * Fetches contract source code from Etherscan API
 */

import { getChainConfig, buildEtherscanSourceUrl } from './chainConfig.js';

/**
 * Fetch contract source code from Etherscan
 * @param {string} chainName - Name of the chain
 * @param {string} contractAddress - Address of the contract
 * @returns {Promise<Object>} Contract source data
 */
export async function fetchContractSource(chainName, contractAddress) {
  const chainConfig = getChainConfig(chainName);
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  const url = buildEtherscanSourceUrl(chainConfig.chainId, contractAddress);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== '1') {
      throw new Error(`Etherscan API error: ${data.message || 'Unknown error'}`);
    }
    
    const result = data.result[0];
    
    // Check if contract is verified
    const isVerified = result.SourceCode && result.SourceCode !== '';
    
    return {
      isVerified,
      contractAddress,
      chainName,
      rawData: result,
      sourceCode: result.SourceCode,
      abi: result.ABI,
      contractName: result.ContractName,
      contractFileName: result.ContractFileName, // Main contract file name from Etherscan
      compilerVersion: result.CompilerVersion,
      compilerType: result.CompilerType,
      optimizationUsed: result.OptimizationUsed === '1',
      runs: parseInt(result.Runs) || 200,
      evmVersion: result.EVMVersion,
      constructorArguments: result.ConstructorArguments,
      library: result.Library,
      licenseType: result.LicenseType,
      isProxy: result.Proxy === '1',
      implementation: result.Implementation
    };
  } catch (error) {
    throw new Error(`Failed to fetch source for ${contractAddress}: ${error.message}`);
  }
}

/**
 * Check if a contract is verified on Etherscan
 * @param {string} chainName - Name of the chain
 * @param {string} contractAddress - Address of the contract
 * @returns {Promise<boolean>} True if contract is verified
 */
export async function isContractVerified(chainName, contractAddress) {
  try {
    const result = await fetchContractSource(chainName, contractAddress);
    return result.isVerified;
  } catch (error) {
    console.error(`Error checking verification status: ${error.message}`);
    return false;
  }
}

/**
 * Fetch source for multiple contracts (e.g., proxy and implementation)
 * @param {string} chainName - Name of the chain
 * @param {string[]} addresses - Array of contract addresses
 * @returns {Promise<Object[]>} Array of contract source data
 */
export async function fetchMultipleContractSources(chainName, addresses) {
  const results = [];
  
  for (const address of addresses) {
    try {
      const source = await fetchContractSource(chainName, address);
      results.push(source);
    } catch (error) {
      results.push({
        isVerified: false,
        contractAddress: address,
        chainName,
        error: error.message
      });
    }
  }
  
  return results;
}

export default {
  fetchContractSource,
  isContractVerified,
  fetchMultipleContractSources
};
