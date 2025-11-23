'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const RAGEQUIT_CONTRACT = '0x2c36BB66ace498F62b1709E60b0614bA1C360c2c'

const ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getRageQuitCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

export function RageQuitCounter() {
  const { address } = useAccount()
  const [count, setCount] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setCount(null)
      return
    }

    const fetchCount = async () => {
      setLoading(true)
      try {
        const result = await publicClient.readContract({
          address: RAGEQUIT_CONTRACT,
          abi: ABI,
          functionName: 'getRageQuitCount',
          args: [address as `0x${string}`],
        })
        setCount(result)
      } catch (error) {
        console.error('Failed to fetch RageQuit count:', error)
        setCount(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCount()
  }, [address])

  if (!address) {
    return null
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔥</span>
        <h3 className="text-lg font-bold text-white">
          Your RageQuits
        </h3>
      </div>

      <div className="text-center py-4">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : (
          <>
            <div className="text-4xl font-bold text-red-500">
              {count?.toString() || '0'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total rage quits on Base
            </div>
          </>
        )}
      </div>

      <div className="text-xs text-gray-600 text-center pt-3 border-t border-slate-800">
        Contract: {RAGEQUIT_CONTRACT.slice(0, 6)}...{RAGEQUIT_CONTRACT.slice(-4)}
      </div>
    </div>
  )
}
