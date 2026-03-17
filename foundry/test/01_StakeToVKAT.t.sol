// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title StakeToVKAT
/// @notice Creates vKAT lock positions from KAT.
contract StakeToVKATTest is KatanaForkTest {

    function test_createLock() public {
        uint256 amount = 1_000 ether;

        vm.startPrank(alice);
        kat.approve(address(escrow), amount);
        uint256 tokenId = escrow.createLock(amount);
        vm.stopPrank();

        IVotingEscrow.LockedBalance memory lock = escrow.locked(tokenId);
        assertEq(uint256(lock.amount), amount, "Locked amount should match");
        assertTrue(escrow.votingPower(tokenId) > 0, "Should have voting power");
        assertEq(kat.balanceOf(alice), 10_000 ether - amount, "KAT should be deducted");
    }

    function test_createLockFor() public {
        uint256 amount = 500 ether;

        vm.startPrank(alice);
        kat.approve(address(escrow), amount);
        uint256 tokenId = escrow.createLockFor(amount, bob);
        vm.stopPrank();

        uint256[] memory bobTokens = escrow.ownedTokens(bob);
        assertEq(bobTokens.length, 1, "Bob should have 1 vKAT NFT");
        assertEq(bobTokens[0], tokenId, "Token ID should match");
        assertEq(kat.balanceOf(alice), 10_000 ether - amount);
    }

    function test_multipleLocks() public {
        vm.startPrank(alice);
        kat.approve(address(escrow), 3_000 ether);
        escrow.createLock(1_000 ether);
        escrow.createLock(1_000 ether);
        escrow.createLock(1_000 ether);
        vm.stopPrank();

        uint256[] memory tokens = escrow.ownedTokens(alice);
        assertEq(tokens.length, 3, "Should have 3 NFTs");
    }
}
