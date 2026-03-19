# Agent Guide

This file provides context for AI coding agents working on this repository. It is model-agnostic.

## What This Project Does

A local Anvil fork of Katana Network (chain 747474) with a Next.js frontend for testing the KAT staking/voting ecosystem. Users can stake KAT for vKAT (voting NFTs), deposit into avKAT (liquid vault), vote on gauges, and unstake with a cooldown period.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.24, Foundry (forge/anvil/cast) |
| Frontend | Next.js 16, React 19, TypeScript |
| Web3 | wagmi v2, viem, RainbowKit |
| Styling | Tailwind CSS v4 |
| Chain | Katana Network (EVM-compatible, chain ID 747474) |

## Repository Layout

```
katanafork/
├── CLAUDE.md                 # Claude Code-specific context (detailed)
├── AGENTS.md                 # This file (model-agnostic)
├── Makefile                  # Top-level: make install, make fork, make dev
├── foundry/
│   ├── Makefile              # make fork, make test, make warp DAYS=N
│   ├── foundry.toml          # Solc 0.8.24 config
│   ├── src/
│   │   ├── KatanaConfig.sol  # Central config: addresses, constants
│   │   └── interfaces/       # IKAT, IVotingEscrow, IAvKATVault, IGaugeVoter, INFTLock
│   ├── test/
│   │   ├── Base.t.sol        # Test harness with fork setup helpers
│   │   ├── 01-06_*.t.sol     # Test suites (19 tests total)
│   └── script/
│       └── setup-anvil.sh    # 7-step adaptive fork bootstrap
└── frontend/
    ├── package.json
    └── src/
        ├── app/              # Next.js app router, globals.css, providers
        ├── components/       # One component per feature (Overview, StakeKAT, etc.)
        ├── config/           # abis.ts, contracts.ts, chain.ts, wagmi.ts
        └── lib/              # Shared utilities (format.ts)
```

## Contract Addresses

All contracts live on Katana mainnet. The fork uses the same addresses.

```
KAT Token:        0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d
VotingEscrow:     0x4d6fC15Ca6258b168225D283262743C623c13Ead
NFT Lock:         0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d
avKAT Vault:      0x7231dbaCdFc968E07656D12389AB20De82FbfCeB
GaugeVoter:       0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352
Exit Queue:       0x6dE9cAAb658C744aD337Ca5d92D084c97ffF578d
IVotes Adapter:   0xB67Ac05e2C1d8592692a90BF61712274b988f25A
Compound Strategy: 0x60233D1c150F9C08D886906d597aA79a205b0463
```

## How to Run

```bash
make install          # Install foundry deps + npm deps
make fork             # Start Anvil fork (latest block) + setup
make dev              # Start frontend on localhost:3000
make test             # Run 19 forge tests
make warp DAYS=60     # Fast-forward fork time
make fund ADDR=0x...  # Give any address KAT tokens
```

## Key Patterns

### Adding a new contract interaction
1. Add the ABI to `frontend/src/config/abis.ts`
2. Add the address to `frontend/src/config/contracts.ts`
3. Use `useReadContract` / `useWriteContract` from wagmi in the component

### Adding a new forge test
1. Create `foundry/test/NN_TestName.t.sol`
2. Extend `KatanaForkTest` from `Base.t.sol` for latest-block tests
3. Use `_dealKAT(address, amount)` to fund, `_advancePastMinLock()` to skip min lock

### Exit queue parameters
Read dynamically from chain — never hardcode:
- `ExitQueue.cooldown()` — cooldown period in seconds
- `ExitQueue.feePercent()` — max fee (bps)
- `ExitQueue.minFeePercent()` — min fee (bps)

### Formatting convention
Use `fmtEther()` from `frontend/src/lib/format.ts` for display (4 decimal max). Use raw `formatEther()` from viem only for input values (MAX buttons).

## Style Guide

- **CSS**: Tailwind v4 with custom `ink-*` palette (dark theme) and `katana-*` (blue accent). Defined in `globals.css`.
- **Buttons**: `btn-primary` (blue), `btn-secondary` (gray), `btn-danger` (red). All pill-shaped (rounded-full).
- **Cards**: `.card` class for containers.
- **Colors**: Use `ink-*` for backgrounds/text, `katana-*` for brand/accent, `emerald-*` only for success states.

## Things to Watch Out For

- KAT is already unlocked on mainnet — the setup script detects this and skips unlock steps
- `beginWithdrawal` requires 1 day since lock creation (`MinLockNotReached` error)
- After `beginWithdrawal`, the NFT moves to the escrow — `ownedTokens()` won't list it anymore
- Use `ExitQueue.queue(tokenId)` to get `(holder, createdAt)` for pending withdrawals
- Voting requires self-delegation first: `IVotesAdapter.delegate(yourAddress)`
- `votingActive()` is epoch-based — fork may need time warp to reach a voting window
- DAO is mocked on fork (always returns true) — don't test permissions against it
