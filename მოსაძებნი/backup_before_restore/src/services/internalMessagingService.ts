
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
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  messageType: 'text' | 'image' | 'file' | 'system';
  attachments?: string[];
  readBy: string[];
}

export interface InternalConversation {
  id: string;
  title: string;
  type: 'booking' | 'support' | 'general';
  bookingId?: string;
  participantIds: string[];
  participantNames: string[];
  participantRoles: string[];
  lastMessage?: InternalMessage;
  unreadCount: { [userId: string]: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    propertyName?: string;
    bookingReference?: string;
    priority?: 'low' | 'medium' | 'high';
  };
}

class InternalMessagingService {
  private conversationsCollection = 'internal_conversations';

  // Create conversation for booking
  async createBookingConversation(
    bookingId: string,
    guestId: string,
    guestName: string,
    hostId: string,
    hostName: string,
    propertyName: string,
    bookingReference: string
  ): Promise<string | null> {
    try {
      // Check if conversation already exists
      const existingQuery = query(
        collection(db, this.conversationsCollection),
        where('bookingId', '==', bookingId)
      );
      
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        return existingSnap.docs[0].id;
      }

      const conversationData = {
        title: `ჯავშანი: ${propertyName}`,
        type: 'booking',
        bookingId,
        participantIds: [guestId, hostId],
        participantNames: [guestName, hostName],
        participantRoles: ['CUSTOMER', 'PROVIDER'],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadCount: {
          [guestId]: 0,
          [hostId]: 0
        },
        metadata: {
          propertyName,
          bookingReference,
          priority: 'medium'
        }
      };

      const docRef = await addDoc(collection(db, this.conversationsCollection), conversationData);
      
      // Send welcome message
      await this.sendSystemMessage(
        docRef.id, 
        `გამარჯობა! ეს არის შიდა მესენჯერი ჯავშნის ${bookingReference} საკითხებისთვის. აქ შეგიძლიათ თავისუფლად იკომუნიკიროთ.`
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating booking conversation:', error);
      return null;
    }
  }

  // Send message to conversation
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    attachments?: string[]
  ): Promise<boolean> {
    try {
      const messageData = {
        senderId,
        senderName,
        content,
        messageType,
        attachments: attachments || [],
        timestamp: serverTimestamp(),
        isRead: false,
        readBy: [senderId]
      };

      // Add message to subcollection
      await addDoc(collection(db, this.conversationsCollection, conversationId, 'messages'), messageData);

      // Update conversation
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      await updateDoc(conversationRef, {
        lastMessage: {
          ...messageData,
          timestamp: new Date()
        },
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  // Send system message
  async sendSystemMessage(conversationId: string, content: string): Promise<boolean> {
    try {
      const messageData = {
        senderId: 'system',
        senderName: 'სისტემა',
        content,
        messageType: 'system',
        attachments: [],
        timestamp: serverTimestamp(),
        isRead: false,
        readBy: []
      };

      await addDoc(collection(db, this.conversationsCollection, conversationId, 'messages'), messageData);
      return true;
    } catch (error) {
      console.error('Error sending system message:', error);
      return false;
    }
  }

  // Get user conversations
  getUserConversations(userId: string, callback: (conversations: InternalConversation[]) => void) {
    const q = query(
      collection(db, this.conversationsCollection),
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const conversations: InternalConversation[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          title: data.title,
          type: data.type,
          bookingId: data.bookingId,
          participantIds: data.participantIds,
          participantNames: data.participantNames,
          participantRoles: data.participantRoles,
          lastMessage: data.lastMessage ? {
            ...data.lastMessage,
            timestamp: data.lastMessage.timestamp?.toDate?.() || new Date(data.lastMessage.timestamp)
          } : undefined,
          unreadCount: data.unreadCount || {},
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          metadata: data.metadata
        });
      });

      callback(conversations);
    });
  }

  // Get conversation messages
  getConversationMessages(conversationId: string, callback: (messages: InternalMessage[]) => void) {
    const q = query(
      collection(db, this.conversationsCollection, conversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages: InternalMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          content: data.content,
          timestamp: data.timestamp?.toDate?.() || new Date(),
          isRead: data.isRead || false,
          messageType: data.messageType || 'text',
          attachments: data.attachments || [],
          readBy: data.readBy || []
        });
      });

      callback(messages);
    });
  }

  // Mark messages as read
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  // Get unread count for user
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.conversationsCollection),
        where('participantIds', 'array-contains', userId)
      );

      const snapshot = await getDocs(q);
      let totalUnread = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const unreadForUser = data.unreadCount?.[userId] || 0;
        totalUnread += unreadForUser;
      });

      return totalUnread;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}

export const internalMessagingService = new InternalMessagingService();
