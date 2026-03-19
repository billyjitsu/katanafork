import { formatEther } from "viem";

/** Format wei to a human-readable string with up to 4 decimal places */
export function fmtEther(wei: bigint): string {
  const num = Number(formatEther(wei));
  // Remove unnecessary trailing zeros but keep up to 4 decimals
  return parseFloat(num.toFixed(4)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}
