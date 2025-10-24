import fs from 'fs';
import path from 'path';

// Function to parse YAML frontmatter
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
        
        if (line.includes(':') && !inMultiline && !originalLine.startsWith(' ')) {
            // Only treat as key if the line doesn't start with spaces
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
                // Start with this value, but check if next lines are indented (implicit multiline)
                currentValue = value;
                inMultiline = false;
            } else {
                currentValue = '';
                inMultiline = false;
            }
        } else if ((inMultiline || currentKey) && currentKey) {
            // Check if we're starting a new key (line ends with colon and no spaces in the key part)
            if (line.endsWith(':') && !line.includes(' ') && originalLine.indexOf(line) === 0) {
                // End of multiline, start of new key
                frontmatter[currentKey] = currentValue.trim();
                currentKey = line.slice(0, -1);
                currentValue = '';
                inMultiline = false;
            } else if (originalLine.startsWith('  ') && currentKey) {
                // Indented line - continue multiline content
                if (!inMultiline) {
                    // This is the first indented line, so we're starting implicit multiline
                    inMultiline = true;
                }
                // Add space before content if currentValue doesn't end with space or newline
                if (currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n')) {
                    currentValue += ' ';
                }
                currentValue += originalLine.replace(/^\s+/, ''); // Remove leading spaces
            } else if (inMultiline) {
                // Continue explicit multiline content
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
            } else {
                // Non-indented line that's not a key - this shouldn't happen in well-formed YAML
                // but let's handle it gracefully
                if (currentValue && !currentValue.endsWith(' ')) {
                    currentValue += ' ';
                }
                currentValue += line;
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

// Function to convert markdown to HTML (improved conversion with proper list handling)
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

// Helper function to apply inline formatting
function applyInlineFormatting(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting completely
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>');
}

// Main function to process all markdown files for pages
function processMarkdownFiles() {
    const inputDir = '/Users/lamf_mac/Web/github.com/IACR-CMS/public/admin/content/pages/en';
    const outputFile = '/Users/lamf_mac/Web/github.com/IACR-CMS/admin/pages_en.json';
    
    const result = {};
    
    try {
        const files = fs.readdirSync(inputDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        console.log(`Found ${mdFiles.length} markdown files to process...`);
        
        mdFiles.forEach(file => {
            const filePath = path.join(inputDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const { frontmatter, content } = parseFrontmatter(fileContent);
            
            // Get filename without extension
            const fileName = path.basename(file, '.md');
            
            // Extract title, content, and picture
            const title = frontmatter.title || frontmatter.info || fileName;
            const htmlContent = markdownToHtml(frontmatter.content || content || '');
            const picture = frontmatter.picture || frontmatter.image || '';
            
            // Add to result object
            result[`${fileName}_title`] = title;
            result[`${fileName}_desc`] = htmlContent;
            result[`${fileName}_image`] = picture;
            
            console.log(`Processed: ${fileName}`);
        });
        
        // Write result to JSON file
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`\nExport completed! ${Object.keys(result).length / 3} files exported to ${outputFile}`);
        
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

// Run the script when executed directly
if (import.meta.url === `file://${process.argv[1]}` || !process.env.JEST_WORKER_ID) {
    processMarkdownFiles();
}

export default { processMarkdownFiles };
