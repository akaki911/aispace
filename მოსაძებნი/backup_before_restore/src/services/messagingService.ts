import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  getDoc,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

// Support team configuration - აკაკი ცინცაძე ყველასთვის
export const SUPPORT_TEAM = {
  id: 'akaki-tsintsadze',
  name: 'აკაკი ცინცაძე',
  role: 'SUPPORT_ADMIN',
  email: 'support@bakhmaro.ge',
  phone: '+995598123456'
};

// Helper function to create support conversation with Akaki
export const createSupportConversation = async (
  userId: string,
  userName: string,
  userRole: string,
  subject: string,
  initialMessage?: string
): Promise<Conversation> => {
  const participantIds = [userId, SUPPORT_TEAM.id];
  const participantNames = [userName, SUPPORT_TEAM.name];
  const participantRoles = [userRole, SUPPORT_TEAM.role];

  const conversation = await messagingService.createConversation(
    'support',
    participantIds,
    participantNames,
    participantRoles,
    {
      priority: 'medium',
      bookingReference: subject
    }
  );

  // Send initial support message
  if (initialMessage) {
    await messagingService.sendMessage(conversation.id, initialMessage);
  }

  return conversation;
};

// Helper function to get provider's limited conversations (only their bookings and support)
export const getProviderConversations = async (providerId: string): Promise<Conversation[]> => {
  try {
    const conversationsRef = collection(db, 'conversations');

    // Get conversations where provider is a participant
    const providerConversationsQuery = query(
      conversationsRef,
      where('participantIds', 'array-contains', providerId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(providerConversationsQuery);
    const conversations: Conversation[] = [];

    // Get provider's own bookings to validate conversation access
    const bookingsRef = collection(db, 'bookings');
    const providerBookingsQuery = query(
      bookingsRef,
      where('providerId', '==', providerId)
    );
    const providerBookings = await getDocs(providerBookingsQuery);
    const providerBookingIds = new Set(providerBookings.docs.map(doc => doc.id));

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // Provider can only see:
      // 1. Support conversations (with Akaki)
      // 2. Booking conversations for their own bookings
      const isValidConversation = 
        data.type === 'support' || 
        (data.type === 'booking' && data.bookingId && providerBookingIds.has(data.bookingId));

      if (isValidConversation) {
        const conversation: Conversation = {
          id: docSnap.id,
          type: data.type,
          bookingId: data.bookingId,
          participantIds: data.participantIds || [],
          participantNames: data.participantNames || [],
          participantRoles: data.participantRoles || [],
          unreadCount: data.unreadCount || {},
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          metadata: data.metadata || {}
        };

        // Get last message
        const lastMessage = await messagingService.getLastMessage(conversation.id);
        if (lastMessage) {
          conversation.lastMessage = lastMessage;
        }

        conversations.push(conversation);
      }
    }

    return conversations;
  } catch (error) {
    console.error('Error fetching provider conversations:', error);
    throw new Error('შეცდომა პროვაიდერის საუბრების ჩატვირთვისას');
  }
};

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  readBy: string[];
  attachments?: string[];
  messageType: 'text' | 'image' | 'file' | 'system' | 'forwarded';
  isEdited?: boolean;
  editedAt?: Date;
  editedBy?: string;
  isPinned?: boolean;
  pinnedAt?: Date;
  pinnedBy?: string;
  isReported?: boolean;
  reportedAt?: Date;
  reportedBy?: string[];
  originalMessageId?: string;
  originalSender?: string;
  forwardedFrom?: string;
}

