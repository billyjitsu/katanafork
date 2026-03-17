// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "forge-std/interfaces/IERC721.sol";

interface INFTLock is IERC721 {
    function escrow() external view returns (address);
    function enableTransfers() external;
    function setWhitelisted(address _account, bool _isWhitelisted) external;
    function whitelisted(address _account) external view returns (bool);
    function transfersEnabled() external view returns (bool);
    function burn(uint256 tokenId) external;
}
