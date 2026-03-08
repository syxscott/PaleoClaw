# PowerShell script to rename OpenClaw to PaleoClaw
$targetDir = "D:\GIthub\Claw\PaleoClaw"

# Files to process (text files only)
$includePatterns = @("*.json", "*.md", "*.ts", "*.tsx", "*.js", "*.mjs", "*.yml", "*.yaml", "*.toml", "*.sh", "*.txt", "*.html", "*.css", "*.swift", "*.plist", "*.env*")

# Get all text files
$files = Get-ChildItem -Path $targetDir -Include $includePatterns -Recurse -File -ErrorAction SilentlyContinue

$count = 0
foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # Skip if no changes needed
        if ($content -notmatch 'openclaw|OpenClaw|OPENCLAW') {
            continue
        }
        
        # Perform replacements (case-sensitive patterns)
        $newContent = $content `
            -replace '\bopenclaw\.mjs\b', 'paleoclaw.mjs' `
            -replace '\bopenclaw\b', 'paleoclaw' `
            -replace '\bOpenClaw\b', 'PaleoClaw' `
            -replace '\bOPENCLAW\b', 'PALEOCLAW' `
            -replace 'github\.com/openclaw/openclaw', 'github.com/paleoclaw/paleoclaw' `
            -replace 'ai\.openclaw\.', 'ai.paleoclaw.' `
            -replace '@openclaw/', '@paleoclaw/' `
            -replace 'docs\.openclaw\.ai', 'docs.paleoclaw.ai' `
            -replace 'clawhub\.com', 'paleohub.org' `
            -replace 'ClawHub', 'PaleoHub' `
            -replace 'openclaw\.ai', 'paleoclaw.ai'
        
        if ($newContent -ne $content) {
            Set-Content $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $count++
            Write-Host "Updated: $($file.Name)"
        }
    }
    catch {
        Write-Warning "Error processing $($file.FullName): $($_.Exception.Message)"
    }
}

Write-Host "======================================"
Write-Host "Total files updated: $count"
Write-Host "======================================"
