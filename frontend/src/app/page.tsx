"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Overview } from "@/components/Overview";
import { StakeKAT } from "@/components/StakeKAT";
import { DepositAvKAT } from "@/components/DepositAvKAT";
import { ConvertTokens } from "@/components/ConvertTokens";
import { UnstakeVKAT } from "@/components/UnstakeVKAT";
import { VoteOnGauges } from "@/components/VoteOnGauges";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "stake", label: "vKAT" },
  { id: "vault", label: "avKAT" },
  { id: "convert", label: "Convert" },
  { id: "unstake", label: "Unstake" },
  { id: "vote", label: "Vote" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-emerald-500">
                Katana Dashboard
              </h1>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                Local Fork
              </span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="card text-center py-16">
            <h2 className="text-2xl font-bold text-zinc-300 mb-3">
              Welcome to Katana
            </h2>
            <p className="text-zinc-500 mb-6">
              Connect your wallet to interact with the KAT ecosystem.
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <>
            <nav className="flex gap-1 mb-8 bg-zinc-900 rounded-xl p-1.5 border border-zinc-800 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
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
              {activeTab === "unstake" && <UnstakeVKAT />}
              {activeTab === "vote" && <VoteOnGauges />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
