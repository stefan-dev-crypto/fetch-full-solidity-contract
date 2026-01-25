/**
 * Chain Configuration Module
 * Contains RPC URLs, chain IDs, and Etherscan API configurations for supported EVM chains
 */

// Etherscan API key
export const ETHERSCAN_API_KEY = 'RQKMV5PAI8SZZSITH89RYZ8CPFZMRE6PHR';

// Chain configurations
export const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://ethereum.publicnode.com',
    symbol: 'ETH',
    explorer: 'https://etherscan.io'
  },
  bsc: {
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc.blockrazor.xyz',
    symbol: 'BNB',
    explorer: 'https://bscscan.com'
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://base-rpc.publicnode.com',
    symbol: 'ETH',
    explorer: 'https://basescan.org'
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arbitrum.publicnode.com',
    symbol: 'ETH',
    explorer: 'https://arbiscan.io'
  }
};

/**
 * Get chain configuration by chain name
 * @param {string} chainName - Name of the chain (e.g., 'ethereum', 'bsc', 'base', 'arbitrum')
 * @returns {Object|null} Chain configuration object or null if not found
 */
export function getChainConfig(chainName) {
  const normalizedName = chainName.toLowerCase().trim();
  return CHAIN_CONFIG[normalizedName] || null;
}

/**
 * Get all supported chain names
 * @returns {string[]} Array of supported chain names
 */
export function getSupportedChains() {
  return Object.keys(CHAIN_CONFIG);
}

/**
 * Check if a chain is supported
 * @param {string} chainName - Name of the chain
 * @returns {boolean} True if the chain is supported
 */
export function isChainSupported(chainName) {
  const normalizedName = chainName.toLowerCase().trim();
  return normalizedName in CHAIN_CONFIG;
}

/**
 * Build Etherscan API URL for contract source code
 * @param {number} chainId - Chain ID
 * @param {string} contractAddress - Contract address
 * @returns {string} Etherscan API URL
 */
export function buildEtherscanSourceUrl(chainId, contractAddress) {
  return `https://api.etherscan.io/v2/api?apikey=${ETHERSCAN_API_KEY}&chainid=${chainId}&module=contract&action=getsourcecode&address=${contractAddress}`;
}

export default {
  ETHERSCAN_API_KEY,
  CHAIN_CONFIG,
  getChainConfig,
  getSupportedChains,
  isChainSupported,
  buildEtherscanSourceUrl
};
