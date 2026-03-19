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
import {
  votingEscrowAbi,
  avkatVaultAbi,
  nftLockAbi,
  exitQueueAbi,
} from "@/config/abis";
import { TxError } from "./TxError";

export function ConvertTokens() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-ink-100">Convert Tokens</h2>
      <VkatToAvkat />
      <AvkatToVkat />
    </div>
  );
}

function VkatToAvkat() {
  const { address } = useAccount();
  const [selectedTokenId, setSelectedTokenId] = useState("");

  const { data: ownedTokens } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "ownedTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    address: CONTRACTS.NFT_LOCK,
    abi: nftLockAbi,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACTS.AVKAT_VAULT] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: setApproval,
    data: approvalTxHash,
    isPending: isApprovePending,
    error: approvalError,
    reset: resetApproval,
  } = useWriteContract();

  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
  } = useWaitForTransactionReceipt({ hash: approvalTxHash });

  const {
    writeContract: depositTokenId,
    data: depositTxHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchApproval();
    }
  }, [isApprovalConfirmed, refetchApproval]);

  const tokenIds = ownedTokens ?? [];

  const handleApprove = () => {
    setApproval({
      address: CONTRACTS.NFT_LOCK,
      abi: nftLockAbi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.AVKAT_VAULT, true],
    });
  };

  const handleDeposit = () => {
    if (!selectedTokenId || !address) return;
    depositTokenId({
      address: CONTRACTS.AVKAT_VAULT,
      abi: avkatVaultAbi,
      functionName: "depositTokenId",
      args: [BigInt(selectedTokenId), address],
    });
  };

  const handleReset = () => {
    setSelectedTokenId("");
    resetApproval();
    resetDeposit();
  };

  return (
    <div className="card space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-ink-200">
          vKAT NFT to avKAT
        </h3>
        <p className="text-sm text-ink-400 mt-1">
          Convert your vKAT NFT into liquid avKAT vault shares.
        </p>
      </div>

      <div>
        <label className="label-text">Select vKAT NFT</label>
        <select
          value={selectedTokenId}
          onChange={(e) => setSelectedTokenId(e.target.value)}
          className="input-field"
        >
          <option value="">Select a token...</option>
          {tokenIds.map((id) => (
            <option key={id.toString()} value={id.toString()}>
              vKAT #{id.toString()}
            </option>
          ))}
        </select>
        {tokenIds.length === 0 && (
          <p className="text-xs text-ink-400 mt-1">
            No vKAT NFTs found in your wallet.
          </p>
        )}
      </div>

      <TxError error={approvalError} />
      <TxError error={depositError} />

      {!isApprovedForAll ? (
        <button
          onClick={handleApprove}
          disabled={isApprovePending || isApprovalConfirming}
          className="btn-primary w-full"
        >
          {isApprovePending
            ? "Confirm in Wallet..."
            : isApprovalConfirming
            ? "Approving..."
            : "Approve NFT Transfer"}
        </button>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={
            isDepositPending || isDepositConfirming || !selectedTokenId
          }
          className="btn-primary w-full"
        >
          {isDepositPending
            ? "Confirm in Wallet..."
            : isDepositConfirming
            ? "Depositing..."
            : "Deposit NFT for avKAT"}
        </button>
      )}

      {isDepositConfirmed && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
          <p className="text-emerald-400 font-medium">
            NFT deposited for avKAT successfully!
          </p>
          <button
            onClick={handleReset}
            className="btn-secondary mt-3 text-sm"
          >
            Convert Another
          </button>
        </div>
      )}
    </div>
  );
}

function AvkatToVkat() {
  const { address } = useAccount();
  const [shares, setShares] = useState("");

  const { data: onChainCooldown } = useReadContract({
    address: CONTRACTS.EXIT_QUEUE,
    abi: exitQueueAbi,
    functionName: "cooldown",
  });
  const cooldownDays = onChainCooldown !== undefined ? Math.round(Number(onChainCooldown) / 86400) : "...";

  const { data: avkatBalance } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const parsedShares = shares ? parseEther(shares) : 0n;

  const { data: assetsOut } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "convertToAssets",
    args: [parsedShares],
    query: { enabled: parsedShares > 0n },
  });

  const {
    writeContract: withdrawTokenId,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  const handleWithdraw = () => {
    if (!parsedShares || !address) return;
    withdrawTokenId({
      address: CONTRACTS.AVKAT_VAULT,
      abi: avkatVaultAbi,
      functionName: "withdrawTokenId",
      args: [parsedShares, address, address],
    });
  };

  const handleReset = () => {
    setShares("");
    resetWithdraw();
  };

  return (
    <div className="card space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-ink-200">
          avKAT to vKAT NFT
        </h3>
        <p className="text-sm text-ink-400 mt-1">
          Redeem avKAT shares to receive a new vKAT NFT.
        </p>
      </div>

      <div>
        <label className="label-text">avKAT Shares to Redeem</label>
        <div className="relative">
          <input
            type="text"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="0.0"
            className="input-field pr-20"
          />
          <button
            onClick={() =>
              avkatBalance && setShares(formatEther(avkatBalance))
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-katana-500 hover:text-katana-400 font-medium"
          >
            MAX
          </button>
        </div>
        <p className="text-xs text-ink-400 mt-1">
          Balance:{" "}
          {avkatBalance !== undefined ? fmtEther(avkatBalance) : "--"} avKAT
        </p>
      </div>

      {assetsOut !== undefined && parsedShares > 0n && (
        <div className="bg-ink-800/50 rounded-lg p-3">
          <p className="text-sm text-ink-400">
            Underlying value:{" "}
            <span className="text-ink-200 font-medium">
              {fmtEther(assetsOut)} KAT
            </span>
          </p>
        </div>
      )}

      <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-3">
        <p className="text-sm text-ink-400">
          You will receive a vKAT NFT. To convert back to KAT, you must begin
          an unstake from the Unstake tab ({cooldownDays}-day cooldown).
        </p>
      </div>

      <TxError error={withdrawError} />

      <button
        onClick={handleWithdraw}
        disabled={isWithdrawPending || isWithdrawConfirming || !parsedShares}
        className="btn-primary w-full"
      >
        {isWithdrawPending
          ? "Confirm in Wallet..."
          : isWithdrawConfirming
          ? "Withdrawing..."
          : "Redeem avKAT for vKAT NFT"}
      </button>

      {isWithdrawConfirmed && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
          <p className="text-emerald-400 font-medium">
            Withdrawal successful! You received a new vKAT NFT.
          </p>
          <button
            onClick={handleReset}
            className="btn-secondary mt-3 text-sm"
          >
            Redeem More
          </button>
        </div>
      )}
    </div>
  );
}
