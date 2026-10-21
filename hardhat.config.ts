import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.24",
  networks: {
    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.BLOCKCHAIN_RPC_URL!,
      accounts: [process.env.ISSUER_PRIVATE_KEY!],
    },
  },
});