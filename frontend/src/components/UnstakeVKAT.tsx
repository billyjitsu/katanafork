"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { votingEscrowAbi } from "@/config/abis";

const RPC_URL = "http://127.0.0.1:8545";

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

export function UnstakeVKAT() {
  const { address } = useAccount();
  const [selectedTokenId, setSelectedTokenId] = useState("");

  const { data: ownedTokens } = useReadContract({
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

  const {
    writeContract: beginWithdrawal,
    data: beginTxHash,
    isPending: isBeginPending,
  } = useWriteContract();

  const { isLoading: isBeginConfirming, isSuccess: isBeginConfirmed } =
    useWaitForTransactionReceipt({ hash: beginTxHash });

  const {
    writeContract: withdraw,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  const {
    writeContract: cancelWithdrawal,
    data: cancelTxHash,
    isPending: isCancelPending,
  } = useWriteContract();

  const { isLoading: isCancelConfirming, isSuccess: isCancelConfirmed } =
    useWaitForTransactionReceipt({ hash: cancelTxHash });

  const [warpDays, setWarpDays] = useState("");
  const [warpStatus, setWarpStatus] = useState("");
  const [withdrawalStart, setWithdrawalStart] = useState<number | null>(null);

  useEffect(() => {
    if (isBeginConfirmed && beginTxHash) {
      (async () => {
        try {
          const blockRes = await rpcCall("eth_getBlockByNumber", [
            "latest",
            false,
          ]);
          const ts = parseInt(blockRes.result.timestamp, 16);
          setWithdrawalStart(ts);
        } catch {}
      })();
    }
  }, [isBeginConfirmed, beginTxHash]);

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
    } catch {
      setWarpStatus("Failed to warp time");
    }
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

  const handleWithdraw = () => {
    if (!selectedTokenId) return;
    withdraw({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "withdraw",
      args: [BigInt(selectedTokenId)],
    });
  };

  const handleCancel = () => {
    if (!selectedTokenId) return;
    cancelWithdrawal({
      address: CONTRACTS.VOTING_ESCROW,
      abi: votingEscrowAbi,
      functionName: "cancelWithdrawalRequest",
      args: [BigInt(selectedTokenId)],
    });
  };

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

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Unstake vKAT</h2>
      <p className="text-zinc-400">
        Begin the withdrawal process for your vKAT NFT to reclaim your KAT
        tokens.
      </p>
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-200 font-medium">Holding avKAT?</span>{" "}
          You can sell avKAT directly on a DEX, or convert it to vKAT on the
          Convert tab and then start the unstaking process here.
        </p>
      </div>

      <div className="card space-y-5">
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
        </div>

        {selectedTokenId && selectedLocked && (
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Locked Amount</span>
              <span className="text-zinc-200">
                {formatEther(selectedLocked[0])} KAT
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Lock Start</span>
              <span className="text-zinc-200">
                {new Date(
                  Number(selectedLocked[1]) * 1000
                ).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Voting Power</span>
              <span className="text-emerald-400">
                {selectedVP !== null ? formatEther(selectedVP) : "--"}
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
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={handleBeginWithdrawal}
            disabled={
              isBeginPending ||
              isBeginConfirming ||
              !selectedTokenId ||
              !!selectedIsVoting
            }
            className="btn-primary w-full"
          >
            {isBeginPending
              ? "Confirm in Wallet..."
              : isBeginConfirming
              ? "Processing..."
              : "Begin Withdrawal"}
          </button>

          <button
            onClick={handleWithdraw}
            disabled={
              isWithdrawPending || isWithdrawConfirming || !selectedTokenId
            }
            className="btn-secondary w-full"
          >
            {isWithdrawPending
              ? "Confirm in Wallet..."
              : isWithdrawConfirming
              ? "Processing..."
              : "Withdraw (after cooldown)"}
          </button>

          <button
            onClick={handleCancel}
            disabled={
              isCancelPending || isCancelConfirming || !selectedTokenId
            }
            className="btn-danger w-full"
          >
            {isCancelPending
              ? "Confirm in Wallet..."
              : isCancelConfirming
              ? "Processing..."
              : "Cancel Withdrawal Request"}
          </button>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-zinc-200">
            Fast-Forward Time (Dev)
          </h4>
          <p className="text-xs text-zinc-500">
            After beginning withdrawal, fast-forward the fork to skip the
            cooldown. Use 45 days for minimum fee (2.5%) or withdraw earlier for
            a higher fee.
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
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2.5 py-1 rounded transition-colors"
              >
                {d}d
              </button>
            ))}
          </div>
          {warpStatus && (
            <p className="text-xs text-emerald-400">{warpStatus}</p>
          )}
        </div>

        {isBeginConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4 space-y-2">
            <p className="text-emerald-400 font-medium">
              Withdrawal process started!
            </p>
            {withdrawalStart && (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cooldown started</span>
                  <span className="text-zinc-200">
                    {new Date(withdrawalStart * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Min fee withdraw (45d)</span>
                  <span className="text-zinc-200">
                    {new Date(
                      (withdrawalStart + 45 * 86400) * 1000
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Rage quit fee</span>
                  <span className="text-red-400">~25%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Full cooldown fee</span>
                  <span className="text-emerald-400">~2.5%</span>
                </div>
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              Use the time warp below to fast-forward, then click &quot;Withdraw
              (after cooldown)&quot;.
            </p>
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
              Withdrawal request cancelled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
