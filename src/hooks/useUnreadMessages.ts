import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export function useUnreadMessages(): number {
  const { user } = useAuth()
  const location = useLocation()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) { setCount(0); return }

    const fetch = async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

      if (!convs?.length) { setCount(0); return }

      const { count: c } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convs.map(c => c.id))
        .eq('is_read', false)
        .neq('sender_id', user.id)

      setCount(c ?? 0)
    }

    fetch()
  }, [user, location.pathname])

  return count
}
