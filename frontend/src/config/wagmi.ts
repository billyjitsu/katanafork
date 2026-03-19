import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http } from "wagmi";
import { katanaFork } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Katana KAT Simulation Tool",
  projectId: "00000000000000000000000000000000",
  chains: [katanaFork],
  transports: {
    [katanaFork.id]: http("http://127.0.0.1:8545"),
  },
  wallets: [
    {
      groupName: "Local",
      wallets: [injectedWallet, metaMaskWallet, coinbaseWallet],
    },
  ],
  ssr: true,
});
