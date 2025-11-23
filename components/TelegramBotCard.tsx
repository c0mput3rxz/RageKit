'use client'

export function TelegramBotCard() {
  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🤖</span>
        <h3 className="text-lg font-bold text-white">
          RageGuard Bot
        </h3>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Get instant alerts when your tokens dump. Never miss a rage quit opportunity.
      </p>

      <a
        href="http://t.me/RageGuardBot"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all text-center"
      >
        Open in Telegram
      </a>

      <div className="mt-4 pt-4 border-t border-slate-800">
        <p className="text-xs text-gray-500 mb-2 font-semibold">Features:</p>
        <ul className="text-xs text-gray-400 space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Price drop alerts
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Portfolio tracking
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Quick exit commands
          </li>
        </ul>
      </div>
    </div>
  )
}
