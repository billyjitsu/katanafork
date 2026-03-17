#!/bin/bash
# setup-anvil.sh -- Bootstrap a local KAT fork on Anvil
set -e

RPC=${1:-http://127.0.0.1:8545}

KAT=0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d
ESCROW=0x4d6fC15Ca6258b168225D283262743C623c13Ead
NFT_LOCK=0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d
VAULT=0x7231dbaCdFc968E07656D12389AB20De82FbfCeB
GAUGE_VOTER=0x5e755A3C5dc81A79DE7a7cEF192FFA60964c9352
ADAPTER=0xB67Ac05e2C1d8592692a90BF61712274b988f25A
STRATEGY=0x60233D1c150F9C08D886906d597aA79a205b0463
DAO=0xb72291652f15cF73651357383c0A86FBba29B675
UNLOCKER=0x92D8Ce89fF02C640daf0B7c23d497cCF1880C390

ALICE=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
CAROL=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

WEI_1K=1000000000000000000000
WEI_50K=50000000000000000000000
WEI_100K=100000000000000000000000

ZERO=0x0000000000000000000000000000000000000000000000000000000000000000
SLOT_65=0x0000000000000000000000000000000000000000000000000000000000000065
SLOT_FB=0x00000000000000000000000000000000000000000000000000000000000000fb

echo ""
echo "========================================="
echo "  KAT Fork Setup"
echo "  RPC: $RPC"
echo "========================================="
echo ""

echo "[1/10] Warping time past KAT unlock..."
UNLOCK_TIME=$(cast call $KAT "unlockTime()(uint256)" --rpc-url $RPC | awk '{print $1}')
CURRENT_TIME=$(cast block latest --field timestamp --rpc-url $RPC | awk '{print $1}')
if [ "$CURRENT_TIME" -lt "$((UNLOCK_TIME + 1))" ]; then
  TARGET_TIME=$((UNLOCK_TIME + 1))
  cast rpc evm_setNextBlockTimestamp $(printf '0x%x' $TARGET_TIME) --rpc-url $RPC > /dev/null
  cast rpc evm_mine --rpc-url $RPC > /dev/null
  echo "       Timestamp set to $TARGET_TIME (unlockTime was $UNLOCK_TIME)"
else
  echo "       Already past unlockTime ($CURRENT_TIME > $UNLOCK_TIME)"
fi

echo "[2/10] Unlocking KAT transfers..."
cast rpc anvil_setBalance $UNLOCKER 0xDE0B6B3A7640000 --rpc-url $RPC > /dev/null
cast send $KAT "unlockAndRenounceUnlocker()" \
  --from $UNLOCKER --unlocked --rpc-url $RPC > /dev/null
echo "       KAT is now transferable"

echo "[3/10] Unpausing contracts (storage overrides)..."
cast rpc anvil_setStorageAt $ESCROW $SLOT_65 $ZERO --rpc-url $RPC > /dev/null
cast rpc anvil_setStorageAt $VAULT $SLOT_65 $ZERO --rpc-url $RPC > /dev/null
cast rpc anvil_setStorageAt $ADAPTER $SLOT_65 $ZERO --rpc-url $RPC > /dev/null
cast rpc anvil_setStorageAt $GAUGE_VOTER $SLOT_FB $ZERO --rpc-url $RPC > /dev/null
echo "       All contracts unpaused"

echo "[4/10] Mocking DAO permissions..."
cast rpc anvil_setCode $DAO 0x600160005260206000f3 --rpc-url $RPC > /dev/null
echo "       DAO returns true for all permission checks"

echo "[5/10] Enabling NFT Lock transfers..."
cast send $NFT_LOCK "enableTransfers()" \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null
echo "       NFT transfers enabled"

echo "[6/10] Funding wallets with KAT..."
set_kat_balance() {
  local ADDR=$1
  local HEX_AMOUNT=$2
  local BAL_SLOT
  BAL_SLOT=$(cast index address "$ADDR" 0)
  cast rpc anvil_setStorageAt $KAT "$BAL_SLOT" "$HEX_AMOUNT" --rpc-url $RPC > /dev/null
}

HEX_100K=0x00000000000000000000000000000000000000000000152d02c7e14af6800000
HEX_50K=0x000000000000000000000000000000000000000000000a968163f0a57b400000
HEX_1K=0x00000000000000000000000000000000000000000000003635c9adc5dea00000

set_kat_balance $ALICE $HEX_100K
set_kat_balance $BOB   $HEX_100K
set_kat_balance $CAROL $HEX_50K
echo "       Alice: 100,000 KAT"
echo "       Bob:   100,000 KAT"
echo "       Carol:  50,000 KAT"

echo "[7/10] Initializing vault master token..."
MASTER_ID=$(cast call $VAULT "masterTokenId()(uint256)" --rpc-url $RPC | awk '{print $1}')
if [ "$MASTER_ID" = "0" ]; then
  ALICE_BAL_SLOT=$(cast index address $ALICE 0)
  HEX_101K=0x00000000000000000000000000000000000000000000156338918f10d5200000
  cast rpc anvil_setStorageAt $KAT "$ALICE_BAL_SLOT" "$HEX_101K" --rpc-url $RPC > /dev/null

  cast send $KAT "approve(address,uint256)" $ESCROW $WEI_1K \
    --from $ALICE --unlocked --rpc-url $RPC > /dev/null
  cast send $ESCROW "createLock(uint256)" $WEI_1K \
    --from $ALICE --unlocked --rpc-url $RPC > /dev/null
  TOKEN_ID=$(cast call $ESCROW "lastLockId()(uint256)" --rpc-url $RPC | awk '{print $1}')

  cast send $NFT_LOCK "approve(address,uint256)" $VAULT $TOKEN_ID \
    --from $ALICE --unlocked --rpc-url $RPC > /dev/null
  cast send $VAULT "initializeMasterTokenAndStrategy(uint256,address)" $TOKEN_ID $STRATEGY \
    --from $ALICE --unlocked --rpc-url $RPC > /dev/null
  echo "       Vault initialized with master token #$TOKEN_ID"

  cast rpc anvil_setStorageAt $KAT "$ALICE_BAL_SLOT" "$HEX_100K" --rpc-url $RPC > /dev/null
else
  echo "       Vault already initialized (master token #$MASTER_ID)"
fi

echo "[8/10] Approving escrow as NFT operator..."
cast send $NFT_LOCK "setApprovalForAll(address,bool)" $ESCROW true \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null
cast send $NFT_LOCK "setApprovalForAll(address,bool)" $ESCROW true \
  --from $BOB --unlocked --rpc-url $RPC > /dev/null
cast send $NFT_LOCK "setApprovalForAll(address,bool)" $ESCROW true \
  --from $CAROL --unlocked --rpc-url $RPC > /dev/null
echo "       Escrow approved for Alice, Bob, Carol"

echo "[9/10] Creating test gauges..."
GAUGE_ETH_USDC=0x0000000000000000000000000000000000000001
GAUGE_WBTC_USDC=0x0000000000000000000000000000000000000002
GAUGE_KAT_ETH=0x0000000000000000000000000000000000000003

# Always create — idempotent on fresh fork, harmless if already exist
cast send $GAUGE_VOTER "createGauge(address,string)" $GAUGE_ETH_USDC "ETH/USDC Pool" \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
cast send $GAUGE_VOTER "createGauge(address,string)" $GAUGE_WBTC_USDC "WBTC/USDC Pool" \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
cast send $GAUGE_VOTER "createGauge(address,string)" $GAUGE_KAT_ETH "KAT/ETH Pool" \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
echo "       ETH/USDC  $GAUGE_ETH_USDC"
echo "       WBTC/USDC $GAUGE_WBTC_USDC"
echo "       KAT/ETH   $GAUGE_KAT_ETH"

# ── Step 10: Warp into voting window + delegate ─────────────
# The GaugeVoter has epoch-based voting windows. We need to warp
# past epochVoteStart so that votingActive() returns true.
echo "[10/10] Warping into voting window + delegating..."
VOTE_START=$(cast call $GAUGE_VOTER "epochVoteStart()(uint256)" --rpc-url $RPC 2>/dev/null | awk '{print $1}')
if [ -n "$VOTE_START" ] && [ "$VOTE_START" -gt 0 ]; then
  VOTE_TARGET=$((VOTE_START + 3600))
  cast rpc evm_setNextBlockTimestamp $(printf '0x%x' $VOTE_TARGET) --rpc-url $RPC > /dev/null
  cast rpc evm_mine --rpc-url $RPC > /dev/null
  echo "       Warped to voting window (epochVoteStart + 1h)"
fi

# Delegate votes for test wallets via IVotes adapter
ADAPTER_IVOTES=0xB67Ac05e2C1d8592692a90BF61712274b988f25A
cast send $ADAPTER_IVOTES "delegate(address)" $ALICE \
  --from $ALICE --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
cast send $ADAPTER_IVOTES "delegate(address)" $BOB \
  --from $BOB --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
cast send $ADAPTER_IVOTES "delegate(address)" $CAROL \
  --from $CAROL --unlocked --rpc-url $RPC > /dev/null 2>&1 || true
echo "       Delegated votes for Alice, Bob, Carol"

VOTING_ACTIVE=$(cast call $GAUGE_VOTER "votingActive()(bool)" --rpc-url $RPC 2>/dev/null)
echo "       Voting active: $VOTING_ACTIVE"

echo ""
echo "========================================="
echo "  Fork ready!"
echo "========================================="
echo ""
echo "  RPC URL:  $RPC"
echo "  Chain ID: 747474"
echo ""
echo "  Test Wallets (import private keys into MetaMask):"
echo ""
echo "    Alice  $ALICE"
echo "    Key:   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
echo "    Bob    $BOB"
echo "    Key:   0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
echo ""
echo "    Carol  $CAROL"
echo "    Key:   0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
echo ""
echo "  KAT Token: $KAT"
echo ""
