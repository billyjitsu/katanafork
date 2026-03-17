// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVotingEscrow {
    struct LockedBalance {
        uint208 amount;
        uint48 start;
    }

    function token() external view returns (address);
    function lockNFT() external view returns (address);
    function voter() external view returns (address);
    function clock() external view returns (address);
    function curve() external view returns (address);
    function queue() external view returns (address);
    function dao() external view returns (address);
    function ivotesAdapter() external view returns (address);
    function decimals() external view returns (uint8);
    function totalLocked() external view returns (uint256);
    function totalVotingPower() external view returns (uint256);
    function totalVotingPowerAt(uint256 timestamp) external view returns (uint256);
    function lastLockId() external view returns (uint256);
    function minDeposit() external view returns (uint256);
    function paused() external view returns (bool);
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function votingPower(uint256 tokenId) external view returns (uint256);
    function votingPowerAt(uint256 tokenId, uint256 t) external view returns (uint256);
    function votingPowerForAccount(address account) external view returns (uint256);
    function isVoting(uint256 tokenId) external view returns (bool);
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
    function ownedTokens(address owner) external view returns (uint256[] memory);
    function currentExitingAmount() external view returns (uint256);
    function ESCROW_ADMIN_ROLE() external view returns (bytes32);
    function PAUSER_ROLE() external view returns (bytes32);
    function SWEEPER_ROLE() external view returns (bytes32);
    function createLock(uint256 value) external returns (uint256);
    function createLockFor(uint256 value, address to) external returns (uint256);
    function beginWithdrawal(uint256 tokenId) external;
    function withdraw(uint256 tokenId) external;
    function cancelWithdrawalRequest(uint256 tokenId) external;
    function resetVotesAndBeginWithdrawal(uint256 tokenId) external;
    function merge(uint256 from, uint256 to) external;
    function split(uint256 from, uint256 value) external returns (uint256);
    function sweep() external;
    function pause() external;
    function unpause() external;
    function setMinDeposit(uint256 minDeposit) external;
    function setVoter(address voter) external;
    function setQueue(address queue) external;
    function setCurve(address curve) external;
    function setClock(address clock) external;
    function setLockNFT(address nft) external;
    function setIVotesAdapter(address adapter) external;
    function setEnableSplit(address account, bool isWhitelisted) external;
    function enableSplit() external;
}
