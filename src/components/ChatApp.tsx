import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  last_seen: string | null;
  is_banned: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface ChatAppProps {
  currentUser: { id: string; email: string };
  initialProfiles: Profile[];
  initialActiveUserId?: string;
}

export default function ChatApp({
  currentUser,
  initialProfiles,
  initialActiveUserId,
}: ChatAppProps) {
  const supabase = createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [activeUserId, setActiveUserId] = useState<string | null>(initialActiveUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [activeUserProfile, setActiveUserProfile] = useState<Profile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter profiles by search
  const filteredProfiles = profiles.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get active user profile
  useEffect(() => {
    if (activeUserId) {
      const profile = profiles.find((p) => p.id === activeUserId);
      setActiveUserProfile(profile || null);
    }
  }, [activeUserId, profiles]);

  // Fetch messages when active user changes
  useEffect(() => {
    if (activeUserId) {
      fetchMessages();
    }
  }, [activeUserId]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeUserId) ||
            (newMsg.sender_id === activeUserId && newMsg.receiver_id === currentUser.id)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, currentUser.id]);

  // Subscribe to typing status
  useEffect(() => {
    if (!activeUserId) return;

    const channel = supabase
      .channel(`typing-${activeUserId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId === activeUserId) {
          setOtherUserTyping(payload.payload.typing);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId]);

  // Subscribe to profile updates
  useEffect(() => {
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchProfiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, last_seen, is_banned')
      .neq('id', currentUser.id)
      .order('last_seen', { ascending: false });
    if (data) setProfiles(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeUserId}),and(sender_id.eq.${activeUserId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Broadcast typing status
    supabase.channel(`typing-${activeUserId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id, typing: true },
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel(`typing-${activeUserId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id, typing: false },
      });
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeUserId) return;

    const content = newMessage;
    setNewMessage('');

    // Stop typing
    supabase.channel(`typing-${activeUserId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id, typing: false },
    });

    // Optimistic update
    const tempMsg: Message = {
      id: crypto.randomUUID(),
      sender_id: currentUser.id,
      receiver_id: activeUserId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeUserId,
      content,
    });

    if (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="flex w-full h-full">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-0 rounded-lg px-4 py-2 text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setActiveUserId(profile.id)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition ${
                activeUserId === profile.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
              }`}
            >
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                    {getInitials(profile.username)}
                  </div>
                )}
                {isOnline(profile.last_seen) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">{profile.username}</p>
                <p className="text-sm text-gray-500">
                  {isOnline(profile.last_seen) ? 'Online' : 'Offline'}
                </p>
              </div>
            </button>
          ))}
          {filteredProfiles.length === 0 && (
            <p className="p-4 text-center text-gray-500">No users found</p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {activeUserId && activeUserProfile ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
              {activeUserProfile.avatar_url ? (
                <img
                  src={activeUserProfile.avatar_url}
                  alt={activeUserProfile.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                  {getInitials(activeUserProfile.username)}
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{activeUserProfile.username}</p>
                <p className="text-sm text-gray-500">
                  {isOnline(activeUserProfile.last_seen) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <span className={`text-[10px] mt-1 block ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {otherUserTyping && (
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

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
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
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-500">Select a user to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}