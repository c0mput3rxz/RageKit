import { create } from 'zustand'

export interface SelectedToken {
  chainId: number
  address: string
  symbol: string
  balance: string
  selectedAmount: string
}

interface RageQuitStore {
  selectedTokens: Map<string, SelectedToken>
  toggleToken: (token: {
    chainId: number
    address: string
    symbol: string
    balance: string
  }) => void
  updateAmount: (key: string, amount: string) => void
  clearSelections: () => void
  isTokenSelected: (chainId: number, address: string) => boolean
  getSelectedAmount: (chainId: number, address: string) => string
  getAllSelected: () => SelectedToken[]
}

const getTokenKey = (chainId: number, address: string) => `${chainId}-${address}`

export const useRageQuitStore = create<RageQuitStore>((set, get) => ({
  selectedTokens: new Map(),

  toggleToken: (token) => {
    const key = getTokenKey(token.chainId, token.address)
    const newMap = new Map(get().selectedTokens)

    if (newMap.has(key)) {
      // Deselect
      newMap.delete(key)
    } else {
      // Select with full balance by default
      newMap.set(key, {
        ...token,
        selectedAmount: token.balance,
      })
    }

    set({ selectedTokens: newMap })
  },

  updateAmount: (key, amount) => {
    const newMap = new Map(get().selectedTokens)
    const token = newMap.get(key)

    if (token) {
      newMap.set(key, { ...token, selectedAmount: amount })
      set({ selectedTokens: newMap })
    }
  },

  clearSelections: () => {
    set({ selectedTokens: new Map() })
  },

  isTokenSelected: (chainId, address) => {
    const key = getTokenKey(chainId, address)
    return get().selectedTokens.has(key)
  },

  getSelectedAmount: (chainId, address) => {
    const key = getTokenKey(chainId, address)
    return get().selectedTokens.get(key)?.selectedAmount || ''
  },

  getAllSelected: () => {
    return Array.from(get().selectedTokens.values())
  },
}))
