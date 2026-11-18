import { Contract, JsonRpcProvider, Wallet, type ContractTransactionResponse, type Provider } from 'ethers';
import PassportVerifierArtifact from '../../artifacts/contracts/PassportVerifier.sol/PassportVerifier.json';
import type { LedgerEnv } from '../env';
import {
  LedgerConfigError,
  LedgerError,
  normalizeDocumentHash,
  type IssuerAuthenticity,
  type LedgerLookup,
  type LedgerProvider,
  type LedgerReceipt,
  type LedgerRegistration,
} from './types';

type AmoyEnv = Extract<LedgerEnv, { mode: 'amoy' }>;

const CONFIRMATION_TIMEOUT_MS = 60_000;
const EXPLORER_TX_URL = 'https://amoy.polygonscan.com/tx/';

interface PassportVerifierContract {
  registerPassport(
    passportId: string,
    verificationId: string,
    docHash: string,
    version: number,
    previousVerificationId: string,
  ): Promise<ContractTransactionResponse>;
  getPassport(verificationId: string): Promise<{ version: bigint; docHash: string; isLatest: boolean }>;
  owner(): Promise<string>;
}

const providers = new Map<string, JsonRpcProvider>();

function providerFor(rpcUrl: string): JsonRpcProvider {
  let provider = providers.get(rpcUrl);
  if (!provider) {
    provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    providers.set(rpcUrl, provider);
  }
  return provider;
}

function connect(address: string, runner: Wallet | Provider): PassportVerifierContract {
  return new Contract(address, PassportVerifierArtifact.abi, runner) as unknown as PassportVerifierContract;
}

// One relayer wallet means one nonce sequence, so writes within an instance must not overlap.
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

export class AmoyLedger implements LedgerProvider {
  readonly mode = 'amoy' as const;
  readonly label = 'Polygon Amoy';

  constructor(private readonly env: AmoyEnv) {}

  issuerAddress(): string {
    return this.relayer().address;
  }

  transactionUrl(transactionHash: string): string | null {
    return /^0x[0-9a-fA-F]{64}$/.test(transactionHash) ? `${EXPLORER_TX_URL}${transactionHash}` : null;
  }

  async register(registration: LedgerRegistration): Promise<LedgerReceipt> {
    const documentHash = normalizeDocumentHash(registration.documentHash);
    const wallet = this.relayer(providerFor(this.env.rpcUrl));
    const contract = connect(this.env.contractAddress, wallet);

    return serialize(async () => {
      const transaction = await contract.registerPassport(
        registration.passportId,
        registration.verificationId,
        documentHash,
        registration.version,
        registration.previousVerificationId,
      );
      const receipt = await transaction.wait(1, CONFIRMATION_TIMEOUT_MS);
      if (!receipt) throw new LedgerError('Transaction was not confirmed in time.');
      return { transactionHash: receipt.hash, mode: this.mode };
    });
  }

  async lookup(verificationId: string): Promise<LedgerLookup> {
    const contract = connect(this.env.contractAddress, providerFor(this.env.rpcUrl));
    const record = await contract.getPassport(verificationId);
    const version = Number(record.version);
    if (!Number.isSafeInteger(version) || version <= 0) return { exists: false };

    return {
      exists: true,
      mode: this.mode,
      documentHash: String(record.docHash),
      version,
      isLatest: Boolean(record.isLatest),
      issuerAuthenticity: await this.issuerAuthenticity(contract),
    };
  }

  private async issuerAuthenticity(contract: PassportVerifierContract): Promise<IssuerAuthenticity> {
    const expected = this.env.expectedIssuerAddress;
    if (!expected) return 'NOT_CONFIGURED';
    const owner = await contract.owner();
    return owner.toLowerCase() === expected.toLowerCase() ? 'VERIFIED' : 'UNVERIFIED';
  }

  private relayer(provider?: Provider): Wallet {
    if (!this.env.issuerPrivateKey) {
      throw new LedgerConfigError('ISSUER_PRIVATE_KEY is required to issue credentials in amoy mode.');
    }
    return new Wallet(this.env.issuerPrivateKey, provider);
  }
}
