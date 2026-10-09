// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockAUSD
/// @notice MOCK TOKEN FOR TESTNET DEMOS ONLY. Not AUSD, not real money.
/// Mirrors a USD stablecoin's 6 decimals. Anyone can mint, so balances mean nothing.
contract MockAUSD is ERC20, ERC20Permit {
    constructor() ERC20("Mock AUSD", "mAUSD") ERC20Permit("Mock AUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Open mint for demo funding. Testnet only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
