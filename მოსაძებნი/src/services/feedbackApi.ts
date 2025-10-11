
interface FeedbackPayload {
  messageId: string;
  up: boolean;
}

export const feedbackApi = {
  async sendFeedback(payload: FeedbackPayload) {
    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('Feedback API not available:', response.status);
        return { ok: false, error: 'API not available' };
      }

      return await response.json();
    } catch (error) {
      console.warn('Feedback submission failed:', error);
      return { ok: false, error: 'Network error' };
    }
  }
};
