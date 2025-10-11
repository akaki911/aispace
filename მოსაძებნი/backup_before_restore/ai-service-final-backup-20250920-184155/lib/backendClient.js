"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendClient = void 0;
const axios_1 = __importDefault(require("axios"));
class BackendClient {
    constructor() {
        this.timeout = 15000;
        this.baseUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
    }
    async submitProposal(proposal) {
        try {
            console.log(`🔗 [BACKEND-CLIENT] Submitting proposal: ${proposal.title}`);
            const payload = {
                title: proposal.title,
                severity: proposal.severity,
                summary: proposal.summary,
                evidence: proposal.evidence,
                patch: proposal.patch,
                risk: proposal.risk || 'low',
                rollbackPlan: proposal.rollbackPlan || 'Manual review and revert if needed'
            };
            const response = await axios_1.default.post(`${this.baseUrl}/api/ai/autoimprove/propose`, payload, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'ai-service',
                    'X-Service-Token': 'ai-service-internal'
                },
                withCredentials: true
            });
            if (response.data?.ok) {
                console.log(`✅ [BACKEND-CLIENT] Proposal submitted successfully: ${response.data.data?.id}`);
                return response.data;
            }
            else {
                throw new Error(response.data?.error || 'Backend rejected proposal');
            }
        }
        catch (error) {
            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.error || error.response.statusText;
                console.error(`❌ [BACKEND-CLIENT] HTTP ${status}: ${message}`);
                throw new Error(`Backend error (${status}): ${message}`);
            }
            else if (error.request) {
                console.error('❌ [BACKEND-CLIENT] Network error:', error.message);
                throw new Error(`Network error: ${error.message}`);
            }
            else {
                console.error('❌ [BACKEND-CLIENT] Request setup error:', error.message);
                throw new Error(`Request error: ${error.message}`);
            }
        }
    }
    async healthCheck() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/health`, {
                timeout: 5000
            });
            return response.status === 200;
        }
        catch (error) {
            console.warn('⚠️ [BACKEND-CLIENT] Backend health check failed:', error.message);
            return false;
        }
    }
}
exports.backendClient = new BackendClient();
