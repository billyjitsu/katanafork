import { defineChain } from "viem";

export const katanaFork = defineChain({
  id: 747474,
  name: "Katana Fork",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});
