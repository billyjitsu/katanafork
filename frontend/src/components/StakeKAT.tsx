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
import { katAbi, votingEscrowAbi } from "@/config/abis";
import { TxError } from "./TxError";

export function StakeKAT() {
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
    args: address ? [address, CONTRACTS.VOTING_ESCROW] : undefined,
    query: { enabled: !!address },
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
    writeContract: createLock,
    data: lockTxHash,
    isPending: isLocking,
    error: lockError,
    reset: resetLock,
  } = useWriteContract();

  const { isLoading: isLockConfirming, isSuccess: isLockConfirmed } =
    useWaitForTransactionReceipt({ hash: lockTxHash });

  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  const parsedAmount = amount ? parseEther(amount) : 0n;
  const needsApproval =
    parsedAmount > 0n && (allowance === undefined || allowance < parsedAmount);

  const handleApprove = () => {
    if (!parsedAmount) return;
    approve({
      address: CONTRACTS.KAT,
      abi: katAbi,
      functionName: "approve",
      args: [CONTRACTS.VOTING_ESCROW, parsedAmount],
    });
  };

  const handleCreateLock = () => {
    if (!parsedAmount) return;
    createLock({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "createLock",
      args: [parsedAmount],
    });
  };

  const handleReset = () => {
    setAmount("");
    resetApprove();
    resetLock();
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ink-100">Stake KAT to vKAT</h2>
      <p className="text-ink-400">
        Lock your KAT tokens to receive a vKAT NFT with voting power.
      </p>

      <div className="card space-y-5">
        <div>
          <label className="label-text">Amount to Stake</label>
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

        <TxError error={approveError} />
        <TxError error={lockError} />

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
            onClick={handleCreateLock}
            disabled={isLocking || isLockConfirming || !parsedAmount}
            className="btn-primary w-full"
          >
            {isLocking
              ? "Confirm in Wallet..."
              : isLockConfirming
              ? "Creating Lock..."
              : "Create Lock (Stake)"}
          </button>
        )}

        {isLockConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <p className="text-emerald-400 font-medium">
              Lock created successfully!
            </p>
            <p className="text-sm text-ink-400 mt-1">
              Transaction: {lockTxHash?.slice(0, 10)}...{lockTxHash?.slice(-8)}
            </p>
            <button
              onClick={handleReset}
              className="btn-secondary mt-3 text-sm"
            >
              Stake More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
