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

interface RageQuitStatsProps {
  recordOnChain: boolean
  onToggleRecord: (value: boolean) => void
}

export function RageQuitStats({ recordOnChain, onToggleRecord }: RageQuitStatsProps) {
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
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl">
      {/* Counter Display */}
      <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
        <span className="text-xl">🔥</span>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 leading-none">RageQuits</span>
          {loading ? (
            <span className="text-sm text-gray-400">...</span>
          ) : (
            <span className="text-lg font-bold text-red-500 leading-tight">
              {count?.toString() || '0'}
            </span>
          )}
        </div>
      </div>

      {/* Record Toggle */}
      <label className="flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          checked={recordOnChain}
          onChange={(e) => onToggleRecord(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
        />
        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
          Record
        </span>
      </label>
    </div>
  )
}
