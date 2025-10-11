/**
 * SOL-212 Gurulo Response Composer
 * Replit-style structured responses in Georgian
 */

/**
 * Compose structured response in Georgian with emojis
 * @param {Object} sections - Response sections
 * @param {string} sections.analysis - Analysis text
 * @param {string} sections.tech - Technical details
 * @param {string} sections.status - Status information
 * @param {string} sections.rec - Recommendations
 * @param {string} sections.final - Final response (optional)
 * @returns {string} - Formatted Georgian response
 */
function composeStructured({ analysis, tech, status, rec, final }) {
  const sections = [];
  
  // SOL-202: Optional structured format (only when explicitly needed)
  if (analysis && analysis.trim()) {
    sections.push(`**ანალიზი:**\n${analysis.trim()}`);
  }
  
  if (tech && tech.trim()) {
    sections.push(`**ტექნიკური დეტალები:**\n${tech.trim()}`);
  }
  
  if (status && status.trim()) {
    sections.push(`**მდგომარეობა:**\n${status.trim()}`);
  }
  
  if (rec && rec.trim()) {
    sections.push(`**რეკომენდაცია:**\n${rec.trim()}`);
  }
  
  // 🔚 საბოლოო პასუხი (optional)
  if (final && final.trim()) {
    sections.push(`🔚 **საბოლოო პასუხი**\n${final.trim()}`);
  }
  
  // Join sections with double newlines
  let response = sections.join('\n\n');
  
  // Add Georgian AI signature
  if (response) {
    response += '\n\n✨ *გურულო AI ასისტენტი - მზადაა დახმარებისთვის!*';
  }
  
  return response || 'პასუხი მზად არ არის - მოითხოვება დამატებითი ინფორმაცია.';
}

/**
 * Create simple confirmation response for file reading
 * @param {string} filename - Name of the file
 * @param {Object} meta - File metadata
 * @returns {string} - Georgian confirmation
 */
function composeFileConfirmation(filename, meta) {
  if (filename === 'შემდეგი ჩატის პრ.txt') {
    return 'კაკი, ფაილი „შემდეგი ჩატის პრ.txt" წარმატებით წავიკითხე UTF-8 კოდირებით. შინაარსს გავეცანი. მზად ვარ შემდეგი დავალებისთვის.';
  }
  
  return `ფაილი „${filename}" წარმატებით წავიკითხე (${meta.bytes} ბაიტი, ${meta.lines} ხაზი). მზად ვარ შემდეგი დავალებისთვის.`;
}

/**
 * Create error response in Georgian
 * @param {string} operation - Operation that failed
 * @param {string} error - Error message
 * @returns {string} - Georgian error response
 */
function composeError(operation, error) {
  return composeStructured({
    analysis: `${operation}-ის შესრულებისას შეცდომა მოხდა`,
    tech: `შეცდომის დეტალები: ${error}`,
    status: '❌ ვერ შესრულდა',
    rec: 'გთხოვთ, გადაამოწმოთ მოთხოვნა და სცადოთ ხელახლა'
  });
}

module.exports = {
  composeStructured,
  composeFileConfirmation,
  composeError
};