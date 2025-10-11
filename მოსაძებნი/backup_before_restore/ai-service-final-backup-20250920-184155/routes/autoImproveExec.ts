
import express from 'express';
import { dryRunApply, applyOnBranch } from '../self-improvement/patchApplier';
import { auditLogger } from '../self-improvement/auditLogger';
import { getFileAllowlist } from '../self-improvement/utils/fsUtils';

const router = express.Router();

/**
 * POST /api/ai/autoimprove/:id/dry-run
 * Performs dry-run of proposal without making permanent changes
 */
router.post('/:id/dry-run', async (req, res) => {
  const { id: proposalId } = req.params;
  
  try {
    console.log(`🧪 [EXEC] Starting dry-run for proposal: ${proposalId}`);
    
    // Log execution start
    await auditLogger.logExecutionStart(proposalId, 'dry-run');
    
    // Fetch proposal from backend
    const proposal = await auditLogger.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }
    
    if (!proposal.patch) {
      return res.status(400).json({
        success: false,
        error: 'Proposal has no patch data'
      });
    }
    
    // Get file allowlist
    const allowlist = getFileAllowlist();
    
    // Perform dry-run
    const result = await dryRunApply(
      proposal.patch,
      allowlist,
      `dry-run-${proposalId.substring(0, 8)}`
    );
    
    if (!result.ok) {
      await auditLogger.logExecutionEnd(proposalId, 'dry-run', false, { reason: result.reason });
      
      return res.status(400).json({
        success: false,
        error: result.reason,
        checklist: result.checklist
      });
    }
    
    // Update checklist in backend
    const updateSuccess = await auditLogger.updateDryRunChecklist(proposalId, result.checklist);
    if (!updateSuccess) {
      console.warn(`⚠️ [EXEC] Failed to update backend checklist for proposal: ${proposalId}`);
    }
    
    await auditLogger.logExecutionEnd(proposalId, 'dry-run', true, { 
      checklist: result.checklist 
    });
    
    res.json({
      success: true,
      proposalId,
      checklist: result.checklist,
      logs: result.logs,
      message: '🔍 Dry-run ვალიდაცია წარმატებით დასრულდა',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [EXEC] Dry-run failed for proposal ${proposalId}:`, error);
    
    await auditLogger.logExecutionEnd(proposalId, 'dry-run', false, { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Dry-run-ის შესრულება ვერ მოხერხდა',
      details: error.message,
      message: '❌ ვალიდაციის შეცდომა'
    });
  }
});

/**
 * POST /api/ai/autoimprove/:id/apply
 * Applies proposal to a new branch after approval
 */
router.post('/:id/apply', async (req, res) => {
  const { id: proposalId } = req.params;
  
  try {
    console.log(`🚀 [EXEC] Starting apply for proposal: ${proposalId}`);
    
    // Log execution start
    await auditLogger.logExecutionStart(proposalId, 'apply');
    
    // Fetch proposal from backend
    const proposal = await auditLogger.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }
    
    // Check if proposal is approved
    if (proposal.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Proposal status is '${proposal.status}', must be 'approved' to apply`
      });
    }
    
    if (!proposal.patch) {
      return res.status(400).json({
        success: false,
        error: 'Proposal has no patch data'
      });
    }
    
    // Get file allowlist
    const allowlist = getFileAllowlist();
    
    // Generate branch name
    const branchName = `ai-proposal-${proposalId.substring(0, 8)}-${Date.now()}`;
    
    // Apply patch
    const result = await applyOnBranch(
      proposal.patch,
      allowlist,
      branchName
    );
    
    // Prepare apply log
    const applyLog = result.logs ? JSON.stringify(result.logs, null, 2) : 'No detailed logs available';
    
    // Update backend with results
    const applyResult = {
      branchName: result.branchName,
      commitSha: result.commitSha,
      applyLog,
      success: result.ok,
      checklist: result.checklist || {}
    };
    
    const updateSuccess = await auditLogger.updateApplyResult(proposalId, applyResult);
    if (!updateSuccess) {
      console.warn(`⚠️ [EXEC] Failed to update backend apply result for proposal: ${proposalId}`);
    }
    
    if (!result.ok) {
      await auditLogger.logExecutionEnd(proposalId, 'apply', false, { 
        reason: result.reason,
        checklist: result.checklist 
      });
      
      return res.status(400).json({
        success: false,
        error: result.reason,
        checklist: result.checklist
      });
    }
    
    await auditLogger.logExecutionEnd(proposalId, 'apply', true, {
      branchName: result.branchName,
      commitSha: result.commitSha,
      checklist: result.checklist
    });
    
    res.json({
      success: true,
      proposalId,
      branchName: result.branchName,
      commitSha: result.commitSha,
      checklist: result.checklist,
      rollbackInstructions: result.commitSha ? `git revert ${result.commitSha}` : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [EXEC] Apply failed for proposal ${proposalId}:`, error);
    
    await auditLogger.logExecutionEnd(proposalId, 'apply', false, { 
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      error: 'Apply execution failed',
      details: error.message
    });
  }
});

/**
 * POST /api/ai/autoimprove/:id/rollback
 * Provides rollback instructions (does not auto-merge)
 */
router.post('/:id/rollback', async (req, res) => {
  const { id: proposalId } = req.params;
  
  try {
    const proposal = await auditLogger.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }
    
    if (!proposal.commitSha) {
      return res.status(400).json({
        success: false,
        error: 'No commit SHA available for rollback'
      });
    }
    
    const rollbackInstructions = {
      commitSha: proposal.commitSha,
      branchName: proposal.branchName,
      commands: [
        `git checkout ${proposal.branchName}`,
        `git revert ${proposal.commitSha}`,
        `git push origin ${proposal.branchName}`
      ],
      note: 'Manual rollback required - AI service does not auto-merge to main'
    };
    
    res.json({
      success: true,
      proposalId,
      rollbackInstructions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ [EXEC] Rollback instructions failed for proposal ${proposalId}:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate rollback instructions',
      details: error.message
    });
  }
});

export default router;
