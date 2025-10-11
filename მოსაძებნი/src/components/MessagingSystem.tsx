import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, User, Calendar, Paperclip, Phone, Mail, Search, MoreVertical, Image, File, CheckCheck, Check, Clock } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { messagingService } from '../services/messagingService';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  attachments?: string[];
  messageType: 'text' | 'image' | 'file';
  readBy?: string[];
}

interface Conversation {
  id: string;
  bookingId: string;
  listingTitle: string;
  listingType: string;
  participantIds: string[];
  participantNames: string[];
  lastMessage: Message | null;
  unreadCount: { [userId: string]: number };
  messages: Message[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isMuted?: boolean;
}

interface MessagingSystemProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBooking?: any | null;
}

export default function MessagingSystem({ isOpen, onClose, selectedBooking }: MessagingSystemProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadConversations();

      // If specific booking is selected, create or find conversation
      if (selectedBooking) {
        handleBookingConversation();
      } else {
        // If no booking selected, create/find support conversation
        handleSupportConversation();
      }
    }
  }, [user, isOpen, selectedBooking]);

  const handleBookingConversation = async () => {
    if (!selectedBooking || !user) return;

    // Find existing conversation for this booking
    const existingConv = conversations.find(conv => 
      conv.bookingId === selectedBooking.id
    );

    if (existingConv) {
      setSelectedConversation(existingConv);
      await loadMessages(existingConv.id);
    } else {
      // Create new conversation for this booking
      const conversationId = await createConversation(
        selectedBooking.id,
        selectedBooking.hostInfo?.name || 'მეპატრონე',
        selectedBooking.hostInfo?.phone || 'მეპატრონე',
        selectedBooking.property
      );
      if (conversationId) {
        // Reload conversations to get the new one
        await loadConversations();
      }
    }
  };

  const handleSupportConversation = async () => {
    if (!user) return;

    // Find existing support conversation
    const supportConv = conversations.find(conv => 
      conv.listingType === 'support' && 
      conv.participantNames.includes('აკაკი ცინცაძე')
    );

    if (supportConv) {
      setSelectedConversation(supportConv);
      await loadMessages(supportConv.id);
    } else {
      // Create support conversation with აკაკი ცინცაძე
      const conversationId = await createConversation(
        'support-' + Date.now(),
        'support-admin-id', // This would be actual support admin ID
        'აკაკი ცინცაძე',
        'დახმარების ჯგუფი'
      );
      if (conversationId) {
        await loadConversations();
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Load real conversations from Firebase
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participantIds', 'array-contains', user.uid || user.id),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedConversations: Conversation[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedConversations.push({
            id: doc.id,
            bookingId: data.bookingId || '',
            listingTitle: data.listingTitle || 'საუბარი',
            listingType: data.listingType || 'general',
            participantIds: data.participantIds || [],
            participantNames: data.participantNames || [],
            lastMessage: data.lastMessage ? {
              ...data.lastMessage,
              timestamp: data.lastMessage.timestamp?.toDate?.() || new Date(data.lastMessage.timestamp)
            } : null,
            unreadCount: data.unreadCount || {},
            messages: [],
            isActive: data.isActive !== false,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            isMuted: Boolean(data.mutedBy?.[user.uid || user.id || ''])
          });
        });

        setConversations(loadedConversations);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: Message[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          messages.push({
            id: doc.id,
            senderId: data.senderId,
            senderName: data.senderName,
            content: data.content,
            timestamp: data.timestamp?.toDate?.() || new Date(),
            isRead: data.isRead || false,
            attachments: data.attachments || [],
            messageType: data.messageType || 'text',
            readBy: data.readBy || []
          });
        });

        setSelectedConversation(prev => 
          prev ? { ...prev, messages } : null
        );
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isLoading || !user) return;

    setIsLoading(true);

    try {
      const messageData = {
        senderId: user.uid || user.id,
        senderName: `${user.firstName} ${user.lastName}`,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'text',
        readBy: [user.uid || user.id]
      };

      // Add message to subcollection
      const messagesRef = collection(db, 'conversations', selectedConversation.id, 'messages');
      await addDoc(messagesRef, messageData);

      // Update conversation's last message
      const conversationRef = doc(db, 'conversations', selectedConversation.id);
      await updateDoc(conversationRef, {
        lastMessage: {
          ...messageData,
          timestamp: new Date()
        },
        updatedAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('შეცდომა შეტყობინების გაგზავნისას');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (!user) return;

    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        [`unreadCount.${user.uid || user.id}`]: 0
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const createConversation = async (bookingId: string, otherUserId: string, otherUserName: string, listingTitle: string) => {
    if (!user) return;

    try {
      const isSupport = bookingId.startsWith('support-');

      const conversationData = {
        bookingId,
        listingTitle,
        listingType: isSupport ? 'support' : 'booking',
        participantIds: [user.uid || user.id, otherUserId],
        participantNames: [`${user.firstName} ${user.lastName}`, otherUserName],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadCount: {
          [user.uid || user.id]: 0,
          [otherUserId]: 0
        }
      };

      const conversationsRef = collection(db, 'conversations');
      const docRef = await addDoc(conversationsRef, conversationData);

      // Send welcome message for support conversations
      if (isSupport) {
        await sendWelcomeMessage(docRef.id);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const sendWelcomeMessage = async (conversationId: string) => {
    try {
      const welcomeMessage = {
        senderId: 'support-admin-id',
        senderName: 'აკაკი ცინცაძე',
        content: 'გამარჯობა! მე ვარ აკაკი ცინცაძე, ბახმაროს პლატფორმის დახმარების ჯგუფიდან. როგორ შემიძლია დაგეხმაროთ?',
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'text',
        readBy: ['support-admin-id']
      };

      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, welcomeMessage);
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
    await markAsRead(conversation.id);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.listingTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.participantNames.some(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const formatMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('ka-GE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatConversationTime = (timestamp: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return formatMessageTime(timestamp);
    if (diffDays === 1) return 'გუშინ';
    if (diffDays < 7) return `${diffDays} დღის წინ`;
    return timestamp.toLocaleDateString('ka-GE');
  };

  const getOtherParticipantName = (conversation: Conversation) => {
    return conversation.participantNames.find(name => 
      !name.includes(user?.firstName || '') || !name.includes(user?.lastName || '')
    ) || 'უცნობი მომხმარებელი';
  };

  const getCurrentUserUnreadCount = (conversation: Conversation) => {
    return conversation.unreadCount[user?.uid || user?.id || ''] || 0;
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;

    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ შეტყობინების წაშლა?')) {
      try {
        await messagingService.deleteMessage(selectedConversation.id, messageId);
        alert('შეტყობინება წარმატებით წაიშალა');
        await loadMessages(selectedConversation.id);
      } catch (error) {
        console.error('Error deleting message:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`შეცდომა: ${message}`);
      }
    }
  };

  const handleEditMessage = async (messageId: string, currentContent: string) => {
    const newContent = prompt('შეცვალეთ შეტყობინება:', currentContent);
    if (newContent && newContent.trim() !== currentContent) {
      try {
        await messagingService.editMessage(selectedConversation!.id, messageId, newContent.trim());
        alert('შეტყობინება წარმატებით შეიცვალა');
      } catch (error) {
        console.error('Error editing message:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`შეცდომა: ${message}`);
      }
    }
  };

  const handleReportMessage = async (messageId: string) => {
    const reason = prompt('მიუთითეთ რეპორტის მიზეზი:');
    if (reason) {
      try {
        await messagingService.reportMessage(selectedConversation!.id, messageId, reason);
        alert('შეტყობინება დარეპორტებულია');
      } catch (error) {
        console.error('Error reporting message:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`შეცდომა: ${message}`);
      }
    }
  };

  const handleMuteConversation = async () => {
    if (!selectedConversation) return;

    try {
      await messagingService.muteConversation(selectedConversation.id, !selectedConversation.isMuted);
      alert(selectedConversation.isMuted ? 'საუბარი აღარ არის გაუჩუმებული' : 'საუბარი გაუჩუმდა');
      await loadConversations();
    } catch (error) {
      console.error('Error muting conversation:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`შეცდომა: ${message}`);
    }
  };

  const handleLeaveConversation = async () => {
    if (!selectedConversation) return;

    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ საუბრიდან გასვლა?')) {
      try {
        await messagingService.leaveConversation(selectedConversation.id);
        alert('საუბრიდან წარმატებით გავედით');
        setSelectedConversation(null);
        await loadConversations();
      } catch (error) {
        console.error('Error leaving conversation:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`შეცდომა: ${message}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex">

        {/* Conversations List */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600">
            <h2 className="text-lg font-semibold text-white">
              🏔️ ბახმარო მესენჯერი
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="საუბრის ძებნა..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>საუბრები არ არის</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const unreadCount = getCurrentUserUnreadCount(conversation);
                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                      selectedConversation?.id === conversation.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {getOtherParticipantName(conversation)}
                          </h3>
                          {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          📍 {conversation.listingTitle}
                        </p>
                        {conversation.lastMessage && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {conversation.lastMessage ? formatConversationTime(conversation.lastMessage.timestamp) : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {getOtherParticipantName(selectedConversation)}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>ბრონირება #{selectedConversation.bookingId}</span>
                        <span>•</span>
                        <span>{selectedConversation.listingTitle}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                {selectedConversation.messages.map((message) => {
                  const isOwnMessage = message.senderId === (user?.uid || user?.id);
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl relative ${
                          isOwnMessage
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span
                            className={`text-xs ${
                              isOwnMessage
                                ? 'text-blue-100'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {isOwnMessage && (
                            <div className="ml-2">
                              {message.readBy && message.readBy.length > 1 ? (
                                <CheckCheck className="w-3 h-3 text-blue-200" />
                              ) : (
                                <Check className="w-3 h-3 text-blue-200" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={(e) => {
                      // Handle file upload
                      console.log('File selected:', e.target.files?.[0]);
                    }}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="შეიყვანეთ შეტყობინება..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isLoading}
                    className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">აირჩიეთ საუბარი</p>
                <p className="text-sm">შეტყობინების გასაგზავნად აირჩიეთ საუბარი მარცხენა პანელიდან</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}