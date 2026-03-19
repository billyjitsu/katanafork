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
import { fmtEther } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import {
  votingEscrowAbi,
  gaugeVoterAbi,
  ivotesAdapterAbi,
} from "@/config/abis";
import { TxError } from "./TxError";

// Filter out dummy/test gauges (low addresses used in dev setup)
function isRealGauge(addr: string): boolean {
  return BigInt(addr) > 0xffffn;
}

// Gauge names resolved from on-chain IPFS metadata
const GAUGE_NAMES: Record<string, string> = {
  "0x2a2c512beaa8eb15495726c235472d82effb7a6b": "USDC/ETH 5bps",
  "0x744676b3ced942d78f9b8e9cd22246db5c32395c": "WBTC/USDC 5bps",
  "0x5f88eeb3a5662489eb2d5da9f0c73f03355f3009": "USDC/USDT 1bp",
  "0x5ee63f441aa80e8c8d3ba80df8371754c052b027": "USDT/ETH 30bps",
  "0x105f833d8522f33d8dc3e9599455e9412b63d049": "USDC/ETH 30bps",
  "0x401489b205fa340f7e120aafd00694ec506d0e7f": "POL/ETH 5bps",
  "0x02cdd2dd00e1e0900ec03267cf16e6170ff7b05b": "AUSD/USDC 1bp",
  "0x8d6daef922532571e33924dccc5aa09edd9eef77": "WBTC/ETH 30bps",
  "0x4488005fd5eea2e22a80cb2a0e820ed6066e687f": "WBTC/USDC 30bps",
  "0x40aa031a01b8a2db94962e571a47d68139053dd4": "KAI/USDC 1bp",
  "0x03010431e7adc5ebb1d364a680ad1cea049132b0": "WBTC/KAI 30bps",
  "0xf7e78bd15c8c8747cc032fc0d5fdc001aa7a5261": "YFI/ETH 30bps",
  "0xa522683ece4b864a505cc7d4f65faefc93e72f38": "AUSD/ETH 30bps",
  "0x42c00599d9008e56e4e2e570ca27ea46eae5d89a": "MORPHO/ETH 30bps",
  "0x932ed6a5e76d772799f8fddd95a3707f698fe2d0": "uSOL/ETH 30bps",
  "0x1ddc6d10b4108e33bb1f90e1c67504287566e1ce": "uSOL/ETH 30bps",
  "0x3134594109e8fa40179d639ff88a071263dc4076": "JitoSOL/uSOL 1bp",
  "0xdfc0ba24be7f93bf1a9401635815ece4cc579282": "weETH/ETH 5bps",
  "0x0a2e4519ac308dddaa3c531f320b5d82e4fa84c3": "WBTC/LBTC 5bps",
  "0x9c6779f6fc6cba48496c9a02ca855dac46e322bf": "WBTC/KAI 0.1bp",
  "0x53bb89297d2e2e2726fbc3b9a663555708519647": "WBTC/BTC.b 5bps",
  "0xa9be90ff6dbb42fd55fe8f4446cf956ac7975872": "PEPE/ETH 1bp",
  "0x6d7fcdce5afc40caff96bc34465ae276073eb089": "LINK/ETH 1bp",
  "0xa452a726f2066b15dab04764017cfc4d997cab40": "wstETH/ETH 1bp",
  "0x845fe91f01e3de32afa6c739622fd92100a2a358": "WBTC/KAI 5bps",
  "0x6205751b4cced5ac88a03329722a21162cd5d2b5": "BTC.b/LBTC 1bp",
  "0x2a03e9059231eb0d991c7207fec0b497dad0aacd": "AUSD/frxUSD 1bp",
  "0xbf22bbc5c9111ca953d26ed99c8f5017d2f1bf81": "sfrxUSD/frxUSD 1bp",
  "0xa9d2dcc7581dd96c4851afb04463ddb65a4b0d87": "USDC/sYUSD 5bps",
  "0x1327cd81cd185ed21b8caf13eec022da29ab43f0": "USDC/dUSD 1bp",
  "0x8ab12bfb374dd52a47e48246a4dd8650d96153d8": "ETH/KITSU 30bps",
  "0x53804a1b515c04161f96323e0efc42d2705842a6": "BUSHIDO/ETH 30bps",
  "0x317d7716f414fae4a3c0845f6ecef0ab149dbe1f": "USDC/UTY 1bp",
  "0x6d8a30f4b2501de8f0b443cb11eb512f12d5355f": "KAT/USDC 30bps",
  "0xae4fb0a3ab3a929b332e1ff5adc1897d7204cf6b": "KAT/USDC 5bps",
};

