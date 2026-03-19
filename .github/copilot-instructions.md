# Copilot Instructions

This is a local Anvil fork testing environment for the KAT ecosystem on Katana Network (chain 747474).

## Project structure
- `foundry/` — Solidity tests (Foundry). Config in `src/KatanaConfig.sol`, test base in `test/Base.t.sol`
- `frontend/` — Next.js 16 + wagmi v2 + Tailwind v4. Components in `src/components/`, config in `src/config/`

## Contract addresses (Katana mainnet, same on fork)
- KAT: `0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d`
- VotingEscrow: `0x4d6fC15Ca6258b168225D283262743C623c13Ead`
- avKAT Vault: `0x7231dbaCdFc968E07656D12389AB20De82FbfCeB`
- GaugeVoter: `0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352`
- Exit Queue: `0x6dE9cAAb658C744aD337Ca5d92D084c97ffF578d`
- NFT Lock: `0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d`

## Conventions
- Display formatting: use `fmtEther()` from `lib/format.ts` (4 decimals max)
- Exit queue params (cooldown, fees): always read from chain via contract calls, never hardcode
- Theme: `ink-*` for dark backgrounds/text, `katana-*` for blue accent, `emerald-*` for success only
- Buttons: pill-shaped (rounded-full), classes: btn-primary, btn-secondary, btn-danger
- Forge tests: extend `KatanaForkTest`, call `_advancePastMinLock()` before `beginWithdrawal`

## Gotchas
- `beginWithdrawal` needs 1 day after lock creation or it reverts with MinLockNotReached
- After beginWithdrawal, NFT transfers to escrow — query `ExitQueue.queue(tokenId)` for pending state
- Gauge voting needs self-delegation first: `IVotesAdapter.delegate(yourAddress)`
- DAO is mocked on fork (always returns true) — not suitable for permission testing
- `merge(from, to)` does NOT need NFT approval — works across epochs, while voting. Source can't be in exit queue
