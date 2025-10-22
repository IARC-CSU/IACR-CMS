import fs from 'fs';
import path from 'path';

// Function to parse YAML frontmatter (reusing from export-news.js)
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

// Helper function to apply inline formatting (reusing from export-news.js)
function applyInlineFormatting(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />'); // Handle images
}

// Function to convert markdown to HTML (enhanced for annual meetings)
function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Clean up the input
    markdown = markdown.trim();
    
    // Split content by double newlines to identify distinct blocks (paragraphs, lists, etc.)
    const blocks = markdown.split(/\n\s*\n+/).filter(block => block.trim());
    
    return blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        
        // Handle headings
        if (block.match(/^#{1,6}\s/)) {
            const level = block.match(/^(#{1,6})/)[1].length;
            const text = block.replace(/^#{1,6}\s*/, '');
            return `<h${level}>${applyInlineFormatting(text)}</h${level}>`;
        }
        
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

// Main function to process all annual meetings markdown files
function processAnnualMeetingsFiles() {
    const inputDir = '/Users/lamf_mac/Web/github.com/IACR-CMS/public/admin/content/annual_meetings/en';
    const outputFile = '/Users/lamf_mac/Web/github.com/IACR-CMS/annual_meetings_en.json';
    
    const result = {
        annual_meetings: []
    };
    
    try {
        if (!fs.existsSync(inputDir)) {
            console.log(`Directory not found: ${inputDir}`);
            return;
        }
        
        const files = fs.readdirSync(inputDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        console.log(`Found ${mdFiles.length} annual meeting files in ${inputDir}...`);
        
        mdFiles.forEach(file => {
            const filePath = path.join(inputDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const { frontmatter, content } = parseFrontmatter(fileContent);
            
            // Get filename without extension for ID
            const fileName = path.basename(file, '.md');
            
            // Extract fields from frontmatter
            const title = frontmatter.title || fileName;
            const city = frontmatter.city || '';
            const date_event = frontmatter.date_event || '';
            const date = frontmatter.date || '';
            const picture = frontmatter.picture || '';
            const logo = frontmatter.logo || '';
            const description = frontmatter.description || '';
            
            // Convert markdown content to HTML
            const htmlContent = markdownToHtml(content || '');
            
            // Create annual meeting object
            const meetingItem = {
                id: fileName,
                title: title,
                city: city,
                date_event: date_event,
                date: date,
                picture: picture,
                logo: logo,
                description: description,
                content: htmlContent
            };
            
            result.annual_meetings.push(meetingItem);
            console.log(`Processed: ${fileName}`);
        });
        
        // Sort annual meetings by event date (newest first)
        result.annual_meetings.sort((a, b) => {
            const dateA = new Date(a.date || a.date_event);
            const dateB = new Date(b.date || b.date_event);
            return dateB - dateA;
        });
        
        // Write result to JSON file
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`\nAnnual meetings export completed! ${result.annual_meetings.length} meeting(s) exported to ${outputFile}`);
        
    } catch (error) {
        console.error('Error processing annual meetings files:', error);
    }
}

// Run the script
processAnnualMeetingsFiles();