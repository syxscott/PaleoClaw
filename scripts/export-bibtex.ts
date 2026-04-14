/**
 * BibTeX Export Script
 * 
 * Converts literature data to BibTeX format for use in LaTeX documents.
 * 
 * Usage:
 *   bun scripts/export-bibtex.ts <input.json> <output.bib>
 *   bun scripts/export-bibtex.ts --doi <doi> [--output <file>]
 */

interface Paper {
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  url?: string;
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${authors.slice(0, -1).join(', ')} and ${authors[authors.length - 1]}`;
}

function sanitizeBibKey(title: string, year: number | undefined): string {
  const words = title.split(/\s+/).slice(0, 3);
  const base = words.join('').toLowerCase().replace(/[^a-z]/g, '');
  return year ? `${base}${year}` : base;
}

function paperToBibtex(paper: Paper, key?: string): string {
  const bibKey = key || sanitizeBibKey(paper.title || 'unknown', paper.year);
  
  const entries: string[] = [];
  entries.push(`@article{${bibKey},`);
  
  if (paper.title) entries.push(`  title = {${paper.title}},`);
  if (paper.authors && paper.authors.length > 0) {
    entries.push(`  author = {${formatAuthors(paper.authors)}},`);
  }
  if (paper.year) entries.push(`  year = {${paper.year}},`);
  if (paper.journal) entries.push(`  journal = {${paper.journal}},`);
  if (paper.volume) entries.push(`  volume = {${paper.volume}},`);
  if (paper.issue) entries.push(`  number = {${paper.issue}},`);
  if (paper.pages) entries.push(`  pages = {${paper.pages}},`);
  if (paper.doi) entries.push(`  doi = {${paper.doi}},`);
  if (paper.url) entries.push(`  url = {${paper.url}},`);
  
  entries.push('}');
  
  return entries.join('\n');
}

function papersToBibtex(papers: Paper[]): string {
  const bibtex = papers.map((paper, index) => {
    return paperToBibtex(paper, `ref${index + 1}`);
  });
  
  return [
    '% BibTeX exported by PaleoClaw',
    `% Generated: ${new Date().toISOString()}`,
    '% Total references: ${papers.length}`,
    '',
    ...bibtex,
  ].join('\n');
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
PaleoClaw BibTeX Export Tool

Usage:
  bun scripts/export-bibtex.ts <input.json> [output.bib]
  bun scripts/export-bibtex.ts --doi <doi> [--output <file>]

Examples:
  bun scripts/export-bibtex.ts papers.json bibliography.bib
  bun scripts/export-bibtex.ts --doi 10.1038/nature12373 --output ref.bib
    `);
    return;
  }
  
  try {
    let papers: Paper[] = [];
    let output = 'bibliography.bib';
    
    if (args[0] === '--doi') {
      const doi = args[1];
      if (!doi) {
        console.error('Error: DOI required');
        process.exit(1);
      }
      
      // Fetch paper info from DOI
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!response.ok) {
        console.error(`Error: Failed to fetch DOI ${doi}`);
        process.exit(1);
      }
      
      const data = await response.json();
      const work = data.message;
      
      papers = [{
        title: work.title?.[0] || '',
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        year: work.published?.['date-parts']?.[0]?.[0],
        journal: work['container-title']?.[0] || '',
        doi: work.DOI,
        volume: work.volume,
        issue: work.issue,
        pages: work.page,
        url: work.URL,
      }];
      
      output = args.find(a => a.startsWith('--output='))?.split('=')[1] || `${sanitizeBibtex(papers[0].title || 'ref', papers[0].year)}.bib`;
    } else {
      const inputFile = args[0];
      if (args[1]) output = args[1];
      
      const content = await Bun.file(inputFile).text();
      papers = JSON.parse(content);
    }
    
    const bibtex = papersToBibtex(papers);
    await Bun.write(output, bibtex);
    
    console.log(`✅ Exported ${papers.length} references to ${output}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function sanitizeBibtex(title: string, year: number | undefined): string {
  const words = title.split(/\s+/).slice(0, 3);
  const base = words.join('').toLowerCase().replace(/[^a-z]/g, '');
  return year ? `${base}${year}` : base;
}

main();
