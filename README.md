# Katana Fork

A lightweight repo for testing dapps against the KAT ecosystem on a local Anvil fork. Fork it, run locally, and explore staking, voting, and converting between KAT, vKAT, and avKAT.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, anvil, cast)
- [Node.js](https://nodejs.org/) >= 18
- Python 3 (for Makefile hex math)

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Start the local Anvil fork (background)
make fork

# 3. Start the frontend
make dev
```

Open [http://localhost:3000](http://localhost:3000) and connect with MetaMask.

## MetaMask Setup

| Setting | Value |
|---------|-------|
| Network Name | Katana Fork |
| RPC URL | http://localhost:8545 |
| Chain ID | 747474 |
| Currency Symbol | ETH |
| KAT Token | `0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d` |

**Use your own wallet** — connect any MetaMask wallet and use the built-in Faucet on the Dashboard to give yourself ETH and KAT. No need to import test private keys.

If you prefer pre-funded Anvil wallets, these are available:

| Wallet | Address | Private Key |
|--------|---------|-------------|
| Alice | `0xf39Fd...92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Bob | `0x70997...c79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Carol | `0x3C44C...93BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

## What's Inside

### Token Flows

| Flow | Description |
|------|-------------|
| **KAT -> vKAT** | Stake KAT into VotingEscrow, get a non-transferable NFT with voting power |
| **KAT -> avKAT** | Deposit KAT into the ERC-4626 vault for auto-compounding |
| **vKAT -> avKAT** | Convert your vKAT NFT into liquid avKAT vault shares |
| **avKAT -> vKAT** | Redeem avKAT back to a vKAT NFT |
| **vKAT -> KAT** | Begin withdrawal (cooldown + exit fee read dynamically from the Exit Queue contract) |
| **avKAT exit** | Sell on DEX, or convert to vKAT and unstake |

### Project Structure

```
├── Makefile              # Top-level commands
├── foundry/              # Solidity tests + fork setup
│   ├── src/              # Interfaces + config
│   ├── test/             # Forge tests covering all flows
│   ├── script/           # Anvil setup script
│   └── Makefile          # Foundry-specific commands
└── frontend/             # Next.js 16 + wagmi v2 + RainbowKit + Tailwind v4
    └── src/
        ├── app/          # Pages + providers + global styles
        ├── components/   # UI for each flow
        ├── config/       # Chain, contracts, ABIs, wagmi config
        └── lib/          # Shared utilities (formatting)
```

### Forge Tests

| Test File | Scenarios |
|-----------|-----------|
| `01_StakeToVKAT` | createLock, createLockFor, multiple locks |
| `02_StakeToAvKAT` | deposit, exchange rate, multiple deposits, transferability |
| `03_VoteOnGauges` | single voter, multiple voters |
| `04_UnstakeVKAT` | standard (60d), rage quit, early withdrawal, cancel |
| `05_ConvertVKATToAvKAT` | vKAT->avKAT, avKAT->vKAT |
| `06_FullLifecycle` | active path, passive path, conversion, combined |

## Commands

```bash
make install              # Install all dependencies
make fork                 # Start Anvil fork + apply state changes
make dev                  # Start frontend dev server
make test                 # Run Forge tests
make stop                 # Stop Anvil
make fund ADDR=0x...      # Fund any address with KAT
make warp DAYS=60         # Fast-forward time (e.g., skip cooldown)
make balances             # Check test wallet KAT balances
```

You can pin to a specific block if needed: `make fork FORK_BLOCK=27185000`

## Key Contracts

| Contract | Address |
|----------|---------|
| KAT Token | `0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d` |
| VotingEscrow (vKAT) | `0x4d6fC15Ca6258b168225D283262743C623c13Ead` |
| NFT Lock | `0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d` |
| avKAT Vault | `0x7231dbaCdFc968E07656D12389AB20De82FbfCeB` |
| GaugeVoter | `0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352` |
| Exit Queue | `0x6dE9cAAb658C744aD337Ca5d92D084c97ffF578d` |
| Compound Strategy | `0x60233D1c150F9C08D886906d597aA79a205b0463` |

## How the Fork Works

The `make fork` command starts Anvil forking Katana mainnet at the **latest block** and runs a setup script that adapts to the current on-chain state:

1. **Checks if KAT is unlocked** — skips time warp and unlock if transfers are already live
2. **Checks if contracts are unpaused** — skips storage overrides if already unpaused
3. **Mocks DAO permissions** so test wallets can call admin functions
4. **Funds test wallets** with 100k KAT each
5. **Approves escrow** as NFT operator for test wallets
6. **Creates test gauges** for voting (if not already present)
7. **Warps into voting window** and delegates votes

Since KAT is now live and transferable on mainnet, steps 1-2 are automatically skipped. The setup only applies what's still needed for local testing.

## Frontend Features

- **Dashboard** — KAT balance, vKAT NFTs, avKAT shares, voting power, protocol totals (K/M formatting)
- **Stake/Deposit** — Lock KAT for vKAT or deposit into avKAT vault
- **Unstake** — Pending withdrawal tracker with live fee estimator, progress bar, and cooldown countdown
- **Vote** — 35 real mainnet gauges with pool names (e.g., USDC/ETH 5bps), collapsible list, MAX allocation
- **Convert** — Swap between vKAT NFTs and avKAT shares
- **Dev tools** — Faucet (ETH + KAT), time warp for cooldown testing
- **Dynamic params** — Exit queue cooldown, min/max fees, and gauge list all read from the chain at runtime. When the protocol updates these values, the UI adjusts automatically
- **1-day min lock warning** — Alerts when withdrawal can't begin yet
