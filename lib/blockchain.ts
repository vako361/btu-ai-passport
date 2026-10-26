import { ethers } from 'ethers';
import PassportVerifierABI from '../artifacts/contracts/PassportVerifier.sol/PassportVerifier.json';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
const PRIVATE_KEY = process.env.ISSUER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

// კონტრაქტის ინტერფეისი (ABI)
const contractABI = [
  "function registerPassport(string _passportId, string _verificationId, bytes32 _docHash, uint256 _version, string _previousVerificationId) external",
  "function getPassport(string _verificationId) external view returns (tuple(string passportId, string verificationId, bytes32 docHash, uint256 version, uint256 timestamp, bool isLatest))",
  'function owner() view returns (address)',
];

export function getIssuerAddress() {
  if (!PRIVATE_KEY) throw new Error("გაკლია ISSUER_PRIVATE_KEY");
  return new ethers.Wallet(PRIVATE_KEY).address;
}

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

export type IssuerAuthenticity = 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED';

export type PublicPassportRecord =
  | { recordExists: false }
  | {
      recordExists: true;
      documentHash: string;
      version: number;
      isLatest: boolean;
      issuerAuthenticity: IssuerAuthenticity;
    };

export async function verifyDocumentOnChain(verificationId: string): Promise<PublicPassportRecord> {
  if (!RPC_URL || !CONTRACT_ADDRESS) throw new Error('Blockchain verifier is not configured.');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, PassportVerifierABI.abi, provider);
  const result = await contract.getPassport(verificationId);
  const version = Number(result.version);
  if (!Number.isSafeInteger(version) || version <= 0) return { recordExists: false };

  const expectedIssuer = process.env.BTU_ISSUER_ADDRESS;
  const contractOwner = await contract.owner();
  const issuerAuthenticity: IssuerAuthenticity = !expectedIssuer
    ? 'NOT_CONFIGURED'
    : String(contractOwner).toLowerCase() === expectedIssuer.toLowerCase()
      ? 'VERIFIED'
      : 'UNVERIFIED';

  return {
    recordExists: true,
    documentHash: String(result.docHash),
    version,
    isLatest: Boolean(result.isLatest),
    issuerAuthenticity,
  };
}