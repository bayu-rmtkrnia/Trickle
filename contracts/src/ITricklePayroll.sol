// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITricklePayroll
/// @notice Prefunded, linear salary streams with an optional per-worker family split
/// (up to MAX_RECIPIENTS recipients). See docs/contract-spec.md for the full spec.
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

    /// @dev One slot per entry.
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
    /// @notice `toRecipients` is the total sent to all split recipients; see SplitPaid for each one.
    event Withdrawn(
        uint256 indexed streamId, address indexed worker, uint128 toWorker, uint128 toRecipients
    );
    /// @notice One per recipient that received a non-zero share in a withdrawal.
    event SplitPaid(
        uint256 indexed streamId, address indexed worker, address indexed recipient, uint128 amount
    );
    /// @notice The worker's full split list after the update. Empty means split is off.
    event SplitUpdated(address indexed worker, Split[] splits);
    event StreamCanceled(uint256 indexed streamId, uint128 streamedAtCancel, uint128 refunded);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidTimeRange();
    error InvalidSplit();
    error TooManyRecipients();
    error DuplicateRecipient(address recipient);
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

    /// @notice Sends everything withdrawable to the worker, minus each split recipient's share.
    function withdraw(uint256 streamId) external;

    /// @notice Replaces the caller's split list for all their streams. An empty list turns it off.
    function setSplits(Split[] calldata splits) external;

    /// @notice Stops the stream and refunds the unstreamed remainder to the employer.
    function cancel(uint256 streamId) external;

    function MAX_RECIPIENTS() external view returns (uint256);
    function getStream(uint256 streamId) external view returns (Stream memory);
    function streamedAmount(uint256 streamId) external view returns (uint128);
    function withdrawable(uint256 streamId) external view returns (uint128);
    function splitsOf(address worker) external view returns (Split[] memory);
    /// @notice The share `recipient` gets from `worker`'s withdrawals, or 0 if it is not a recipient.
    function splitBpsOf(address worker, address recipient) external view returns (uint16);
}
