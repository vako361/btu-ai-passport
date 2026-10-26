import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('PassportVerifier version history', function () {
  async function deployVerifier() {
    return ethers.deployContract('PassportVerifier');
  }

  it('keeps the prior verification record and advances latest only on a valid next version', async function () {
    const verifier = await deployVerifier();
    const firstHash = ethers.keccak256(ethers.toUtf8Bytes('passport-v1'));
    const secondHash = ethers.keccak256(ethers.toUtf8Bytes('passport-v2'));

    await verifier.registerPassport('BTU-AI-S1', 'VER-1', firstHash, 1, '');
    await verifier.registerPassport('BTU-AI-S1', 'VER-2', secondHash, 2, 'VER-1');

    const first = await verifier.getPassport('VER-1');
    const second = await verifier.getPassport('VER-2');

    expect(first.docHash).to.equal(firstHash);
    expect(first.version).to.equal(BigInt(1));
    expect(first.isLatest).to.equal(false);
    expect(second.docHash).to.equal(secondHash);
    expect(second.version).to.equal(BigInt(2));
    expect(second.isLatest).to.equal(true);
  });

  it('does not overwrite a registered Verification ID', async function () {
    const verifier = await deployVerifier();
    const originalHash = ethers.keccak256(ethers.toUtf8Bytes('original'));
    const changedHash = ethers.keccak256(ethers.toUtf8Bytes('changed'));

    await verifier.registerPassport('BTU-AI-S1', 'VER-1', originalHash, 1, '');
    await expect(
      verifier.registerPassport('BTU-AI-S1', 'VER-1', changedHash, 1, ''),
    ).to.be.revertedWith('Verification ID conflicts with existing record');

    expect((await verifier.getPassport('VER-1')).docHash).to.equal(originalHash);
  });

  it('leaves the current version latest when the next registration is invalid', async function () {
    const verifier = await deployVerifier();
    const firstHash = ethers.keccak256(ethers.toUtf8Bytes('passport-v1'));
    const invalidHash = ethers.keccak256(ethers.toUtf8Bytes('invalid-v3'));

    await verifier.registerPassport('BTU-AI-S1', 'VER-1', firstHash, 1, '');
    await expect(
      verifier.registerPassport('BTU-AI-S1', 'VER-3', invalidHash, 3, 'VER-1'),
    ).to.be.revertedWith('Version must increment by one');

    const first = await verifier.getPassport('VER-1');
    expect(first.isLatest).to.equal(true);
    expect((await verifier.getPassport('VER-3')).timestamp).to.equal(BigInt(0));
  });
});