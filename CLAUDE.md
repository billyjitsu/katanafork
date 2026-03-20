# CLAUDE.md

## Project Overview

Katana Fork is a local testing environment for the KAT token ecosystem on Katana Network (chain ID 747474). It uses Anvil to fork mainnet at the latest block and provides a Next.js frontend for interacting with the protocol.

## Architecture

- **`foundry/`** — Solidity tests and Anvil fork setup (Foundry toolchain)
- **`frontend/`** — Next.js 16 + wagmi v2 + RainbowKit + Tailwind v4

## Key Commands

```bash
make install    # Install all deps (foundry + frontend)
make fork       # Start Anvil fork at latest block + run setup script
make dev        # Start frontend dev server (localhost:3000)
make test       # Run forge tests (19 tests across 6 suites)
make stop       # Stop Anvil
```

## Chain & RPC

- Mainnet RPC: `https://rpc.katana.network`
- Local fork RPC: `http://127.0.0.1:8545`
- Chain ID: `747474`

## Core Contracts (all on Katana mainnet, same addresses on fork)

| Contract | Address | Purpose |
|----------|---------|---------|
| KAT | `0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d` | Native token (ERC-20, now unlocked and transferable) |
| VotingEscrow | `0x4d6fC15Ca6258b168225D283262743C623c13Ead` | Lock KAT to get vKAT NFTs with voting power |
| NFT Lock | `0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d` | ERC-721 wrapper for vKAT positions |
| avKAT Vault | `0x7231dbaCdFc968E07656D12389AB20De82FbfCeB` | ERC-4626 auto-compounding vault |
| GaugeVoter | `0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352` | Epoch-based gauge voting system |
| Exit Queue | `0x6dE9cAAb658C744aD337Ca5d92D084c97ffF578d` | Manages vKAT withdrawal cooldowns and fees |
| IVotes Adapter | `0xB67Ac05e2C1d8592692a90BF61712274b988f25A` | Vote delegation adapter |
| Compound Strategy | `0x60233D1c150F9C08D886906d597aA79a205b0463` | Vault yield strategy |
| DAO | `0xb72291652f15cF73651357383c0A86FBba29B675` | Permission controller (mocked on fork) |

## Token Flow

```
KAT --stake--> vKAT (NFT, voting power, non-transferable)
KAT --deposit--> avKAT (ERC-20, liquid, auto-compounding)
vKAT --deposit--> avKAT (convert active to passive)
avKAT --withdraw--> vKAT (convert passive to active)
vKAT + vKAT --merge--> vKAT (combine NFTs, source burns)
vKAT --split--> vKAT + vKAT (split into two, both >= minDeposit)
vKAT --beginWithdrawal + withdraw--> KAT (cooldown + exit fee)
```

## Merge Mechanics

`VotingEscrow.merge(uint256 from, uint256 to)` combines two vKAT NFTs:
- Source NFT is burned, its KAT added to destination
- Destination keeps its original `lock.start` timestamp
- Works across different epochs/creation times
- Works while NFTs are actively voting
- Does NOT require NFT Lock approval
- Reverts if: same NFT (`SameNFT`), non-owner (`NotApprovedOrOwner`), source in exit queue (`NotSameOwner`)

## Split Mechanics

`VotingEscrow.split(uint256 from, uint256 value)` splits a vKAT NFT into two:
- Original NFT keeps `locked - value`, new NFT gets `value`
- Both must have >= `minDeposit()` (currently 0.5 KAT)
- New NFT inherits the same `lock.start` timestamp
- Works while voting
- Cannot split NFTs in the exit queue
- Reverts if: amount too big (`SplitAmountTooBig`), below min (`AmountTooSmall`), non-owner (`NotApprovedOrOwner`)

## Exit Queue Mechanics

Parameters are read dynamically from the Exit Queue contract:
- `cooldown()` — current cooldown period (currently 60 days / 5184000 seconds)
- `feePercent()` — max exit fee at day 0 (currently 8000 bps / 80%)
- `minFeePercent()` — min exit fee after full cooldown (currently 250 bps / 2.5%)
- Fee is linear: `fee = maxFee - (maxFee - minFee) * elapsed / cooldown`
- There is a 1-day minimum lock period before `beginWithdrawal` can be called
- `queue(tokenId)` returns `(address holder, uint48 createdAt)` for pending withdrawals

These values can change via governance — the frontend reads them from chain, not hardcoded.

## Fork Setup Script (`foundry/script/setup-anvil.sh`)

The setup is adaptive — it checks on-chain state and skips steps already done on mainnet:
1. Checks `isUnlocked()` on KAT — skips time warp + unlock if already live
2. Checks `paused()` on escrow — skips storage overrides if already unpaused
3. Mocks DAO permissions (`anvil_setCode` to return true)
4. Funds test wallets via storage slot manipulation
5. Approves escrow as NFT operator
6. Creates test gauges (idempotent)
7. Warps into voting window + delegates votes

## Foundry Tests

Located in `foundry/test/`. All inherit from `Base.t.sol` which provides:
- `KatanaForkTest` — forks at latest block, runs `_simulateUnlock()` setup
- `KatanaEarlyForkTest` — forks at early block (23368900) for pre-unlock testing
- `_advancePastMinLock()` — skips 1-day min lock period
- `_dealKAT(address, amount)` — fund accounts with KAT

## Frontend Structure

All components in `frontend/src/components/`:
- `Overview.tsx` — Dashboard with balances, protocol stats, faucet
- `StakeKAT.tsx` — KAT -> vKAT staking
- `DepositAvKAT.tsx` — KAT -> avKAT vault deposit
- `ConvertTokens.tsx` — vKAT <-> avKAT conversion (both directions)
- `MergeVKAT.tsx` — Merge and split vKAT NFTs
- `UnstakeVKAT.tsx` — Withdrawal with pending tracker, fee estimator, time warp
- `VoteOnGauges.tsx` — Gauge voting with 35 real mainnet gauges

Config in `frontend/src/config/`:
- `abis.ts` — ABI definitions for all contracts including Exit Queue
- `contracts.ts` — Contract addresses
- `chain.ts` — Katana fork chain definition
- `wagmi.ts` — Wallet config (injected only, no WalletConnect)

Shared utilities in `frontend/src/lib/`:
- `format.ts` — `fmtEther()` for 4-decimal display formatting

## Gauge Metadata

Gauge names are stored on-chain as IPFS URIs in the `gauges(address)` mapping (returns `bool active, uint48 createdAt, string label`). The label is a hex-encoded `ipfs://Qm...` URI pointing to JSON with a `name` field. The frontend uses a static name map for performance — see `GAUGE_NAMES` in `VoteOnGauges.tsx`.

## Common Gotchas

- KAT is already unlocked on mainnet — no need to simulate unlock on recent fork blocks
- `beginWithdrawal` reverts with `MinLockNotReached` if called within 1 day of lock creation
- `ownedTokens(address)` won't include NFTs in the exit queue — use `queue(tokenId)` on the Exit Queue to find pending withdrawals
- Voting requires delegation to self first via `IVotesAdapter.delegate(address)`
- `votingActive()` is epoch-based — may need time warp to enter a voting window
- The DAO is mocked on fork (`anvil_setCode` to always return true) — don't test permission logic against it
- Merge does NOT require NFT Lock approval — only withdrawal does
