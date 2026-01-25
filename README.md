# Fetch Solidity Contract

A JavaScript tool to fetch and analyze Solidity smart contracts from multiple EVM chains.

## Features

- **Multi-chain Support**: Ethereum, BSC, Base, Arbitrum (extensible)
- **Proxy Detection**: Automatically detects proxy contracts (standard & non-standard patterns) and fetches both proxy and implementation sources
- **Source Fetching**: Fetches verified contract source code from Etherscan
- **🔍 Production-Grade Audit Filtering**: Automatically **deletes** well-audited vendor libraries (OpenZeppelin, Uniswap, Aave, etc.) to reduce auditing workload by 60-90%
- **🚨 Red Flag Detection**: Identifies and **keeps** potentially modified vendor code in suspicious locations (contracts/vendor/, contracts/lib/)
- **Organized Output**: Saves contracts in a structured directory format compatible with Smart-Contract-Auditor
- **⚠️ Only Verified Contracts**: Only processes contracts with verified source code on block explorers

## Installation

```bash
cd fetch-solidity-contract
npm install
```

### Environment Setup

Set your Etherscan API key:

```bash
export ETHERSCAN_API_KEY="your_api_key_here"
```

Or create a `.env` file in the project root.

## Usage

### Basic Usage

```bash
node src/index.js <chain> <contractAddress>
```

### Examples

```bash
# Fetch a normal contract from Ethereum
node src/index.js ethereum 0xF4a21Ac7e51d17A0e1C8B59f7a98bb7A97806f14

# Fetch a proxy contract from BSC (both proxy and implementation will be fetched)
node src/index.js bsc 0x25aB3Efd52e6470681CE037cD546Dc60726948D3

# Fetch a non-standard proxy contract
node src/index.js bsc 0xFf6d49EA29FDC85f391AF76F8188039Fc0D35Ee4
```

### NPM Scripts

```bash
# Run main CLI
npm start -- <chain> <contractAddress>

# Test individual modules
npm run test:proxy      # Test proxy detection
npm run test:fetch      # Test source fetching
npm run test:parse      # Test source parsing
npm run test:decompile  # Test decompilation

# Run all tests
npm run test:all
```

## 🔍 Audit Filtering System

The tool includes a production-grade audit filtering system designed by senior security auditors to reduce auditing workload while maintaining correctness.

### Key Features

- **60-90% Reduction**: Automatically excludes well-audited vendor libraries
- **Smart Detection**: Identifies OpenZeppelin, Uniswap, Aave, Chainlink, and 20+ other standard libraries
- **Red Flag System**: Detects potentially modified vendor code in suspicious locations
- **Priority Levels**: Categorizes files by audit priority (critical, high, medium, low)
- **Audit Manifest**: Generates detailed metadata for each contract

### Example Output

```bash
Processing main (0xb4475b5cF033DA6c62F66c36AD17b48ebebeF321)...
  ✓ Contract verified: TaxReceiver
  🗑️  Deleted 4 excluded file(s)
  ✓ Files saved: 1

📊 Audit Summary:
   Total files fetched: 5
   Files kept for audit: 1 ✅
   Files deleted: 4 🗑️ (80% reduction)
   Main contract (main): TaxReceiver.sol
```

**With Red Flags:**
```bash
🚨 CRITICAL WARNINGS: 2 red flag file(s) detected!
   ⚠️  Files in contracts/lib, contracts/vendor, or contracts/utils
   ⚠️  These may be MODIFIED vendor code - MUST AUDIT!

   Red flags in main:
      - contracts/vendor/CustomOZ.sol
      - contracts/lib/ModifiedUniswap.sol
```

### What Gets Deleted

- 🗑️ OpenZeppelin contracts (all variants)
- 🗑️ Uniswap, SushiSwap, PancakeSwap
- 🗑️ Aave, Compound, Yearn
- 🗑️ Chainlink, API3, UMA
- 🗑️ Test files, mocks, scripts
- 🗑️ Build artifacts
- 🗑️ Pure interfaces

### What Gets Kept (Red Flags)

- ✅ Files in `contracts/vendor/` (likely modified)
- ✅ Files in `contracts/lib/` (likely modified)
- ✅ Files in `contracts/external/` (likely modified)
- ✅ All custom contracts
- ✅ Main contract file

**See [AUDIT_FILTERING.md](AUDIT_FILTERING.md) for complete documentation.**

## Supported Chains

| Chain    | Chain ID | RPC URL                           |
|----------|----------|-----------------------------------|
| Ethereum | 1        | https://ethereum.publicnode.com   |
| BSC      | 56       | https://bsc.blockrazor.xyz        |
| Base     | 8453     | https://base-rpc.publicnode.com   |
| Arbitrum | 42161    | https://arb-one.api.pocket.network|

## Output Structure

The output directory `evm-chain-contracts` is created **outside** the project folder (at the parent directory level) so that other projects can easily access the contract source code.

```
../evm-chain-contracts/           # Outside project folder
├── <chain>/
│   └── <contractAddress>/
│       ├── summary.json           # Processing summary
│       ├── metadata.json          # Contract metadata
│       ├── audit-manifest.json    # 🔍 Audit filtering results
│       ├── abi.json               # Contract ABI
│       ├── compiler-settings.json # Compiler configuration
│       ├── <ContractName>.sol     # Main contract source
│       ├── <OtherContracts>.sol   # Other contract files
│       ├── proxy/                 # Proxy contract (if applicable)
│       │   ├── metadata.json
│       │   ├── audit-manifest.json
│       │   ├── abi.json
│       │   └── <ProxyContract>.sol
│       └── implementation/        # Implementation (if proxy)
│           ├── metadata.json
│           ├── audit-manifest.json
│           ├── abi.json
│           └── <ImplContract>.sol
```

**Note**: The output folder is located at `<project-parent>/evm-chain-contracts/` to allow other projects to reference the contract source code.

## Modules

### chainConfig.js
Chain configuration including RPC URLs, chain IDs, and Etherscan API settings.

### proxyDetector.js
Detects proxy contracts using `ethers-proxies` library.

### sourceFetcher.js
Fetches contract source code from Etherscan API.

### sourceParser.js
Parses JSON-formatted source code and saves to file structure.

### decompiler.js
Decompiles bytecode using Panoramix for unverified contracts.

## Test Contracts

| Type       | Chain    | Address                                    |
|------------|----------|-------------------------------------------|
| Proxy      | BSC      | 0x25aB3Efd52e6470681CE037cD546Dc60726948D3|
| Normal     | Ethereum | 0xF4a21Ac7e51d17A0e1C8B59f7a98bb7A97806f14|
| Unverified | BSC      | 0xC38e4e6A15593f908255214653d3D947CA1c2338|

## API

### fetchContract(chainName, contractAddress)

Main function to fetch and process a contract.

```javascript
import { fetchContract } from './src/index.js';

const result = await fetchContract('ethereum', '0x...');
```

### detectProxy(chainName, contractAddress)

Check if a contract is a proxy.

```javascript
import { detectProxy } from './src/modules/proxyDetector.js';

const { isProxy, implementationAddress } = await detectProxy('ethereum', '0x...');
```

### fetchContractSource(chainName, contractAddress)

Fetch source code from Etherscan.

```javascript
import { fetchContractSource } from './src/modules/sourceFetcher.js';

const sourceData = await fetchContractSource('ethereum', '0x...');
```

## License

MIT
