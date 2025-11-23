import { NextRequest, NextResponse } from 'next/server'
import { CHAIN_ID_TO_1INCH } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainId = searchParams.get('chainId')
  const tokenAddress = searchParams.get('tokenAddress')

  if (!chainId || !tokenAddress) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const chain1inch = CHAIN_ID_TO_1INCH[parseInt(chainId)]
  if (!chain1inch) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://api.1inch.dev/price/v1.1/${chain1inch}/${tokenAddress}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('1inch API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch price', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Price fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
