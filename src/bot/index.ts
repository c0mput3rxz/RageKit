import { config } from 'dotenv'
import { resolve } from 'path'
import { Telegraf, Context } from 'telegraf'
import { message } from 'telegraf/filters'

// Load environment variables from .env or .env.local
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Initialize bot
const botToken = process.env.TELEGRAM_BOT_TOKEN

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables')
  process.exit(1)
}

const bot = new Telegraf(botToken)

// Helper function to format chain names
function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon',
  }
  return chainNames[chainId] || `Chain ${chainId}`
}

// Start command
bot.start(async (ctx: Context) => {
  const welcomeMessage = `
🧨 *Welcome to AbuelaBot*

Your helper for *RageQuit* —* when you're tilted, don't think — *hit the button*.

AbuelaBot helps you learn about and access RageQuit, which exits your degen tokens into stablecoins across multiple chains.

*Available Commands:*
/help - Show this help message
/info - Learn about RageQuit
/chains - View supported chains
/tokens - View tracked degen tokens
/webapp - Get link to RageQuit web app

*How RageQuit works:*
1. Connect your wallet via Privy
2. We scan your balances across chains
3. Select your target chain and stablecoin
4. Hit the RageQuit button to exit all positions

Ready to rage quit? Use /webapp to get started!
  `
  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' })
})

// Help command
bot.command('help', async (ctx: Context) => {
  const helpMessage = `
*AbuelaBot Commands:*

AbuelaBot is your helper for RageQuit. Use these commands to learn more:

/help - Show this help message
/info - Learn about RageQuit
/chains - View supported chains and stablecoins
/tokens - View tracked degen tokens
/webapp - Get link to the RageQuit web application

*Need help?*
AbuelaBot provides information and links about RageQuit. To actually execute RageQuit, visit the web app and connect your wallet.
  `
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' })
})

// Info command
bot.command('info', async (ctx: Context) => {
  const infoMessage = `
🧨 *About RageQuit*

*What is RageQuit?*
A panic button for degens. Exit all your risk tokens into stablecoins with a single click.

*Features:*
• Multi-chain support (Ethereum, Base, Arbitrum, Optimism, Polygon)
• Automatic token scanning
• Optimal swap routing via 1inch
• Embedded wallets via Privy (no wallet needed to start)
• Connect existing wallets for power users

*Tech Stack:*
• Next.js + TypeScript
• Privy for wallet management
• 1inch Aggregation API for swaps
• wagmi + viem for blockchain interactions

*Safety:*
All transactions require your explicit approval. We never have access to your private keys.

*About AbuelaBot:*
I'm your helper bot for RageQuit. Use /webapp to access the RageQuit application!
  `
  await ctx.reply(infoMessage, { parse_mode: 'Markdown' })
})

// Chains command
bot.command('chains', async (ctx: Context) => {
  const chainsMessage = `
*Supported Chains & Stablecoins:*

*Ethereum (Mainnet)*
• USDC: \`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\`
• USDT: \`0xdAC17F958D2ee523a2206206994597C13D831ec7\`

*Base*
• USDC: \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`

*Arbitrum*
• USDC: \`0xaf88d065e77c8cC2239327C5EDb3A432268e5831\`
• USDT: \`0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9\`

*Optimism*
• USDC: \`0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85\`

*Polygon*
• USDC: \`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359\`
• USDT: \`0xc2132D05D31c914a87C6611C10748AEb04B58e8F\`

Use /webapp to select your target chain and stablecoin.
  `
  await ctx.reply(chainsMessage, { parse_mode: 'Markdown' })
})

// Tokens command
bot.command('tokens', async (ctx: Context) => {
  const tokensMessage = `
*Tracked Degen Tokens:*

*Ethereum*
• PEPE: \`0x6982508145454Ce325dDbE47a25d4ec3d2311933\`
• SHIB: \`0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE\`

*Base*
• DEGEN: \`0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed\`

*Note:* This list can be expanded. The web app scans for these tokens across all supported chains.

Want to add more tokens? Check out the project on GitHub or modify the configuration.

Use /webapp to check your balances and rage quit!
  `
  await ctx.reply(tokensMessage, { parse_mode: 'Markdown' })
})

// Webapp command
bot.command('webapp', async (ctx: Context) => {
  // In production, replace with your actual web app URL
  const webappUrl = process.env.WEBAPP_URL || 'http://localhost:3000'
  
  const webappMessage = `
🌐 *RageQuit Web Application*

Click the link below to access RageQuit:

${webappUrl}

*What to do:*
1. Open the link above
2. Connect your wallet (or create an embedded wallet with Privy)
3. Wait for balance scan to complete
4. Select your target chain and stablecoin
5. Hit the big red RageQuit button!

*Remember:* All transactions require your approval. Stay safe! 🛡️
  `
  
  await ctx.reply(webappMessage, { parse_mode: 'Markdown' })
  
  // Also send as a clickable button
  await ctx.reply('🚀 Open RageQuit', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Open RageQuit', url: webappUrl }],
      ],
    },
  })
})

// Handle any other text messages
bot.on(message('text'), async (ctx: Context) => {
  if (ctx.message && 'text' in ctx.message) {
    await ctx.reply(
      "I didn't understand that command. Use /help to see available commands.",
    )
  }
})

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err)
  ctx.reply('An error occurred. Please try again later.')
})

// Start bot
async function startBot() {
  try {
    console.log('🤖 Starting AbuelaBot...')
    await bot.launch()
    console.log('✅ AbuelaBot is running!')
    
    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
  } catch (error) {
    console.error('❌ Failed to start bot:', error)
    process.exit(1)
  }
}

// Start the bot
startBot()

export default bot

