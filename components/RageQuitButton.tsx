'use client'

import { useState } from 'react'
import { useAccount, useWalletClient, useSwitchChain, usePublicClient } from 'wagmi'
import { getSwapTransaction, getApproveTransaction, checkAllowance } from '@/lib/1inch'
import { STABLECOINS } from '@/lib/constants'
import { useRageQuitStore } from '@/stores/useRageQuitStore'
import { parseUnits } from 'viem'
import { base } from 'viem/chains'
import type { WalletClient } from 'viem'

const RAGEQUIT_CONTRACT = '0x2c36BB66ace498F62b1709E60b0614bA1C360c2c'
const RAGEQUIT_ABI = [
  {
    inputs: [{ name: 'count', type: 'uint256' }],
    name: 'recordBatchRageQuit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

interface RageQuitButtonProps {
  onComplete?: () => void
  onOptimisticUpdate?: (chainId: number, tokenAddress: string, amountSwapped: bigint, decimals: number) => void
  recordOnChain: boolean
}

export function RageQuitButton({
  onComplete,
  onOptimisticUpdate,
  recordOnChain,
}: RageQuitButtonProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()
  const [isExecuting, setIsExecuting] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState(0)

  const { getAllSelected, getAllTokens, clearSelections } = useRageQuitStore()

  async function executeRageQuit() {
    console.log('🧨 RageQuit button clicked!')

    if (!address || !walletClient) {
      console.error('Wallet not connected', { address, walletClient })
      setStatus('Please connect your wallet')
      return
    }

    const selectedTokens = getAllSelected()
    console.log('Selected tokens:', selectedTokens)

    if (selectedTokens.length === 0) {
      console.warn('No tokens selected')
      setStatus('No tokens selected. Please select tokens to swap.')
      return
    }

    setIsExecuting(true)
    setStatus('Starting RageQuit...')
    setProgress(0)

    try {
      const totalSteps = selectedTokens.length * 2 // Approve + swap for each token
      let currentStep = 0

      // Match selected tokens with their full balance data from Zustand
      const allTokens = getAllTokens()
      const tokensToSwap = selectedTokens.map(selected => {
        const fullBalance = allTokens.find(
          (t) => t.chainId === selected.chainId && t.address === selected.address
        )
        if (!fullBalance) return null

        // Validate selectedAmount - skip if empty or invalid
        if (!selected.selectedAmount || selected.selectedAmount.trim() === '') {
          console.warn(`Skipping ${selected.symbol} - no amount specified`)
          return null
        }

        // Calculate the amount to swap in raw units
        const decimals = fullBalance.decimals || 18
        try {
          const amountToSwap = parseUnits(selected.selectedAmount, decimals)

          // Skip if amount is 0
          if (amountToSwap === 0n) {
            console.warn(`Skipping ${selected.symbol} - amount is 0`)
            return null
          }

          return {
            ...fullBalance,
            rawBalance: amountToSwap,
          }
        } catch (error) {
          console.error(`Invalid amount for ${selected.symbol}: ${selected.selectedAmount}`, error)
          return null
        }
      }).filter(Boolean) as typeof allTokens

      // Check if there are any valid tokens to swap
      if (tokensToSwap.length === 0) {
        console.warn('No valid tokens to swap after filtering')
        setStatus('No valid amounts to swap. Please enter amounts for selected tokens.')
        return
      }

      console.log('Tokens to swap:', tokensToSwap)

      // Group balances by chain
      const balancesByChain = tokensToSwap.reduce((acc, balance) => {
        if (!acc[balance.chainId]) {
          acc[balance.chainId] = []
        }
        acc[balance.chainId].push(balance)
        return acc
      }, {} as Record<number, typeof tokensToSwap>)

      console.log('Balances grouped by chain:', balancesByChain)

      // Execute swaps chain by chain
      for (const [chainId, chainBalances] of Object.entries(balancesByChain)) {
        const chain = parseInt(chainId)
        console.log(`🔗 Processing chain ${chain} with ${chainBalances.length} tokens`)

        // Get target stablecoin for this chain
        const targetStable = STABLECOINS[chain]?.[0]
        if (!targetStable) {
          console.warn(`No stablecoin configured for chain ${chain}`)
          continue
        }
        console.log(`Target stablecoin: ${targetStable.symbol} (${targetStable.address})`)

        // Switch to the chain if needed
        if (walletClient.chain.id !== chain) {
          console.log(`Switching from chain ${walletClient.chain.id} to ${chain}`)
          setStatus(`Switching to chain ${chain}...`)
          await switchChain({ chainId: chain })
          // Wait a bit for the switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Filter out tokens that don't need swapping
        const tokensNeedingSwap = chainBalances.filter(balance => {
          if (balance.address.toLowerCase() === targetStable.address.toLowerCase()) {
            console.log(`Skipping ${balance.symbol} - already target stablecoin`)
            return false
          }
          if (balance.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
            console.log(`Skipping native token ${balance.symbol}`)
            return false
          }
          return true
        })

        if (tokensNeedingSwap.length === 0) {
          console.log('No tokens need swapping on this chain')
          continue
        }

        // PHASE 1: Batch all approvals
        console.log('🔄 Phase 1: Batching all approvals...')
        setStatus('Checking allowances and preparing approvals...')

        const approvalsNeeded: Array<{
          balance: typeof tokensNeedingSwap[0]
          approveTx: { data: string; gasPrice: string; to: string; value: string }
        }> = []

        for (const balance of tokensNeedingSwap) {
          console.log(`✅ Checking allowance for ${balance.symbol}...`)

          const allowance = await checkAllowance(chain, balance.address, address)
          console.log(`Current allowance for ${balance.symbol}: ${allowance}, needed: ${balance.rawBalance.toString()}`)

          if (BigInt(allowance) < balance.rawBalance) {
            console.log(`🔐 Approval needed for ${balance.symbol}`)
            const approveTx = await getApproveTransaction(
              chain,
              balance.address,
              balance.rawBalance.toString()
            )
            approvalsNeeded.push({ balance, approveTx })
          } else {
            console.log(`✅ Sufficient allowance for ${balance.symbol}`)
            currentStep++
            setProgress((currentStep / totalSteps) * 100)
          }
        }

        // Execute all approvals in parallel
        if (approvalsNeeded.length > 0) {
          console.log(`📦 Executing ${approvalsNeeded.length} approvals in parallel...`)
          setStatus(`Approving ${approvalsNeeded.length} token${approvalsNeeded.length > 1 ? 's' : ''}...`)

          const approvalPromises = approvalsNeeded.map(async ({ balance, approveTx }) => {
            try {
              const approveHash = await walletClient.sendTransaction({
                to: approveTx.to as `0x${string}`,
                data: approveTx.data as `0x${string}`,
                value: BigInt(approveTx.value),
              })
              console.log(`Approve tx hash for ${balance.symbol}: ${approveHash}`)
              return { balance, hash: approveHash }
            } catch (error) {
              console.error(`❌ Error approving ${balance.symbol}:`, error)
              return null
            }
          })

          const approvalResults = await Promise.all(approvalPromises)

          // Wait for all approvals to confirm
          setStatus('Waiting for all approvals to confirm...')
          const confirmationPromises = approvalResults
            .filter(result => result !== null)
            .map(async (result) => {
              if (publicClient && result) {
                try {
                  await publicClient.waitForTransactionReceipt({ hash: result.hash })
                  console.log(`✅ Approval confirmed for ${result.balance.symbol}`)
                  currentStep++
                  setProgress((currentStep / totalSteps) * 100)
                } catch (error) {
                  console.error(`❌ Error confirming approval for ${result.balance.symbol}:`, error)
                }
              }
            })

          await Promise.all(confirmationPromises)
          console.log('✅ All approvals confirmed!')
        }

        // PHASE 2: Batch all swaps
        console.log('🔄 Phase 2: Batching all swaps...')
        setStatus('Preparing swaps...')

        const swapPromises = tokensNeedingSwap.map(async (balance) => {
          try {
            console.log(`🔄 Getting swap transaction for ${balance.symbol}...`)

            const swapTx = await getSwapTransaction({
              chainId: chain,
              src: balance.address,
              dst: targetStable.address,
              amount: balance.rawBalance.toString(),
              from: address,
              slippage: 3,
            })
            console.log(`Swap transaction prepared for ${balance.symbol}`)

            return { balance, swapTx }
          } catch (error) {
            console.error(`❌ Error preparing swap for ${balance.symbol}:`, error)
            currentStep += 2 // Skip both approval and swap steps
            setProgress((currentStep / totalSteps) * 100)
            return null
          }
        })

        const swapsToExecute = (await Promise.all(swapPromises)).filter(swap => swap !== null)

        if (swapsToExecute.length > 0) {
          console.log(`📦 Executing ${swapsToExecute.length} swaps in parallel...`)
          setStatus(`Swapping ${swapsToExecute.length} token${swapsToExecute.length > 1 ? 's' : ''} to ${targetStable.symbol}...`)

          const swapExecutionPromises = swapsToExecute.map(async ({ balance, swapTx }) => {
            try {
              const swapHash = await walletClient.sendTransaction({
                to: swapTx.tx.to as `0x${string}`,
                data: swapTx.tx.data as `0x${string}`,
                value: BigInt(swapTx.tx.value),
                gas: BigInt(swapTx.tx.gas),
              })
              console.log(`Swap tx hash for ${balance.symbol}: ${swapHash}`)
              return { balance, hash: swapHash }
            } catch (error) {
              console.error(`❌ Error swapping ${balance.symbol}:`, error)
              return null
            }
          })

          const swapResults = await Promise.all(swapExecutionPromises)

          // Wait for all swaps to confirm
          setStatus('Waiting for all swaps to confirm...')
          const swapConfirmationPromises = swapResults
            .filter(result => result !== null)
            .map(async (result) => {
              if (publicClient && result) {
                try {
                  await publicClient.waitForTransactionReceipt({ hash: result.hash })
                  console.log(`✅ Swap confirmed for ${result.balance.symbol}`)

                  // Optimistically update balance
                  if (onOptimisticUpdate) {
                    console.log(`🔄 Optimistically updating ${result.balance.symbol} balance...`)
                    onOptimisticUpdate(chain, result.balance.address, result.balance.rawBalance, result.balance.decimals)
                  }

                  currentStep++
                  setProgress((currentStep / totalSteps) * 100)
                } catch (error) {
                  console.error(`❌ Error confirming swap for ${result.balance.symbol}:`, error)
                }
              }
            })

          await Promise.all(swapConfirmationPromises)
          console.log('✅ All swaps confirmed!')
        }
      }

      setStatus('RageQuit complete! 🎉')
      setProgress(100)

      // Record on-chain if enabled
      if (recordOnChain && tokensToSwap.length > 0) {
        try {
          console.log('📝 Recording RageQuit on Base contract...')
          setStatus('Recording on-chain...')

          // Switch to Base if needed
          if (walletClient.chain.id !== base.id) {
            await switchChain({ chainId: base.id })
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          // Call the contract to record the rage quit
          const hash = await walletClient.writeContract({
            address: RAGEQUIT_CONTRACT,
            abi: RAGEQUIT_ABI,
            functionName: 'recordBatchRageQuit',
            args: [BigInt(tokensToSwap.length)],
          })

          console.log('Contract call hash:', hash)

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash })
            console.log('✅ RageQuit recorded on-chain!')
            setStatus('RageQuit recorded on-chain! 🎉')
          }
        } catch (error) {
          console.error('Failed to record on-chain:', error)
          // Don't fail the whole operation if recording fails
          setStatus('RageQuit complete (on-chain recording failed)')
        }
      }

      // Clear selections after successful rage quit
      clearSelections()

      // Refresh balances to show updated amounts
      if (onComplete) {
        console.log('🔄 Refreshing balances...')
        onComplete()
      }
    } catch (error) {
      console.error('RageQuit error:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setTimeout(() => {
        setIsExecuting(false)
        setStatus('')
        setProgress(0)
      }, 5000)
    }
  }

  const selectedCount = getAllSelected().length

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <button
        onClick={executeRageQuit}
        disabled={isExecuting || selectedCount === 0}
        className="group relative w-full py-8 text-3xl font-black text-white bg-linear-to-r from-red-600 via-red-500 to-orange-600 rounded-2xl shadow-2xl hover:shadow-red-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden"
      >
        {/* Animated background */}
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

        <span className="relative flex flex-col items-center justify-center gap-1">
          {isExecuting ? (
            <>
              <span className="animate-spin text-4xl">🧨</span>
              <span className="animate-pulse">RAGING...</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-3">
                <span className="group-hover:animate-bounce">🧨</span>
                <span>RAGEQUIT</span>
              </span>
              {selectedCount > 0 && (
                <span className="text-sm font-semibold text-red-200">
                  {selectedCount} token{selectedCount !== 1 ? 's' : ''} selected
                </span>
              )}
              {selectedCount === 0 && (
                <span className="text-sm font-medium text-red-200/60">
                  Select tokens to rage quit
                </span>
              )}
            </>
          )}
        </span>
      </button>

      {isExecuting && (
        <div className="w-full space-y-3">
          <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-red-500 via-orange-500 to-red-600 rounded-full transition-all duration-500 shadow-lg shadow-red-500/50"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-center text-gray-400 font-medium">
              {status}
            </p>
          </div>
        </div>
      )}

      {!isExecuting && status && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
          <span className="text-2xl">🎉</span>
          <p className="text-sm text-green-400 font-medium">
            {status}
          </p>
        </div>
      )}
    </div>
  )
}
