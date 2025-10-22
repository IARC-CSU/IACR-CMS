import fs from 'fs';
import path from 'path';

// Function to parse YAML frontmatter (reusing from export-pages.js)
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: {}, content: content };
    }
    
    const yamlContent = match[1];
    const markdownContent = match[2];
    
    // Simple YAML parser for our specific format
    const frontmatter = {};
    const lines = yamlContent.split('\n');
    let currentKey = null;
    let currentValue = '';
    let inMultiline = false;
    let multilineType = '';
    
    for (let line of lines) {
        const originalLine = line;
        line = line.trim();
        
        if (!line) {
            if (inMultiline) {
                currentValue += '\n';
            }
            continue;
        }
        
        if (line.includes(':') && !inMultiline) {
            // Save previous key-value if exists
            if (currentKey) {
                frontmatter[currentKey] = currentValue.trim();
            }
            
            const colonIndex = line.indexOf(':');
            currentKey = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Handle quoted values
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
                frontmatter[currentKey] = value;
                currentKey = null;
                currentValue = '';
                inMultiline = false;
            } else if (value.startsWith('>-') || value.startsWith('|-')) {
                // Multi-line content
                multilineType = value;
                inMultiline = true;
                currentValue = '';
            } else if (value) {
                frontmatter[currentKey] = value;
                currentKey = null;
                currentValue = '';
                inMultiline = false;
            } else {
                currentValue = '';
                inMultiline = false;
            }
        } else if (inMultiline && currentKey) {
            // Check if we're starting a new key (line ends with colon and no spaces in the key part)
            if (line.endsWith(':') && !line.includes(' ') && originalLine.indexOf(line) === 0) {
                // End of multiline, start of new key
                frontmatter[currentKey] = currentValue.trim();
                currentKey = line.slice(0, -1);
                currentValue = '';
                inMultiline = false;
            } else {
                // Continue multiline content, preserve some structure
                if (multilineType === '>-') {
                    // Folded style - replace single newlines with spaces, but preserve double newlines
                    if (currentValue && !currentValue.endsWith('\n\n')) {
                        currentValue += currentValue.endsWith('\n') ? '\n' : ' ';
                    }
                    currentValue += originalLine.replace(/^\s{2}/, ''); // Remove 2-space indentation
                } else {
                    // Literal style
                    currentValue += originalLine.replace(/^\s{2}/, '') + '\n';
                }
            }
        } else if (!inMultiline && line.endsWith(':')) {
            // Single key without value
            if (currentKey) {
                frontmatter[currentKey] = currentValue.trim();
            }
            currentKey = line.slice(0, -1);
            currentValue = '';
            inMultiline = false;
        }
    }
    
    // Save last key-value
    if (currentKey) {
        frontmatter[currentKey] = currentValue.trim();
    }
    
    return { frontmatter, content: markdownContent.trim() };
}

// Helper function to apply inline formatting (reusing from export-pages.js)
function applyInlineFormatting(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Function to convert markdown to HTML (reusing from export-pages.js)
function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Clean up the input
    markdown = markdown.trim();
    
    // Split content by double newlines to identify distinct blocks (paragraphs, lists, etc.)
    const blocks = markdown.split(/\n\s*\n+/).filter(block => block.trim());
    
    return blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        
        // Check if this block is a list (starts with bullet points)
        const listLines = block.split('\n').filter(line => line.match(/^\s*[\*\-\+]\s/));
        if (listLines.length > 1) {
            // This is a list block
            const listItems = listLines.map(line => {
                const content = line.replace(/^\s*[\*\-\+]\s/, '').trim();
                return content ? `<li>${applyInlineFormatting(content)}</li>` : '';
            }).filter(item => item);
            
            return listItems.length > 0 ? `<ul>${listItems.join('')}</ul>` : '';
        }
        
        // Handle single bullet point
        if (block.match(/^\s*[\*\-\+]\s/)) {
            const content = block.replace(/^\s*[\*\-\+]\s/, '• ').trim();
            return `<p>${applyInlineFormatting(content)}</p>`;
        }
        
        // Regular paragraph - replace single newlines with spaces
        block = block.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        return `<p>${applyInlineFormatting(block)}</p>`;
        
    }).filter(html => html !== '').join('');
}

// Main function to process all news markdown files
function processNewsFiles() {
    const newsDirectories = [
        '/Users/lamf_mac/Web/github.com/IACR-CMS/content/news/en',
        '/Users/lamf_mac/Web/github.com/IACR-CMS/public/admin/content/news/en'
    ];
    const outputFile = '/Users/lamf_mac/Web/github.com/IACR-CMS/news_en.json';
    
    const result = {
        news: []
    };
    
    try {
        let totalFiles = 0;
        
        newsDirectories.forEach(inputDir => {
            if (!fs.existsSync(inputDir)) {
                console.log(`Directory not found: ${inputDir}`);
                return;
            }
            
            const files = fs.readdirSync(inputDir);
            const mdFiles = files.filter(file => file.endsWith('.md'));
            
            console.log(`Found ${mdFiles.length} news files in ${inputDir}...`);
            totalFiles += mdFiles.length;
            
            mdFiles.forEach(file => {
                const filePath = path.join(inputDir, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const { frontmatter, content } = parseFrontmatter(fileContent);
                
                // Get filename without extension for ID
                const fileName = path.basename(file, '.md');
                
                // Extract fields from frontmatter
                const title = frontmatter.title || fileName;
                const date = frontmatter.date || '';
                const picture = frontmatter.picture || '';
                const description = frontmatter.description || '';
                
                // Convert markdown content to HTML
                const htmlContent = markdownToHtml(content || '');
                
                // Create news object
                const newsItem = {
                    id: fileName,
                    title: title,
                    date: date,
                    picture: picture,
                    description: description,
                    content: htmlContent
                };
                
                result.news.push(newsItem);
                console.log(`Processed: ${fileName}`);
            });
        });
        
        // Sort news by date (newest first)
        result.news.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
        });
        
        // Write result to JSON file
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`\nNews export completed! ${result.news.length} news articles exported to ${outputFile}`);
        
    } catch (error) {
        console.error('Error processing news files:', error);
    }
}

// Run the script
processNewsFiles();