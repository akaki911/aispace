// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  Filter, 
  Search, 
  MoreVertical,
  Flag,
  UserCheck,
  Archive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Tag,
  Calendar,
  Send,
  ArrowLeft,
  User,
  Paperclip,
  Check,
  Pin,
  Edit,
  Reply,
  Forward,
  Trash,
  VolumeX,
  Volume2,
  UserX,
  Shield
} from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import { useAuth } from '../contexts/useAuth';
import { messagingService, Conversation, Message } from '../services/messagingService';
import { collection, query, getDocs, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  avgResponseTime: number;
  unreadCount: number;
  supportTickets: number;
  resolvedToday: number;
}

interface AdminConversation extends Conversation {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'resolved' | 'escalated';
  assignedTo?: string;
  responseTime?: number;
  messageCount: number;
  tags: string[];
  flagged: boolean;
  customerSatisfaction?: number;
}

const AdminMessagingDashboard: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  // Check if user has admin access - allow customers to see their own messaging
  const isAdmin = user && ['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN'].includes(user.role);
  const isCustomer = user && user.role === 'CUSTOMER';
  
  if (!user || (!isAdmin && !isCustomer)) {
    return (
      <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className={`w-16 h-16 mx-auto mb-4 text-red-500`} />
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                წვდომა უარყოფილია
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                თქვენ არ გაქვთ შეტყობინებების სისტემის უფლება
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [stats, setStats] = useState<ConversationStats>({
    totalConversations: 0,
    activeConversations: 0,
    avgResponseTime: 0,
    unreadCount: 0,
    supportTickets: 0,
    resolvedToday: 0
  });
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'open' | 'pending' | 'urgent' | 'flagged'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'lastActivity' | 'priority' | 'responseTime'>('lastActivity');
  
  // New states for messaging functionality
  const [selectedConversation, setSelectedConversation] = useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConversationView, setShowConversationView] = useState(false);
  const [selectedConversationMenu, setSelectedConversationMenu] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<AdminConversation | null>(null);
  const [showPriorityModal, setShowPriorityModal] = useState<AdminConversation | null>(null);
  const [showTagsModal, setShowTagsModal] = useState<AdminConversation | null>(null);
  const [newTags, setNewTags] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('👤 AdminMessagingDashboard useEffect - User:', user ? {
      id: user.id,
      uid: user.uid,
      role: user.role,
      firstName: user.firstName
    } : 'No user');
    
    if (user && (['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN'].includes(user.role) || user.role === 'CUSTOMER')) {
      console.log('✅ Loading dashboard data for user role:', user.role);
      loadDashboardData();
    } else {
      console.log('🚫 User not authorized for messaging dashboard');
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation && showConversationView) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation, showConversationView]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        console.error('No user found');
        setLoading(false);
        return;
      }
      
      // Use messagingService for all roles to ensure consistent handling
      let conversationsData: AdminConversation[] = [];
      
      try {
        const userConversations = await messagingService.getConversations(user.id || user.uid, user.role);
        conversationsData = Array.isArray(userConversations) ? userConversations as AdminConversation[] : [];
        
        // For super admins, if no conversations found via service, try direct fetch
        if (user.role === 'SUPER_ADMIN' && conversationsData.length === 0) {
          const conversationsRef = collection(db, 'conversations');
          const conversationsQuery = query(conversationsRef, orderBy('updatedAt', 'desc'));
          const conversationsSnapshot = await getDocs(conversationsQuery);
          
          for (const docSnap of conversationsSnapshot.docs) {
            const data = docSnap.data();
            conversationsData.push({
              id: docSnap.id,
              type: data.type || 'general',
              bookingId: data.bookingId,
              participantIds: data.participantIds || [],
              participantNames: data.participantNames || [],
              participantRoles: data.participantRoles || [],
              unreadCount: data.unreadCount || {},
              isActive: data.isActive !== false,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              metadata: data.metadata || {}
            } as AdminConversation);
          }
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        conversationsData = [];
      }
      
      // Ensure conversationsData is always an array
      if (!Array.isArray(conversationsData)) {
        conversationsData = [];
      }
      
      let totalUnread = 0;
      let supportTickets = 0;
      let activeCount = 0;
      
      // Process conversations data safely
      const processedConversations: AdminConversation[] = [];
      
      if (Array.isArray(conversationsData) && conversationsData.length > 0) {
        for (const conversation of conversationsData) {
          try {
            // Count unread messages for this conversation
            const unreadForConversation = Object.values(conversation.unreadCount || {})
              .reduce((sum: number, count) => sum + (count as number), 0);
            totalUnread += unreadForConversation;
            
            if (conversation.type === 'support') {
              supportTickets++;
            }
            
            if (conversation.isActive !== false) {
              activeCount++;
            }
            
            // Get message count for this conversation
            let messageCount = 0;
            try {
              const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
              const messagesSnapshot = await getDocs(messagesRef);
              messageCount = messagesSnapshot.size;
            } catch (error) {
              console.log('Could not get message count for conversation:', conversation.id);
              messageCount = 0;
            }
            
            // Determine priority based on type and metadata
            let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
            if (conversation.metadata?.priority) {
              priority = conversation.metadata.priority;
            } else if (conversation.type === 'support') {
              priority = 'high';
            } else if (conversation.type === 'dispute') {
              priority = 'urgent';
            }
            
            // Determine status
            let status: 'open' | 'pending' | 'resolved' | 'escalated' = 'open';
            if (!conversation.isActive) {
              status = 'resolved';
            } else if (conversation.type === 'dispute') {
              status = 'escalated';
            } else if (unreadForConversation > 0) {
              status = 'pending';
            }
            
            // Calculate actual response time from messages
            let responseTime = 30; // default fallback
            try {
              const messages = await messagingService.getMessages(conversation.id, 5);
              if (messages.messages && messages.messages.length > 1) {
                const timeDiffs = messages.messages.slice(1).map((msg, index) => {
                  const prevMsg = messages.messages[index];
                  return msg.timestamp.getTime() - prevMsg.timestamp.getTime();
                });
                if (timeDiffs.length > 0) {
                  responseTime = Math.round(timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length / 60000); // minutes
                }
              }
            } catch (error) {
              console.log('Could not calculate response time for conversation:', conversation.id);
            }
            
            const adminConversation: AdminConversation = {
              ...conversation,
              priority,
              status,
              messageCount,
              tags: [],
              flagged: priority === 'urgent' || conversation.type === 'dispute',
              responseTime
            };
            
            // Generate tags based on conversation data
            if (conversation.bookingId) {
              adminConversation.tags.push('ჯავშანი');
            }
            if (conversation.type === 'support') {
              adminConversation.tags.push('მხარდაჭერა');
            }
            if (conversation.type === 'dispute') {
              adminConversation.tags.push('კონფლიქტი');
            }
            if (conversation.metadata?.propertyName) {
              adminConversation.tags.push(conversation.metadata.propertyName);
            }
            if (conversation.metadata?.bookingReference) {
              adminConversation.tags.push(conversation.metadata.bookingReference);
            }
            
            processedConversations.push(adminConversation);
          } catch (error) {
            console.error('Error processing conversation:', conversation.id, error);
          }
        }
      }
      
      // Calculate stats with processed conversations
      const newStats: ConversationStats = {
        totalConversations: processedConversations.length,
        activeConversations: activeCount,
        avgResponseTime: processedConversations.length > 0 
          ? processedConversations.reduce((sum, conv) => sum + (conv.responseTime || 0), 0) / processedConversations.length
          : 0,
        unreadCount: totalUnread,
        supportTickets,
        resolvedToday: processedConversations.filter(conv => 
          conv.status === 'resolved' && 
          conv.updatedAt.toDateString() === new Date().toDateString()
        ).length
      };
      
      setStats(newStats);
      setConversations(processedConversations);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const unsubscribe = messagingService.subscribeToMessages(conversationId, (loadedMessages) => {
        setMessages(loadedMessages);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleConversationClick = async (conversation: AdminConversation) => {
    setSelectedConversation(conversation);
    setShowConversationView(true);
    
    // Mark as read with proper user ID handling
    try {
      // Get current user ID from multiple sources
      let currentUserId = user?.id || user?.uid;
      
      // Fallback to localStorage if auth context user is not available
      if (!currentUserId) {
        const authUser = localStorage.getItem('authUser');
        const savedUserId = localStorage.getItem('userId');
        const savedEmail = localStorage.getItem('savedEmail');
        
        if (authUser) {
          try {
            const parsedUser = JSON.parse(authUser);
            currentUserId = parsedUser.id || parsedUser.uid || parsedUser.personalId;
          } catch (error) {
            console.warn('Could not parse stored auth user');
          }
        }
        
        if (!currentUserId && savedUserId) {
          currentUserId = savedUserId;
        } else if (!currentUserId && savedEmail) {
          currentUserId = savedEmail;
        }
      }
      
      console.log('🔍 Marking conversation as read for user:', currentUserId);
      
      if (currentUserId) {
        await messagingService.markAsRead(conversation.id);
      } else {
        console.warn('⚠️ No user ID available, cannot mark conversation as read');
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) {
      console.log('🚫 Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        hasConversation: !!selectedConversation, 
        isSending 
      });
      return;
    }

    // Additional validation
    if (newMessage.trim().length > 1000) {
      alert('შეტყობინება ძალიან გრძელია (მაქს. 1000 სიმბოლო)');
      return;
    }

    console.log('📤 Sending message:', { 
      conversationId: selectedConversation.id, 
      message: newMessage.trim().substring(0, 50),
      messageLength: newMessage.trim().length
    });

    setIsSending(true);
    try {
      await messagingService.sendMessage(selectedConversation.id, newMessage.trim());
      setNewMessage('');
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Provide more specific error messages
      let errorMessage = 'შეცდომა შეტყობინების გაგზავნისას';
      
      if (error instanceof Error) {
        if (error.message.includes('ავტორიზებული')) {
          errorMessage = 'გთხოვთ ხელახლა შეხვიდეთ სისტემაში';
        } else if (error.message.includes('ცარიელი')) {
          errorMessage = 'შეტყობინება არ შეიძლება ცარიელი იყოს';
        } else if (error.message.includes('ვერ მოიძებნა')) {
          errorMessage = 'საუბარი ვერ მოიძებნა, გთხოვთ განაახლოთ გვერდი';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleBackToList = () => {
    setShowConversationView(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  const handleArchiveToggle = async (conversation: AdminConversation) => {
    try {
      if (conversation.isActive) {
        await messagingService.archiveConversation(conversation.id);
        alert('საუბარი წარმატებით დაარქივდა');
      } else {
        await messagingService.restoreConversation(conversation.id);
        alert('საუბარი წარმატებით აღდგა');
      }
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error toggling archive:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleDeleteConversation = (conversation: AdminConversation) => {
    setShowDeleteModal(conversation);
  };

  const confirmDeleteConversation = async () => {
    if (!showDeleteModal) return;
    
    try {
      await messagingService.deleteConversation(showDeleteModal.id);
      alert('საუბარი წარმატებით წაიშალა');
      setShowDeleteModal(null);
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handlePriorityChange = (conversation: AdminConversation) => {
    setShowPriorityModal(conversation);
  };

  const updatePriority = async (priority: 'low' | 'medium' | 'high') => {
    if (!showPriorityModal) return;
    
    try {
      await messagingService.updateConversationPriority(showPriorityModal.id, priority);
      alert('პრიორიტეტი წარმატებით განახლდა');
      setShowPriorityModal(null);
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error updating priority:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleAddTags = (conversation: AdminConversation) => {
    setShowTagsModal(conversation);
    setNewTags('');
  };

  const addTags = async () => {
    if (!showTagsModal || !newTags.trim()) return;
    
    try {
      const tags = newTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await messagingService.addConversationTags(showTagsModal.id, tags);
      alert('ტეგები წარმატებით დაემატა');
      setShowTagsModal(null);
      setNewTags('');
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error adding tags:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleLeaveConversation = async (conversation: AdminConversation) => {
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ საუბრიდან გასვლა?')) {
      try {
        await messagingService.leaveConversation(conversation.id);
        alert('საუბრიდან წარმატებით გავედით');
        setSelectedConversationMenu(null);
        loadDashboardData(); // Refresh data
      } catch (error) {
        console.error('Error leaving conversation:', error);
        alert(`შეცდომა: ${error.message}`);
      }
    }
  };

  const handleExportConversation = async (conversation: AdminConversation) => {
    try {
      const messages = await messagingService.getMessages(conversation.id, 1000);
      const exportData = {
        conversation: {
          id: conversation.id,
          participants: conversation.participantNames,
          createdAt: conversation.createdAt,
          type: conversation.type
        },
        messages: messages.messages.map(msg => ({
          sender: msg.senderName,
          content: msg.content,
          timestamp: msg.timestamp.toISOString()
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversation.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSelectedConversationMenu(null);
    } catch (error) {
      console.error('Error exporting conversation:', error);
      alert(`შეცდომა ექსპორტისას: ${error.message}`);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ შეტყობინების წაშლა?')) {
      try {
        await messagingService.deleteMessage(selectedConversation.id, messageId);
        alert('შეტყობინება წარმატებით წაიშალა');
        // Refresh messages
        await loadMessages(selectedConversation.id);
      } catch (error) {
        console.error('Error deleting message:', error);
        alert(`შეცდომა: ${error.message}`);
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
        alert(`შეცდომა: ${error.message}`);
      }
    }
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      await messagingService.pinMessage(selectedConversation!.id, messageId, !isPinned);
      alert(isPinned ? 'შეტყობინება გაუქმდა' : 'შეტყობინება მიმაგრდა');
    } catch (error) {
      console.error('Error pinning message:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ ${userName}-ის დაბლოკვა?`)) {
      try {
        await messagingService.blockUser(userId);
        alert('მომხმარებელი დაბლოკილია');
        loadDashboardData();
      } catch (error) {
        console.error('Error blocking user:', error);
        alert(`შეცდომა: ${error.message}`);
      }
    }
  };

  const handleMuteConversation = async (conversationId: string, isMuted: boolean) => {
    try {
      await messagingService.muteConversation(conversationId, !isMuted);
      alert(isMuted ? 'საუბარი აღარ არის გაუჩუმებული' : 'საუბარი გაუჩუმდა');
      loadDashboardData();
    } catch (error) {
      console.error('Error muting conversation:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleReportMessage = async (messageId: string, reason: string) => {
    try {
      await messagingService.reportMessage(selectedConversation!.id, messageId, reason);
      alert('შეტყობინება დარეპორტებულია');
    } catch (error) {
      console.error('Error reporting message:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const handleForwardMessage = async (messageId: string, targetConversationId: string) => {
    try {
      await messagingService.forwardMessage(selectedConversation!.id, messageId, targetConversationId);
      alert('შეტყობინება გადაიგზავნა');
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert(`შეცდომა: ${error.message}`);
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('ka-GE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-500';
      case 'pending': return 'text-yellow-500';
      case 'resolved': return 'text-blue-500';
      case 'escalated': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <Flag className="w-4 h-4 text-orange-500" />;
      case 'normal': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = conversation.participantNames.some(p => 
      p.toLowerCase().includes(searchTerm.toLowerCase())
    ) || conversation.tags.some(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesFilter = (() => {
      switch (selectedFilter) {
        case 'open': return conversation.status === 'open';
        case 'pending': return conversation.status === 'pending';
        case 'urgent': return conversation.priority === 'urgent';
        case 'flagged': return conversation.flagged;
        default: return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    switch (sortBy) {
      case 'lastActivity':
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      case 'responseTime':
        return (b.responseTime || 0) - (a.responseTime || 0);
      default:
        return 0;
    }
  });

  const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; unit?: string }> = 
    ({ title, value, icon, color, unit = '' }) => (
    <div className={`p-6 rounded-lg border ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {Math.round(value)}{unit}
          </p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show conversation view when selected
  if (showConversationView && selectedConversation) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto h-screen flex flex-col">
          {/* Header */}
          <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackToList}
                  className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedConversation.participantNames.filter(name => 
                        !name.includes(user?.firstName || '') && !name.includes(user?.lastName || '')
                      ).join(' ↔ ')}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>საუბარი #{selectedConversation.id.slice(-6)}</span>
                      {selectedConversation.bookingId && (
                        <>
                          <span>•</span>
                          <span>ბრონირება: {selectedConversation.bookingId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-sm rounded-full ${
                  selectedConversation.status === 'open'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200'
                    : selectedConversation.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                }`}>
                  {selectedConversation.status === 'open' ? 'ღია' :
                   selectedConversation.status === 'pending' ? 'მოლოდინში' : 'გადაწყვეტილი'}
                </span>
                {selectedConversation.flagged && (
                  <Flag className="w-4 h-4 text-red-500" />
                )}
                
                {/* Conversation actions */}
                <div className="flex items-center space-x-1">
                  {/* Mute/Unmute conversation */}
                  <button
                    onClick={() => handleMuteConversation(selectedConversation.id, selectedConversation.isMuted || false)}
                    className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}
                    title={selectedConversation.isMuted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'}
                  >
                    {selectedConversation.isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  
                  {/* Block user (admin only) */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        const otherUser = selectedConversation.participantNames.find(name => 
                          !name.includes(user?.firstName || '') && !name.includes(user?.lastName || '')
                        );
                        const otherUserId = selectedConversation.participantIds.find(id => id !== (user?.id || user?.uid));
                        if (otherUserId && otherUser) {
                          handleBlockUser(otherUserId, otherUser);
                        }
                      }}
                      className={`p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500`}
                      title="მომხმარებლის დაბლოკვა"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Close conversation */}
                  <button
                    onClick={() => {
                      if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ საუბრის დახურვა?')) {
                        handleArchiveToggle(selectedConversation);
                      }
                    }}
                    className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}
                    title="საუბრის დახურვა"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <MessageSquare className={`w-16 h-16 mx-auto mb-4 opacity-50 ${
                    isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    შეტყობინებები არ არის
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    ეს საუბარი ჯერ არ დაწყებულა
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const userIdentifier = user?.uid || user?.id || localStorage.getItem('savedEmail');
                const isOwnMessage = message.senderId === userIdentifier;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      isOwnMessage
                        ? 'bg-blue-500 text-white'
                        : isDarkMode 
                          ? 'bg-gray-700 text-white' 
                          : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-medium ${
                          isOwnMessage 
                            ? 'text-blue-100' 
                            : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {message.senderName}
                        </span>
                        <span className={`text-xs ${
                          isOwnMessage 
                            ? 'text-blue-100' 
                            : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {formatMessageTime(message.timestamp)}
                        </span>
                      </div>
                      <div className="group relative">
                        <p className="text-sm">{message.content}</p>
                        
                        {/* Message actions menu */}
                        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center space-x-1 bg-black/20 rounded px-1">
                            {/* Pin/Unpin message */}
                            <button
                              onClick={() => handlePinMessage(message.id, message.isPinned || false)}
                              className="text-white hover:text-yellow-300 p-1"
                              title={message.isPinned ? 'პინის გაუქმება' : 'შეტყობინების მიმაგრება'}
                            >
                              <Pin className={`w-3 h-3 ${message.isPinned ? 'text-yellow-300' : ''}`} />
                            </button>
                            
                            {/* Edit message (only for own messages) */}
                            {isOwnMessage && (
                              <button
                                onClick={() => handleEditMessage(message.id, message.content)}
                                className="text-white hover:text-blue-300 p-1"
                                title="შეტყობინების რედაქტირება"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                            
                            {/* Reply to message */}
                            <button
                              onClick={() => setNewMessage(`@${message.senderName} `)}
                              className="text-white hover:text-green-300 p-1"
                              title="პასუხი"
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                            
                            {/* Forward message */}
                            <button
                              onClick={() => {
                                const conversationId = prompt('შეიყვანეთ საუბრის ID გადასაგზავნად:');
                                if (conversationId) handleForwardMessage(message.id, conversationId);
                              }}
                              className="text-white hover:text-purple-300 p-1"
                              title="შეტყობინების გადაგზავნა"
                            >
                              <Forward className="w-3 h-3" />
                            </button>
                            
                            {/* Report message (for other users' messages) */}
                            {!isOwnMessage && (
                              <button
                                onClick={() => {
                                  const reason = prompt('მიუთითეთ რეპორტის მიზეზი:');
                                  if (reason) handleReportMessage(message.id, reason);
                                }}
                                className="text-white hover:text-red-300 p-1"
                                title="შეტყობინების რეპორტი"
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            )}
                            
                            {/* Delete message (admin only or own messages) */}
                            {(isAdmin || isOwnMessage) && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="text-white hover:text-red-300 p-1"
                                title="შეტყობინების წაშლა"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs ${
                            isOwnMessage 
                              ? 'text-blue-100' 
                              : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {message.isEdited && (
                            <span className="text-xs text-gray-400">(რედაქტირებული)</span>
                          )}
                          {message.isPinned && (
                            <Pin className="w-3 h-3 text-yellow-400" />
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {isOwnMessage && (
                            <Check className="w-3 h-3 text-blue-200" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center space-x-3">
              <button className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="შეიყვანეთ შეტყობინება..."
                  className={`w-full px-4 py-3 rounded-full border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  disabled={isSending}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {isCustomer ? 'ჩემი შეტყობინებები' : 'შეტყობინებების ადმინისტრირება'}
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isCustomer ? 'თქვენი საუბრები და მხარდაჭერა' : 'მხარდაჭერისა და კომუნიკაციის მართვა'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <StatCard
            title="სულ საუბრები"
            value={stats.totalConversations}
            icon={<MessageSquare className="w-6 h-6 text-white" />}
            color="bg-blue-500"
          />
          <StatCard
            title="აქტიური"
            value={stats.activeConversations}
            icon={<Users className="w-6 h-6 text-white" />}
            color="bg-green-500"
          />
          <StatCard
            title="საშუალო პასუხი"
            value={stats.avgResponseTime}
            icon={<Clock className="w-6 h-6 text-white" />}
            color="bg-orange-500"
            unit=" წუთი"
          />
          <StatCard
            title="წაუკითხავი"
            value={stats.unreadCount}
            icon={<Flag className="w-6 h-6 text-white" />}
            color="bg-red-500"
          />
          <StatCard
            title="მხარდაჭერა"
            value={stats.supportTickets}
            icon={<AlertTriangle className="w-6 h-6 text-white" />}
            color="bg-purple-500"
          />
          <StatCard
            title="დღეს გადაწყვეტილი"
            value={stats.resolvedToday}
            icon={<CheckCircle className="w-6 h-6 text-white" />}
            color="bg-teal-500"
          />
        </div>

        {/* Filters and Search */}
        <div className={`mb-6 p-6 rounded-lg border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'ყველა', count: conversations.length },
                { key: 'open', label: 'ღია', count: conversations.filter(c => c.status === 'open').length },
                { key: 'pending', label: 'მოლოდინში', count: conversations.filter(c => c.status === 'pending').length },
                { key: 'urgent', label: 'გადაუდებელი', count: conversations.filter(c => c.priority === 'urgent').length },
                { key: 'flagged', label: 'მონიშნული', count: conversations.filter(c => c.flagged).length }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedFilter === filter.key
                      ? 'bg-purple-500 text-white'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="ძებნა..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 pr-3 py-2 text-sm rounded-lg border w-64 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
              >
                <option value="lastActivity">ბოლო აქტივობით</option>
                <option value="priority">პრიორიტეტით</option>
                <option value="responseTime">პასუხის დროით</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conversations Table */}
        <div className={`rounded-lg border overflow-hidden ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    საუბარი
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    ტიპი/პრიორიტეტი
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    სტატუსი
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    ბოლო აქტივობა
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    შეტყობინებები
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    მოქმედებები
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {sortedConversations.map((conversation) => (
                  <tr key={conversation.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    conversation.flagged ? 'bg-red-50 dark:bg-red-900/20' : ''
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-start space-x-3">
                        {conversation.flagged && (
                          <Flag className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className={`font-medium text-sm truncate ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {conversation.participantNames.join(' ↔ ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {conversation.tags.map((tag, index) => (
                              <span
                                key={index}
                                className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                  isDarkMode 
                                    ? 'bg-gray-700 text-gray-300' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className={`text-xs mt-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {conversation.bookingId && `ჯავშანი: ${conversation.bookingId}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getPriorityIcon(conversation.priority)}
                        <span className={`text-sm capitalize ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {conversation.type === 'booking' ? 'ჯავშანი' : 
                           conversation.type === 'support' ? 'მხარდაჭერა' : 'ზოგადი'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        conversation.status === 'open' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200'
                          : conversation.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                            : conversation.status === 'resolved'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      }`}>
                        {conversation.status === 'open' ? 'ღია' :
                         conversation.status === 'pending' ? 'მოლოდინში' :
                         conversation.status === 'resolved' ? 'გადაწყვეტილი' : 'ესკალაცია'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                        {conversation.updatedAt.toLocaleDateString('ka-GE')}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {conversation.updatedAt.toLocaleTimeString('ka-GE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {conversation.messageCount} შეტყობინება
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleConversationClick(conversation)}
                          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                          title="ნახვა და პასუხი"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        
                        {/* Archive/Restore Button */}
                        <button
                          onClick={() => handleArchiveToggle(conversation)}
                          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                          title={conversation.isActive ? "არქივირება" : "აღდგენა"}
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        {/* Admin-only controls */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handlePriorityChange(conversation)}
                              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}
                              title="პრიორიტეტი"
                            >
                              <Flag className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => handleDeleteConversation(conversation)}
                              className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500`}
                              title="წაშლა"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        <button
                          onClick={() => setSelectedConversationMenu(selectedConversationMenu === conversation.id ? null : conversation.id)}
                          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                          title="მეტი"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {selectedConversationMenu === conversation.id && (
                          <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-50 ${
                            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          } border`}>
                            <div className="py-1">
                              <button
                                onClick={() => handleLeaveConversation(conversation)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}
                              >
                                საუბრიდან გასვლა
                              </button>
                              <button
                                onClick={() => handleAddTags(conversation)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}
                              >
                                ტეგების დამატება
                              </button>
                              <button
                                onClick={() => handleExportConversation(conversation)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}
                              >
                                ექსპორტი
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {sortedConversations.length === 0 && (
          <div className={`text-center py-12 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-lg border`}>
            <MessageSquare className={`mx-auto h-12 w-12 ${
              isDarkMode ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`mt-2 text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              საუბრები ვერ მოიძებნა
            </h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              შეცვალეთ ფილტრები ან ძებნის პარამეტრები
            </p>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                საუბრის წაშლა
              </h3>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                დარწმუნებული ხართ, რომ გსურთ ამ საუბრისა და ყველა შეტყობინების წაშლა? ეს მოქმედება შეუქცევადია.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className={`px-4 py-2 rounded border ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  გაუქმება
                </button>
                <button
                  onClick={confirmDeleteConversation}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  წაშლა
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Priority Modal */}
        {showPriorityModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                პრიორიტეტის შეცვლა
              </h3>
              <div className="space-y-3 mb-6">
                {[
                  { value: 'low', label: 'დაბალი', color: 'text-green-500' },
                  { value: 'medium', label: 'საშუალო', color: 'text-yellow-500' },
                  { value: 'high', label: 'მაღალი', color: 'text-red-500' }
                ].map(priority => (
                  <button
                    key={priority.value}
                    onClick={() => updatePriority(priority.value as 'low' | 'medium' | 'high')}
                    className={`w-full text-left p-3 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'border-gray-600' : 'border-gray-300'
                    }`}
                  >
                    <span className={`font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPriorityModal(null)}
                className={`w-full px-4 py-2 rounded border ${
                  isDarkMode 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                გაუქმება
              </button>
            </div>
          </div>
        )}

        {/* Tags Modal */}
        {showTagsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                ტეგების დამატება
              </h3>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="ტეგები გამოყავით მძიმით..."
                className={`w-full px-3 py-2 rounded border mb-4 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowTagsModal(null)}
                  className={`px-4 py-2 rounded border ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  გაუქმება
                </button>
                <button
                  onClick={addTags}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  დამატება
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMessagingDashboard;
