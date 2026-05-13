import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ChatInterfaceProps {
  initialMessages: Message[];
  currentUserId: string;
  otherUserId: string;
}

export default function ChatInterface({ initialMessages, currentUserId, otherUserId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Subscribe to new messages
    const channel = supabase
      .channel(`chat_${currentUserId}_${otherUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, (payload: { new: Message }) => {
        if (payload.new.sender_id === otherUserId) {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload: { payload: { userId: string; typing: boolean } }) => {
        if (payload.payload.userId === otherUserId) {
            setIsTyping(payload.payload.typing);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgContent = newMessage;
    setNewMessage('');
    
    // Broadcast stop typing
    supabase.channel(`chat_${otherUserId}_${currentUserId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, typing: false }
    });

    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const tempMsg: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: msgContent,
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setMessages(prev => [...prev, tempMsg]);

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: otherUserId,
        content: msgContent
      });

    if (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  let typingTimeout: ReturnType<typeof setTimeout>;
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(e.target.value);
      
      // Broadcast typing
      supabase.channel(`chat_${otherUserId}_${currentUserId}`).send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, typing: true }
      });

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
          supabase.channel(`chat_${otherUserId}_${currentUserId}`).send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId: currentUserId, typing: false }
          });
      }, 2000);
  };

  return (
    <>
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'}`}>
                <p className="text-sm">{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        {isTyping && (
             <div className="flex justify-start">
             <div className="bg-gray-200 rounded-2xl px-4 py-2 rounded-bl-none text-gray-500 text-sm flex gap-1 items-center">
               <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
               <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
               <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-indigo-600 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
