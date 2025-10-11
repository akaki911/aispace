
import { collection, query, getDocs, deleteDoc, doc, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const cleanTestMessagingData = async () => {
  try {
    console.log('🧹 Starting cleanup of test messaging data...');
    
    // Get all conversations
    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(conversationsRef, orderBy('createdAt', 'asc'));
    const conversationsSnapshot = await getDocs(conversationsQuery);
    
    let deletedConversations = 0;
    let deletedMessages = 0;
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationData = conversationDoc.data();
      
      // Check if this is test data (empty participant names, or test patterns)
      const isTestData = 
        !conversationData.participantNames || 
        conversationData.participantNames.length === 0 ||
        conversationData.participantNames.some((name: string) => 
          !name || 
          name.includes('test') || 
          name.includes('Test') ||
          name === 'მომხმარებელი' ||
          name === ''
        );
      
      if (isTestData) {
        console.log('🗑️ Deleting test conversation:', conversationDoc.id);
        
        // Delete all messages in this conversation first
        const messagesRef = collection(db, 'conversations', conversationDoc.id, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        
        for (const messageDoc of messagesSnapshot.docs) {
          await deleteDoc(messageDoc.ref);
          deletedMessages++;
        }
        
        // Delete the conversation itself
        await deleteDoc(conversationDoc.ref);
        deletedConversations++;
      }
    }
    
    console.log(`✅ Cleanup completed: ${deletedConversations} conversations and ${deletedMessages} messages deleted`);
    return { deletedConversations, deletedMessages };
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
};

// Function to clean only duplicate conversations for a specific user
export const cleanDuplicateConversations = async (userId: string) => {
  try {
    console.log(`🧹 Cleaning duplicate conversations for user: ${userId}`);
    
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef, 
      where('participantIds', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const conversationsByParticipants = new Map<string, any[]>();
    
    // Group conversations by participant combination
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const participantKey = data.participantIds?.sort().join('|') || '';
      
      if (!conversationsByParticipants.has(participantKey)) {
        conversationsByParticipants.set(participantKey, []);
      }
      
      conversationsByParticipants.get(participantKey)?.push({
        id: doc.id,
        data,
        ref: doc.ref
      });
    });
    
    let deletedDuplicates = 0;
    
    // Keep only the most recent conversation for each participant combination
    for (const [key, conversations] of conversationsByParticipants) {
      if (conversations.length > 1) {
        // Sort by creation date, keep the newest
        conversations.sort((a, b) => 
          (b.data.createdAt?.toDate() || new Date()).getTime() - 
          (a.data.createdAt?.toDate() || new Date()).getTime()
        );
        
        // Delete all but the first (newest)
        for (let i = 1; i < conversations.length; i++) {
          const conv = conversations[i];
          console.log(`🗑️ Deleting duplicate conversation: ${conv.id}`);
          
          // Delete messages first
          const messagesRef = collection(db, 'conversations', conv.id, 'messages');
          const messagesSnapshot = await getDocs(messagesRef);
          
          for (const messageDoc of messagesSnapshot.docs) {
            await deleteDoc(messageDoc.ref);
          }
          
          // Delete conversation
          await deleteDoc(conv.ref);
          deletedDuplicates++;
        }
      }
    }
    
    console.log(`✅ Removed ${deletedDuplicates} duplicate conversations`);
    return deletedDuplicates;
    
  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
    throw error;
  }
};
