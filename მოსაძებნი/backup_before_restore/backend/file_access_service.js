const fs = require('fs').promises;
const path = require('path');

/**
 * Reads a file from the given path and returns the content as string
 * @param {string} filePath - Relative path to the file from project root
 * @returns {Promise<string>} - File content as string
 */
async function readFileContent(filePath) {
  try {
    const absolutePath = path.join(process.cwd(), filePath);
    console.log(`📖 Reading file: ${absolutePath}`);

    const content = await fs.readFile(absolutePath, 'utf8');
    console.log(`✅ Successfully read file: ${filePath}`);
    return content;
  } catch (error) {
    const errorMessage = `❌ Failed to read file '${filePath}': ${error.message}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Overwrites the file at the given path with new content
 * @param {string} filePath - Relative path to the file from project root
 * @param {string} newContent - New content to write to the file
 * @returns {Promise<void>}
 */
async function replaceFileContent(filePath, newContent) {
  try {
    const absolutePath = path.join(process.cwd(), filePath);
    console.log(`📝 Writing to file: ${absolutePath}`);

    await fs.writeFile(absolutePath, newContent, 'utf8');
    console.log(`✅ Successfully wrote to file: ${filePath}`);
  } catch (error) {
    const errorMessage = `❌ Failed to write file '${filePath}': ${error.message}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Search for text in files
 */
async function searchInFiles(searchText, extensions = ['.tsx', '.ts', '.js', '.jsx']) {
  const results = [];

  try {
    const searchInDirectory = async (dirPath) => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          await searchInDirectory(fullPath);
        } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
              if (line.includes(searchText)) {
                results.push({
                  file: fullPath.replace(process.cwd() + '/', ''),
                  line: index + 1,
                  content: line.trim()
                });
              }
            });
          } catch (readError) {
            // Skip files that can't be read
          }
        }
      }
    };

    await searchInDirectory('./src');
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Replace text in file
 */
async function replaceTextInFile(filePath, oldText, newText) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const updatedContent = content.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newText);
    
    if (content !== updatedContent) {
      await fs.writeFile(filePath, updatedContent, 'utf8');
      return { success: true, changes: 1 };
    }
    
    return { success: true, changes: 0 };
  } catch (error) {
    console.error('Replace error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  readFileContent,
  replaceFileContent,
  searchInFiles,
  replaceTextInFilearchInFiles
};