import { canonicalJson, sha256Hex, GENESIS_HASH } from "./cryptoUtils";

/** H_i = Hash(H_{i-1} + Trans_Data + H_v) */
export function computeTransactionHash(
  prevHash: string,
  transData: Record<string, unknown>,
  hV: string
): string {
  const payload = `${prevHash}|${canonicalJson(transData)}|${hV}`;
  return sha256Hex(payload);
}

export function computeBlockHash(
  prevBlockHash: string,
  merkleRoot: string,
  blockHeight: number,
  timestamp: string
): string {
  return sha256Hex(`${prevBlockHash}|${merkleRoot}|${blockHeight}|${timestamp}`);
}

export function computeAnchorHash(blockHash: string, timestamp: string): string {
  return sha256Hex(`${blockHash}|${timestamp}`);
}

export function computeAgreementHash(
  proposalHash: string,
  revisionHashes: string[],
  finalState: Record<string, unknown>
): string {
  const rev = revisionHashes.join("|");
  return sha256Hex(`${proposalHash}|${rev}|${canonicalJson(finalState)}`);
}

export { GENESIS_HASH };
