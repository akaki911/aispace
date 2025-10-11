// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  Paperclip, 
  Zap, 
  Search, 
  Filter, 
  Archive, 
  UserPlus,
  MoreHorizontal,
  Clock,
  Check,
  CheckCheck,
  X,
  Plus,
  Star,
  Pin
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/useTheme';
import { messagingService } from '../services/messagingService';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'CUSTOMER' | 'PROVIDER_ADMIN' | 'SUPER_ADMIN';
  content: string;
  timestamp: Date;
  isRead: boolean;
  readBy?: string[];
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  isInternal?: boolean; // For admin-only notes
}

interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
    role: string;
  }[];
  bookingId?: string;
  bookingContext?: {
    listingName: string;
    listingType: 'cottage' | 'hotel' | 'vehicle' | 'horse' | 'snowmobile';
    checkIn: string;
    checkOut: string;
    guestCount: number;
    status: string;
  };
  lastMessage: Message;
  unreadCount: number;
  isSupport: boolean;
  status: 'active' | 'resolved' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: 'checkin' | 'checkout' | 'directions' | 'general' | 'support';
  placeholders?: string[];
}

const EnhancedMessagingSystem: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  // Make user context available globally for messaging service
  useEffect(() => {
    if (user) {
      (window as any).authContext = { user };
      console.log('✅ Made user context available globally for messaging:', user.id);
    }
  }, [user]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'support' | 'bookings' | 'urgent'>('all');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickReplies: QuickReply[] = [
    {
      id: '1',
      title: 'მისალმება',
      content: 'გამარჯობა {guest_name}, მადლობა {listing_name}-ის დაჯავშნისთვის! როგორ შემიძლია დაგეხმაროთ?',
      category: 'general',
      placeholders: ['guest_name', 'listing_name']
    },
    {
      id: '2',
      title: 'ჩეკ-ინის ინსტრუქციები',
      content: 'ჩეკ-ინი არის {check_in_time}-ზე {check_in_date} რიცხვს. მისამართი: {listing_address}. გასაღებები იქნება {key_location}-ში.',
      category: 'checkin',
      placeholders: ['check_in_time', 'check_in_date', 'listing_address', 'key_location']
    },
    {
      id: '3',
      title: 'მიმართულებები',
      content: 'ბახმაროსთვის: თბილისიდან ედით გურჯაანის მიმართულებით, შემდეგ ბახმაროს სატაბლო. GPS კოორდინატები: {coordinates}',
      category: 'directions',
      placeholders: ['coordinates']
    },
    {
      id: '4',
      title: 'ჩეკ-აუთი',
      content: 'ჩეკ-აუთი არის {checkout_time}-მდე. გთხოვთ დატოვოთ გასაღებები {key_return_location}-ში. მადლობა ჩვენთან ყოფნისთვის!',
      category: 'checkout',
      placeholders: ['checkout_time', 'key_return_location']
    }
  ];

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    // Mock data - replace with actual API call
    const mockConversations: Conversation[] = [
      {
        id: '1',
        participants: [
          { id: user?.id || '', name: user?.firstName || '', role: user?.role || 'CUSTOMER' },
          { id: '2', name: 'ნინო გრიგალაშვილი', role: 'CUSTOMER' }
        ],
        bookingId: 'booking-123',
        bookingContext: {
          listingName: 'მზის ჩაშვება კოტეჯი',
          listingType: 'cottage',
          checkIn: '2024-01-20',
          checkOut: '2024-01-22',
          guestCount: 2,
          status: 'confirmed'
        },
        lastMessage: {
          id: 'msg-1',
          senderId: '2',
          senderName: 'ნინო გრიგალაშვილი',
          senderRole: 'CUSTOMER',
          content: 'გამარჯობა, რომელი საათია ჩეკ-ინი?',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          isRead: false
        },
        unreadCount: 1,
        isSupport: false,
        status: 'active',
        priority: 'normal',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 10 * 60 * 1000)
      },
      {
        id: '2',
        participants: [
          { id: user?.id || '', name: user?.firstName || '', role: user?.role || 'CUSTOMER' },
          { id: '3', name: 'Support Team', role: 'SUPER_ADMIN' }
        ],
        lastMessage: {
          id: 'msg-2',
          senderId: '3',
          senderName: 'Support Team',
          senderRole: 'SUPER_ADMIN',
          content: 'თქვენი მოთხოვნა განხილულია. გვაქვს შეკითხვა დამატებითი დეტალების შესახებ.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          isRead: true
        },
        unreadCount: 0,
        isSupport: true,
        status: 'active',
        priority: 'high',
        assignedTo: 'admin-1',
        tags: ['უაზრო პრობლემა', 'გადასახადები'],
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000)
      }
    ];
    setConversations(mockConversations);
  };

  const loadMessages = async (conversationId: string) => {
    // Mock messages - replace with actual API call
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        senderId: '2',
        senderName: 'ნინო გრიგალაშვილი',
        senderRole: 'CUSTOMER',
        content: 'გამარჯობა, რომელი საათია ჩეკ-ინი?',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        isRead: false
      }
    ];
    setMessages(mockMessages);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      // Create temporary message for immediate UI feedback
      const tempMessage: Message = {
        id: 'temp-' + Date.now(),
        senderId: user?.id || '',
        senderName: user?.firstName || 'მე',
        senderRole: user?.role || 'CUSTOMER',
        content: newMessage.trim(),
        timestamp: new Date(),
        isRead: false,
        readBy: [user?.id || '']
      };

      // Add message to UI immediately for better UX
      setMessages(prev => [...prev, tempMessage]);
      const messageContent = newMessage.trim();
      setNewMessage('');
      setShowQuickReplies(false);

      // Send actual message to backend
      const sentMessage = await messagingService.sendMessage(
        selectedConversation.id,
        messageContent,
        'text',
        []
      );

      // Replace temp message with actual sent message
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id ? sentMessage : msg
      ));

      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Error sending message:', error);

      // Remove failed temp message
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      // Restore message text for retry
      setNewMessage(newMessage);

      // Show error to user
      alert(`შეცდომა შეტყობინების გაგზავნისას: ${error.message || 'უცნობი შეცდომა'}`);
    }
  };

  const insertQuickReply = (quickReply: QuickReply) => {
    let content = quickReply.content;

    // Replace placeholders with actual data
    if (selectedConversation?.bookingContext && quickReply.placeholders) {
      quickReply.placeholders.forEach(placeholder => {
        switch (placeholder) {
          case 'guest_name':
            content = content.replace(`{${placeholder}}`, selectedConversation.participants.find(p => p.role === 'CUSTOMER')?.name || '');
            break;
          case 'listing_name':
            content = content.replace(`{${placeholder}}`, selectedConversation.bookingContext?.listingName || '');
            break;
          case 'check_in_date':
            content = content.replace(`{${placeholder}}`, selectedConversation.bookingContext?.checkIn || '');
            break;
          // Add more placeholder replacements as needed
        }
      });
    }

    setNewMessage(content);
    setShowQuickReplies(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ შეტყობინების წაშლა?')) {
      try {
        await messagingService.deleteMessage(selectedConversation.id, messageId);
        console.log('✅ Message deleted successfully');
      } catch (error) {
        console.error('❌ Error deleting message:', error);
        alert(`შეცდომა შეტყობინების წაშლისას: ${error.message}`);
      }
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedConversation) return;
    
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ საუბრის არქივირება?')) {
      try {
        await messagingService.archiveConversation(selectedConversation.id);
        setSelectedConversation(null);
        loadConversations(); // Refresh conversations list
        alert('საუბარი წარმატებით დაარქივდა');
      } catch (error) {
        console.error('❌ Error archiving conversation:', error);
        alert(`შეცდომა საუბრის არქივირებისას: ${error.message}`);
      }
    }
  };

  const handleLeaveConversation = async () => {
    if (!selectedConversation) return;
    
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ საუბრიდან გასვლა?')) {
      try {
        await messagingService.leaveConversation(selectedConversation.id);
        setSelectedConversation(null);
        loadConversations(); // Refresh conversations list
        alert('საუბრიდან წარმატებით გავედით');
      } catch (error) {
        console.error('❌ Error leaving conversation:', error);
        alert(`შეცდომა საუბრიდან გასვლისას: ${error.message}`);
      }
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = conversation.participants.some(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || conversation.bookingContext?.listingName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = (() => {
      switch (activeFilter) {
        case 'unread': return conversation.unreadCount > 0;
        case 'support': return conversation.isSupport;
        case 'bookings': return !conversation.isSupport && conversation.bookingId;
        case 'urgent': return conversation.priority === 'urgent' || conversation.priority === 'high';
        default: return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });

  const getListingIcon = (type: string) => {
    switch (type) {
      case 'cottage': return '🏡';
      case 'hotel': return '🏨';
      case 'vehicle': return '🚙';
      case 'horse': return '🐎';
      case 'snowmobile': return '🛷';
      default: return '📍';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'normal': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isDarkMode 
            ? 'bg-purple-600 hover:bg-purple-700 text-white' 
            : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        <MessageCircle className="w-6 h-6" />
        {conversations.reduce((total, conv) => total + conv.unreadCount, 0) > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {conversations.reduce((total, conv) => total + conv.unreadCount, 0)}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={`absolute bottom-16 right-0 w-96 h-[600px] rounded-lg shadow-2xl border transition-all duration-300 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>

          {!selectedConversation ? (
            // Conversation List
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className={`p-4 border-b flex items-center justify-between ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  შეტყობინებები
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="p-3 space-y-3">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <input
                    type="text"
                    placeholder="ძებნა..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>

                <div className="flex space-x-1">
                  {[
                    { key: 'all', label: 'ყველა' },
                    { key: 'unread', label: 'წაუკითხავი' },
                    { key: 'support', label: 'მხარდაჭერა' },
                    { key: 'bookings', label: 'ჯავშნები' },
                    { key: 'urgent', label: 'გადაუდებელი' }
                  ].map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key as any)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        activeFilter === filter.key
                          ? 'bg-purple-500 text-white'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.map(conversation => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {conversation.bookingContext && (
                            <span className="text-lg">
                              {getListingIcon(conversation.bookingContext.listingType)}
                            </span>
                          )}
                          {conversation.isSupport && <span className="text-lg">🎧</span>}
                          <h4 className={`font-medium truncate ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {conversation.isSupport 
                              ? 'მხარდაჭერა' 
                              : conversation.bookingContext?.listingName || 
                                conversation.participants.find(p => p.id !== user?.id)?.name
                            }
                          </h4>
                          <Star className={`w-3 h-3 ${getPriorityColor(conversation.priority)}`} />
                        </div>

                        {conversation.bookingContext && (
                          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {conversation.bookingContext.checkIn} - {conversation.bookingContext.checkOut}
                          </p>
                        )}

                        <p className={`text-sm mt-1 truncate ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {conversation.lastMessage.content}
                        </p>
                      </div>

                      <div className="flex flex-col items-end space-y-1">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {conversation.lastMessage.timestamp.toLocaleTimeString('ka-GE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Chat View
            <div className="h-full flex flex-col">
              {/* Chat Header */}
              <div className={`p-3 border-b flex items-center justify-between ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div>
                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedConversation.isSupport 
                        ? 'მხარდაჭერა' 
                        : selectedConversation.participants.find(p => p.id !== user?.id)?.name
                      }
                    </h4>
                    {selectedConversation.bookingContext && (
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedConversation.bookingContext.listingName} • 
                        {selectedConversation.bookingContext.checkIn} - {selectedConversation.bookingContext.checkOut}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {user?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => setShowInternalNotes(!showInternalNotes)}
                      className={`p-1 rounded transition-colors ${
                        showInternalNotes 
                          ? 'bg-purple-500 text-white' 
                          : isDarkMode 
                            ? 'text-gray-400 hover:bg-gray-700' 
                            : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="შიდა შენიშვნები"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Archive button */}
                  <button
                    onClick={handleArchiveConversation}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}
                    title="საუბრის არქივირება"
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  {/* Leave conversation button */}
                  <button
                    onClick={handleLeaveConversation}
                    className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500`}
                    title="საუბრიდან გასვლა"
                  >
                    <UserPlus className="w-4 h-4 transform rotate-180" />
                  </button>
                  
                  <button
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                      message.isInternal
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                        : message.senderId === user?.id
                          ? 'bg-purple-500 text-white'
                          : isDarkMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                    }`}>
                      {message.isInternal && (
                        <p className={`text-xs font-medium mb-1 ${
                          isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                        }`}>
                          🔒 შიდა შენიშვნა
                        </p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${
                          message.senderId === user?.id 
                            ? 'text-purple-200' 
                            : isDarkMode 
                              ? 'text-gray-400' 
                              : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString('ka-GE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        <div className="flex items-center space-x-1">
                          {/* Message actions for sender or admin */}
                          {(message.senderId === user?.id || user?.role === 'SUPER_ADMIN') && (
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="შეტყობინების წაშლა"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {message.senderId === user?.id && (
                            <div className="flex items-center space-x-1">
                              {message.isRead ? (
                                <CheckCheck className="w-3 h-3 text-purple-200" />
                              ) : (
                                <Check className="w-3 h-3 text-purple-200" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className={`px-3 py-2 rounded-lg ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              {showQuickReplies && (
                <div className={`border-t p-3 max-h-32 overflow-y-auto ${
                  isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="grid grid-cols-1 gap-2">
                    {quickReplies.map(reply => (
                      <button
                        key={reply.id}
                        onClick={() => insertQuickReply(reply)}
                        className={`text-left p-2 rounded text-sm transition-colors ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                            : 'bg-white hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{reply.title}</div>
                        <div className={`text-xs truncate ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {reply.content}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className={`p-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {showInternalNotes && (
                  <div className={`mb-2 text-xs flex items-center space-x-1 ${
                    isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>
                    <Pin className="w-3 h-3" />
                    <span>შიდა შენიშვნის რეჟიმი</span>
                  </div>
                )}
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={showInternalNotes ? "შიდა შენიშვნა..." : "შეტყობინება..."}
                      className={`w-full px-3 py-2 text-sm rounded-lg border resize-none ${
                        showInternalNotes
                          ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30'
                          : isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className={`p-2 rounded transition-colors ${
                        showQuickReplies 
                          ? 'bg-purple-500 text-white' 
                          : isDarkMode 
                            ? 'text-gray-400 hover:bg-gray-700' 
                            : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="სწრაფი პასუხები"
                    >
                      <Zap className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2 rounded transition-colors ${
                        isDarkMode 
                          ? 'text-gray-400 hover:bg-gray-700' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="ფაილის მიმაგრება"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className={`p-2 rounded transition-colors ${
                        newMessage.trim()
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-500'
                            : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  // Handle file upload
                  console.log('Files selected:', e.target.files);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedMessagingSystem;