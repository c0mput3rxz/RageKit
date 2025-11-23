import { create } from 'zustand'

export interface TokenData {
  chainId: number
  chainName: string
  address: string
  symbol: string
  balance: string
  rawBalance: bigint
  decimals: number
  priceChange24h: number | null
  isSelected: boolean
  selectedAmount: string
}

export interface SelectedToken {
  chainId: number
  address: string
  symbol: string
  balance: string
  selectedAmount: string
}

interface RageQuitStore {
  tokens: Map<string, TokenData>
  selectedTokens: Map<string, SelectedToken>
  setTokens: (tokens: TokenData[]) => void
  updateTokenData: (chainId: number, address: string, updates: Partial<TokenData>) => void
  toggleToken: (token: {
    chainId: number
    address: string
    symbol: string
    balance: string
  }) => void
  updateAmount: (key: string, amount: string) => void
  updateTokenBalance: (chainId: number, address: string, newBalance: string, newRawBalance: bigint) => void
  clearSelections: () => void
  isTokenSelected: (chainId: number, address: string) => boolean
  getSelectedAmount: (chainId: number, address: string) => string
  getAllSelected: () => SelectedToken[]
  getAllTokens: () => TokenData[]
}

const getTokenKey = (chainId: number, address: string) => `${chainId}-${address}`

export const useRageQuitStore = create<RageQuitStore>((set, get) => ({
  tokens: new Map(),
  selectedTokens: new Map(),

  setTokens: (tokens) => {
    const newTokensMap = new Map<string, TokenData>()
    tokens.forEach(token => {
      const key = getTokenKey(token.chainId, token.address)
      const existingToken = get().tokens.get(key)

      // Preserve selection state and health data if it exists
      newTokensMap.set(key, {
        ...token,
        priceChange24h: existingToken?.priceChange24h ?? token.priceChange24h,
        isSelected: existingToken?.isSelected ?? true, // Auto-select by default
        selectedAmount: existingToken?.selectedAmount ?? token.balance,
      })

      // Auto-select new tokens
      if (!existingToken) {
        const newSelectedMap = new Map(get().selectedTokens)
        newSelectedMap.set(key, {
          chainId: token.chainId,
          address: token.address,
          symbol: token.symbol,
          balance: token.balance,
          selectedAmount: token.balance,
        })
        set({ selectedTokens: newSelectedMap })
      }
    })
    set({ tokens: newTokensMap })
  },

  updateTokenData: (chainId, address, updates) => {
    const key = getTokenKey(chainId, address)
    const tokensMap = new Map(get().tokens)
    const token = tokensMap.get(key)

    if (token) {
      tokensMap.set(key, { ...token, ...updates })
      set({ tokens: tokensMap })
    }
  },

  toggleToken: (token) => {
    const key = getTokenKey(token.chainId, token.address)
    const tokensMap = new Map(get().tokens)
    const selectedMap = new Map(get().selectedTokens)
    const tokenData = tokensMap.get(key)

    if (selectedMap.has(key)) {
      // Deselect
      selectedMap.delete(key)
      if (tokenData) {
        tokensMap.set(key, { ...tokenData, isSelected: false })
      }
    } else {
      // Select with full balance by default
      selectedMap.set(key, {
        ...token,
        selectedAmount: token.balance,
      })
      if (tokenData) {
        tokensMap.set(key, { ...tokenData, isSelected: true, selectedAmount: token.balance })
      }
    }

    set({ selectedTokens: selectedMap, tokens: tokensMap })
  },

  updateAmount: (key, amount) => {
    const selectedMap = new Map(get().selectedTokens)
    const tokensMap = new Map(get().tokens)
    const token = selectedMap.get(key)
    const tokenData = tokensMap.get(key)

    if (token) {
      selectedMap.set(key, { ...token, selectedAmount: amount })
      set({ selectedTokens: selectedMap })
    }

    if (tokenData) {
      tokensMap.set(key, { ...tokenData, selectedAmount: amount })
      set({ tokens: tokensMap })
    }
  },

  updateTokenBalance: (chainId, address, newBalance, newRawBalance) => {
    const key = getTokenKey(chainId, address)
    const tokensMap = new Map(get().tokens)
    const selectedMap = new Map(get().selectedTokens)
    const token = tokensMap.get(key)
    const selectedToken = selectedMap.get(key)

    if (token) {
      if (newRawBalance <= 0n) {
        // Remove token if balance is 0
        tokensMap.delete(key)
        selectedMap.delete(key)
      } else {
        // Update token balance
        tokensMap.set(key, {
          ...token,
          balance: newBalance,
          rawBalance: newRawBalance,
          selectedAmount: newBalance
        })

        if (selectedToken) {
          selectedMap.set(key, {
            ...selectedToken,
            balance: newBalance,
            selectedAmount: newBalance
          })
        }
      }

      set({ tokens: tokensMap, selectedTokens: selectedMap })
    }
  },

  clearSelections: () => {
    const tokensMap = new Map(get().tokens)
    tokensMap.forEach((token, key) => {
      tokensMap.set(key, { ...token, isSelected: false })
    })
    set({ selectedTokens: new Map(), tokens: tokensMap })
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

  getAllTokens: () => {
    return Array.from(get().tokens.values())
  },
}))
