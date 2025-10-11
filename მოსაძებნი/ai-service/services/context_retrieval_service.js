const { getProjectStructure } = require('./file_system_service');

// Enhanced regex patterns for file path detection
const filePathRegex = /([a-zA-Z0-9_\-\/]+\.[a-zA-Z]{2,})/g;
const fileNameRegex = /\b([a-zA-Z0-9_\-]+\.(js|ts|jsx|tsx|py|css|scss|html|json|md|txt|sql|php|java|go|rust|cpp|c|h))\b/gi;

async function findRelevantFiles(query) {
    const mentionedFiles = query.match(filePathRegex) || [];
    if (mentionedFiles.length === 0) {
        return []; // No files mentioned
    }

    const projectFiles = await getProjectStructure();
    const relevantFiles = [];
    
    // For each mentioned file, find matching files in the project
    for (const mentionedFile of mentionedFiles) {
        // First, try exact match
        if (projectFiles.includes(mentionedFile)) {
            relevantFiles.push(mentionedFile);
            continue;
        }
        
        // Then, try to find files that end with this filename
        const matchingFiles = projectFiles.filter(projectFile => {
            // Check if project file ends with the mentioned filename
            return projectFile.endsWith(mentionedFile) || 
                   projectFile.endsWith(`/${mentionedFile}`) ||
                   projectFile.includes(mentionedFile);
        });
        
        relevantFiles.push(...matchingFiles);
    }
    
    // Remove duplicates and return
    return [...new Set(relevantFiles)];
}

/**
 * Extract explicit file mentions from user query
 * Part 1 requirement: Direct File Context detection
 * @param {string} query - User query text
 * @returns {Array<string>} - Array of potential file paths/names
 */
function extractFileMentions(query) {
    if (!query || typeof query !== 'string') return [];
    
    const mentions = new Set();
    
    // Extract full file paths
    const pathMatches = query.match(filePathRegex) || [];
    pathMatches.forEach(match => mentions.add(match.trim()));
    
    // Extract just file names
    const nameMatches = query.match(fileNameRegex) || [];
    nameMatches.forEach(match => mentions.add(match.trim()));
    
    // Georgian language file mentions (e.g., "server.js-ში")
    const georgianFileRegex = /([a-zA-Z0-9_\-]+\.[a-zA-Z]{2,})(-ში|-ზე|-თან|-დან)/g;
    const georgianMatches = query.match(georgianFileRegex) || [];
    georgianMatches.forEach(match => {
        const fileName = match.replace(/(-ში|-ზე|-თან|-დან)$/, '');
        mentions.add(fileName);
    });
    
    return Array.from(mentions);
}

/**
 * Resolve candidate file mentions to actual project file paths
 * Part 1 requirement: Enhanced file resolution
 * @param {Array<string>} mentions - File mentions from extractFileMentions
 * @returns {Promise<Array<string>>} - Array of resolved file paths
 */
async function resolveCandidateFiles(mentions) {
    if (!mentions || mentions.length === 0) return [];
    
    try {
        const projectFiles = await getProjectStructure();
        const resolved = new Set();
        
        for (const mention of mentions) {
            // 1. Exact path match
            if (projectFiles.includes(mention)) {
                resolved.add(mention);
                continue;
            }
            
            // 2. Filename-based matching
            const matchingFiles = projectFiles.filter(projectFile => {
                const fileName = projectFile.split('/').pop();
                return fileName === mention || 
                       projectFile.endsWith(`/${mention}`) ||
                       projectFile.includes(mention);
            });
            
            matchingFiles.forEach(file => resolved.add(file));
        }
        
        return Array.from(resolved);
    } catch (error) {
        console.warn('⚠️ [CONTEXT RETRIEVAL] Error resolving candidate files:', error.message);
        return [];
    }
}

module.exports = {
    findRelevantFiles,
    extractFileMentions,
    resolveCandidateFiles
};