import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  CHAIN_ID: parseInt(process.env.CHAIN_ID) || 196,
  CHAIN_NAME: process.env.CHAIN_NAME || 'X Layer',
  RPC_URL: process.env.RPC_URL || process.env.XLAYER_RPC || 'https://rpc.xlayer.tech',
  EXPLORER_URL: process.env.EXPLORER_URL || 'https://www.okx.com/explorer/xlayer',
  EXPLORER_API: process.env.EXPLORER_API || 'https://web3.okx.com',

  USDC_ADDRESS: process.env.USDC_ADDRESS || '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
  USDC_SYMBOL: 'USDC',
  USDC_DECIMALS: 6,

  MIN_BET_USDC: '0.01',
  MARKET_DURATION_MINUTES: 2,
  TARGET_PERCENT_UP: 0.001, // 0.1%

  TREASURY_ADDRESS: process.env.TREASURY_WALLET || '0x5C67869272f3d167c761dBbf0DC3901a1fF214D3',

  MARKET_CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || null,

  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
};

export const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export const MARKET_ABI = [
  'constructor(address _usdc, address _treasury)',
  'event MarketCreated(bytes32 indexed marketId, string question, uint256 targetPrice, uint256 expiresAt)',
  'event MarketEntered(bytes32 indexed marketId, address indexed user, bool betYes, uint256 amount)',
  'event MarketResolved(bytes32 indexed marketId, bool result, uint256 finalPrice)',
  'event WinningsClaimed(bytes32 indexed marketId, address indexed user, uint256 amount)',
  'function createMarket(string memory _question, uint256 _targetPrice, uint256 _expiresAt) external returns (bytes32 marketId)',
  'function enterMarket(bytes32 _marketId, bool _betYes) external',
  'function resolveMarket(bytes32 _marketId, uint256 _finalPrice) external',
  'function claimWinnings(bytes32 _marketId) external',
  'function getMarket(bytes32 _marketId) external view returns (tuple(bytes32 id, string question, uint256 targetPrice, uint256 expiresAt, uint256 yesPool, uint256 noPool, bool resolved, bool result, uint256 finalPrice))',
  'function getUserPosition(bytes32 _marketId, address _user) external view returns (uint256 yesAmount, uint256 noAmount, bool hasClaimed)',
  'function getPendingWinnings(bytes32 _marketId, address _user) external view returns (uint256 pending)',
  'function getEntryFee() external pure returns (uint256)',
  'function treasury() external view returns (address)',
  'function usdc() external view returns (address)',
  'function owner() external view returns (address)',
];

export function usdcToWei(amount) {
  // Use string math to avoid floating point issues
  const parts = String(amount).split('.');
  const whole = BigInt(parts[0] || '0') * BigInt(10 ** CONFIG.USDC_DECIMALS);
  let frac = BigInt(0);
  if (parts[1]) {
    const fracStr = parts[1].padEnd(CONFIG.USDC_DECIMALS, '0').slice(0, CONFIG.USDC_DECIMALS);
    frac = BigInt(fracStr);
  }
  return (whole + frac).toString();
}

export function weiToUsdc(wei) {
  const value = BigInt(wei);
  const divisor = BigInt(10 ** CONFIG.USDC_DECIMALS);
  const whole = value / divisor;
  const frac = value % divisor;
  return `${whole}.${frac.toString().padStart(CONFIG.USDC_DECIMALS, '0').slice(0, 2)}`;
}
