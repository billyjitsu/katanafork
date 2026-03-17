// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title ConvertVKATToAvKAT
/// @notice Convert a vKAT NFT position into avKAT vault shares.
contract ConvertVKATToAvKATTest is KatanaForkTest {

    function test_convertVKATToAvKAT() public {
        uint256 amount = 1_000 ether;

        vm.startPrank(alice);
        kat.approve(address(escrow), amount);
        uint256 tokenId = escrow.createLock(amount);

        nftLock.approve(address(vault), tokenId);
        uint256 shares = vault.depositTokenId(tokenId, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), shares, "Should have avKAT shares");
        assertTrue(shares > 0, "Should receive > 0 shares");

        uint256[] memory aliceTokens = escrow.ownedTokens(alice);
        for (uint256 i = 0; i < aliceTokens.length; i++) {
            assertTrue(aliceTokens[i] != tokenId, "Should not own deposited NFT");
        }
    }

    function test_redeemAvKATToVKAT() public {
        uint256 amount = 1_000 ether;

        // First deposit KAT -> avKAT
        vm.startPrank(alice);
        kat.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);

        // Redeem avKAT -> vKAT NFT
        uint256 tokenId = vault.withdrawTokenId(shares, alice, alice);
        vm.stopPrank();

        assertTrue(tokenId > 0, "Should receive a vKAT NFT");
        assertEq(vault.balanceOf(alice), 0, "avKAT balance should be 0");
    }
}
