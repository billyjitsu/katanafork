"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { katanaFork } from "@/config/chain";
import { Overview } from "@/components/Overview";
import { StakeKAT } from "@/components/StakeKAT";
import { DepositAvKAT } from "@/components/DepositAvKAT";
import { ConvertTokens } from "@/components/ConvertTokens";
import { MergeVKAT } from "@/components/MergeVKAT";
import { UnstakeVKAT } from "@/components/UnstakeVKAT";
import { VoteOnGauges } from "@/components/VoteOnGauges";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "stake", label: "vKAT" },
  { id: "vault", label: "avKAT" },
  { id: "convert", label: "Convert" },
  { id: "merge", label: "Merge / Split" },
  { id: "unstake", label: "Unstake" },
  { id: "vote", label: "Vote" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== katanaFork.id;

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-ink-700/30 bg-ink-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight text-white">
                Katana KAT
              </span>
              <span className="text-xs bg-katana-500/15 text-katana-500 px-2.5 py-0.5 rounded-full font-medium">
                Fork
              </span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {isWrongChain && (
        <div className="bg-red-900/30 border-b border-red-800/50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-300">
              Wrong network (chain {chainId}). Please switch to Katana Fork (chain {katanaFork.id}).
            </p>
            <button
              onClick={() => switchChain({ chainId: katanaFork.id })}
              className="text-sm bg-red-800/80 hover:bg-red-700 text-white px-3 py-1 rounded-full transition-colors"
            >
              Switch Network
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="card text-center py-20">
            <h2 className="text-3xl font-bold text-white mb-3">
              Welcome to Katana
            </h2>
            <p className="text-ink-300 mb-8 max-w-md mx-auto">
              Connect your wallet to interact with the KAT ecosystem on your local fork.
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <>
            <nav className="flex gap-1 mb-8 bg-ink-900/50 rounded-full p-1 border border-ink-700/30 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-katana-500 text-white shadow-lg shadow-katana-500/20"
                      : "text-ink-300 hover:text-white hover:bg-ink-700/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div>
              {activeTab === "overview" && <Overview />}
              {activeTab === "stake" && <StakeKAT />}
              {activeTab === "vault" && <DepositAvKAT />}
              {activeTab === "convert" && <ConvertTokens />}
              {activeTab === "merge" && <MergeVKAT />}
              {activeTab === "unstake" && <UnstakeVKAT />}
              {activeTab === "vote" && <VoteOnGauges />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
