export default function AgentThinking() {
  return (
    <div className="flex items-center justify-center gap-3 text-indigo-400">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-sm">Agent is choosing a move…</span>
    </div>
  )
}
