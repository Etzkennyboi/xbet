import dotenv from 'dotenv';
dotenv.config();

const { PRIVATE_KEY, RPC_URL } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 196
    },
    xlayer: {
      url: RPC_URL || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: PRIVATE_KEY && PRIVATE_KEY !== 'your_private_key_here'
        ? [PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`]
        : []
    }
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
