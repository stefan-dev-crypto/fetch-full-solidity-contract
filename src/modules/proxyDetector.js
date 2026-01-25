/**
 * Proxy Detection Module
 * Detects if a contract is a proxy and retrieves the implementation address
 * Custom implementation compatible with ethers v6
 */

import { ethers } from 'ethers';
import { getChainConfig } from './chainConfig.js';

// EIP-1967 Implementation Slot: bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
const EIP_1967_LOGIC_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

// EIP-1967 Beacon Slot: bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)
const EIP_1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';

// OpenZeppelin Implementation Slot: keccak256("org.zeppelinos.proxy.implementation")
const OPEN_ZEPPELIN_IMPLEMENTATION_SLOT = '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3';

// EIP-1822 UUPS Slot: keccak256("PROXIABLE")
const EIP_1822_LOGIC_SLOT = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7';

// EIP-897 Interface
const EIP_897_ABI = ['function implementation() view returns (address)'];

// Gnosis Safe Proxy Interface
const GNOSIS_SAFE_PROXY_ABI = ['function masterCopy() view returns (address)'];

// EIP-1167 Beacon Interface
const EIP_1167_BEACON_ABI = [
  'function implementation() view returns (address)',
  'function childImplementation() view returns (address)'
];

/**
 * Read address from storage slot value
 * @param {string} value - Storage slot value (32 bytes hex)
 * @returns {string|null} Address if valid, null otherwise
 */
