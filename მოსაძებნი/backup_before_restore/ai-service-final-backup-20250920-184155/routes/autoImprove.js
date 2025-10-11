"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const discoveryRunner_1 = require("../self-improvement/discoveryRunner");
const proposalBuilder_1 = require("../self-improvement/proposalBuilder");
const backendClient_1 = require("../lib/backendClient");
const router = express_1.default.Router();
/**
 * POST /api/ai/autoimprove/discover
 * Runs discovery pipeline and submits proposals to backend
 */
router.post('/discover', async (req, res) => {
    try {
        console.log('🔍 [AUTO-IMPROVE] Starting discovery pipeline...');
        // Run discovery to collect evidence
        const discoveryResult = await discoveryRunner_1.discoveryRunner.runDiscovery();
        console.log(`📊 [AUTO-IMPROVE] Discovery completed: ${discoveryResult.evidenceCount} evidence entries, ${discoveryResult.skippedTools.length} tools skipped`);
        // Build proposals from evidence
        const proposals = await proposalBuilder_1.proposalBuilder.buildProposals(discoveryResult.evidence);
        console.log(`📝 [AUTO-IMPROVE] Generated ${proposals.length} proposals`);
        // Submit proposals to backend
        let proposalsCreated = 0;
        const submissionErrors = [];
        for (const proposal of proposals) {
            try {
                await backendClient_1.backendClient.submitProposal(proposal);
                proposalsCreated++;
                console.log(`✅ [AUTO-IMPROVE] Submitted proposal: ${proposal.title}`);
            }
            catch (error) {
                console.error(`❌ [AUTO-IMPROVE] Failed to submit proposal "${proposal.title}":`, error);
                submissionErrors.push(`${proposal.title}: ${error.message}`);
            }
        }
        const result = {
            proposalsCreated,
            evidenceCount: discoveryResult.evidenceCount,
            skippedTools: discoveryResult.skippedTools,
            submissionErrors: submissionErrors.length > 0 ? submissionErrors : undefined
        };
        console.log(`🎯 [AUTO-IMPROVE] Discovery pipeline completed: ${proposalsCreated}/${proposals.length} proposals submitted`);
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ [AUTO-IMPROVE] Discovery pipeline failed:', error);
        res.status(500).json({
            success: false,
            error: 'Discovery pipeline failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
