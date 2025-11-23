import { NextRequest, NextResponse } from 'next/server'
import { CHAIN_ID_TO_1INCH } from '@/lib/constants'

const API_BASE_URL = 'https://api.1inch.dev/swap/v6.0'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId')
    const tokenAddress = searchParams.get('tokenAddress')
    const amount = searchParams.get('amount')

    if (!chainId || !tokenAddress) {
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
      tokenAddress,
    })

    if (amount) {
      queryParams.append('amount', amount)
    }

    const url = `${API_BASE_URL}/${chain1inch}/approve/transaction?${queryParams}`
    console.log('Fetching approve transaction from 1inch:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('1inch approve API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to get approve transaction', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Approve transaction error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
