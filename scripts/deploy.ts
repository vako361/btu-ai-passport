import { network } from "hardhat";

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
const issuerPrivateKey = process.env.ISSUER_PRIVATE_KEY;

if (!rpcUrl || !/^https?:\/\//.test(rpcUrl) || !/^0x[0-9a-fA-F]{64}$/.test(issuerPrivateKey ?? "")) {
	throw new Error(
		"Set a valid BLOCKCHAIN_RPC_URL and 32-byte 0x-prefixed ISSUER_PRIVATE_KEY in .env.local before deploying.",
	);
}

const { ethers } = await network.connect("amoy");

console.log("⏳ ვიწყებთ კონტრაქტის ატვირთვას Amoy ქსელში...");

const PassportVerifier = await ethers.getContractFactory("PassportVerifier");
const contract = await PassportVerifier.deploy();
await contract.waitForDeployment();

console.log("✅ სმარტ-კონტრაქტი წარმატებით აიტვირთა!");
console.log(`მისამართი: ${await contract.getAddress()}`);