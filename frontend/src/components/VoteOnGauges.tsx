"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import {
  votingEscrowAbi,
  gaugeVoterAbi,
  ivotesAdapterAbi,
} from "@/config/abis";

const TEST_GAUGES: `0x${string}`[] = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
];

const GAUGE_NAMES: Record<string, string> = {
  "0x0000000000000000000000000000000000000001": "ETH / USDC",
  "0x0000000000000000000000000000000000000002": "WBTC / USDC",
  "0x0000000000000000000000000000000000000003": "KAT / ETH",
};

export function VoteOnGauges() {
  const { address } = useAccount();
  const [weights, setWeights] = useState<Record<string, string>>({});

  const gauges = TEST_GAUGES;

  const { data: votingPower } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "votingPowerForAccount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: adapterVotes } = useReadContract({
    address: CONTRACTS.IVOTES_ADAPTER,
    abi: ivotesAdapterAbi,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: delegatee } = useReadContract({
    address: CONTRACTS.IVOTES_ADAPTER,
    abi: ivotesAdapterAbi,
    functionName: "delegates",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: votingIsActive } = useReadContract({
    address: CONTRACTS.GAUGE_VOTER,
    abi: gaugeVoterAbi,
    functionName: "votingActive",
  });

  const { data: gaugeVotesData } = useReadContracts({
    contracts: gauges.map((gauge) => ({
      address: CONTRACTS.GAUGE_VOTER,
      abi: gaugeVoterAbi,
      functionName: "gaugeVotes" as const,
      args: [gauge] as const,
    })),
  });

  const {
    writeContract: delegateVotes,
    data: delegateTxHash,
    isPending: isDelegating,
  } = useWriteContract();

  const { isLoading: isDelegateConfirming, isSuccess: isDelegateConfirmed } =
    useWaitForTransactionReceipt({ hash: delegateTxHash });

  const {
    writeContract: vote,
    data: voteTxHash,
    isPending: isVotePending,
    reset: resetVoteTx,
  } = useWriteContract();

  const { isLoading: isVoteConfirming, isSuccess: isVoteConfirmed } =
    useWaitForTransactionReceipt({ hash: voteTxHash });

  const {
    writeContract: resetVotes,
    data: resetTxHash,
    isPending: isResetPending,
  } = useWriteContract();

  const { isLoading: isResetConfirming, isSuccess: isResetConfirmed } =
    useWaitForTransactionReceipt({ hash: resetTxHash });

  const needsDelegation =
    address &&
    delegatee &&
    delegatee !== address &&
    delegatee === "0x0000000000000000000000000000000000000000";

  const totalWeight = Object.values(weights).reduce(
    (sum, w) => sum + (parseInt(w) || 0),
    0
  );

  const handleDelegate = () => {
    if (!address) return;
    delegateVotes({
      address: CONTRACTS.IVOTES_ADAPTER,
      abi: ivotesAdapterAbi,
      functionName: "delegate",
      args: [address],
    });
  };

  const handleVote = () => {
    if (totalWeight === 0) return;

    const voteArgs: { weight: bigint; gauge: `0x${string}` }[] = [];
    for (const [gauge, weight] of Object.entries(weights)) {
      const w = parseInt(weight);
      if (w > 0) {
        voteArgs.push({
          weight: BigInt(w),
          gauge: gauge as `0x${string}`,
        });
      }
    }

    vote({
      address: CONTRACTS.GAUGE_VOTER,
      abi: gaugeVoterAbi,
      functionName: "vote",
      args: [voteArgs],
    });
  };

  const handleReset = () => {
    resetVotes({
      address: CONTRACTS.GAUGE_VOTER,
      abi: gaugeVoterAbi,
      functionName: "reset",
      args: [],
    });
  };

  const handleWeightChange = (gauge: string, value: string) => {
    setWeights((prev) => ({ ...prev, [gauge]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Vote on Gauges</h2>
      <p className="text-zinc-400">
        Allocate your voting power across gauges. Weights must sum to 10,000
        (100%).
      </p>
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">
          To change your vote, submit a new allocation. To remove your vote
          entirely, click{" "}
          <span className="text-red-400 font-medium">Reset Votes</span> — this
          clears all gauge allocations and frees your voting power.
        </p>
      </div>

      <div className="card space-y-5">
        {!votingIsActive && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
            <p className="text-sm text-yellow-400">
              Voting is not currently active. Use the time warp on the Unstake
              tab to advance into the next voting window.
            </p>
          </div>
        )}

        <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Your Voting Power (Escrow)</span>
            <span className="text-zinc-200">
              {votingPower !== undefined ? formatEther(votingPower) : "--"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Delegated Votes (Adapter)</span>
            <span className="text-zinc-200">
              {adapterVotes !== undefined ? formatEther(adapterVotes) : "--"}
            </span>
          </div>
        </div>

        {needsDelegation && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
            <p className="text-sm text-yellow-400 mb-3">
              You need to delegate your votes to yourself before voting. This is
              a one-time action.
            </p>
            <button
              onClick={handleDelegate}
              disabled={isDelegating || isDelegateConfirming}
              className="btn-primary text-sm"
            >
              {isDelegating
                ? "Confirm in Wallet..."
                : isDelegateConfirming
                ? "Delegating..."
                : "Delegate to Self"}
            </button>
            {isDelegateConfirmed && (
              <p className="text-xs text-emerald-400 mt-2">
                Delegation successful!
              </p>
            )}
          </div>
        )}

        {gauges.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label-text mb-0">Gauge Weights</label>
              <span
                className={`text-sm font-medium ${
                  totalWeight === 10000
                    ? "text-emerald-400"
                    : totalWeight > 10000
                    ? "text-red-400"
                    : "text-zinc-400"
                }`}
              >
                {totalWeight} / 10,000
              </span>
            </div>

            {gauges.map((gauge, i) => {
              const votes =
                gaugeVotesData?.[i]?.status === "success"
                  ? (gaugeVotesData[i].result as bigint)
                  : null;

              return (
                <div
                  key={gauge}
                  className="bg-zinc-800/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {GAUGE_NAMES[gauge.toLowerCase()] ??
                          `${gauge.slice(0, 6)}...${gauge.slice(-4)}`}
                      </p>
                      {votes !== null && (
                        <p className="text-xs text-zinc-500">
                          Current votes: {formatEther(votes)}
                        </p>
                      )}
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={weights[gauge] || ""}
                        onChange={(e) =>
                          handleWeightChange(gauge, e.target.value)
                        }
                        placeholder="0"
                        className="input-field text-right text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleVote}
            disabled={
              isVotePending ||
              isVoteConfirming ||
              totalWeight !== 10000 ||
              !votingIsActive
            }
            className="btn-primary"
          >
            {isVotePending
              ? "Confirm in Wallet..."
              : isVoteConfirming
              ? "Voting..."
              : "Submit Vote"}
          </button>

          <button
            onClick={handleReset}
            disabled={isResetPending || isResetConfirming}
            className="btn-danger"
          >
            {isResetPending
              ? "Confirm in Wallet..."
              : isResetConfirming
              ? "Resetting..."
              : "Reset Votes"}
          </button>
        </div>

        {isVoteConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <p className="text-emerald-400 font-medium">
              Vote submitted successfully!
            </p>
            <button
              onClick={() => {
                setWeights({});
                resetVoteTx();
              }}
              className="btn-secondary mt-3 text-sm"
            >
              Vote Again
            </button>
          </div>
        )}

        {isResetConfirmed && (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-400 font-medium">Votes reset.</p>
          </div>
        )}
      </div>
    </div>
  );
}
