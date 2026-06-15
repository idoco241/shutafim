const COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
]

function colorFromId(id: string): string {
  let h = 0
  for (const c of id) h = ((h * 31 + c.charCodeAt(0)) >>> 0)
  return COLORS[h % COLORS.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (
    parts.length >= 2
      ? (parts[0][0] ?? '') + (parts[1][0] ?? '')
      : (parts[0]?.slice(0, 2) ?? '?')
  ).toUpperCase()
}

const SIZE = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
}

interface Props {
  name: string
  userId: string
  size?: keyof typeof SIZE
}

export function Avatar({ name, userId, size = 'md' }: Props) {
  return (
    <div
      className={`${SIZE[size]} ${colorFromId(userId)} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {initials(name)}
    </div>
  )
}
