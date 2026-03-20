"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { fmtEther } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { votingEscrowAbi } from "@/config/abis";
import { TxError } from "./TxError";

export function MergeVKAT() {
  const { address } = useAccount();

  const { data: ownedTokens, refetch: refetchOwned } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "ownedTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: minDeposit } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "minDeposit",
  });

  const tokenIds = ownedTokens ?? [];
  const minDepositNum = minDeposit ? Number(formatEther(minDeposit)) : 0.5;

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

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <MergeSection
        tokenIds={tokenIds.map(String)}
        getTokenLocked={getTokenLocked}
        getTokenVP={getTokenVP}
        refetchOwned={refetchOwned}
      />

      <SplitSection
        tokenIds={tokenIds.map(String)}
        getTokenLocked={getTokenLocked}
        minDepositNum={minDepositNum}
        refetchOwned={refetchOwned}
      />

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

// ─── Merge Section ──────────────────────────────────────
function MergeSection({
  tokenIds,
  getTokenLocked,
  getTokenVP,
  refetchOwned,
}: {
  tokenIds: string[];
  getTokenLocked: (id: string) => bigint | null;
  getTokenVP: (id: string) => bigint | null;
  refetchOwned: () => void;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

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
    if (isMergeConfirmed) refetchOwned();
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

  const fromLocked = fromId ? getTokenLocked(fromId) : null;
  const toLocked = toId ? getTokenLocked(toId) : null;
  const fromVP = fromId ? getTokenVP(fromId) : null;
  const toVP = toId ? getTokenVP(toId) : null;
  const canMerge = fromId && toId && fromId !== toId;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-100">Merge vKAT NFTs</h2>
        <p className="text-ink-400 mt-1">
          Combine two vKAT NFTs into one. Source burns, destination keeps its lock start.
        </p>
      </div>

      <div className="bg-ink-800/50 border border-ink-600/30 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-ink-200">Merge rules</p>
        <ul className="text-xs text-ink-400 space-y-1 list-disc list-inside">
          <li>Works across different epochs and while voting</li>
          <li>No NFT approval required</li>
          <li>NFTs in the exit queue <span className="text-amber-400">cannot</span> be used as source</li>
          <li>Both NFTs must be owned by the same wallet</li>
        </ul>
      </div>

      {tokenIds.length < 2 ? (
        <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-4">
          <p className="text-sm text-ink-400">
            You need at least 2 vKAT NFTs to merge.
          </p>
        </div>
      ) : (
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
                  .filter((id) => id !== toId)
                  .map((id) => (
                    <option key={id} value={id}>
                      vKAT #{id}
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
                  .filter((id) => id !== fromId)
                  .map((id) => (
                    <option key={id} value={id}>
                      vKAT #{id}
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
                  <p className="text-ink-200">{fromLocked ? fmtEther(fromLocked) : "--"} KAT</p>
                  <p className="text-ink-400 text-xs">VP: {fromVP ? fmtEther(fromVP) : "--"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-ink-400 font-medium">Dest #{toId}</p>
                  <p className="text-ink-200">{toLocked ? fmtEther(toLocked) : "--"} KAT</p>
                  <p className="text-ink-400 text-xs">VP: {toVP ? fmtEther(toVP) : "--"}</p>
                </div>
              </div>
              <div className="border-t border-ink-600/50 pt-3 flex justify-between text-sm">
                <span className="text-ink-300 font-medium">Result</span>
                <span className="text-katana-400 font-bold">
                  {fromLocked && toLocked ? fmtEther(fromLocked + toLocked) : "--"} KAT in #{toId}
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
            {isMergePending ? "Confirm in Wallet..." : isMergeConfirming ? "Merging..." : "Merge NFTs"}
          </button>

          {isMergeConfirmed && (
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
              <p className="text-emerald-400 font-medium">
                NFTs merged! #{fromId} burned, KAT added to #{toId}.
              </p>
              <button
                onClick={() => { setFromId(""); setToId(""); resetMerge(); }}
                className="btn-secondary mt-3 text-sm"
              >
                Merge More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Split Section ──────────────────────────────────────
function SplitSection({
  tokenIds,
  getTokenLocked,
  minDepositNum,
  refetchOwned,
}: {
  tokenIds: string[];
  getTokenLocked: (id: string) => bigint | null;
  minDepositNum: number;
  refetchOwned: () => void;
}) {
  const [splitId, setSplitId] = useState("");
  const [splitAmount, setSplitAmount] = useState("");

  const {
    writeContract: split,
    data: splitTxHash,
    isPending: isSplitPending,
    error: splitError,
    reset: resetSplit,
  } = useWriteContract();

  const { isLoading: isSplitConfirming, isSuccess: isSplitConfirmed } =
    useWaitForTransactionReceipt({ hash: splitTxHash });

  useEffect(() => {
    if (isSplitConfirmed) refetchOwned();
  }, [isSplitConfirmed, refetchOwned]);

  const handleSplit = () => {
    if (!splitId || !splitAmount) return;
    split({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "split",
      args: [BigInt(splitId), parseEther(splitAmount)],
    });
  };

  const sourceLocked = splitId ? getTokenLocked(splitId) : null;
  const sourceNum = sourceLocked ? Number(formatEther(sourceLocked)) : 0;
  const splitNum = parseFloat(splitAmount) || 0;
  const remainderNum = sourceNum - splitNum;

  const splitValid =
    splitId &&
    splitNum >= minDepositNum &&
    remainderNum >= minDepositNum &&
    splitNum > 0 &&
    splitNum < sourceNum;

  const maxSplit = sourceNum > minDepositNum ? sourceNum - minDepositNum : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-100">Split vKAT NFT</h2>
        <p className="text-ink-400 mt-1">
          Split a vKAT NFT into two. A new NFT is created with the split amount.
        </p>
      </div>

      <div className="bg-ink-800/50 border border-ink-600/30 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-ink-200">Split rules</p>
        <ul className="text-xs text-ink-400 space-y-1 list-disc list-inside">
          <li>Both resulting NFTs must have at least <span className="text-ink-200">{minDepositNum} KAT</span> (minDeposit)</li>
          <li>New NFT inherits the same lock start date</li>
          <li>Works while voting</li>
          <li>NFTs in the exit queue cannot be split</li>
        </ul>
      </div>

      {tokenIds.length === 0 ? (
        <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-4">
          <p className="text-sm text-ink-400">
            You need a vKAT NFT to split.
          </p>
        </div>
      ) : (
        <div className="card space-y-5">
          <div>
            <label className="label-text">NFT to Split</label>
            <select
              value={splitId}
              onChange={(e) => { setSplitId(e.target.value); setSplitAmount(""); }}
              className="input-field"
            >
              <option value="">Select NFT...</option>
              {tokenIds.map((id) => (
                <option key={id} value={id}>
                  vKAT #{id}
                </option>
              ))}
            </select>
          </div>

          {splitId && sourceLocked && (
            <>
              <div className="bg-ink-800/50 rounded-lg p-3 flex justify-between text-sm">
                <span className="text-ink-400">Locked in #{splitId}</span>
                <span className="text-ink-200 font-medium">{fmtEther(sourceLocked)} KAT</span>
              </div>

              <div>
                <label className="label-text">Amount to Split Off</label>
                <div className="relative">
                  <input
                    type="text"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    placeholder="0.0"
                    className="input-field pr-16"
                  />
                  <button
                    onClick={() => setSplitAmount(maxSplit > 0 ? maxSplit.toFixed(4) : "")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-katana-500 hover:text-katana-400 font-medium"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  Min: {minDepositNum} KAT | Max: {maxSplit > 0 ? maxSplit.toFixed(4) : "--"} KAT
                </p>
              </div>

              {splitNum > 0 && (
                <div className="bg-ink-800/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-400">New NFT</span>
                    <span className="text-katana-400 font-medium">{splitNum.toFixed(4)} KAT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Remaining in #{splitId}</span>
                    <span className={`font-medium ${remainderNum < minDepositNum ? "text-red-400" : "text-ink-200"}`}>
                      {remainderNum.toFixed(4)} KAT
                    </span>
                  </div>
                  {remainderNum < minDepositNum && remainderNum > 0 && (
                    <p className="text-xs text-red-400">
                      Remainder must be at least {minDepositNum} KAT
                    </p>
                  )}
                  {splitNum < minDepositNum && (
                    <p className="text-xs text-red-400">
                      Split amount must be at least {minDepositNum} KAT
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <TxError error={splitError} />

          <button
            onClick={handleSplit}
            disabled={!splitValid || isSplitPending || isSplitConfirming}
            className="btn-primary w-full"
          >
            {isSplitPending ? "Confirm in Wallet..." : isSplitConfirming ? "Splitting..." : "Split NFT"}
          </button>

          {isSplitConfirmed && (
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
              <p className="text-emerald-400 font-medium">
                NFT split successfully! New NFT created with {splitAmount} KAT.
              </p>
              <button
                onClick={() => { setSplitId(""); setSplitAmount(""); resetSplit(); }}
                className="btn-secondary mt-3 text-sm"
              >
                Split More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
