/**
 * Runs the ordering that keeps issuance recoverable: register first, then mark the version issued,
 * and only then advance the passport's latest pointer.
 */
export async function registerAndFinalizePassportVersion(
  register: () => Promise<string>,
  markIssued: (transactionHash: string) => Promise<void>,
  updateLatest: () => Promise<void>,
): Promise<string> {
  const transactionHash = await register();
  await markIssued(transactionHash);
  await updateLatest();
  return transactionHash;
}
