// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title FullLifecycle
/// @notice End-to-end user journey scenarios.
contract FullLifecycleTest is KatanaForkTest {

    /// @notice Active path: KAT -> vKAT -> unstake -> KAT
    function test_activeParticipantFlow() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), 2_000 ether);
        uint256 tokenId = escrow.createLock(2_000 ether);
        vm.stopPrank();

        _advancePastMinLock();

        vm.startPrank(alice);
        escrow.beginWithdrawal(tokenId);
        vm.warp(block.timestamp + 60 days + 1);
        vm.roll(block.number + 1);

        uint256 katBefore = kat.balanceOf(alice);
        escrow.withdraw(tokenId);
        vm.stopPrank();

        uint256 received = kat.balanceOf(alice) - katBefore;
        assertTrue(received > 1_900 ether, "Should receive > 95% after full cooldown");
    }

    /// @notice Passive path: KAT -> avKAT -> transfer
    function test_passiveHolderFlow() public {
        vm.startPrank(alice);
        kat.approve(address(vault), 2_000 ether);
        uint256 shares = vault.deposit(2_000 ether, alice);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vault.transfer(bob, shares / 2);

        assertEq(vault.balanceOf(alice), shares - shares / 2);
        assertEq(vault.balanceOf(bob), shares / 2);
    }

    /// @notice Convert: vKAT -> avKAT
    function test_convertActiveToPassive() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), 1_000 ether);
        uint256 tokenId = escrow.createLock(1_000 ether);
        nftLock.approve(address(vault), tokenId);
        uint256 shares = vault.depositTokenId(tokenId, alice);
        vm.stopPrank();

        assertTrue(shares > 0, "Should receive avKAT shares");
    }

    /// @notice Combined: Alice active, Bob passive, Carol transfers
    function test_combinedScenario() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), 5_000 ether);
        uint256 aliceTokenId = escrow.createLock(5_000 ether);
        vm.stopPrank();

        vm.startPrank(bob);
        kat.approve(address(vault), 5_000 ether);
        uint256 bobShares = vault.deposit(5_000 ether, bob);
        vm.stopPrank();

        vm.prank(carol);
        kat.transfer(alice, 2_000 ether);

        vm.startPrank(alice);
        kat.approve(address(escrow), 2_000 ether);
        uint256 aliceTokenId2 = escrow.createLock(2_000 ether);
        vm.stopPrank();

        assertEq(escrow.ownedTokens(alice).length, 2);
        assertTrue(bobShares > 0);
        assertTrue(aliceTokenId > 0 && aliceTokenId2 > 0);
    }
}
