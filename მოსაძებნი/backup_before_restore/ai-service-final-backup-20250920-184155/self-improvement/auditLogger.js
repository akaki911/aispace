"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
const axios_1 = __importDefault(require("axios"));
class AuditLogger {
    constructor() {
        this.timeout = 10000;
        this.baseUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
    }
    async updateDryRunChecklist(proposalId, checklist) {
        try {
            console.log(`📝 [AUDIT] Updating dry-run checklist for proposal: ${proposalId}`);
            const response = await axios_1.default.post(`${this.baseUrl}/api/ai/autoimprove/${proposalId}/dry-run`, { checklist }, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': 'ai-service-internal'
                }
            });
            if (response.data?.ok) {
                console.log(`✅ [AUDIT] Dry-run checklist updated successfully`);
                return true;
            }
            else {
                console.error(`❌ [AUDIT] Backend rejected dry-run update:`, response.data);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ [AUDIT] Failed to update dry-run checklist:`, error.message);
            return false;
        }
    }
    async updateApplyResult(proposalId, result) {
        try {
            console.log(`📝 [AUDIT] Updating apply result for proposal: ${proposalId}`);
            const payload = {
                branchName: result.branchName,
                commitSha: result.commitSha,
                applyLog: result.applyLog,
                success: result.success,
                checklist: result.checklist,
                timestamp: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.baseUrl}/api/ai/autoimprove/${proposalId}/apply`, payload, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': 'ai-service-internal'
                }
            });
            if (response.data?.ok) {
                console.log(`✅ [AUDIT] Apply result updated successfully`);
                return true;
            }
            else {
                console.error(`❌ [AUDIT] Backend rejected apply result:`, response.data);
                return false;
            }
        }
        catch (error) {
            console.error(`❌ [AUDIT] Failed to update apply result:`, error.message);
            return false;
        }
    }
    async getProposal(proposalId) {
        try {
            console.log(`📖 [AUDIT] Fetching proposal: ${proposalId}`);
            const response = await axios_1.default.get(`${this.baseUrl}/api/ai/autoimprove/proposals?id=${proposalId}`, {
                timeout: this.timeout,
                headers: {
                    'X-Service-Token': 'ai-service-internal'
                }
            });
            if (response.data?.ok && response.data.data) {
                const proposal = Array.isArray(response.data.data)
                    ? response.data.data.find((p) => p.id === proposalId)
                    : response.data.data;
                if (proposal) {
                    console.log(`✅ [AUDIT] Proposal fetched successfully`);
                    return proposal;
                }
            }
            throw new Error('Proposal not found');
        }
        catch (error) {
            console.error(`❌ [AUDIT] Failed to fetch proposal:`, error.message);
            throw error;
        }
    }
    async logExecutionStart(proposalId, operation) {
        try {
            console.log(`🚀 [AUDIT] Logging execution start: ${operation} for ${proposalId}`);
            const payload = {
                proposalId,
                operation,
                status: 'started',
                timestamp: new Date().toISOString(),
                executedBy: 'ai-service'
            };
            // This is a fire-and-forget log entry
            await axios_1.default.post(`${this.baseUrl}/api/ai/autoimprove/audit-log`, payload, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': 'ai-service-internal'
                }
            }).catch(error => {
                console.warn(`⚠️ [AUDIT] Failed to log execution start:`, error.message);
            });
        }
        catch (error) {
            console.warn(`⚠️ [AUDIT] Execution start logging failed:`, error.message);
        }
    }
    async logExecutionEnd(proposalId, operation, success, details) {
        try {
            console.log(`🏁 [AUDIT] Logging execution end: ${operation} for ${proposalId}`);
            const payload = {
                proposalId,
                operation,
                status: success ? 'completed' : 'failed',
                timestamp: new Date().toISOString(),
                executedBy: 'ai-service',
                details: details || {}
            };
            // This is a fire-and-forget log entry
            await axios_1.default.post(`${this.baseUrl}/api/ai/autoimprove/audit-log`, payload, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': 'ai-service-internal'
                }
            }).catch(error => {
                console.warn(`⚠️ [AUDIT] Failed to log execution end:`, error.message);
            });
        }
        catch (error) {
            console.warn(`⚠️ [AUDIT] Execution end logging failed:`, error.message);
        }
    }
}
exports.auditLogger = new AuditLogger();
