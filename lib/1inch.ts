interface SwapQuoteParams {
  chainId: number
  src: string
  dst: string
  amount: string
  from: string
}

interface SwapParams extends SwapQuoteParams {
  slippage: number
  disableEstimate?: boolean
}

export interface SwapQuote {
  dstAmount: string
  tx: {
    from: string
    to: string
    data: string
    value: string
    gas: number
    gasPrice: string
  }
}

export async function getSwapQuote(
  params: SwapQuoteParams
): Promise<SwapQuote> {
  const queryParams = new URLSearchParams({
    chainId: params.chainId.toString(),
    src: params.src,
    dst: params.dst,
    amount: params.amount,
    from: params.from,
    slippage: '1', // 1% default slippage
  })

  const response = await fetch(`/api/1inch/swap?${queryParams}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`1inch API error: ${error.error || 'Unknown error'}`)
  }

  return response.json()
}

export async function getSwapTransaction(params: SwapParams): Promise<SwapQuote> {
  const queryParams = new URLSearchParams({
    chainId: params.chainId.toString(),
    src: params.src,
    dst: params.dst,
    amount: params.amount,
    from: params.from,
    slippage: params.slippage.toString(),
  })

  const response = await fetch(`/api/1inch/swap?${queryParams}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`1inch API error: ${error.error || 'Unknown error'}`)
  }

  return response.json()
}

export async function checkAllowance(
  chainId: number,
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const queryParams = new URLSearchParams({
    chainId: chainId.toString(),
    tokenAddress,
    walletAddress,
  })

  const response = await fetch(`/api/1inch/allowance?${queryParams}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`1inch API error: ${error.error || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.allowance
}

export async function getApproveTransaction(
  chainId: number,
  tokenAddress: string,
  amount?: string
): Promise<{ data: string; gasPrice: string; to: string; value: string }> {
  const queryParams = new URLSearchParams({
    chainId: chainId.toString(),
    tokenAddress,
  })

  if (amount) {
    queryParams.append('amount', amount)
  }

  const response = await fetch(`/api/1inch/approve?${queryParams}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`1inch API error: ${error.error || 'Unknown error'}`)
  }

  return response.json()
}
