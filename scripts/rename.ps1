# PowerShell script to rename paleoclaw to PaleoClaw
# Resolve the repository root from the script location so the script never
# depends on a machine-specific absolute path.
$targetDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# Files to process (text files only)
$includePatterns = @("*.json", "*.md", "*.ts", "*.tsx", "*.js", "*.mjs", "*.yml", "*.yaml", "*.toml", "*.sh", "*.txt", "*.html", "*.css", "*.swift", "*.plist", "*.env*")

# Get all text files
$files = Get-ChildItem -Path $targetDir -Include $includePatterns -Recurse -File -ErrorAction SilentlyContinue

# Write UTF-8 without a byte-order mark. A BOM before `#!/usr/bin/env node`
# disables the shebang, so the launcher would be executed as a shell script.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$count = 0
foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # Skip if no changes needed
        if ($content -notmatch 'paleoclaw|paleoclaw|OPENCLAW') {
            continue
        }
        
        # Perform replacements (case-sensitive patterns)
        $newContent = $content `
            -replace '\bopenclaw\.mjs\b', 'paleoclaw.mjs' `
            -replace '\bopenclaw\b', 'paleoclaw' `
            -replace '\bOpenClaw\b', 'PaleoClaw' `
            -replace '\bOPENCLAW\b', 'PALEOCLAW' `
            -replace 'github\.com/paleoclaw/paleoclaw', 'github.com/syxscott/PaleoClaw' `
            -replace 'ai\.openclaw\.', 'ai.paleoclaw.' `
            -replace '@paleoclaw/', '@paleoclaw/' `
            -replace 'docs\.openclaw\.ai', 'docs.paleoclaw.ai' `
            -replace 'PaleoHub\.com', 'paleohub.org' `
            -replace 'PaleoHub', 'PaleoHub' `
            -replace 'paleoclaw\.ai', 'paleoclaw.ai'
        
        if ($newContent -ne $content) {
            [System.IO.File]::WriteAllText($file.FullName, $newContent, $utf8NoBom)
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
