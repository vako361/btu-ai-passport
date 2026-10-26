import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function getAmoyNetworkConfig() {
  const url = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.ISSUER_PRIVATE_KEY;

  if (!url || !privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return {
    type: "http" as const,
    chainType: "l1" as const,
    url,
    accounts: [privateKey],
  };
}

const amoyNetwork = getAmoyNetworkConfig();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.24",
  networks: amoyNetwork ? { amoy: amoyNetwork } : {},
});