export interface Conversation {
  id: string;
  type: 'booking' | 'support' | 'general';
  bookingId?: string;
  participantIds: string[];
  participantNames: string[];
  participantRoles: string[];
  lastMessage?: Message;
  unreadCount: { [userId: string]: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isMuted?: boolean;
  mutedBy?: { [userId: string]: boolean };
  metadata?: {
    propertyName?: string;
    bookingReference?: string;
    priority?: 'low' | 'medium' | 'high';
    listingTitle?: string;
    listingType?: string;
  };
}

// Helper function to get current user ID from various sources
const getCurrentUserId = (): string | null => {
  console.log('🔍 Getting current user ID...');

  // Try to get from window.authContext if available (React context)
  try {
    const authContext = (window as any).authContext;
    if (authContext?.user?.id) {
      console.log('✅ Found user ID from window auth context:', authContext.user.id);
      return authContext.user.id;
    }
  } catch (error) {
    console.warn('⚠️ Could not get user from window auth context');
  }

  // Try localStorage auth user
  try {
    const authUser = localStorage.getItem('authUser');
    if (authUser) {
      const parsedUser = JSON.parse(authUser);
      const userId = parsedUser.id || parsedUser.uid || parsedUser.personalId;
      if (userId) {
        console.log('✅ Found user ID from authUser:', userId);
        return userId;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not parse stored auth user');
  }

  // Try Firebase Auth
  const firebaseUser = auth.currentUser;
  if (firebaseUser?.uid) {
    console.log('✅ Found Firebase user ID:', firebaseUser.uid);
    return firebaseUser.uid;
  }

  // Try individual stored values
  const savedUserId = localStorage.getItem('userId');
  if (savedUserId) {
    console.log('✅ Found saved user ID:', savedUserId);
    return savedUserId;
  }

  const savedEmail = localStorage.getItem('savedEmail');
  if (savedEmail) {
    console.log('✅ Using saved email as user ID:', savedEmail);
    return savedEmail;
  }

  const savedEmailOrPhone = localStorage.getItem('savedEmailOrPhone');
  if (savedEmailOrPhone) {
    console.log('✅ Using savedEmailOrPhone as user ID:', savedEmailOrPhone);
    return savedEmailOrPhone;
  }

  console.warn('❌ No user ID found from any source');
  return null;
};

export const messagingService = {
  // Get conversations for user based on role
  async getConversations(userId: string, userRole?: string): Promise<Conversation[]> {
    try {
      console.log('🔍 Loading conversations for user:', { userId, userRole });

      // For provider admins, use the restricted function with fallback
      if (userRole === 'PROVIDER_ADMIN') {
        try {
          return await getProviderConversations(userId);
        } catch (error) {
          console.warn('⚠️ Provider conversations failed, using fallback:', error);
          // Fallback to regular participant-based query
        }
      }

      // For super admins, get ALL conversations (not filtered by participant)
      if (userRole === 'SUPER_ADMIN') {
        try {
          const conversationsRef = collection(db, 'conversations');
          const q = query(
            conversationsRef,
            orderBy('updatedAt', 'desc')
          );

          const snapshot = await getDocs(q);
          const conversations: Conversation[] = [];

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const conversation: Conversation = {
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
            };

            // Get last message with error handling
            try {
              const lastMessage = await this.getLastMessage(conversation.id);
              if (lastMessage) {
                conversation.lastMessage = lastMessage;
              }
            } catch (messageError) {
              console.warn('Could not load last message for conversation:', conversation.id);
            }

            conversations.push(conversation);
          }

          console.log('✅ Loaded super admin conversations:', conversations.length);
          return conversations;
        } catch (error) {
          console.warn('⚠️ Super admin query failed, using fallback:', error);
          // Fallback to participant-based query
        }
      }

      // For customers and other roles, get conversations where they are participants
      // This is also the fallback for failed provider/admin queries
      console.log('🔄 Using participant-based query for user:', userId);
      const conversationsRef = collection(db, 'conversations');

      // Try without orderBy first if index is missing
      let q;
      try {
        q = query(
          conversationsRef,
          where('participantIds', 'array-contains', userId),
          orderBy('updatedAt', 'desc')
        );
      } catch (indexError) {
        console.warn('⚠️ Index missing, using query without orderBy');
        q = query(
          conversationsRef,
          where('participantIds', 'array-contains', userId)
        );
      }

      const snapshot = await getDocs(q);
      const conversations: Conversation[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const conversation: Conversation = {
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
        };

        // Get last message with error handling
        try {
          const lastMessage = await this.getLastMessage(conversation.id);
          if (lastMessage) {
            conversation.lastMessage = lastMessage;
          }
        } catch (messageError) {
          console.warn('Could not load last message for conversation:', conversation.id);
        }

        conversations.push(conversation);
      }

      // Sort manually if orderBy was not used
      conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      console.log('✅ Loaded conversations:', conversations.length);
      return conversations;
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      // Return empty array instead of throwing to prevent crash
      return [];
    }
  },

  // Get messages for conversation
  async getMessages(conversationId: string, limitCount = 50, lastDoc?: DocumentSnapshot): Promise<{ messages: Message[], lastVisible?: DocumentSnapshot }> {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      let q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const messages: Message[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        messages.push({
          id: docSnap.id,
          conversationId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole || 'CUSTOMER',
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          isRead: data.isRead || false,
          readBy: data.readBy || [],
          attachments: data.attachments || [],
          messageType: data.messageType || 'text'
        });
      });

      // Reverse to get chronological order (oldest first)
      messages.reverse();

      return {
        messages,
        lastVisible: snapshot.docs[snapshot.docs.length - 1]
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error('შეცდომა შეტყობინებების ჩატვირთვისას');
    }
  },

  // Get last message for conversation
  async getLastMessage(conversationId: string): Promise<Message | null> {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      return {
        id: docSnap.id,
        conversationId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole || 'CUSTOMER',
        content: data.content,
        timestamp: data.timestamp?.toDate() || new Date(),
        isRead: data.isRead || false,
        readBy: data.readBy || [],
        attachments: data.attachments || [],
        messageType: data.messageType || 'text'
      };
    } catch (error) {
      console.error('Error fetching last message:', error);
      return null;
    }
  },

