"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { fmtEther } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { votingEscrowAbi, nftLockAbi, exitQueueAbi } from "@/config/abis";
import { TxError } from "./TxError";

const RPC_URL = "http://127.0.0.1:8545";
const BPS = 10000;
const MIN_LOCK_SECONDS = 86400; // 1 day
const LS_KEY = "katana_pending_withdrawals";

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function feeEstimate(
  elapsed: number,
  lockedAmount: bigint,
  cooldown: number,
  maxFeeBps: number,
  minFeeBps: number,
) {
  const ratio = Math.min(elapsed / cooldown, 1);
  const feeBps = Math.round(maxFeeBps - (maxFeeBps - minFeeBps) * ratio);
  const feePercent = feeBps / 100;
  const lockedNum = Number(formatEther(lockedAmount));
  const receiveAmount = lockedNum * (1 - feeBps / BPS);
  const feeAmount = lockedNum * (feeBps / BPS);
  const cooldownDone = elapsed >= cooldown;
  return { ratio, feeBps, feePercent, lockedNum, receiveAmount, feeAmount, cooldownDone };
}

// Persist pending token IDs per address in localStorage
function loadPendingIds(address: string): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return data[address.toLowerCase()] || [];
  } catch {
    return [];
  }
}

function savePendingIds(address: string, ids: string[]) {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    data[address.toLowerCase()] = ids;
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

export function UnstakeVKAT() {
  const { address } = useAccount();
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  // ─── Read exit queue params from chain ─────────────────
  const { data: onChainCooldown } = useReadContract({
    address: CONTRACTS.EXIT_QUEUE,
    abi: exitQueueAbi,
    functionName: "cooldown",
  });
  const { data: onChainMaxFee } = useReadContract({
    address: CONTRACTS.EXIT_QUEUE,
    abi: exitQueueAbi,
    functionName: "feePercent",
  });
  const { data: onChainMinFee } = useReadContract({
    address: CONTRACTS.EXIT_QUEUE,
    abi: exitQueueAbi,
    functionName: "minFeePercent",
  });

  const cooldown = onChainCooldown !== undefined ? Number(onChainCooldown) : 5184000;
  const maxFeeBps = onChainMaxFee !== undefined ? Number(onChainMaxFee) : 8000;
  const minFeeBps = onChainMinFee !== undefined ? Number(onChainMinFee) : 250;
  const cooldownDays = Math.round(cooldown / 86400);
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);
  const [warpDays, setWarpDays] = useState("");
  const [warpStatus, setWarpStatus] = useState("");

  // ─── Owned tokens (not in withdrawal) ─────────────────
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
      {
        address: CONTRACTS.VOTING_ESCROW,
        abi: votingEscrowAbi,
        functionName: "isVoting" as const,
        args: [tokenId] as const,
      },
    ]),
    query: { enabled: tokenIds.length > 0 },
  });

  // ─── Pending withdrawal validation ────────────────────
  // Read queue() for holder+createdAt, locked() for amount, canExit() for status
  const { data: pendingTicketData, refetch: refetchPending } = useReadContracts({
    contracts: pendingIds.flatMap((id) => [
      {
        address: CONTRACTS.EXIT_QUEUE,
        abi: exitQueueAbi,
        functionName: "queue" as const,
        args: [BigInt(id)] as const,
      },
      {
        address: CONTRACTS.VOTING_ESCROW,
        abi: votingEscrowAbi,
        functionName: "locked" as const,
        args: [BigInt(id)] as const,
      },
      {
        address: CONTRACTS.EXIT_QUEUE,
        abi: exitQueueAbi,
        functionName: "canExit" as const,
        args: [BigInt(id)] as const,
      },
    ]),
    query: { enabled: pendingIds.length > 0 },
  });

  // Filter to only IDs where queue holder matches our address
  const validPendingTokens = pendingIds
    .map((id, i) => {
      const queueResult = pendingTicketData?.[i * 3];
      const lockedResult = pendingTicketData?.[i * 3 + 1];
      const canExitResult = pendingTicketData?.[i * 3 + 2];
      const queueData =
        queueResult?.status === "success"
          ? (queueResult.result as unknown as [string, bigint])
          : null;
      const holder = queueData ? queueData[0] : null;
      const createdAt = queueData ? Number(queueData[1]) : null;
      const locked =
        lockedResult?.status === "success"
          ? (lockedResult.result as unknown as [bigint, bigint])
          : null;
      const canExit =
        canExitResult?.status === "success" ? (canExitResult.result as boolean) : false;
      return { id, holder, createdAt, locked, canExit };
    })
    .filter(
      (t) =>
        t.holder && address && t.holder.toLowerCase() === address.toLowerCase()
    );

  // ─── Load pending IDs from localStorage on mount ──────
  useEffect(() => {
    if (address) {
      setPendingIds(loadPendingIds(address));
    }
  }, [address]);

  // ─── Poll current block timestamp ─────────────────────
  const fetchTimestamp = useCallback(async () => {
    try {
      const res = await rpcCall("eth_getBlockByNumber", ["latest", false]);
      setCurrentTimestamp(parseInt(res.result.timestamp, 16));
    } catch {}
  }, []);

  useEffect(() => {
    fetchTimestamp();
    const interval = setInterval(fetchTimestamp, 5000);
    return () => clearInterval(interval);
  }, [fetchTimestamp]);

  // ─── NFT approval ─────────────────────────────────────
  const { data: isNftApproved, refetch: refetchApproval } = useReadContract({
    address: CONTRACTS.NFT_LOCK,
    abi: nftLockAbi,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACTS.VOTING_ESCROW] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: approveNft,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  useEffect(() => {
    if (isApproveConfirmed) refetchApproval();
  }, [isApproveConfirmed, refetchApproval]);

  // ─── Begin withdrawal ─────────────────────────────────
  const {
    writeContract: beginWithdrawal,
    data: beginTxHash,
    isPending: isBeginPending,
    error: beginError,
  } = useWriteContract();

  const { isLoading: isBeginConfirming, isSuccess: isBeginConfirmed } =
    useWaitForTransactionReceipt({ hash: beginTxHash });

  // When beginWithdrawal succeeds, track the token ID
  useEffect(() => {
    if (isBeginConfirmed && selectedTokenId && address) {
      const newIds = [...new Set([...pendingIds, selectedTokenId])];
      setPendingIds(newIds);
      savePendingIds(address, newIds);
      refetchOwned();
      refetchPending();
      fetchTimestamp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBeginConfirmed]);

  // ─── Withdraw ─────────────────────────────────────────
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const {
    writeContract: withdraw,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  useEffect(() => {
    if (isWithdrawConfirmed && withdrawingId && address) {
      const newIds = pendingIds.filter((id) => id !== withdrawingId);
      setPendingIds(newIds);
      savePendingIds(address, newIds);
      setWithdrawingId(null);
      refetchPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWithdrawConfirmed]);

  // ─── Cancel ───────────────────────────────────────────
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const {
    writeContract: cancelWithdrawal,
    data: cancelTxHash,
    isPending: isCancelPending,
    error: cancelError,
  } = useWriteContract();

  const { isLoading: isCancelConfirming, isSuccess: isCancelConfirmed } =
    useWaitForTransactionReceipt({ hash: cancelTxHash });

  useEffect(() => {
    if (isCancelConfirmed && cancellingId && address) {
      const newIds = pendingIds.filter((id) => id !== cancellingId);
      setPendingIds(newIds);
      savePendingIds(address, newIds);
      setCancellingId(null);
      refetchOwned();
      refetchPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCancelConfirmed]);

  // ─── Handlers ─────────────────────────────────────────
  const handleApproveNft = () => {
    approveNft({
      address: CONTRACTS.NFT_LOCK,
      abi: nftLockAbi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.VOTING_ESCROW, true],
    });
  };

  const handleBeginWithdrawal = () => {
    if (!selectedTokenId) return;
    beginWithdrawal({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "beginWithdrawal",
      args: [BigInt(selectedTokenId)],
    });
  };

  const handleWithdraw = (tokenId: string) => {
    setWithdrawingId(tokenId);
    withdraw({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "withdraw",
      args: [BigInt(tokenId)],
    });
  };

  const handleCancel = (tokenId: string) => {
    setCancellingId(tokenId);
    cancelWithdrawal({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "cancelWithdrawalRequest",
      args: [BigInt(tokenId)],
    });
  };

  const handleWarp = async () => {
    const d = parseInt(warpDays);
    if (!d || d <= 0) return;
    try {
      setWarpStatus("Warping...");
      const blockRes = await rpcCall("eth_getBlockByNumber", ["latest", false]);
      const current = parseInt(blockRes.result.timestamp, 16);
      const target = current + d * 86400;
      await rpcCall("evm_setNextBlockTimestamp", ["0x" + target.toString(16)]);
      await rpcCall("evm_mine", []);
      setWarpStatus(
        `Moved ${d} days forward — ${new Date(target * 1000).toLocaleDateString()}`
      );
      setWarpDays("");
      fetchTimestamp();
      refetchPending();
    } catch {
      setWarpStatus("Failed to warp time");
    }
  };

  // ─── Derived state for selected token ─────────────────
  const needsNftApproval = isNftApproved === false;
  const selectedIndex = tokenIds.findIndex(
    (id) => id.toString() === selectedTokenId
  );
  const selectedLocked =
    selectedIndex >= 0 && tokenDetails?.[selectedIndex * 3]?.status === "success"
      ? (tokenDetails[selectedIndex * 3].result as unknown as [bigint, bigint])
      : null;
  const selectedVP =
    selectedIndex >= 0 &&
    tokenDetails?.[selectedIndex * 3 + 1]?.status === "success"
      ? (tokenDetails[selectedIndex * 3 + 1].result as bigint)
      : null;
  const selectedIsVoting =
    selectedIndex >= 0 &&
    tokenDetails?.[selectedIndex * 3 + 2]?.status === "success"
      ? (tokenDetails[selectedIndex * 3 + 2].result as boolean)
      : null;

  const lockStart = selectedLocked ? Number(selectedLocked[1]) : null;
  const minLockReady =
    lockStart !== null && currentTimestamp !== null
      ? currentTimestamp >= lockStart + MIN_LOCK_SECONDS
      : null;
  const minLockRemaining =
    lockStart !== null && currentTimestamp !== null && !minLockReady
      ? lockStart + MIN_LOCK_SECONDS - currentTimestamp
      : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ink-100">Unstake vKAT</h2>
      <p className="text-ink-400">
        Begin the withdrawal process for your vKAT NFT to reclaim your KAT
        tokens.
      </p>

      {/* ─── Pending Withdrawals ──────────────────────── */}
      {validPendingTokens.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-ink-200">
            Pending Withdrawals
          </h3>
          {validPendingTokens.map((token) => {
            const withdrawalStart = token.createdAt ?? 0;
            const elapsed = currentTimestamp && withdrawalStart ? Math.max(0, currentTimestamp - withdrawalStart) : 0;
            const est = token.locked
              ? feeEstimate(elapsed, token.locked[0], cooldown, maxFeeBps, minFeeBps)
              : null;
            const daysElapsed = Math.floor(elapsed / 86400);
            const daysRemaining = Math.max(0, cooldownDays - daysElapsed);
            const isThisWithdrawing = withdrawingId === token.id && (isWithdrawPending || isWithdrawConfirming);
            const isThisCancelling = cancellingId === token.id && (isCancelPending || isCancelConfirming);

            return (
              <div
                key={token.id}
                className="card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-semibold text-ink-200">
                      vKAT #{token.id}
                    </span>
                  </div>
                  <span className="text-ink-400 text-sm">
                    {token.locked ? fmtEther(token.locked[0]) : "--"} KAT locked
                  </span>
                </div>

                {est && (
                  <div className="space-y-2">
                    {/* Progress bar */}
                    <div className="flex justify-between text-xs text-ink-400">
                      <span>{daysElapsed}d / {cooldownDays}d</span>
                      <span>
                        {est.cooldownDone ? (
                          <span className="text-emerald-400">Cooldown complete</span>
                        ) : (
                          `${daysRemaining}d remaining`
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-ink-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${est.cooldownDone ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(est.ratio * 100, 100)}%` }}
                      />
                    </div>

                    {/* Fee + receive estimate */}
                    <div className="bg-ink-800/50 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">Current fee</span>
                        <span
                          className={
                            est.feePercent > 10
                              ? "text-red-400 font-medium"
                              : est.feePercent > 5
                              ? "text-amber-400 font-medium"
                              : "text-emerald-400 font-medium"
                          }
                        >
                          {est.feePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">Fee</span>
                        <span className="text-red-400">
                          -{est.feeAmount.toFixed(2)} KAT
                        </span>
                      </div>
                      <div className="border-t border-ink-600/50pt-1.5 flex justify-between text-sm">
                        <span className="text-ink-300 font-medium">
                          You receive
                        </span>
                        <span className="text-emerald-400 font-bold text-base">
                          {est.receiveAmount.toFixed(2)} KAT
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <TxError error={withdrawingId === token.id ? withdrawError : null} />
                <TxError error={cancellingId === token.id ? cancelError : null} />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleWithdraw(token.id)}
                    disabled={isThisWithdrawing}
                    className="btn-primary text-sm"
                  >
                    {isThisWithdrawing ? "Processing..." : "Withdraw Now"}
                  </button>
                  <button
                    onClick={() => handleCancel(token.id)}
                    disabled={isThisCancelling}
                    className="btn-danger text-sm"
                  >
                    {isThisCancelling ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isWithdrawConfirmed && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
          <p className="text-emerald-400 font-medium">
            KAT tokens withdrawn successfully!
          </p>
        </div>
      )}

      {isCancelConfirmed && (
        <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-400 font-medium">
            Withdrawal cancelled — NFT returned to your wallet.
          </p>
        </div>
      )}

      {/* ─── Begin New Withdrawal ─────────────────────── */}
      <div className="card space-y-5">
        <h3 className="text-lg font-semibold text-ink-200">
          Begin New Withdrawal
        </h3>

        <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-4">
          <p className="text-sm text-ink-400">
            <span className="text-ink-200 font-medium">Holding avKAT?</span>{" "}
            Convert to vKAT on the Convert tab first, then unstake here.
          </p>
        </div>

        <div>
          <label className="label-text">Select vKAT NFT</label>
          <select
            value={selectedTokenId}
            onChange={(e) => setSelectedTokenId(e.target.value)}
            className="input-field"
          >
            <option value="">
              {tokenIds.length === 0
                ? "No vKAT NFTs in wallet"
                : "Select a token..."}
            </option>
            {tokenIds.map((id) => (
              <option key={id.toString()} value={id.toString()}>
                vKAT #{id.toString()}
              </option>
            ))}
          </select>
        </div>

        {selectedTokenId && selectedLocked && (
          <div className="bg-ink-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">Locked Amount</span>
              <span className="text-ink-200">
                {fmtEther(selectedLocked[0])} KAT
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">Lock Start</span>
              <span className="text-ink-200">
                {new Date(
                  Number(selectedLocked[1]) * 1000
                ).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">Voting Power</span>
              <span className="text-katana-400">
                {selectedVP !== null ? fmtEther(selectedVP) : "--"}
              </span>
            </div>
            {selectedIsVoting && (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2 mt-2">
                <p className="text-xs text-yellow-500">
                  This NFT is currently being used for voting. You must reset
                  votes before withdrawing.
                </p>
              </div>
            )}
            {minLockReady === false && (
              <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-2 mt-2">
                <p className="text-xs text-amber-500">
                  1-day minimum lock period not met. You can begin withdrawal in{" "}
                  <span className="font-medium">
                    {formatDuration(minLockRemaining)}
                  </span>
                  . Use the time warp below to skip ahead.
                </p>
              </div>
            )}
          </div>
        )}

        <TxError error={approveError} />
        <TxError error={beginError} />

        {needsNftApproval ? (
          <button
            onClick={handleApproveNft}
            disabled={isApprovePending || isApproveConfirming || !selectedTokenId}
            className="btn-primary w-full"
          >
            {isApprovePending
              ? "Confirm in Wallet..."
              : isApproveConfirming
              ? "Approving..."
              : "Approve vKAT NFT"}
          </button>
        ) : (
          <button
            onClick={handleBeginWithdrawal}
            disabled={
              isBeginPending ||
              isBeginConfirming ||
              !selectedTokenId ||
              !!selectedIsVoting ||
              minLockReady === false
            }
            className="btn-primary w-full"
          >
            {isBeginPending
              ? "Confirm in Wallet..."
              : isBeginConfirming
              ? "Processing..."
              : "Begin Withdrawal"}
          </button>
        )}
      </div>

      {/* ─── Time Warp (Dev) ──────────────────────────── */}
      <div className="card space-y-3">
        <h4 className="text-sm font-semibold text-ink-200">
          Fast-Forward Time (Dev)
        </h4>
        <p className="text-xs text-ink-400">
          Fast-forward the fork to skip the cooldown. {cooldownDays} days for min fee
          ({(minFeeBps / 100).toFixed(1)}%), or withdraw earlier for a higher fee (up to {(maxFeeBps / 100).toFixed(0)}%).
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            value={warpDays}
            onChange={(e) => setWarpDays(e.target.value)}
            placeholder="Days"
            min="1"
            className="input-field text-sm flex-1"
          />
          <button
            onClick={handleWarp}
            disabled={!warpDays || parseInt(warpDays) <= 0}
            className="btn-secondary text-sm px-4"
          >
            Warp
          </button>
        </div>
        <div className="flex gap-2">
          {[1, 15, 30, 45, 60].map((d) => (
            <button
              key={d}
              onClick={() => setWarpDays(d.toString())}
              className="text-xs bg-ink-800 hover:bg-ink-600 text-ink-400 px-2.5 py-1 rounded transition-colors"
            >
              {d}d
            </button>
          ))}
        </div>
        {warpStatus && (
          <p className="text-xs text-emerald-400">{warpStatus}</p>
        )}
      </div>
    </div>
  );
}
