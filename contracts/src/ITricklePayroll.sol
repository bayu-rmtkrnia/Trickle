// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITricklePayroll
/// @notice Prefunded, linear salary streams with an optional per-worker family split.
/// See docs/contract-spec.md for the full spec.
interface ITricklePayroll {
    /// @dev Packed into 4 storage slots. Each stream lives in its own slots so withdrawals
    /// from different workers never write shared contract state.
    struct Stream {
        address employer;
        uint40 start;
        uint40 end;
        bool canceled;
        address worker;
        uint128 amount;
        uint128 withdrawn;
        uint128 refunded;
    }

    struct Split {
        address recipient;
        uint16 bps;
    }

    event StreamCreated(
        uint256 indexed streamId,
        address indexed employer,
        address indexed worker,
        uint128 amount,
        uint40 start,
        uint40 end
    );
    event Withdrawn(
        uint256 indexed streamId,
        address indexed worker,
        uint128 toWorker,
        address indexed recipient,
        uint128 toRecipient
    );
    event SplitUpdated(address indexed worker, address indexed recipient, uint16 bps);
    event StreamCanceled(uint256 indexed streamId, uint128 streamedAtCancel, uint128 refunded);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidTimeRange();
    error InvalidSplit();
    error StreamNotFound(uint256 streamId);
    error NotWorker(uint256 streamId);
    error NotEmployer(uint256 streamId);
    error NothingToWithdraw(uint256 streamId);
    error StreamAlreadyCanceled(uint256 streamId);
    error StreamAlreadyEnded(uint256 streamId);

    /// @notice Pulls `amount` from the caller and streams it to `worker` between `start` and `end`.
    /// @param start Unix seconds; 0 means "now".
    function createStream(address worker, uint128 amount, uint40 start, uint40 end)
        external
        returns (uint256 streamId);

    /// @notice Sends everything withdrawable to the worker, minus the split share for the recipient.
    function withdraw(uint256 streamId) external;

    /// @notice Sets the caller's split for all their streams. `recipient = 0` turns it off.
    function setSplit(address recipient, uint16 bps) external;

    /// @notice Stops the stream and refunds the unstreamed remainder to the employer.
    function cancel(uint256 streamId) external;

    function getStream(uint256 streamId) external view returns (Stream memory);
    function streamedAmount(uint256 streamId) external view returns (uint128);
    function withdrawable(uint256 streamId) external view returns (uint128);
    function splitOf(address worker) external view returns (address recipient, uint16 bps);
}
