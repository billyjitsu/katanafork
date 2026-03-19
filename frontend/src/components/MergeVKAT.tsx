"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { fmtEther } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { votingEscrowAbi } from "@/config/abis";
import { TxError } from "./TxError";

export function MergeVKAT() {
  const { address } = useAccount();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  const { data: ownedTokens, refetch: refetchOwned } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "ownedTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const tokenIds = ownedTokens ?? [];

  const { data: tokenDetails } = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      {
        address: CONTRACTS.VOTING_ESCROW,
        abi: votingEscrowAbi,
        functionName: "locked" as const,
        args: [tokenId] as const,
      },
      {
        address: CONTRACTS.VOTING_ESCROW,
        abi: votingEscrowAbi,
        functionName: "votingPower" as const,
        args: [tokenId] as const,
      },
    ]),
    query: { enabled: tokenIds.length > 0 },
  });

  // Merge tx
  const {
    writeContract: merge,
    data: mergeTxHash,
    isPending: isMergePending,
    error: mergeError,
    reset: resetMerge,
  } = useWriteContract();

  const { isLoading: isMergeConfirming, isSuccess: isMergeConfirmed } =
    useWaitForTransactionReceipt({ hash: mergeTxHash });

  useEffect(() => {
    if (isMergeConfirmed) {
      refetchOwned();
    }
  }, [isMergeConfirmed, refetchOwned]);

  const handleMerge = () => {
    if (!fromId || !toId) return;
    merge({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "merge",
      args: [BigInt(fromId), BigInt(toId)],
    });
  };

  const handleReset = () => {
    setFromId("");
    setToId("");
    resetMerge();
  };

  // Get locked amounts for preview
  function getTokenLocked(id: string): bigint | null {
    const idx = tokenIds.findIndex((t) => t.toString() === id);
    if (idx < 0 || !tokenDetails?.[idx * 2]) return null;
    const result = tokenDetails[idx * 2];
    if (result.status !== "success") return null;
    return (result.result as unknown as [bigint, bigint])[0];
  }

  function getTokenVP(id: string): bigint | null {
    const idx = tokenIds.findIndex((t) => t.toString() === id);
    if (idx < 0 || !tokenDetails?.[idx * 2 + 1]) return null;
    const result = tokenDetails[idx * 2 + 1];
    if (result.status !== "success") return null;
    return result.result as bigint;
  }

  const fromLocked = fromId ? getTokenLocked(fromId) : null;
  const toLocked = toId ? getTokenLocked(toId) : null;
  const fromVP = fromId ? getTokenVP(fromId) : null;
  const toVP = toId ? getTokenVP(toId) : null;

  const canMerge = fromId && toId && fromId !== toId;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ink-100">Merge vKAT NFTs</h2>
      <p className="text-ink-400">
        Combine two vKAT NFTs into one. The source NFT is burned and its locked
        KAT is added to the destination NFT.
      </p>

      <div className="bg-ink-800/50 border border-ink-600/30 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-ink-200">How merge works</p>
        <ul className="text-xs text-ink-400 space-y-1 list-disc list-inside">
          <li>Source NFT is <span className="text-red-400">burned</span> — its KAT transfers to the destination</li>
          <li>Destination NFT <span className="text-ink-200">keeps its original lock start date</span></li>
          <li>Works even if NFTs were created at different times or in different epochs</li>
          <li>Works while your NFTs are being used for voting</li>
          <li>NFTs in the exit queue (pending withdrawal) <span className="text-amber-400">cannot be used as the source</span></li>
          <li>Both NFTs must be owned by the same wallet</li>
        </ul>
      </div>

      {tokenIds.length < 2 && (
        <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-4">
          <p className="text-sm text-ink-400">
            You need at least 2 vKAT NFTs to merge. Stake more KAT on the vKAT
            tab to create additional NFTs.
          </p>
        </div>
      )}

      <div className="card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">Source (burns)</label>
            <select
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value);
                if (e.target.value === toId) setToId("");
              }}
              className="input-field"
            >
              <option value="">Select NFT...</option>
              {tokenIds
                .filter((id) => id.toString() !== toId)
                .map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    vKAT #{id.toString()}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label-text">Destination (keeps)</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="input-field"
            >
              <option value="">Select NFT...</option>
              {tokenIds
                .filter((id) => id.toString() !== fromId)
                .map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    vKAT #{id.toString()}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {canMerge && (
          <div className="bg-ink-800/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-ink-400 font-medium">Source #{fromId}</p>
                <p className="text-ink-200">
                  {fromLocked ? fmtEther(fromLocked) : "--"} KAT
                </p>
                <p className="text-ink-400 text-xs">
                  VP: {fromVP ? fmtEther(fromVP) : "--"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-ink-400 font-medium">Dest #{toId}</p>
                <p className="text-ink-200">
                  {toLocked ? fmtEther(toLocked) : "--"} KAT
                </p>
                <p className="text-ink-400 text-xs">
                  VP: {toVP ? fmtEther(toVP) : "--"}
                </p>
              </div>
            </div>

            <div className="border-t border-ink-600/50 pt-3 flex justify-between text-sm">
              <span className="text-ink-300 font-medium">Result</span>
              <span className="text-katana-400 font-bold">
                {fromLocked && toLocked
                  ? fmtEther(fromLocked + toLocked)
                  : "--"}{" "}
                KAT in #{toId}
              </span>
            </div>
          </div>
        )}

        <TxError error={mergeError} />

        <button
          onClick={handleMerge}
          disabled={!canMerge || isMergePending || isMergeConfirming}
          className="btn-primary w-full"
        >
          {isMergePending
            ? "Confirm in Wallet..."
            : isMergeConfirming
            ? "Merging..."
            : "Merge NFTs"}
        </button>

        {isMergeConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <p className="text-emerald-400 font-medium">
              NFTs merged successfully! #{fromId} burned, KAT added to #{toId}.
            </p>
            <button
              onClick={handleReset}
              className="btn-secondary mt-3 text-sm"
            >
              Merge More
            </button>
          </div>
        )}
      </div>

      {tokenIds.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-ink-200 mb-4">
            Your vKAT NFTs
          </h3>
          <div className="space-y-2">
            {tokenIds.map((tokenId, i) => {
              const lockedResult = tokenDetails?.[i * 2];
              const vpResult = tokenDetails?.[i * 2 + 1];
              const locked =
                lockedResult?.status === "success"
                  ? (lockedResult.result as unknown as [bigint, bigint])
                  : null;
              const vp =
                vpResult?.status === "success"
                  ? (vpResult.result as bigint)
                  : null;

              return (
                <div
                  key={tokenId.toString()}
                  className="flex items-center justify-between bg-ink-800/50 rounded-lg px-4 py-3"
                >
                  <span className="text-ink-200 font-mono text-sm">
                    #{tokenId.toString()}
                  </span>
                  <span className="text-ink-300 text-sm">
                    {locked ? fmtEther(locked[0]) : "--"} KAT
                  </span>
                  <span className="text-katana-400 text-sm">
                    VP: {vp ? fmtEther(vp) : "--"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