  // Send message
  async sendMessage(conversationId: string, content: string, messageType: 'text' | 'image' | 'file' = 'text', attachments: string[] = []): Promise<Message> {
    try {
      console.log('🔄 Attempting to send message:', { conversationId, content: content.substring(0, 50) });

      // Get current user ID using our helper function
      let currentUserId = getCurrentUserId();
      let currentUserEmail = '';

      // Additional fallback: check if user is logged in from console logs
      if (!currentUserId) {
        console.log('🔍 Checking localStorage for logged in user...');
        const authUser = localStorage.getItem('authUser');
        if (authUser) {
          try {
            const parsedUser = JSON.parse(authUser);
            currentUserId = parsedUser.id || parsedUser.personalId;
            currentUserEmail = parsedUser.email || localStorage.getItem('savedEmail') || '';
            console.log('✅ Found user from localStorage:', { id: currentUserId, email: currentUserEmail });
          } catch (error) {
            console.warn('⚠️ Could not parse stored auth user');
          }
        }
      }

      // Try to get email separately if still not found
      if (!currentUserEmail) {
        const savedEmail = localStorage.getItem('savedEmail');
        currentUserEmail = savedEmail || '';
      }

      if (!currentUserId) {
        console.error('❌ No authenticated user found');
        console.log('🔍 Debug localStorage:', {
          hasAuthUser: !!localStorage.getItem('authUser'),
          hasSavedEmail: !!localStorage.getItem('savedEmail'),
          hasSavedEmailOrPhone: !!localStorage.getItem('savedEmailOrPhone'),
          hasFirebaseUser: !!auth.currentUser
        });
        throw new Error('მომხმარებელი არ არის ავტორიზებული. გთხოვთ ხელახლა შეხვიდეთ სისტემაში.');
      }

      console.log('✅ Using user ID for message:', currentUserId);

      // Validate conversation exists
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        console.error('❌ Conversation not found:', conversationId);
        throw new Error('საუბარი ვერ მოიძებნა');
      }

      console.log('📝 Getting user data for:', currentUserId);

      // Get user data for role and name with comprehensive error handling
      let userData = null;
      let userDisplayName = 'მომხმარებელი';
      let userRole = 'CUSTOMER';

      try {
        // Try to get user data from Firestore using current user ID
        let userDocId = currentUserId;

        // Try direct lookup with current user ID first
        const userDoc = await getDoc(doc(db, 'users', userDocId));
        if (userDoc.exists()) {
          userData = userDoc.data();
          console.log('👤 Found user by ID:', { id: userDocId, firstName: userData.firstName, role: userData.role });
        } else {
          // Try clients collection if not found in users
          const clientDoc = await getDoc(doc(db, 'clients', userDocId));
          if (clientDoc.exists()) {
            userData = clientDoc.data();
            console.log('👤 Found user in clients:', { id: userDocId, firstName: userData.firstName, role: userData.role });
          } else if (currentUserEmail) {
            // If using email as ID, try to find user by email field
            const usersRef = collection(db, 'users');
            const emailQuery = query(usersRef, where('email', '==', currentUserEmail));
            const emailSnapshot = await getDocs(emailQuery);

            if (!emailSnapshot.empty) {
              const userDocSnap = emailSnapshot.docs[0];
              userData = userDocSnap.data();
              userDocId = userDocSnap.id;
              console.log('👤 Found user by email:', { id: userDocId, firstName: userData.firstName, role: userData.role });
            }
          }
        }

        if (userData) {
          userDisplayName = userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`
            : userData.firstName || userData.email || currentUserEmail || 'მომხმარებელი';
          userRole = userData.role || 'CUSTOMER';
        } else {
          console.warn('⚠️ User document not found in Firestore');
          userDisplayName = currentUserEmail || 'მომხმარებელი';
        }
      } catch (userError) {
        console.warn('⚠️ Could not fetch user data from Firestore:', userError);
        userDisplayName = currentUserEmail || 'მომხმარებელი';
      }

      const messageData = {
        senderId: currentUserId,
        senderName: userDisplayName,
        senderRole: userRole,
        content: content.trim(),
        messageType,
        attachments: attachments || [],
        timestamp: serverTimestamp(),
        isRead: false,
        readBy: [currentUserId] // Mark as read for sender
      };

      console.log('💬 Message data prepared:', { 
        senderId: messageData.senderId, 
        senderName: messageData.senderName, 
        senderRole: messageData.senderRole 
      });

      // Validate message content
      if (!messageData.content || messageData.content.trim().length === 0) {
        throw new Error('შეტყობინება არ შეიძლება ცარიელი იყოს');
      }

      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      console.log('🔄 Adding message to Firestore...');

      const docRef = await addDoc(messagesRef, messageData);
      console.log('✅ Message added with ID:', docRef.id);

      // Update conversation with enhanced error handling
      try {
        console.log('🔄 Updating conversation...');
        await updateDoc(conversationRef, {
          updatedAt: serverTimestamp(),
          [`unreadCount.${currentUserId}`]: 0 // Reset unread count for sender
        });
        console.log('✅ Conversation updated');
      } catch (updateError) {
        console.warn('⚠️ Could not update conversation, but message was sent:', updateError);
        // Don't throw here, message was still sent successfully
      }

      const result: Message = {
        id: docRef.id,
        conversationId,
        senderId: currentUserId,
        senderName: messageData.senderName,
        senderRole: messageData.senderRole,
        content: messageData.content,
        timestamp: new Date(),
        isRead: false,
        readBy: [currentUserId],
        attachments: messageData.attachments,
        messageType
      };

      console.log('✅ Message sent successfully:', result.id);
      return result;

    } catch (error) {
      console.error('❌ Error sending message:', error);

      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        throw new Error('არ გაქვთ ამ საუბარში შეტყობინების გაგზავნის უფლება');
      } else if (error.code === 'not-found') {
        throw new Error('საუბარი ვერ მოიძებნა');
      } else if (error.code === 'unauthenticated') {
        throw new Error('გთხოვთ ხელახლა შეხვიდეთ სისტემაში');
      } else {
        throw new Error(`შეცდომა შეტყობინების გაგზავნისას: ${error.message || 'უცნობი შეცდომა'}`);
      }
    }
  },

  // Create conversation
  async createConversation(
    type: 'booking' | 'support' | 'general',
    participantIds: string[],
    participantNames: string[],
    participantRoles: string[],
    metadata?: {
      bookingId?: string;
      propertyName?: string;
      bookingReference?: string;
      priority?: 'low' | 'medium' | 'high';
      listingTitle?: string;
      listingType?: string;
    }
  ): Promise<Conversation> {
    try {
      const firebaseUser = auth.currentUser;
      let currentUserId = firebaseUser?.uid;

      // Try to get user from localStorage with multiple fallbacks
      if (!currentUserId) {
        const authUser = localStorage.getItem('authUser');
        const savedUserId = localStorage.getItem('userId');
        const savedEmail = localStorage.getItem('savedEmail');

        // First, try to get from stored auth user
        if (authUser) {
          try {
            const parsedUser = JSON.parse(authUser);
            currentUserId = parsedUser.id || parsedUser.uid || parsedUser.personalId;
          } catch (error) {
            console.warn('⚠️ Could not parse stored auth user');
          }
        }

        // Fallback to individual stored values
        if (!currentUserId && savedUserId) {
          currentUserId = savedUserId;
        } else if (!currentUserId && savedEmail) {
          currentUserId = savedEmail;
        }

        if (!currentUserId) {
          throw new Error('მომხმარებელი არ არის ავტორიზებული');
        }
      }

      const conversationData = {
        type,
        participantIds,
        participantNames,
        participantRoles,
        unreadCount: participantIds.reduce((acc, id) => {
          acc[id] = 0;
          return acc;
        }, {} as { [key: string]: number }),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: metadata || {}
      };

      const conversationsRef = collection(db, 'conversations');
      const docRef = await addDoc(conversationsRef, conversationData);

      return {
        id: docRef.id,
        type,
        participantIds,
        participantNames,
        participantRoles,
        unreadCount: conversationData.unreadCount,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: metadata || {}
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('შეცდომა საუბრის შექმნისას');
    }
  },

  // Mark messages as read
  async markAsRead(conversationId: string): Promise<void> {
    try {
      console.log('🔄 Starting markAsRead for conversation:', conversationId);

      const currentUserId = getCurrentUserId();

      if (!currentUserId) {
        console.warn('⚠️ No user ID available for markAsRead - skipping read marking');
        console.log('🔍 Debug info:', {
          firebaseUser: !!auth.currentUser,
          authUserInStorage: !!localStorage.getItem('authUser'),
          savedUserIdInStorage: !!localStorage.getItem('userId'),
          savedEmailInStorage: !!localStorage.getItem('savedEmail'),
          savedEmailOrPhoneInStorage: !!localStorage.getItem('savedEmailOrPhone')
        });
        // Don't throw error, just return silently
        return;
      }

      console.log('✅ Found user ID for markAsRead:', currentUserId);

      const batch = writeBatch(db);

      // Get unread messages
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('readBy', 'not-in', [[currentUserId]])
      );

      console.log('🔍 Querying unread messages for user:', currentUserId);
      const snapshot = await getDocs(q);
      console.log('📨 Found', snapshot.docs.length, 'unread messages');

      // Mark each message as read
      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, {
          readBy: arrayUnion(currentUserId)
        });
      });

      // Update conversation unread count
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.update(conversationRef, {
        [`unreadCount.${currentUserId}`]: 0
      });

      console.log('🔄 Committing batch update...');
      await batch.commit();
      console.log('✅ Successfully marked', snapshot.docs.length, 'messages as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('შეცდომა შეტყობინებების მონიშვნისას');
    }
  },

  // Get unread count for user
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participantIds', 'array-contains', userId)
      );

      const snapshot = await getDocs(q);
      let totalUnread = 0;

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const unreadCount = data.unreadCount?.[userId] || 0;
        totalUnread += unreadCount;
      });

      return totalUnread;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  // Listen to conversations in real-time
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, async (snapshot) => {
      const conversations: Conversation[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const conversation: Conversation = {
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
        };

        // Get last message
        const lastMessage = await this.getLastMessage(conversation.id);
        if (lastMessage) {
          conversation.lastMessage = lastMessage;
        }

        conversations.push(conversation);
      }

      callback(conversations);
    });
  },

  // Listen to messages in real-time
  subscribeToMessages(conversationId: string, callback: (messages: Message[]) => void): () => void {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        messages.push({
          id: docSnap.id,
          conversationId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole || 'CUSTOMER',
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          isRead: data.isRead || false,
          readBy: data.readBy || [],
          attachments: data.attachments || [],
          messageType: data.messageType || 'text'
        });
      });

      // Reverse to get chronological order
      messages.reverse();
      callback(messages);
    });
  },

  // Delete a message (admin only)
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      // Check if user has admin rights
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();

      if (!userData || !['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN'].includes(userData.role)) {
        throw new Error('არ გაქვთ შეტყობინების წაშლის უფლება');
      }

      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        content: '[შეტყობინება წაშლილია]',
        messageType: 'system',
        deletedAt: serverTimestamp(),
        deletedBy: currentUserId
      });

      console.log('✅ Message deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      throw new Error(`შეცდომა შეტყობინების წაშლისას: ${error.message}`);
    }
  },

  // Archive conversation
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        isActive: false,
        archivedAt: serverTimestamp(),
        archivedBy: currentUserId,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Conversation archived successfully');
    } catch (error) {
      console.error('❌ Error archiving conversation:', error);
      throw new Error(`შეცდომა საუბრის არქივირებისას: ${error.message}`);
    }
  },

  // Restore archived conversation
  async restoreConversation(conversationId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        isActive: true,
        restoredAt: serverTimestamp(),
        restoredBy: currentUserId,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Conversation restored successfully');
    } catch (error) {
      console.error('❌ Error restoring conversation:', error);
      throw new Error(`შეცდომა საუბრის აღდგენისას: ${error.message}`);
    }
  },

  // Delete entire conversation (admin only)
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      // Check if user has admin rights
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();

      if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
        throw new Error('არ გაქვთ საუბრის წაშლის უფლება');
      }

      const batch = writeBatch(db);

      // Delete all messages in the conversation
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);

      messagesSnapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Delete the conversation itself
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.delete(conversationRef);

      await batch.commit();
      console.log('✅ Conversation deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      throw new Error(`შეცდომა საუბრის წაშლისას: ${error.message}`);
    }
  },

  // Update conversation priority (admin only)
  async updateConversationPriority(conversationId: string, priority: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        'metadata.priority': priority,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Conversation priority updated successfully');
    } catch (error) {
      console.error('❌ Error updating conversation priority:', error);
      throw new Error(`შეცდომა პრიორიტეტის განახლებისას: ${error.message}`);
    }
  },

  // Add tags to conversation (admin only)
  async addConversationTags(conversationId: string, tags: string[]): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        'metadata.tags': arrayUnion(...tags),
        updatedAt: serverTimestamp()
      });

      console.log('✅ Tags added successfully');
    } catch (error) {
      console.error('❌ Error adding tags:', error);
      throw new Error(`შეცდომა ტეგების დამატებისას: ${error.message}`);
    }
  },

  // Leave conversation (remove participant)
  async leaveConversation(conversationId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        throw new Error('საუბარი ვერ მოიძებნა');
      }

      const data = conversationSnap.data();
      const participantIds = data.participantIds || [];

      if (!participantIds.includes(currentUserId)) {
        throw new Error('თქვენ არ ხართ ამ საუბრის მონაწილე');
      }

      // Remove user from participants
      const updatedParticipantIds = participantIds.filter((id: string) => id !== currentUserId);
      const updatedParticipantNames = (data.participantNames || []).filter((_: string, index: number) => 
        participantIds[index] !== currentUserId
      );
      const updatedParticipantRoles = (data.participantRoles || []).filter((_: string, index: number) => 
        participantIds[index] !== currentUserId
      );

      // Update unread count object
      const updatedUnreadCount = { ...data.unreadCount };
      delete updatedUnreadCount[currentUserId];

      await updateDoc(conversationRef, {
        participantIds: updatedParticipantIds,
        participantNames: updatedParticipantNames,
        participantRoles: updatedParticipantRoles,
        unreadCount: updatedUnreadCount,
        updatedAt: serverTimestamp()
      });

      // Add system message about leaving
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, {
        senderId: 'system',
        senderName: 'სისტემა',
        senderRole: 'SYSTEM',
        content: `${data.participantNames[participantIds.indexOf(currentUserId)]} გავიდა საუბრიდან`,
        messageType: 'system',
        timestamp: serverTimestamp(),
        isRead: false,
        readBy: []
      });

      console.log('✅ Left conversation successfully');
    } catch (error) {
      console.error('❌ Error leaving conversation:', error);
      throw new Error(`შეცდომა საუბრიდან გასვლისას: ${error.message}`);
    }
  },

  // Edit message
  async editMessage(conversationId: string, messageId: string, newContent: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);

      if (!messageSnap.exists()) {
        throw new Error('შეტყობინება ვერ მოიძებნა');
      }

      const messageData = messageSnap.data();

      // Check if user owns the message or is admin
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();
      const isAdmin = userData && ['SUPER_ADMIN', 'ADMIN', 'PROVIDER_ADMIN'].includes(userData.role);

      if (messageData.senderId !== currentUserId && !isAdmin) {
        throw new Error('არ გაქვთ ამ შეტყობინების რედაქტირების უფლება');
      }

      await updateDoc(messageRef, {
        content: newContent,
        isEdited: true,
        editedAt: serverTimestamp(),
        editedBy: currentUserId
      });

      console.log('✅ Message edited successfully');
    } catch (error) {
      console.error('❌ Error editing message:', error);
      throw new Error(`შეცდომა შეტყობინების რედაქტირებისას: ${error.message}`);
    }
  },

  // Pin/Unpin message
  async pinMessage(conversationId: string, messageId: string, isPinned: boolean): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        isPinned,
        pinnedAt: isPinned ? serverTimestamp() : null,
        pinnedBy: isPinned ? currentUserId : null
      });

      console.log('✅ Message pin status updated successfully');
    } catch (error) {
      console.error('❌ Error updating pin status:', error);
      throw new Error(`შეცდომა პინის სტატუსის განახლებისას: ${error.message}`);
    }
  },

  // Report message
  async reportMessage(conversationId: string, messageId: string, reason: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      // Add report to reports collection
      const reportsRef = collection(db, 'reports');
      await addDoc(reportsRef, {
        type: 'message',
        conversationId,
        messageId,
        reportedBy: currentUserId,
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Mark message as reported
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        isReported: true,
        reportedAt: serverTimestamp(),
        reportedBy: arrayUnion(currentUserId)
      });

      console.log('✅ Message reported successfully');
    } catch (error) {
      console.error('❌ Error reporting message:', error);
      throw new Error(`შეცდომა შეტყობინების რეპორტისას: ${error.message}`);
    }
  },

  // Forward message
  async forwardMessage(fromConversationId: string, messageId: string, toConversationId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      // Get original message
      const messageRef = doc(db, 'conversations', fromConversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);

      if (!messageSnap.exists()) {
        throw new Error('შეტყობინება ვერ მოიძებნა');
      }

      const originalMessage = messageSnap.data();

      // Get user data
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();
      const userName = userData ? `${userData.firstName} ${userData.lastName}` : 'მომხმარებელი';

      // Create forwarded message
      const forwardedMessage = {
        senderId: currentUserId,
        senderName: userName,
        senderRole: userData?.role || 'CUSTOMER',
        content: `გადაგზავნილი შეტყობინება: ${originalMessage.content}`,
        messageType: 'forwarded',
        timestamp: serverTimestamp(),
        isRead: false,
        readBy: [currentUserId],
        originalMessageId: messageId,
        originalSender: originalMessage.senderName,
        forwardedFrom: fromConversationId
      };

      const targetMessagesRef = collection(db, 'conversations', toConversationId, 'messages');
      await addDoc(targetMessagesRef, forwardedMessage);

      console.log('✅ Message forwarded successfully');
    } catch (error) {
      console.error('❌ Error forwarding message:', error);
      throw new Error(`შეცდომა შეტყობინების გადაგზავნისას: ${error.message}`);
    }
  },

  // Block user
  async blockUser(userId: string): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      // Check admin permissions
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();

      if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
        throw new Error('არ გაქვთ მომხმარებლის დაბლოკვის უფლება');
      }

      // Update user's blocked status
      const targetUserRef = doc(db, 'users', userId);
      await updateDoc(targetUserRef, {
        isBlocked: true,
        blockedAt: serverTimestamp(),
        blockedBy: currentUserId
      });

      console.log('✅ User blocked successfully');
    } catch (error) {
      console.error('❌ Error blocking user:', error);
      throw new Error(`შეცდომა მომხმარებლის დაბლოკვისას: ${error.message}`);
    }
  },

  // Mute/Unmute conversation
  async muteConversation(conversationId: string, isMuted: boolean): Promise<void> {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        [`mutedBy.${currentUserId}`]: isMuted,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Conversation mute status updated successfully');
    } catch (error) {
      console.error('❌ Error updating mute status:', error);
      throw new Error(`შეცდომა გაუჩუმების სტატუსის განახლებისას: ${error.message}`);
    }
  }
};

export const getConversations = async (userId: string, userRole?: string): Promise<Conversation[]> => {
  try {
    const conversations: Conversation[] = [];

    if (userRole === 'PROVIDER_ADMIN') {
      // Provider admins see only conversations related to their properties
      const q = query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const conversation: Conversation = {
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
        };

        // Get last message
        try {
          const lastMessage = await messagingService.getLastMessage(conversation.id);
          if (lastMessage) {
            conversation.lastMessage = lastMessage;
          }
        } catch (error) {
          console.log('Could not get last message for conversation:', conversation.id);
        }

        conversations.push(conversation);
      }
    }

    return conversations;
  } catch (error) {
    console.error('Error fetching provider conversations:', error);
    return []; // Return empty array instead of throwing
  }
};