function readAddressFromSlot(value) {
  // Remove 0x prefix and pad to 64 chars
  const cleanValue = value.replace('0x', '').padStart(64, '0');
  // Address is in the last 40 characters (20 bytes)
  const addressHex = '0x' + cleanValue.slice(-40);
  
  // Check if it's a valid non-zero address
  if (addressHex === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  
  try {
    return ethers.getAddress(addressHex);
  } catch {
    return null;
  }
}

/**
 * Parse EIP-1167 minimal proxy bytecode
 * @param {string} bytecode - Contract bytecode
 * @returns {string|null} Implementation address if EIP-1167, null otherwise
 */
function parseEIP1167Bytecode(bytecode) {
  // EIP-1167 minimal proxy pattern: 
  // 363d3d373d3d3d363d73<address>5af43d82803e903d91602b57fd5bf3
  const patterns = [
    // Standard EIP-1167
    /^0x363d3d373d3d3d363d73([a-fA-F0-9]{40})5af43d82803e903d91602b57fd5bf3$/,
    // Alternative pattern
    /^0x36600080376020363660203736[a-f0-9]*73([a-fA-F0-9]{40})[a-f0-9]*$/i
  ];
  
  for (const pattern of patterns) {
    const match = bytecode.match(pattern);
    if (match && match[1]) {
      try {
        return ethers.getAddress('0x' + match[1]);
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

/**
 * Create an ethers provider for a specific chain
 * @param {string} chainName - Name of the chain
 * @returns {ethers.JsonRpcProvider} Ethers provider instance
 */
export function createProvider(chainName) {
  const chainConfig = getChainConfig(chainName);
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }
  return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

/**
 * Try to read implementation from storage slot
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} proxyAddress - Proxy contract address
 * @param {string} slot - Storage slot
 * @returns {Promise<string|null>} Implementation address or null
 */
async function tryStorageSlot(provider, proxyAddress, slot) {
  try {
    const value = await provider.getStorage(proxyAddress, slot);
    return readAddressFromSlot(value);
  } catch {
    return null;
  }
}

/**
 * Try to read implementation via contract call
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} proxyAddress - Proxy contract address
 * @param {string[]} abi - Contract ABI
 * @param {string} methodName - Method to call
 * @returns {Promise<string|null>} Implementation address or null
 */
async function tryContractCall(provider, proxyAddress, abi, methodName) {
  try {
    const contract = new ethers.Contract(proxyAddress, abi, provider);
    const address = await contract[methodName]();
    if (address && address !== '0x0000000000000000000000000000000000000000') {
      return ethers.getAddress(address);
    }
  } catch {
    // Method doesn't exist or call failed
  }
  return null;
}

/**
 * Detect proxy pattern from source code analysis
 * Handles non-standard proxy patterns like MOSTProxy
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} proxyAddress - Proxy contract address
 * @param {Object} sourceData - Source data from Etherscan
 * @returns {Promise<string|null>} Implementation address or null
 */
async function detectProxyFromSource(provider, proxyAddress, sourceData) {
  try {
    const sourceCode = sourceData.sourceCode || '';
    
    // Pattern 1: Detect if contract inherits from Proxy (OpenZeppelin or similar)
    const proxyInheritance = /contract\s+\w+\s+is\s+[^{]*Proxy/i.test(sourceCode);
    
    // Pattern 2: Detect _implementation() function override
    const hasImplementationFunction = /function\s+_implementation\s*\(\s*\)\s+internal\s+view\s+(?:virtual\s+)?override\s+returns\s*\(\s*address\s*\)/i.test(sourceCode);
    
    // Pattern 3: Detect custom storage slots for implementation
    const storageSlotMatch = sourceCode.match(/bytes32\s+(?:public\s+|private\s+)?constant\s+\w*STORAGE[_]?SLOT\w*\s*=\s*0x([a-fA-F0-9]{64})/i);
    
    if (!proxyInheritance && !hasImplementationFunction && !storageSlotMatch) {
      return null; // Not a proxy based on source code
    }
    
    console.log('  ℹ Non-standard proxy pattern detected in source code');
    
    // Try to call _implementation() if it exists (even if internal, sometimes exposed)
    let implementation = await tryContractCall(provider, proxyAddress, EIP_897_ABI, 'implementation');
    if (implementation) {
      console.log(`  ✓ Found implementation via implementation() call: ${implementation}`);
      return implementation;
    }
    
    // If custom storage slot detected, try reading from it
    if (storageSlotMatch) {
      const customSlot = '0x' + storageSlotMatch[1];
      console.log(`  ℹ Trying custom storage slot: ${customSlot}`);
      
      // First, try reading the slot directly (might contain implementation address)
      let slotValue = await tryStorageSlot(provider, proxyAddress, customSlot);
      if (slotValue) {
        // Check if this is the implementation address
        const code = await provider.getCode(slotValue);
        if (code && code !== '0x' && code !== '0x0') {
          console.log(`  ✓ Found implementation at custom slot: ${slotValue}`);
          return slotValue;
        }
        
        // If not, it might be a storage contract that has implementation()
        console.log(`  ℹ Slot contains address ${slotValue}, trying as storage contract...`);
        implementation = await tryContractCall(provider, slotValue, EIP_897_ABI, 'implementation');
        if (implementation) {
          console.log(`  ✓ Found implementation via storage contract: ${implementation}`);
          return implementation;
        }
      }
    }
    
    // Try to find implementation from constructor arguments
    // Some proxies store implementation address in constructor
    if (sourceData.constructorArguments) {
      const constructorArgs = sourceData.constructorArguments;
      // Extract potential addresses from constructor arguments (20 bytes = 40 hex chars)
      const addressMatches = constructorArgs.match(/[a-fA-F0-9]{40}/g);
      if (addressMatches) {
        for (const addrHex of addressMatches) {
          try {
            const potentialAddr = ethers.getAddress('0x' + addrHex);
            const code = await provider.getCode(potentialAddr);
            if (code && code !== '0x' && code !== '0x0') {
              // This could be the implementation or storage contract
              // Try calling implementation() on it
              const impl = await tryContractCall(provider, potentialAddr, EIP_897_ABI, 'implementation');
              if (impl) {
                console.log(`  ✓ Found implementation via constructor argument storage contract: ${impl}`);
                return impl;
              }
            }
          } catch {
            continue;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`  Error in source-based proxy detection: ${error.message}`);
    return null;
  }
}

/**
 * Detect if a contract is a proxy and get its implementation address
 * Uses multiple detection methods:
 * - Etherscan API (if source data provided)
 * - EIP-1967 (direct and beacon)
 * - OpenZeppelin proxy pattern
 * - EIP-1822 UUPS
 * - EIP-1167 minimal proxy
 * - EIP-897 DelegateProxy
 * - Gnosis Safe Proxy
 * - Source code analysis for custom proxy patterns
 * 
 * @param {string} chainName - Name of the chain
 * @param {string} contractAddress - Address of the contract to check
 * @param {Object} sourceData - Optional source data from Etherscan (for enhanced detection)
 * @returns {Promise<Object>} Object containing isProxy and implementationAddress
 */
export async function detectProxy(chainName, contractAddress, sourceData = null) {
  const provider = createProvider(chainName);
  
  try {
    // Check contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x' || code === '0x0') {
      return {
        isProxy: false,
        proxyAddress: contractAddress,
        implementationAddress: null,
        error: 'No contract at address'
      };
    }
    
    // Priority 1: Use Etherscan's implementation address if available (most reliable)
    if (sourceData && sourceData.isProxy && sourceData.implementation) {
      try {
        const etherscanImpl = ethers.getAddress(sourceData.implementation);
        console.log(`  ✓ Etherscan reports proxy with implementation: ${etherscanImpl}`);
        return {
          isProxy: true,
          proxyAddress: contractAddress,
          implementationAddress: etherscanImpl,
          detectionMethod: 'etherscan-api'
        };
      } catch (error) {
        console.log(`  ⚠ Invalid implementation address from Etherscan: ${sourceData.implementation}`);
      }
    }
    
    // Priority 2: Try standard detection methods
    const detectionMethods = [
      // EIP-1967 direct proxy
      () => tryStorageSlot(provider, contractAddress, EIP_1967_LOGIC_SLOT),
      
      // OpenZeppelin proxy pattern
      () => tryStorageSlot(provider, contractAddress, OPEN_ZEPPELIN_IMPLEMENTATION_SLOT),
      
      // EIP-1822 UUPS
      () => tryStorageSlot(provider, contractAddress, EIP_1822_LOGIC_SLOT),
      
      // EIP-1167 minimal proxy (parse bytecode)
      async () => parseEIP1167Bytecode(code),
      
      // EIP-897 DelegateProxy
      () => tryContractCall(provider, contractAddress, EIP_897_ABI, 'implementation'),
      
      // Gnosis Safe Proxy
      () => tryContractCall(provider, contractAddress, GNOSIS_SAFE_PROXY_ABI, 'masterCopy'),
      
      // EIP-1967 beacon proxy
      async () => {
        const beaconAddress = await tryStorageSlot(provider, contractAddress, EIP_1967_BEACON_SLOT);
        if (beaconAddress) {
          // Try to get implementation from beacon
          let impl = await tryContractCall(provider, beaconAddress, EIP_1167_BEACON_ABI, 'implementation');
          if (!impl) {
            impl = await tryContractCall(provider, beaconAddress, EIP_1167_BEACON_ABI, 'childImplementation');
          }
          return impl;
        }
        return null;
      }
    ];
    
    // Try each method until we find an implementation
    for (const method of detectionMethods) {
      const implementation = await method();
      if (implementation) {
        return {
          isProxy: true,
          proxyAddress: contractAddress,
          implementationAddress: implementation
        };
      }
    }
    
    // Priority 3: If source data is provided, try source code analysis for non-standard proxies
    if (sourceData && sourceData.isVerified) {
      const sourceBasedImpl = await detectProxyFromSource(provider, contractAddress, sourceData);
      if (sourceBasedImpl) {
        return {
          isProxy: true,
          proxyAddress: contractAddress,
          implementationAddress: sourceBasedImpl,
          detectionMethod: 'source-code-analysis'
        };
      }
    }
    
    // No proxy detected
    return {
      isProxy: false,
      proxyAddress: contractAddress,
      implementationAddress: null
    };
    
  } catch (error) {
    console.error(`Error detecting proxy for ${contractAddress}:`, error.message);
    return {
      isProxy: false,
      proxyAddress: contractAddress,
      implementationAddress: null,
      error: error.message
    };
  }
}

/**
 * Get bytecode for a contract address
 * @param {string} chainName - Name of the chain
 * @param {string} contractAddress - Address of the contract
 * @returns {Promise<string>} Contract bytecode
 */
export async function getBytecode(chainName, contractAddress) {
  const provider = createProvider(chainName);
  
  try {
    const bytecode = await provider.getCode(contractAddress);
    
    if (bytecode === '0x' || bytecode === '0x0') {
      throw new Error(`No bytecode found at address ${contractAddress}. This might be an EOA or non-existent contract.`);
    }
    
    return bytecode;
  } catch (error) {
    throw new Error(`Failed to get bytecode for ${contractAddress}: ${error.message}`);
  }
}

export default {
  createProvider,
  detectProxy,
  getBytecode
};
