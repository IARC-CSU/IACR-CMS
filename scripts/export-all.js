import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure admin output directory exists at repo root
const adminDir = path.join(__dirname, '..', 'admin');
if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });

// Import and run the three exporters
import pagesExporter from './export-pages.js';
import newsExporter from './export-news.js';
import meetingsExporter from './export-annual-meetings.js';

async function runAll() {
    console.log('Running all exporters...');
    // Each module exports default with functions that auto-run when executed directly,
    // but expose functions we can call too.
    if (pagesExporter && typeof pagesExporter.processMarkdownFiles === 'function') {
        await pagesExporter.processMarkdownFiles();
    } else {
        // fallback: execute the script file directly
        await import('./export-pages.js');
    }

    if (newsExporter && typeof newsExporter.processNewsFiles === 'function') {
        await newsExporter.processNewsFiles();
    } else {
        await import('./export-news.js');
    }

    if (meetingsExporter && typeof meetingsExporter.processAnnualMeetingsFiles === 'function') {
        await meetingsExporter.processAnnualMeetingsFiles();
    } else {
        await import('./export-annual-meetings.js');
    }

    console.log('All exports finished. JSON files are in the admin/ folder.');
    
    // Copy files to Canviz locales directory
    await copyToCanviz();
}

async function copyToCanviz() {
    const sourceDir = path.join(__dirname, '..', 'admin');
    const destDir = '/Users/lamf_mac/Web/iarc/Canviz/src/subsites/iacr/locales/';
    
    console.log('\nCopying files to Canviz locales directory...');
    
    // Check if destination directory exists
    if (!fs.existsSync(destDir)) {
        console.error(`Error: Destination directory does not exist: ${destDir}`);
        return;
    }
    
    try {
        // Handle pages_en.json specially - merge into en.json
        const pagesSourcePath = path.join(sourceDir, 'pages_en.json');
        const enJsonPath = path.join(destDir, 'en.json');
        
        if (fs.existsSync(pagesSourcePath)) {
            // Read pages_en.json content
            const pagesContent = JSON.parse(fs.readFileSync(pagesSourcePath, 'utf8'));
            
            // Read existing en.json or create empty object
            let enContent = {};
            if (fs.existsSync(enJsonPath)) {
                enContent = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
            }
            
            // Merge pages content into en.json, replacing existing keys
            Object.assign(enContent, pagesContent);
            
            // Write back to en.json
            fs.writeFileSync(enJsonPath, JSON.stringify(enContent, null, 2));
            console.log(`✅ Merged pages_en.json content into en.json`);
        } else {
            console.warn(`⚠️  Source file not found: ${pagesSourcePath}`);
        }
        
        // Copy other files normally
        const otherFiles = ['annual_meetings_en.json', 'news_en.json'];
        for (const file of otherFiles) {
            const sourcePath = path.join(sourceDir, file);
            const destPath = path.join(destDir, file);
            
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                console.log(`✅ Copied ${file} to Canviz locales`);
            } else {
                console.warn(`⚠️  Source file not found: ${sourcePath}`);
            }
        }
        
        console.log('\n🎉 All files successfully copied to Canviz!');
        console.log(`Destination: ${destDir}`);
        console.log(`📝 Pages content merged into: ${enJsonPath}`);
    } catch (error) {
        console.error('Error copying files to Canviz:', error.message);
    }
}

runAll().catch(err => { console.error(err); process.exit(1); });
