import { ethers } from 'ethers';
import PassportVerifierABI from '../artifacts/contracts/PassportVerifier.sol/PassportVerifier.json';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
const PRIVATE_KEY = process.env.ISSUER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

// კონტრაქტის ინტერფეისი (ABI)
const contractABI = [
  "function registerPassport(string _passportId, string _verificationId, bytes32 _docHash, uint256 _version, string _previousVerificationId) external",
  "function getPassport(string _verificationId) external view returns (tuple(string passportId, string verificationId, bytes32 docHash, uint256 version, uint256 timestamp, bool isLatest))"
];

// ფუნქცია, რომელიც ბლოკჩეინში ჩაწერს მონაცემებს
export async function registerPassportOnChain(
  passportId: string,
  verificationId: string,
  docHashHex: string,
  version: number,
  prevVerificationId: string = ""
) {
  if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error("გაკლია .env ცვლადები");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

  // დარწმუნება რომ ჰეში 0x-ით იწყება
  const formattedHash = docHashHex.startsWith('0x') ? docHashHex : `0x${docHashHex}`;

  // კონტრაქტის ფუნქციის გამოძახება
  const tx = await contract.registerPassport(
    passportId,
    verificationId,
    formattedHash,
    version,
    prevVerificationId
  );

  const receipt = await tx.wait(); // ველოდებით ტრანზაქციის დადასტურებას
  return receipt.hash;
}

// დოკუმენტის შემოწმება
export async function verifyDocumentOnChain(docHashOrId: string, isHash: boolean) {
  const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const contract = new ethers.Contract(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string,
    PassportVerifierABI.abi,
    provider
  );

  try {
    // იძახებს სმარტ-კონტრაქტის რეალურ ფუნქციას: getPassport
    const result = await contract.getPassport(docHashOrId); 
    
    // ვამოწმებთ, დაბრუნდა თუ არა ვალიდური ჩანაწერი (ვერსია მეტია 0-ზე)
    const isValid = result && Number(result.version) > 0;
    
    return {
      isValid,
      passportId: result.passportId,
      verificationId: result.verificationId,
      version: result.version.toString(),
      isLatest: result.isLatest
    };
  } catch (error) {
    console.error("❌ გადამოწმება ვერ მოხერხდა:", error);
    return { isValid: false, error: "დოკუმენტი არ მოიძებნა ან გაყალბებულია" };
  }
}