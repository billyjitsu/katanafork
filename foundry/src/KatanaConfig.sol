// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title KatanaConfig
/// @notice Central configuration for Katana fork simulations.
library KatanaConfig {
    // ─── Fork Blocks ──────────────────────────────────────
    uint256 internal constant EARLY_BLOCK = 23_368_900;
    uint256 internal constant LATEST_BLOCK = 25_217_547;

    // ─── RPC ──────────────────────────────────────────────
    string internal constant RPC_URL = "https://rpc.katana.network";

    // ─── Contract Addresses ───────────────────────────────
    address internal constant KAT = 0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d;
    address internal constant VOTING_ESCROW = 0x4d6fC15Ca6258b168225D283262743C623c13Ead;
    address internal constant NFT_LOCK = 0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d;
    address internal constant GAUGE_VOTER = 0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352;
    address internal constant VAULT = 0x7231dbaCdFc968E07656D12389AB20De82FbfCeB;
    address internal constant COMPOUND_STRATEGY = 0x60233D1c150F9C08D886906d597aA79a205b0463;
    address internal constant MERKL_DISTRIBUTOR = 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae;
    address internal constant CURVE = 0x38b8B74330b2F918C22F7936aCf773C6D963C73c;
    address internal constant EXIT_QUEUE = 0x6dE9cAAb658C744aD337Ca5d92D084c97ffF578d;
    address internal constant CLOCK = 0x17049d374A2bcdA70F8939C21ad92bcF6B2A95ab;
    address internal constant SWAPPER = 0x92D2e00b6D2BB50B87a9BE971a82B1F00ac44768;
    address internal constant VKAT_METADATA = 0xb2143cFC740356E5FeFB4488e01026cfBb0A328F;
    address internal constant ESCROW_IVOTES_ADAPTER = 0xB67Ac05e2C1d8592692a90BF61712274b988f25A;

    // ─── Constants ────────────────────────────────────────
    uint256 internal constant COOLDOWN_PERIOD = 45 days;
    uint256 internal constant MIN_FEE_BPS = 250;   // 2.5%
    uint256 internal constant MAX_FEE_BPS = 2500;  // 25%
    uint256 internal constant BPS_DENOMINATOR = 10_000;
}
