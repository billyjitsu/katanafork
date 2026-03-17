import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { katanaFork } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Katana Dashboard",
  projectId: "00000000000000000000000000000000",
  chains: [katanaFork],
  transports: {
    [katanaFork.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
