import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuditLog } from '../types/user';

export const logAuditEvent = async (
  userId: string,
  userEmail: string,
  action: AuditLog['action'],
  resourceType: AuditLog['resourceType'],
  resourceId: string,
  oldData?: any,
  newData?: any
) => {
  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      userId,
      userEmail,
      action,
      resourceType,
      resourceId,
      oldData,
      newData,
      timestamp: new Date(),
      ipAddress: 'N/A' // In a real app, you'd get this from the request
    };

    await addDoc(collection(db, 'auditLogs'), auditLog);
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
};