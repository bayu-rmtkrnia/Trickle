// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITricklePayroll} from "./ITricklePayroll.sol";

/// @title TricklePayroll
/// @notice Employers prefund salary streams that unlock linearly per second. Workers withdraw
/// whenever they want, and can route a share of every withdrawal to up to MAX_RECIPIENTS family
/// members.
/// @dev No owner, no admin, no upgrades. Hackathon prototype, not audited.
contract TricklePayroll is ITricklePayroll, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 internal constant MAX_BPS = 10_000;

    /// @notice Keeps withdraw gas bounded: at most this many extra transfers per withdrawal.
    uint256 public constant MAX_RECIPIENTS = 3;

    IERC20 public immutable token;

    /// @notice Id the next stream will get. Written only by createStream, never by withdraw.
    uint256 public nextStreamId = 1;

    mapping(uint256 => Stream) internal _streams;
    mapping(address => Split[]) internal _splits;

    constructor(IERC20 token_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    // ---------------------------------------------------------------------------------------------
    // Mutating
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ITricklePayroll
    function createStream(address worker, uint128 amount, uint40 start, uint40 end)
        external
        nonReentrant
        returns (uint256 streamId)
    {
        if (worker == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint40 effectiveStart = start == 0 ? uint40(block.timestamp) : start;
        if (start != 0 && start < block.timestamp) revert InvalidTimeRange();
        if (end <= effectiveStart) revert InvalidTimeRange();

        streamId = nextStreamId++;
        _streams[streamId] = Stream({
            employer: msg.sender,
            start: effectiveStart,
            end: end,
            canceled: false,
            worker: worker,
            amount: amount,
            withdrawn: 0,
            refunded: 0
        });

        emit StreamCreated(streamId, msg.sender, worker, amount, effectiveStart, end);

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc ITricklePayroll
    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage s = _getStream(streamId);
        if (msg.sender != s.worker) revert NotWorker(streamId);

        uint128 available = _streamedAmount(s) - s.withdrawn;
        if (available == 0) revert NothingToWithdraw(streamId);

        s.withdrawn += available;

        Split[] memory splits = _splits[msg.sender];
        uint128[] memory shares = new uint128[](splits.length);
        uint128 toRecipients = 0;
        for (uint256 i; i < splits.length; ++i) {
            // Rounds down, so any dust stays with the worker. Total bps <= 10_000, so the
            // shares never add up to more than `available`.
            shares[i] = uint128(uint256(available) * splits[i].bps / MAX_BPS);
            toRecipients += shares[i];
        }
        uint128 toWorker = available - toRecipients;

        emit Withdrawn(streamId, msg.sender, toWorker, toRecipients);
        for (uint256 i; i < splits.length; ++i) {
            if (shares[i] > 0) {
                emit SplitPaid(streamId, msg.sender, splits[i].recipient, shares[i]);
            }
        }

        if (toWorker > 0) token.safeTransfer(msg.sender, toWorker);
        for (uint256 i; i < splits.length; ++i) {
            if (shares[i] > 0) token.safeTransfer(splits[i].recipient, shares[i]);
        }
    }

    /// @inheritdoc ITricklePayroll
    function setSplits(Split[] calldata splits) external {
        if (splits.length > MAX_RECIPIENTS) revert TooManyRecipients();

        delete _splits[msg.sender];
        Split[] storage stored = _splits[msg.sender];

        uint256 totalBps = 0;
        for (uint256 i; i < splits.length; ++i) {
            Split calldata split = splits[i];
            if (split.recipient == address(0) || split.bps == 0) revert InvalidSplit();
            for (uint256 j; j < i; ++j) {
                if (splits[j].recipient == split.recipient) {
                    revert DuplicateRecipient(split.recipient);
                }
            }
            totalBps += split.bps;
            stored.push(split);
        }
        if (totalBps > MAX_BPS) revert InvalidSplit();

        emit SplitUpdated(msg.sender, splits);
    }

    /// @inheritdoc ITricklePayroll
    function cancel(uint256 streamId) external nonReentrant {
        Stream storage s = _getStream(streamId);
        if (msg.sender != s.employer) revert NotEmployer(streamId);
        if (s.canceled) revert StreamAlreadyCanceled(streamId);
        if (block.timestamp >= s.end) revert StreamAlreadyEnded(streamId);

        uint128 streamedAtCancel = _streamedAmount(s);
        uint128 refund = s.amount - streamedAtCancel;

        s.canceled = true;
        s.refunded = refund;

        emit StreamCanceled(streamId, streamedAtCancel, refund);

        if (refund > 0) token.safeTransfer(s.employer, refund);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @inheritdoc ITricklePayroll
    function getStream(uint256 streamId) external view returns (Stream memory) {
        return _getStream(streamId);
    }

    /// @inheritdoc ITricklePayroll
    function streamedAmount(uint256 streamId) external view returns (uint128) {
        return _streamedAmount(_getStream(streamId));
    }

    /// @inheritdoc ITricklePayroll
    function withdrawable(uint256 streamId) external view returns (uint128) {
        Stream storage s = _getStream(streamId);
        return _streamedAmount(s) - s.withdrawn;
    }

    /// @inheritdoc ITricklePayroll
    function splitsOf(address worker) external view returns (Split[] memory) {
        return _splits[worker];
    }

    /// @inheritdoc ITricklePayroll
    function splitBpsOf(address worker, address recipient) external view returns (uint16) {
        Split[] storage splits = _splits[worker];
        for (uint256 i; i < splits.length; ++i) {
            if (splits[i].recipient == recipient) return splits[i].bps;
        }
        return 0;
    }

    // ---------------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------------

    function _getStream(uint256 streamId) internal view returns (Stream storage s) {
        s = _streams[streamId];
        if (s.worker == address(0)) revert StreamNotFound(streamId);
    }

    /// @dev amount * elapsed / duration. Frozen at cancel time once canceled
    /// (refunded holds exactly the part that had not streamed yet).
    function _streamedAmount(Stream storage s) internal view returns (uint128) {
        if (s.canceled) return s.amount - s.refunded;
        if (block.timestamp <= s.start) return 0;
        if (block.timestamp >= s.end) return s.amount;
        // Fits in uint256: uint128 * uint40.
        return uint128(uint256(s.amount) * (block.timestamp - s.start) / (s.end - s.start));
    }
}
