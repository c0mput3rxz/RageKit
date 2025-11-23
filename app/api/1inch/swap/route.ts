import { NextRequest, NextResponse } from 'next/server'
import { CHAIN_ID_TO_1INCH } from '@/lib/constants'

const API_BASE_URL = 'https://api.1inch.dev/swap/v6.0'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId')
    const src = searchParams.get('src')
    const dst = searchParams.get('dst')
    const amount = searchParams.get('amount')
    const from = searchParams.get('from')
    const slippage = searchParams.get('slippage')

    if (!chainId || !src || !dst || !amount || !from) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const chain1inch = CHAIN_ID_TO_1INCH[parseInt(chainId)]
    if (!chain1inch) {
      return NextResponse.json(
        { error: `Chain ${chainId} not supported by 1inch` },
        { status: 400 }
      )
    }

    const queryParams = new URLSearchParams({
      src,
      dst,
      amount,
      from,
      slippage: slippage || '3',
      disableEstimate: 'false',
    })

    const url = `${API_BASE_URL}/${chain1inch}/swap?${queryParams}`
    console.log('Fetching swap from 1inch:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('1inch swap API error:', {
        status: response.status,
        url,
        error: errorText,
      })
      return NextResponse.json(
        { error: 'Failed to get swap transaction', details: errorText, status: response.status },
        { status: 400 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Swap transaction error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
