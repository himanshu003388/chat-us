import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function ChatApp({
  currentUser,
  initialProfiles,
  initialActiveUserId
}) {
  const supabase = createBrowserClient(
    "https://yobdetdziljwrlnqanxm.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYmRldGR6aWxqd3JsbnFhbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDc3ODQsImV4cCI6MjA5NDE4Mzc4NH0.vVZl2vhkgXdh9RXJ6ayExyBSsBYz-yHuAprZP8oWe5o"
  );
  const [profiles, setProfiles] = useState(initialProfiles);
  const [activeUserId, setActiveUserId] = useState(initialActiveUserId || null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [activeUserProfile, setActiveUserProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const filteredProfiles = profiles.filter(
    (p) => p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  useEffect(() => {
    if (activeUserId) {
      const profile = profiles.find((p) => p.id === activeUserId);
      setActiveUserProfile(profile || null);
    }
  }, [activeUserId, profiles]);
  useEffect(() => {
    if (activeUserId) {
      fetchMessages();
    }
  }, [activeUserId]);
  useEffect(() => {
    const channel = supabase.channel("messages-realtime").on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeUserId || newMsg.sender_id === activeUserId && newMsg.receiver_id === currentUser.id) {
          setMessages((prev) => [...prev, newMsg]);
        }
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, currentUser.id]);
  useEffect(() => {
    if (!activeUserId) return;
    const channel = supabase.channel(`typing-${activeUserId}`).on("broadcast", { event: "typing" }, (payload) => {
      if (payload.payload.userId === activeUserId) {
        setOtherUserTyping(payload.payload.typing);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId]);
  useEffect(() => {
    const channel = supabase.channel("profiles-realtime").on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles"
      },
      () => {
        fetchProfiles();
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, username, avatar_url, last_seen, is_banned").neq("id", currentUser.id).order("last_seen", { ascending: false });
    if (data) setProfiles(data);
  };
  const fetchMessages = async () => {
    const { data } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeUserId}),and(sender_id.eq.${activeUserId},receiver_id.eq.${currentUser.id})`).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    supabase.channel(`typing-${activeUserId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUser.id, typing: true }
    });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel(`typing-${activeUserId}`).send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUser.id, typing: false }
      });
    }, 2e3);
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeUserId) return;
    const content = newMessage;
    setNewMessage("");
    supabase.channel(`typing-${activeUserId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUser.id, typing: false }
    });
    const tempMsg = {
      id: crypto.randomUUID(),
      sender_id: currentUser.id,
      receiver_id: activeUserId,
      content,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    setMessages((prev) => [...prev, tempMsg]);
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: activeUserId,
      content
    });
    if (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }
  };
  const getInitials = (username) => {
    return username.slice(0, 2).toUpperCase();
  };
  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1e3;
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex w-full h-full", children: [
    /* @__PURE__ */ jsxs("div", { className: "w-80 bg-white border-r border-gray-200 flex flex-col", children: [
      /* @__PURE__ */ jsxs("div", { className: "p-4 border-b border-gray-200", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-3", children: "Messages" }),
        /* @__PURE__ */ jsx("div", { className: "relative", children: /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search users...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "w-full bg-gray-100 border-0 rounded-lg px-4 py-2 text-sm placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto", children: [
        filteredProfiles.map((profile) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveUserId(profile.id),
            className: `w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition ${activeUserId === profile.id ? "bg-indigo-50 border-l-4 border-indigo-600" : ""}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                profile.avatar_url ? /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: profile.avatar_url,
                    alt: profile.username,
                    className: "w-12 h-12 rounded-full object-cover"
                  }
                ) : /* @__PURE__ */ jsx("div", { className: "w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium", children: getInitials(profile.username) }),
                isOnline(profile.last_seen) && /* @__PURE__ */ jsx("span", { className: "absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 text-left", children: [
                /* @__PURE__ */ jsx("p", { className: "font-medium text-gray-900", children: profile.username }),
                /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500", children: isOnline(profile.last_seen) ? "Online" : "Offline" })
              ] })
            ]
          },
          profile.id
        )),
        filteredProfiles.length === 0 && /* @__PURE__ */ jsx("p", { className: "p-4 text-center text-gray-500", children: "No users found" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col bg-gray-50", children: activeUserId && activeUserProfile ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-white border-b border-gray-200 p-4 flex items-center gap-3", children: [
        activeUserProfile.avatar_url ? /* @__PURE__ */ jsx(
          "img",
          {
            src: activeUserProfile.avatar_url,
            alt: activeUserProfile.username,
            className: "w-10 h-10 rounded-full object-cover"
          }
        ) : /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium", children: getInitials(activeUserProfile.username) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium text-gray-900", children: activeUserProfile.username }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500", children: isOnline(activeUserProfile.last_seen) ? "Online" : "Offline" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [
        messages.map((msg) => {
          const isMe = msg.sender_id === currentUser.id;
          return /* @__PURE__ */ jsx("div", { className: `flex ${isMe ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsxs(
            "div",
            {
              className: `max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-900 rounded-bl-none"}`,
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm", children: msg.content }),
                /* @__PURE__ */ jsx("span", { className: `text-[10px] mt-1 block ${isMe ? "text-indigo-200" : "text-gray-400"}`, children: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
              ]
            }
          ) }, msg.id);
        }),
        otherUserTyping && /* @__PURE__ */ jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxs("div", { className: "bg-gray-200 rounded-2xl px-4 py-2 rounded-bl-none text-gray-500 text-sm flex gap-1 items-center", children: [
          /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" }),
          /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75" }),
          /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150" })
        ] }) }),
        /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-4 bg-white border-t border-gray-200", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSendMessage, className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: newMessage,
            onChange: handleTyping,
            placeholder: "Type a message...",
            className: "flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            disabled: !newMessage.trim(),
            className: "bg-indigo-600 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed",
            children: /* @__PURE__ */ jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5 ml-1", children: /* @__PURE__ */ jsx("path", { d: "M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" }) })
          }
        )
      ] }) })
    ] }) : /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
      /* @__PURE__ */ jsx("svg", { className: "w-16 h-16 text-gray-300 mx-auto mb-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-500", children: "Select a user to start chatting" })
    ] }) }) })
  ] });
}

export { ChatApp as C };
