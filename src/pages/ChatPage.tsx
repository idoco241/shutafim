import { useParams } from 'react-router-dom'
import { ConversationList } from '../components/chat/ConversationList'
import { ChatThread } from '../components/chat/ChatThread'

export default function ChatPage() {
  const { id } = useParams<{ id?: string }>()
  return id ? <ChatThread conversationId={id} /> : <ConversationList />
}
