"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import {
  katAbi,
  votingEscrowAbi,
  avkatVaultAbi,
  nftLockAbi,
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
  const [ethAmount, setEthAmount] = useState("100");
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

  const { data: escrowApproved } = useReadContract({
    address: CONTRACTS.NFT_LOCK,
    abi: nftLockAbi,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACTS.VOTING_ESCROW] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: approveEscrow,
    data: approveEscrowTxHash,
    isPending: isApprovingEscrow,
  } = useWriteContract();

  const {
    isLoading: isApproveEscrowConfirming,
    isSuccess: isApproveEscrowConfirmed,
  } = useWaitForTransactionReceipt({ hash: approveEscrowTxHash });

  const handleApproveEscrow = () => {
    approveEscrow({
      address: CONTRACTS.NFT_LOCK,
      abi: nftLockAbi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.VOTING_ESCROW, true],
    });
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
      <h2 className="text-2xl font-bold text-zinc-100">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">KAT Balance</p>
          <p className="text-2xl font-bold text-zinc-100">
            {katBalance !== undefined ? formatEther(katBalance) : "--"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">vKAT NFTs</p>
          <p className="text-2xl font-bold text-zinc-100">
            {tokenIds.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">avKAT Shares</p>
          <p className="text-2xl font-bold text-zinc-100">
            {avkatBalance !== undefined ? formatEther(avkatBalance) : "--"}
          </p>
          {avkatUnderlying !== undefined && avkatUnderlying > 0n && (
            <p className="text-xs text-zinc-500 mt-1">
              ~{formatEther(avkatUnderlying)} KAT underlying
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">Total Voting Power</p>
          <p className="text-2xl font-bold text-emerald-500">
            {totalVotingPower !== undefined
              ? formatEther(totalVotingPower)
              : "--"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">Protocol Total Locked</p>
          <p className="text-xl font-semibold text-zinc-100">
            {totalLocked !== undefined ? formatEther(totalLocked) : "--"} KAT
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-zinc-500 mb-1">Vault Total Assets</p>
          <p className="text-xl font-semibold text-zinc-100">
            {vaultTotalAssets !== undefined
              ? formatEther(vaultTotalAssets)
              : "--"}{" "}
            KAT
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-zinc-200">Faucet (Dev)</h3>
        <p className="text-xs text-zinc-500">
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

        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Escrow NFT Approval
              </p>
              <p className="text-xs text-zinc-500">
                Required for unstaking vKAT. Allows the escrow to transfer your
                NFT during withdrawal.
              </p>
            </div>
            {escrowApproved ? (
              <span className="text-xs text-emerald-400 font-medium px-3 py-1 bg-emerald-900/30 rounded-lg">
                Approved
              </span>
            ) : (
              <button
                onClick={handleApproveEscrow}
                disabled={isApprovingEscrow || isApproveEscrowConfirming}
                className="btn-primary text-sm px-4"
              >
                {isApprovingEscrow
                  ? "Confirm..."
                  : isApproveEscrowConfirming
                  ? "Approving..."
                  : "Approve"}
              </button>
            )}
          </div>
          {isApproveEscrowConfirmed && !escrowApproved && (
            <p className="text-xs text-emerald-400">Escrow approved!</p>
          )}
        </div>
      </div>

      {tokenIds.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-zinc-200 mb-4">
            Your vKAT NFTs
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 text-sm font-medium text-zinc-500">
                    Token ID
                  </th>
                  <th className="pb-3 text-sm font-medium text-zinc-500">
                    Locked Amount
                  </th>
                  <th className="pb-3 text-sm font-medium text-zinc-500">
                    Lock Start
                  </th>
                  <th className="pb-3 text-sm font-medium text-zinc-500">
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
                      className="border-b border-zinc-800/50"
                    >
                      <td className="py-3 text-zinc-200 font-mono">
                        #{tokenId.toString()}
                      </td>
                      <td className="py-3 text-zinc-300">
                        {locked ? formatEther(locked[0]) : "--"} KAT
                      </td>
                      <td className="py-3 text-zinc-400 text-sm">
                        {locked
                          ? new Date(
                              Number(locked[1]) * 1000
                            ).toLocaleDateString()
                          : "--"}
                      </td>
                      <td className="py-3 text-emerald-400">
                        {vp !== null ? formatEther(vp) : "--"}
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
