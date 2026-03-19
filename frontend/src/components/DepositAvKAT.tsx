"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { fmtEther } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { katAbi, avkatVaultAbi } from "@/config/abis";
import { TxError } from "./TxError";

export function DepositAvKAT() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");

  const { data: katBalance } = useReadContract({
    address: CONTRACTS.KAT,
    abi: katAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.KAT,
    abi: katAbi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.AVKAT_VAULT] : undefined,
    query: { enabled: !!address },
  });

  const parsedAmount = amount ? parseEther(amount) : 0n;

  const { data: previewShares } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "previewDeposit",
    args: [parsedAmount],
    query: { enabled: parsedAmount > 0n },
  });

  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract: deposit,
    data: depositTxHash,
    isPending: isDepositing,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  const needsApproval =
    parsedAmount > 0n && (allowance === undefined || allowance < parsedAmount);

  const handleApprove = () => {
    if (!parsedAmount) return;
    approve({
      address: CONTRACTS.KAT,
      abi: katAbi,
      functionName: "approve",
      args: [CONTRACTS.AVKAT_VAULT, parsedAmount],
    });
  };

  const handleDeposit = () => {
    if (!parsedAmount || !address) return;
    deposit({
      address: CONTRACTS.AVKAT_VAULT,
      abi: avkatVaultAbi,
      functionName: "deposit",
      args: [parsedAmount, address],
    });
  };

  const handleReset = () => {
    setAmount("");
    resetApprove();
    resetDeposit();
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ink-100">
        Deposit KAT to avKAT Vault
      </h2>
      <p className="text-ink-400">
        Deposit KAT tokens into the auto-compounding avKAT vault to earn yield.
      </p>

      <div className="card space-y-5">
        <div>
          <label className="label-text">Amount to Deposit</label>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="input-field pr-20"
            />
            <button
              onClick={() =>
                katBalance && setAmount(formatEther(katBalance))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-katana-500 hover:text-katana-400 font-medium"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-1">
            Balance:{" "}
            {katBalance !== undefined ? fmtEther(katBalance) : "--"} KAT
          </p>
        </div>

        {previewShares !== undefined && parsedAmount > 0n && (
          <div className="bg-ink-800/50 rounded-lg p-3">
            <p className="text-sm text-ink-400">
              You will receive:{" "}
              <span className="text-ink-200 font-medium">
                {fmtEther(previewShares)} avKAT
              </span>
            </p>
          </div>
        )}

        <TxError error={approveError} />
        <TxError error={depositError} />

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || isApproveConfirming || !parsedAmount}
            className="btn-primary w-full"
          >
            {isApproving
              ? "Confirm in Wallet..."
              : isApproveConfirming
              ? "Approving..."
              : "Approve KAT"}
          </button>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={isDepositing || isDepositConfirming || !parsedAmount}
            className="btn-primary w-full"
          >
            {isDepositing
              ? "Confirm in Wallet..."
              : isDepositConfirming
              ? "Depositing..."
              : "Deposit to Vault"}
          </button>
        )}

        {isDepositConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <p className="text-emerald-400 font-medium">
              Deposit successful!
            </p>
            <p className="text-sm text-ink-400 mt-1">
              Transaction: {depositTxHash?.slice(0, 10)}...
              {depositTxHash?.slice(-8)}
            </p>
            <button
              onClick={handleReset}
              className="btn-secondary mt-3 text-sm"
            >
              Deposit More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