export function VoteOnGauges() {
  const { address } = useAccount();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  const { data: allGauges } = useReadContract({
    address: CONTRACTS.GAUGE_VOTER,
    abi: gaugeVoterAbi,
    functionName: "getAllGauges",
  });

  const gauges = (allGauges ?? []).filter((g) => isRealGauge(g));

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
    error: delegateError,
  } = useWriteContract();

  const { isLoading: isDelegateConfirming, isSuccess: isDelegateConfirmed } =
    useWaitForTransactionReceipt({ hash: delegateTxHash });

  const {
    writeContract: vote,
    data: voteTxHash,
    isPending: isVotePending,
    error: voteError,
    reset: resetVoteTx,
  } = useWriteContract();

  const { isLoading: isVoteConfirming, isSuccess: isVoteConfirmed } =
    useWaitForTransactionReceipt({ hash: voteTxHash });

  const {
    writeContract: resetVotes,
    data: resetTxHash,
    isPending: isResetPending,
    error: resetError,
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
      <h2 className="text-2xl font-bold text-ink-100">Vote on Gauges</h2>
      <p className="text-ink-400">
        Allocate your voting power across gauges. Weights must sum to 10,000
        (100%).
      </p>
      <div className="bg-ink-800/50 border border-ink-600/30 rounded-lg p-4">
        <p className="text-sm text-ink-400">
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

        <div className="bg-ink-800/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-ink-400">Your Voting Power (Escrow)</span>
            <span className="text-ink-200">
              {votingPower !== undefined ? fmtEther(votingPower) : "--"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-400">Delegated Votes (Adapter)</span>
            <span className="text-ink-200">
              {adapterVotes !== undefined ? fmtEther(adapterVotes) : "--"}
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
                    : "text-ink-400"
                }`}
              >
                {totalWeight} / 10,000
              </span>
            </div>

            {(expanded ? gauges : gauges.slice(0, 5)).map((gauge, i) => {
              const gaugeIndex = expanded ? i : i;
              const actualIndex = gauges.indexOf(gauge);
              const votes =
                gaugeVotesData?.[actualIndex]?.status === "success"
                  ? (gaugeVotesData[actualIndex].result as bigint)
                  : null;

              return (
                <div
                  key={gauge}
                  className="bg-ink-800/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink-200">
                        {GAUGE_NAMES[gauge.toLowerCase()] ??
                          `${gauge.slice(0, 6)}...${gauge.slice(-4)}`}
                      </p>
                      <p className="text-xs text-ink-500 font-mono">
                        {gauge.slice(0, 6)}...{gauge.slice(-4)}
                      </p>
                      {votes !== null && (
                        <p className="text-xs text-ink-400">
                          Current votes: {fmtEther(votes)}
                        </p>
                      )}
                    </div>
                    <div className="w-36 relative">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={weights[gauge] || ""}
                        onChange={(e) =>
                          handleWeightChange(gauge, e.target.value)
                        }
                        placeholder="0"
                        className="input-field text-right text-sm pr-12"
                      />
                      <button
                        onClick={() => {
                          setWeights({ [gauge]: "10000" });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-katana-500 hover:text-katana-400 font-medium"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {gauges.length > 5 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-ink-400 hover:text-ink-200 transition-colors"
              >
                <span>{expanded ? "Show less" : `Show all ${gauges.length} gauges`}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        )}

        <TxError error={delegateError} />
        <TxError error={voteError} />
        <TxError error={resetError} />

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
