// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title RageQuitCounter
 * @notice Tracks the number of times users have executed a RageQuit
 * @dev Simple counter contract to record user RageQuit statistics
 */
contract RageQuitCounter {
    // Mapping from user address to their RageQuit count
    mapping(address => uint256) public rageQuitCount;

    // Total number of RageQuits across all users
    uint256 public totalRageQuits;

    // Events
    event RageQuitRecorded(address indexed user, uint256 newCount, uint256 timestamp);
    event BatchRageQuitRecorded(address indexed user, uint256 count, uint256 newTotal, uint256 timestamp);

    /**
     * @notice Record a single RageQuit for the caller
     * @dev Increments the caller's counter and emits an event
     */
    function recordRageQuit() external {
        rageQuitCount[msg.sender]++;
        totalRageQuits++;

        emit RageQuitRecorded(msg.sender, rageQuitCount[msg.sender], block.timestamp);
    }

    /**
     * @notice Record multiple RageQuits at once (e.g., for batch swaps)
     * @param count Number of tokens swapped in this RageQuit session
     * @dev Useful for tracking multi-token RageQuits
     */
    function recordBatchRageQuit(uint256 count) external {
        require(count > 0, "Count must be greater than 0");

        rageQuitCount[msg.sender] += count;
        totalRageQuits += count;

        emit BatchRageQuitRecorded(msg.sender, count, rageQuitCount[msg.sender], block.timestamp);
    }

    /**
     * @notice Get the RageQuit count for a specific user
     * @param user Address of the user to query
     * @return The number of times the user has RageQuit
     */
    function getRageQuitCount(address user) external view returns (uint256) {
        return rageQuitCount[user];
    }

    /**
     * @notice Get the RageQuit count for the caller
     * @return The number of times the caller has RageQuit
     */
    function getMyRageQuitCount() external view returns (uint256) {
        return rageQuitCount[msg.sender];
    }

    /**
     * @notice Get the total number of RageQuits across all users
     * @return The total RageQuit count
     */
    function getTotalRageQuits() external view returns (uint256) {
        return totalRageQuits;
    }
}
