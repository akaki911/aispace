const fs = require('fs');
const path = require('path');

const feedbackDataPath = path.join(__dirname, '../feedback_data/proposal_outcomes.json');

const ensureDirectory = () => {
  const dir = path.dirname(feedbackDataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const readHistory = () => {
  try {
    if (!fs.existsSync(feedbackDataPath)) {
      return [];
    }
    const raw = fs.readFileSync(feedbackDataPath, 'utf8') || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('⚠️ [AI SERVICE][MEMORY] Failed to read proposal outcomes:', error.message);
    return [];
  }
};

const loadSimilarOutcomes = ({ kpiKey, limit = 5, outcome } = {}) => {
  ensureDirectory();
  const history = readHistory();
  const filtered = history.filter((entry) => {
    if (kpiKey && entry.kpiKey !== kpiKey) {
      return false;
    }
    if (outcome && entry.outcome !== outcome) {
      return false;
    }
    return true;
  });

  const sliceLimit = Math.max(limit, 5);
  return filtered.slice(0, sliceLimit);
};

module.exports = {
  loadSimilarOutcomes
};
