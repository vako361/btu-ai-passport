import { network } from "hardhat";

const { ethers } = await network.connect("amoy");

console.log("⏳ ვიწყებთ კონტრაქტის ატვირთვას Amoy ქსელში...");

const PassportVerifier = await ethers.getContractFactory("PassportVerifier");
const contract = await PassportVerifier.deploy();
await contract.waitForDeployment();

console.log("✅ სმარტ-კონტრაქტი წარმატებით აიტვირთა!");
console.log(`მისამართი: ${await contract.getAddress()}`);