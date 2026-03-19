"use client";

import type { WriteContractErrorType } from "wagmi/actions";

export function TxError({ error }: { error: WriteContractErrorType | null }) {
  if (!error) return null;

  // Extract a human-readable message
  let message = error.message ?? "Transaction failed";

  // Common wagmi/viem error patterns
  if (message.includes("User rejected")) {
    message = "Transaction rejected in wallet.";
  } else if (
    message.includes("chain") ||
    message.includes("chainId") ||
    message.includes("Chain")
  ) {
    message =
      "Wrong network. Please switch MetaMask to the Katana Fork network (chain ID 747474, RPC http://127.0.0.1:8545).";
  } else if (message.length > 200) {
    // Truncate overly verbose errors
    message = message.slice(0, 200) + "…";
  }

  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
