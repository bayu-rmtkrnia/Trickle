// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TricklePayroll} from "../src/TricklePayroll.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";

/// @notice Deploys TricklePayroll. Reuses TOKEN_ADDRESS when set, otherwise deploys MockAUSD first.
/// The signer comes from the CLI (`--account <keystore>`), never from a file in the repo:
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --account trickle-deployer --broadcast
contract Deploy is Script {
    function run() external returns (TricklePayroll payroll, address token) {
        token = vm.envOr("TOKEN_ADDRESS", address(0));

        vm.startBroadcast();
        if (token == address(0)) {
            token = address(new MockAUSD());
            console.log("MockAUSD (MOCK, testnet only):", token);
        }
        payroll = new TricklePayroll(IERC20(token));
        vm.stopBroadcast();

        console.log("TricklePayroll:", address(payroll));
        console.log("Token:", token);
    }
}
