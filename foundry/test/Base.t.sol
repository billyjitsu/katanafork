// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {KatanaConfig} from "../src/KatanaConfig.sol";
import {IKAT} from "../src/interfaces/IKAT.sol";
import {IVotingEscrow} from "../src/interfaces/IVotingEscrow.sol";
import {IAvKATVault} from "../src/interfaces/IAvKATVault.sol";
import {IGaugeVoter} from "../src/interfaces/IGaugeVoter.sol";
import {INFTLock} from "../src/interfaces/INFTLock.sol";

interface IDAO {
    function hasPermission(
        address _where,
        address _who,
        bytes32 _permissionId,
        bytes calldata _data
    ) external view returns (bool);
}

abstract contract KatanaForkTest is Test {
    IKAT internal kat;
    IVotingEscrow internal escrow;
    IAvKATVault internal vault;
    IGaugeVoter internal gaugeVoter;
    INFTLock internal nftLock;

    address internal alice;
    address internal bob;
    address internal carol;

    address internal constant UNLOCKER_ADDR = 0x92D8Ce89fF02C640daf0B7c23d497cCF1880C390;
    address internal constant DAO_ADDR = 0xb72291652f15cF73651357383c0A86FBba29B675;

    uint256 internal forkId;

    function setUp() public virtual {
        forkId = vm.createSelectFork(
            KatanaConfig.RPC_URL,
            KatanaConfig.LATEST_BLOCK
        );

        kat = IKAT(KatanaConfig.KAT);
        escrow = IVotingEscrow(KatanaConfig.VOTING_ESCROW);
        vault = IAvKATVault(KatanaConfig.VAULT);
        gaugeVoter = IGaugeVoter(KatanaConfig.GAUGE_VOTER);
        nftLock = INFTLock(KatanaConfig.NFT_LOCK);

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);

        _simulateUnlock();

        _dealKAT(alice, 10_000 ether);
        _dealKAT(bob, 10_000 ether);
        _dealKAT(carol, 5_000 ether);

        _approveEscrowForAll(alice);
        _approveEscrowForAll(bob);
        _approveEscrowForAll(carol);
    }

    function _simulateUnlock() internal {
        uint256 unlockTime = kat.unlockTime();
        if (block.timestamp < unlockTime) {
            vm.warp(unlockTime + 1);
        }

        if (kat.locked()) {
            vm.prank(UNLOCKER_ADDR);
            kat.unlockAndRenounceUnlocker();
        }

        _setSlotZero(address(escrow), 101);
        _setSlotZero(address(vault), 101);
        _setSlotZero(KatanaConfig.ESCROW_IVOTES_ADAPTER, 101);
        _setSlotZero(address(gaugeVoter), 251);

        _enableNFTTransfers();
        _initializeVaultIfNeeded();
    }

    function _enableNFTTransfers() internal {
        vm.mockCall(
            DAO_ADDR,
            abi.encodeWithSelector(IDAO.hasPermission.selector),
            abi.encode(true)
        );
        nftLock.enableTransfers();
        vm.clearMockedCalls();
    }

    function _approveEscrowForAll(address account) internal {
        vm.prank(account);
        nftLock.setApprovalForAll(address(escrow), true);
    }

    function _initializeVaultIfNeeded() internal {
        if (vault.masterTokenId() != 0) return;

        address vaultInit = makeAddr("vaultInitializer");
        vm.deal(vaultInit, 1 ether);
        deal(address(kat), vaultInit, 1_000 ether, true);

        vm.startPrank(vaultInit);
        kat.approve(address(escrow), 1_000 ether);
        uint256 masterTokenId = escrow.createLock(1_000 ether);
        nftLock.approve(address(vault), masterTokenId);
        vm.stopPrank();

        vm.mockCall(
            DAO_ADDR,
            abi.encodeWithSelector(IDAO.hasPermission.selector),
            abi.encode(true)
        );

        vm.prank(vaultInit);
        vault.initializeMasterTokenAndStrategy(
            masterTokenId,
            KatanaConfig.COMPOUND_STRATEGY
        );

        vm.clearMockedCalls();
    }

    function _setSlotZero(address target, uint256 slot) internal {
        vm.store(target, bytes32(slot), bytes32(uint256(0)));
    }

    function _advanceBlock() internal {
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 2);
    }

    function _dealKAT(address to, uint256 amount) internal {
        deal(address(kat), to, amount, true);
    }

    function _logPosition(string memory label, address account) internal view {
        console.log("--- %s Position: %s ---", label, account);
        console.log("  KAT balance:    ", kat.balanceOf(account));
        console.log("  vKAT NFTs:      ", nftLock.balanceOf(account));
        console.log("  avKAT shares:   ", vault.balanceOf(account));
        console.log("  Voting power:   ", escrow.votingPowerForAccount(account));
    }
}

abstract contract KatanaEarlyForkTest is Test {
    IKAT internal kat;
    IVotingEscrow internal escrow;
    IAvKATVault internal vault;
    INFTLock internal nftLock;

    address internal alice;
    address internal bob;

    uint256 internal forkId;

    function setUp() public virtual {
        forkId = vm.createSelectFork(
            KatanaConfig.RPC_URL,
            KatanaConfig.EARLY_BLOCK
        );

        kat = IKAT(KatanaConfig.KAT);
        escrow = IVotingEscrow(KatanaConfig.VOTING_ESCROW);
        vault = IAvKATVault(KatanaConfig.VAULT);
        nftLock = INFTLock(KatanaConfig.NFT_LOCK);

        alice = makeAddr("alice");
        bob = makeAddr("bob");

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        deal(address(kat), alice, 10_000 ether, true);
        deal(address(kat), bob, 10_000 ether, true);
    }
}
