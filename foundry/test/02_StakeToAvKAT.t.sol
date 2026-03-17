// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Base.t.sol";

/// @title StakeToAvKAT
/// @notice Deposits KAT into the avKAT vault (ERC-4626).
contract StakeToAvKATTest is KatanaForkTest {

    function test_depositToVault() public {
        uint256 amount = 1_000 ether;
        uint256 expectedShares = vault.previewDeposit(amount);

        vm.startPrank(alice);
        kat.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();

        assertEq(shares, expectedShares, "Shares should match preview");
        assertEq(vault.balanceOf(alice), shares, "avKAT balance should match");
        assertEq(kat.balanceOf(alice), 10_000 ether - amount, "KAT should be deducted");
    }

    function test_vaultExchangeRate() public view {
        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();

        if (totalSupply > 0) {
            uint256 rate = vault.convertToAssets(1 ether);
            assertTrue(rate >= 1 ether, "Exchange rate should be >= 1:1");
        }
    }

    function test_multipleDeposits() public {
        vm.startPrank(alice);
        kat.approve(address(vault), 2_000 ether);
        uint256 shares1 = vault.deposit(1_000 ether, alice);
        uint256 shares2 = vault.deposit(1_000 ether, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), shares1 + shares2, "Shares should accumulate");
    }

    function test_avKATIsTransferable() public {
        vm.startPrank(alice);
        kat.approve(address(vault), 1_000 ether);
        uint256 shares = vault.deposit(1_000 ether, alice);
        vm.stopPrank();

        vm.prank(alice);
        vault.transfer(bob, shares / 2);

        assertEq(vault.balanceOf(alice), shares - shares / 2);
        assertEq(vault.balanceOf(bob), shares / 2);
    }
}
