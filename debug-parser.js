import fs from 'fs';

// Copy of the parseFrontmatter function from export-pages.js
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
    
    console.log('Processing YAML lines:');
    
    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const line = originalLine.trim();
        
        console.log(`Line ${i}: "${originalLine}" (trimmed: "${line}") | currentKey: ${currentKey} | inMultiline: ${inMultiline}`);
        
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
                console.log(`  Saving ${currentKey} = "${currentValue.trim()}"`);
                frontmatter[currentKey] = currentValue.trim();
            }
            
            const colonIndex = line.indexOf(':');
            currentKey = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            console.log(`  New key: ${currentKey}, value: "${value}"`);
            
            // Handle quoted values
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
                frontmatter[currentKey] = value;
                console.log(`  Quoted value saved: ${currentKey} = "${value}"`);
                currentKey = null;
                currentValue = '';
                inMultiline = false;
            } else if (value.startsWith('>-') || value.startsWith('|-')) {
                // Multi-line content
                multilineType = value;
                inMultiline = true;
                currentValue = '';
                console.log(`  Starting multiline with type: ${multilineType}`);
            } else if (value) {
                // Start with this value, but check if next lines are indented (implicit multiline)
                currentValue = value;
                inMultiline = false;
                console.log(`  Starting with value: "${value}"`);
            } else {
                currentValue = '';
                inMultiline = false;
                console.log(`  Empty value, starting multiline`);
            }
        } else if ((inMultiline || currentKey) && currentKey) {
            // Check if we're starting a new key (line ends with colon and no spaces in the key part)
            if (line.endsWith(':') && !line.includes(' ') && originalLine.indexOf(line) === 0) {
                // End of multiline, start of new key
                console.log(`  End multiline for ${currentKey}, value: "${currentValue.trim()}"`);
                frontmatter[currentKey] = currentValue.trim();
                currentKey = line.slice(0, -1);
                currentValue = '';
                inMultiline = false;
                console.log(`  New key after multiline: ${currentKey}`);
            } else if (originalLine.startsWith('  ') && currentKey) {
                // Indented line - continue multiline content
                if (!inMultiline) {
                    // This is the first indented line, so we're starting implicit multiline
                    inMultiline = true;
                    console.log(`  Starting implicit multiline for ${currentKey}`);
                }
                // Add space before content if currentValue doesn't end with space or newline
                if (currentValue && !currentValue.endsWith(' ') && !currentValue.endsWith('\n')) {
                    currentValue += ' ';
                }
                const cleanLine = originalLine.replace(/^\s+/, '');
                currentValue += cleanLine;
                console.log(`  Added indented line: "${originalLine}" -> clean: "${cleanLine}" -> currentValue: "${currentValue}"`);
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
                console.log(`  Added to explicit multiline: "${originalLine}" -> currentValue now: "${currentValue}"`);
            } else {
                // Non-indented line that's not a key - this shouldn't happen in well-formed YAML
                // but let's handle it gracefully
                if (currentValue && !currentValue.endsWith(' ')) {
                    currentValue += ' ';
                }
                currentValue += line;
                console.log(`  Added non-indented continuation: "${line}" -> currentValue: "${currentValue}"`);
            }
        } else if (!inMultiline && line.endsWith(':')) {
            // Single key without value
            if (currentKey) {
                console.log(`  Saving before new empty key ${currentKey} = "${currentValue.trim()}"`);
                frontmatter[currentKey] = currentValue.trim();
            }
            currentKey = line.slice(0, -1);
            currentValue = '';
            inMultiline = false;
            console.log(`  New empty key: ${currentKey}`);
        }
    }
    
    // Save last key-value
    if (currentKey) {
        console.log(`Final save: ${currentKey} = "${currentValue.trim()}"`);
        frontmatter[currentKey] = currentValue.trim();
    }
    
    return { frontmatter, content: markdownContent };
}

// Test with the constitution file
const fileContent = fs.readFileSync('/Users/lamf_mac/Web/github.com/IACR-CMS/public/admin/content/pages/en/about-iacr-governance-constitution.md', 'utf8');
console.log('=== DEBUGGING FRONTMATTER PARSER ===');
const result = parseFrontmatter(fileContent);
console.log('\n=== FINAL RESULT ===');
console.log('Frontmatter:', JSON.stringify(result.frontmatter, null, 2));
console.log('Content:', result.content);