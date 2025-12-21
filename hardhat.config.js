import 'dotenv/config';
import "@nomicfoundation/hardhat-ethers";

const { SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env;

export default {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC_URL,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
  },
};