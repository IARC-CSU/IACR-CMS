import fs from 'fs';
import path from 'path';

// (parseFrontmatter, applyInlineFormatting, markdownToHtml same as pages script)
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: {}, content: content };
    }
    
    const yamlContent = match[1];
    const markdownContent = match[2];
    
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
            if (currentKey) {
                frontmatter[currentKey] = currentValue.trim();
            }
            const colonIndex = line.indexOf(':');
            currentKey = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
                frontmatter[currentKey] = value;
                currentKey = null;
                currentValue = '';
                inMultiline = false;
            } else if (value.startsWith('>-') || value.startsWith('|-')) {
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
            if (line.endsWith(':') && !line.includes(' ') && originalLine.indexOf(line) === 0) {
                frontmatter[currentKey] = currentValue.trim();
                currentKey = line.slice(0, -1);
                currentValue = '';
                inMultiline = false;
            } else {
                if (multilineType === '>-') {
                    if (currentValue && !currentValue.endsWith('\n\n')) {
                        currentValue += currentValue.endsWith('\n') ? '\n' : ' ';
                    }
                    currentValue += originalLine.replace(/^\s{2}/, '');
                } else {
                    currentValue += originalLine.replace(/^\s{2}/, '') + '\n';
                }
            }
        } else if (!inMultiline && line.endsWith(':')) {
            if (currentKey) {
                frontmatter[currentKey] = currentValue.trim();
            }
            currentKey = line.slice(0, -1);
            currentValue = '';
            inMultiline = false;
        }
    }
    if (currentKey) {
        frontmatter[currentKey] = currentValue.trim();
    }
    return { frontmatter, content: markdownContent.trim() };
}

function applyInlineFormatting(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
        .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>');
}

function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Clean up the input
    markdown = markdown.trim();
    
    // Split content by double newlines to identify distinct blocks (paragraphs, lists, etc.)
    const blocks = markdown.split(/\n\s*\n+/).filter(block => block.trim());
    
    // Process blocks and group consecutive list items
    const processedBlocks = [];
    let currentListItems = [];
    
    blocks.forEach((block, index) => {
        block = block.trim();
        if (!block) return;
        
        // Check if this block is a single list item
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);
        const isSingleListItem = lines.length === 1 && lines[0].match(/^\s*[\*\-\+]\s/);
        
        if (isSingleListItem) {
            // This is a single list item - add to current list
            const content = lines[0].replace(/^\s*[\*\-\+]\s/, '').trim();
            if (content) {
                currentListItems.push(`<li>${applyInlineFormatting(content)}</li>`);
            }
        } else {
            // This is not a single list item
            // First, close any pending list
            if (currentListItems.length > 0) {
                processedBlocks.push(`<ul>${currentListItems.join('')}</ul>`);
                currentListItems = [];
            }
            
            // Process this block normally
            const listLines = lines.filter(line => line.match(/^\s*[\*\-\+]\s/));
            
            if (listLines.length > 0) {
                // This block has list items - process all lines to handle mixed content
                let inList = false;
                let result = '';
                let listItems = [];
                
                lines.forEach(line => {
                    if (line.match(/^\s*[\*\-\+]\s/)) {
                        // This is a list item
                        if (!inList) {
                            inList = true;
                            listItems = [];
                        }
                        const content = line.replace(/^\s*[\*\-\+]\s/, '').trim();
                        if (content) {
                            listItems.push(`<li>${applyInlineFormatting(content)}</li>`);
                        }
                    } else {
                        // Non-list line
                        if (inList) {
                            // Close the current list
                            if (listItems.length > 0) {
                                result += `<ul>${listItems.join('')}</ul>`;
                            }
                            inList = false;
                            listItems = [];
                        }
                        // Add as paragraph
                        result += `<p>${applyInlineFormatting(line)}</p>`;
                    }
                });
                
                // Close any remaining list
                if (inList && listItems.length > 0) {
                    result += `<ul>${listItems.join('')}</ul>`;
                }
                
                processedBlocks.push(result);
            } else {
                // Regular paragraph - replace single newlines with spaces
                block = block.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                processedBlocks.push(`<p>${applyInlineFormatting(block)}</p>`);
            }
        }
    });
    
    // Close any pending list at the end
    if (currentListItems.length > 0) {
        processedBlocks.push(`<ul>${currentListItems.join('')}</ul>`);
    }
    
    return processedBlocks.filter(html => html !== '').join('');
}

// Main function to process all news markdown files
function processNewsFiles() {
    const newsDirectories = [
        '/Users/lamf_mac/Web/github.com/IACR-CMS/content/news/en',
        '/Users/lamf_mac/Web/github.com/IACR-CMS/public/admin/content/news/en'
    ];
    const outputFile = '/Users/lamf_mac/Web/github.com/IACR-CMS/admin/news_en.json';
    
    const result = { news: [] };
    
    try {
        newsDirectories.forEach(inputDir => {
            if (!fs.existsSync(inputDir)) return;
            const files = fs.readdirSync(inputDir);
            const mdFiles = files.filter(file => file.endsWith('.md'));
            mdFiles.forEach(file => {
                const filePath = path.join(inputDir, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const { frontmatter, content } = parseFrontmatter(fileContent);
                const fileName = path.basename(file, '.md');
                const title = frontmatter.title || fileName;
                const date = frontmatter.date || '';
                const picture = frontmatter.picture || '';
                // convert description from markdown/YAML folded text into HTML (preserve formatting)
                const description = markdownToHtml(frontmatter.description || '');
                const htmlContent = markdownToHtml(content || '');
                result.news.push({ id: fileName, title, date, picture, description, content: htmlContent });
            });
        });
        result.news.sort((a, b) => new Date(b.date) - new Date(a.date));
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`News export completed: ${result.news.length} articles -> ${outputFile}`);
    } catch (err) {
        console.error('Error exporting news', err);
    }
}

if (import.meta.url === `file://${process.argv[1]}` || !process.env.JEST_WORKER_ID) {
    processNewsFiles();
}

export default { processNewsFiles };
