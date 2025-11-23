import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { ERC20_ABI, DEGEN_TOKENS, SUPPORTED_CHAINS } from '@/lib/constants'
import { useRageQuitStore } from '@/stores/useRageQuitStore'

export interface TokenBalance {
  chainId: number
  chainName: string
  address: string
  symbol: string
  balance: string
  rawBalance: bigint
  decimals: number
}

export function useTokenBalances() {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const { setTokens, updateTokenBalance } = useRageQuitStore()

  const fetchBalances = async (force = false) => {
    // Prevent concurrent fetches unless forced
    if (isFetching && !force) {
      console.log('⏭️ Skipping fetch - already fetching')
      return
    }

    if (!address || !isConnected) {
      // Don't clear tokens if we're just temporarily disconnected
      if (force) {
        setTokens([])
      }
      return
    }

    setIsFetching(true)
    setIsLoading(true)
    setError(null)

    try {
      const allBalances: TokenBalance[] = []

      for (const chain of SUPPORTED_CHAINS) {
        const tokens = DEGEN_TOKENS[chain.id] || []

        for (const token of tokens) {
          try {
            // Create a public client for this chain
            const { createPublicClient, http } = await import('viem')
            const publicClient = createPublicClient({
              chain,
              transport: http(),
            })

            const balance = (await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            })) as bigint

            if (balance > 0n) {
              allBalances.push({
                chainId: chain.id,
                chainName: chain.name,
                address: token.address,
                symbol: token.symbol,
                balance: formatUnits(balance, token.decimals),
                rawBalance: balance,
                decimals: token.decimals,
              })
            }
          } catch (err) {
            console.error(
              `Error fetching balance for ${token.symbol} on ${chain.name}:`,
              err
            )
          }
        }
      }

      // Store in Zustand instead of local state
      setTokens(allBalances.map(b => ({
        ...b,
        priceChange24h: null,
        isSelected: false,
        selectedAmount: '',
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  useEffect(() => {
    // Only fetch on initial mount or when address changes
    // Don't refetch on every isConnected change to avoid clearing tokens during chain switches
    if (address) {
      fetchBalances()
    }
  }, [address])

  // Optimistically update balance after successful swap
  const updateBalanceOptimistically = (chainId: number, tokenAddress: string, amountSwapped: bigint, decimals: number) => {
    const tokens = useRageQuitStore.getState().tokens
    const key = `${chainId}-${tokenAddress.toLowerCase()}`
    const token = tokens.get(key)

    if (token) {
      const newRawBalance = token.rawBalance - amountSwapped

      // If balance is now 0 or negative, remove it
      if (newRawBalance <= 0n) {
        updateTokenBalance(chainId, tokenAddress, '0', 0n)
      } else {
        // Otherwise update with new balance
        const newBalance = formatUnits(newRawBalance, decimals)
        updateTokenBalance(chainId, tokenAddress, newBalance, newRawBalance)
      }
    }
  }

  return { isLoading, error, refetch: fetchBalances, updateBalanceOptimistically }
}
