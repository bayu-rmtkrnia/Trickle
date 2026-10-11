import { defineChain, getAddress, type Address } from 'viem'
import manifest from '../../../../packages/shared/deployments/testnet.json'

export interface PayrollConfig {
  chainId: number
  rpcUrl: string
  payrollAddress: Address
  tokenAddress: Address
  deploymentBlock: bigint
  tokenDecimals: number
  isMock: boolean
  explorerUrl: string
}
export const payrollConfig: PayrollConfig = {
  chainId: manifest.chainId,
  rpcUrl: manifest.rpcUrl,
  payrollAddress: getAddress(manifest.contracts.TricklePayroll.address),
  tokenAddress: getAddress(manifest.contracts.MockAUSD.address),
  deploymentBlock: BigInt(manifest.contracts.TricklePayroll.deployBlock),
  tokenDecimals: manifest.contracts.MockAUSD.decimals,
  isMock: manifest.contracts.MockAUSD.mock,
  explorerUrl: manifest.explorer,
}
export const payrollChain = defineChain({
  id: payrollConfig.chainId,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [payrollConfig.rpcUrl] } },
  blockExplorers: { default: { name: 'Explorer', url: payrollConfig.explorerUrl } },
  testnet: true,
})
