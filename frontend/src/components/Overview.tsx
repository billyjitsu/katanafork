"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { fmtEther } from "@/lib/format";

function formatCompact(wei: bigint): string {
  const num = Number(formatEther(wei));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(2);
}
import { CONTRACTS } from "@/config/contracts";
import {
  katAbi,
  votingEscrowAbi,
  avkatVaultAbi,
} from "@/config/abis";

const RPC_URL = "http://127.0.0.1:8545";
const KAT_ADDRESS = CONTRACTS.KAT;

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

export function Overview() {
  const { address } = useAccount();
  const [ethAmount, setEthAmount] = useState("10");
  const [katAmount, setKatAmount] = useState("100000");
  const [faucetStatus, setFaucetStatus] = useState("");

  const { data: katBalance } = useReadContract({
    address: CONTRACTS.KAT,
    abi: katAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: avkatBalance } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: ownedTokens } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "ownedTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalVotingPower } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "votingPowerForAccount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalLocked } = useReadContract({
    address: CONTRACTS.VOTING_ESCROW,
    abi: votingEscrowAbi,
    functionName: "totalLocked",
  });

  const { data: vaultTotalAssets } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "totalAssets",
  });

  const { data: avkatUnderlying } = useReadContract({
    address: CONTRACTS.AVKAT_VAULT,
    abi: avkatVaultAbi,
    functionName: "convertToAssets",
    args: avkatBalance ? [avkatBalance] : undefined,
    query: { enabled: !!avkatBalance && avkatBalance > 0n },
  });

  const handleMintEth = async () => {
    if (!address) return;
    try {
      setFaucetStatus("Minting ETH...");
      const wei = parseEther(ethAmount);
      await rpcCall("anvil_setBalance", [address, "0x" + wei.toString(16)]);
      await rpcCall("evm_mine", []);
      setFaucetStatus(`Set balance to ${ethAmount} ETH`);
    } catch {
      setFaucetStatus("Failed to mint ETH");
    }
  };

  const handleMintKat = async () => {
    if (!address) return;
    try {
      setFaucetStatus("Minting KAT...");
      const { keccak256, encodeAbiParameters, parseAbiParameters } =
        await import("viem");
      const wei = parseEther(katAmount);
      const hex = "0x" + wei.toString(16).padStart(64, "0");
      const slot = keccak256(
        encodeAbiParameters(parseAbiParameters("address, uint256"), [
          address,
          0n,
        ])
      );
      await rpcCall("anvil_setStorageAt", [KAT_ADDRESS, slot, hex]);
      await rpcCall("evm_mine", []);
      setFaucetStatus(`Set balance to ${katAmount} KAT`);
    } catch {
      setFaucetStatus("Failed to mint KAT");
    }
  };

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink-100">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">KAT Balance</p>
          <p className="text-2xl font-bold text-ink-100">
            {katBalance !== undefined ? fmtEther(katBalance) : "--"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">vKAT NFTs</p>
          <p className="text-2xl font-bold text-ink-100">
            {tokenIds.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">avKAT Shares</p>
          <p className="text-2xl font-bold text-ink-100">
            {avkatBalance !== undefined ? fmtEther(avkatBalance) : "--"}
          </p>
          {avkatUnderlying !== undefined && avkatUnderlying > 0n && (
            <p className="text-xs text-ink-400 mt-1">
              ~{fmtEther(avkatUnderlying)} KAT underlying
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">Total Voting Power</p>
          <p className="text-2xl font-bold text-katana-500">
            {totalVotingPower !== undefined
              ? fmtEther(totalVotingPower)
              : "--"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">Total vKAT Locked</p>
          <p className="text-xl font-semibold text-ink-100">
            {totalLocked !== undefined ? formatCompact(totalLocked) : "--"} KAT
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-400 mb-1">Total avKAT Assets</p>
          <p className="text-xl font-semibold text-ink-100">
            {vaultTotalAssets !== undefined
              ? formatCompact(vaultTotalAssets)
              : "--"}{" "}
            KAT
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-ink-200">Faucet (Dev)</h3>
        <p className="text-xs text-ink-400">
          Set your connected wallet&apos;s ETH or KAT balance on the local fork.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="label-text">ETH Amount</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="input-field text-sm flex-1"
              />
              <button onClick={handleMintEth} className="btn-primary text-sm px-4">
                Set ETH
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="label-text">KAT Amount</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={katAmount}
                onChange={(e) => setKatAmount(e.target.value)}
                className="input-field text-sm flex-1"
              />
              <button onClick={handleMintKat} className="btn-primary text-sm px-4">
                Set KAT
              </button>
            </div>
          </div>
        </div>
        {faucetStatus && (
          <p className="text-xs text-emerald-400">{faucetStatus}</p>
        )}

      </div>

      {tokenIds.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-ink-200 mb-4">
            Your vKAT NFTs
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink-700/30">
                  <th className="pb-3 text-sm font-medium text-ink-400">
                    Token ID
                  </th>
                  <th className="pb-3 text-sm font-medium text-ink-400">
                    Locked Amount
                  </th>
                  <th className="pb-3 text-sm font-medium text-ink-400">
                    Lock Start
                  </th>
                  <th className="pb-3 text-sm font-medium text-ink-400">
                    Voting Power
                  </th>
                </tr>
              </thead>
              <tbody>
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
                    <tr
                      key={tokenId.toString()}
                      className="border-b border-ink-700/30"
                    >
                      <td className="py-3 text-ink-200 font-mono">
                        #{tokenId.toString()}
                      </td>
                      <td className="py-3 text-ink-300">
                        {locked ? fmtEther(locked[0]) : "--"} KAT
                      </td>
                      <td className="py-3 text-ink-400 text-sm">
                        {locked
                          ? new Date(
                              Number(locked[1]) * 1000
                            ).toLocaleDateString()
                          : "--"}
                      </td>
                      <td className="py-3 text-katana-400">
                        {vp !== null ? fmtEther(vp) : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
