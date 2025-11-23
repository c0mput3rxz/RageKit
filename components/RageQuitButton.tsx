'use client'

import { useState } from 'react'
import { useAccount, useWalletClient, useSwitchChain, usePublicClient } from 'wagmi'
import { type TokenBalance } from '@/hooks/useTokenBalances'
import { getSwapTransaction, getApproveTransaction, checkAllowance } from '@/lib/1inch'
import { STABLECOINS } from '@/lib/constants'
import { useRageQuitStore } from '@/stores/useRageQuitStore'
import { parseUnits } from 'viem'

interface RageQuitButtonProps {
  balances: TokenBalance[]
  onComplete?: () => void
}

export function RageQuitButton({
  balances,
  onComplete,
}: RageQuitButtonProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()
  const [isExecuting, setIsExecuting] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState(0)

  const { getAllSelected, clearSelections } = useRageQuitStore()

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

      // Match selected tokens with their full balance data
      const tokensToSwap = selectedTokens.map(selected => {
        const fullBalance = balances.find(
          b => b.chainId === selected.chainId && b.address === selected.address
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
      }).filter(Boolean) as TokenBalance[]

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
      }, {} as Record<number, TokenBalance[]>)

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

        // Process each token on this chain
        for (const balance of chainBalances) {
          console.log(`💰 Processing ${balance.symbol}:`, {
            address: balance.address,
            amount: balance.balance,
            rawBalance: balance.rawBalance.toString(),
          })
          // Skip if this is already the target stablecoin
          if (balance.address.toLowerCase() === targetStable.address.toLowerCase()) {
            currentStep += 2
            setProgress((currentStep / totalSteps) * 100)
            continue
          }

          // Skip native tokens for now (would need wrapping)
          if (balance.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
            console.log(`Skipping native token ${balance.symbol}`)
            currentStep += 2
            setProgress((currentStep / totalSteps) * 100)
            continue
          }

          try {
            console.log(`✅ Checking allowance for ${balance.symbol}...`)
            setStatus(`Checking allowance for ${balance.symbol}...`)

            // Check allowance
            const allowance = await checkAllowance(
              chain,
              balance.address,
              address
            )
            console.log(`Current allowance: ${allowance}, needed: ${balance.rawBalance.toString()}`)

            // Approve if needed
            if (BigInt(allowance) < balance.rawBalance) {
              console.log(`🔐 Approval needed for ${balance.symbol}`)
              setStatus(`Approving ${balance.symbol}...`)

              const approveTx = await getApproveTransaction(
                chain,
                balance.address,
                balance.rawBalance.toString()
              )
              console.log('Approve transaction:', approveTx)

              const approveHash = await walletClient.sendTransaction({
                to: approveTx.to as `0x${string}`,
                data: approveTx.data as `0x${string}`,
                value: BigInt(approveTx.value),
              })
              console.log(`Approve tx hash: ${approveHash}`)

              setStatus(`Waiting for approval of ${balance.symbol}...`)
              if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: approveHash })
                console.log(`Approval confirmed for ${balance.symbol}`)
              }
            } else {
              console.log(`✅ Sufficient allowance for ${balance.symbol}`)
            }

            currentStep++
            setProgress((currentStep / totalSteps) * 100)

            // Execute swap
            console.log(`🔄 Getting swap transaction for ${balance.symbol}...`)
            setStatus(`Swapping ${balance.symbol} to ${targetStable.symbol}...`)

            const swapTx = await getSwapTransaction({
              chainId: chain,
              src: balance.address,
              dst: targetStable.address,
              amount: balance.rawBalance.toString(),
              from: address,
              slippage: 3, // 3% slippage
            })
            console.log('Swap transaction:', swapTx)

            const swapHash = await walletClient.sendTransaction({
              to: swapTx.tx.to as `0x${string}`,
              data: swapTx.tx.data as `0x${string}`,
              value: BigInt(swapTx.tx.value),
              gas: BigInt(swapTx.tx.gas),
            })
            console.log(`Swap tx hash: ${swapHash}`)

            setStatus(`Waiting for swap of ${balance.symbol}...`)
            if (publicClient) {
              await publicClient.waitForTransactionReceipt({ hash: swapHash })
              console.log(`✅ Swap confirmed for ${balance.symbol}`)
            }

            currentStep++
            setProgress((currentStep / totalSteps) * 100)

            console.log(`✅ Successfully swapped ${balance.symbol}`)
          } catch (error) {
            console.error(`❌ Error swapping ${balance.symbol}:`, error)
            // Continue with other tokens even if one fails
            currentStep += 2
            setProgress((currentStep / totalSteps) * 100)
          }
        }
      }

      setStatus('RageQuit complete! 🎉')
      setProgress(100)

      // Clear selections after successful rage quit
      clearSelections()

      if (onComplete) {
        setTimeout(() => {
          onComplete()
        }, 2000)
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
