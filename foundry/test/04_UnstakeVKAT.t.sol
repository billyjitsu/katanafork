// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title UnstakeVKAT
/// @notice All exit paths from vKAT: standard, rage quit, early, cancel.
contract UnstakeVKATTest is KatanaForkTest {
    uint256 constant STAKE_AMOUNT = 1_000 ether;

    function test_standardWithdrawal() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), STAKE_AMOUNT);
        uint256 tokenId = escrow.createLock(STAKE_AMOUNT);
        vm.stopPrank();

        _advanceBlock();

        vm.startPrank(alice);
        uint256 katBefore = kat.balanceOf(alice);
        escrow.beginWithdrawal(tokenId);

        vm.warp(block.timestamp + 45 days + 1);
        vm.roll(block.number + 1);

        escrow.withdraw(tokenId);
        vm.stopPrank();

        uint256 received = kat.balanceOf(alice) - katBefore;
        assertTrue(received > 950 ether, "Should receive > 95% after full cooldown");
    }

    function test_rageQuit() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), STAKE_AMOUNT);
        uint256 tokenId = escrow.createLock(STAKE_AMOUNT);
        vm.stopPrank();

        _advanceBlock();

        vm.startPrank(alice);
        uint256 katBefore = kat.balanceOf(alice);
        escrow.beginWithdrawal(tokenId);

        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 2);

        escrow.withdraw(tokenId);
        vm.stopPrank();

        uint256 received = kat.balanceOf(alice) - katBefore;
        assertTrue(received >= 700 ether && received <= 800 ether, "Should receive ~75%");
    }

    function test_earlyWithdrawal() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), STAKE_AMOUNT);
        uint256 tokenId = escrow.createLock(STAKE_AMOUNT);
        vm.stopPrank();

        _advanceBlock();

        vm.startPrank(alice);
        uint256 katBefore = kat.balanceOf(alice);
        escrow.beginWithdrawal(tokenId);

        vm.warp(block.timestamp + 15 days);
        vm.roll(block.number + 1);

        escrow.withdraw(tokenId);
        vm.stopPrank();

        uint256 received = kat.balanceOf(alice) - katBefore;
        assertTrue(received > 750 ether && received < 975 ether, "Fee should be partial");
    }

    function test_cancelWithdrawal() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), STAKE_AMOUNT);
        uint256 tokenId = escrow.createLock(STAKE_AMOUNT);
        vm.stopPrank();

        _advanceBlock();

        vm.startPrank(alice);
        escrow.beginWithdrawal(tokenId);
        escrow.cancelWithdrawalRequest(tokenId);
        vm.stopPrank();

        assertTrue(escrow.votingPower(tokenId) > 0, "Should still have voting power");
        IVotingEscrow.LockedBalance memory lock = escrow.locked(tokenId);
        assertEq(uint256(lock.amount), STAKE_AMOUNT, "Lock amount preserved");
    }
}
