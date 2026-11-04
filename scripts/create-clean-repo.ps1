# Create a clean, single-main-branch ParcelProof AI repository from THIS working copy.
# Run from the project root or from the scripts folder.
# Requires Git, GitHub CLI (gh), and an authenticated GitHub CLI session.

$ErrorActionPreference = "Stop"

$Owner = "BasutkarSony"
$NewRepoName = "ParcelProof-AI"
$NewRepoFullName = "$Owner/$NewRepoName"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $ScriptDirectory "backend\app\main.py")) {
    $ProjectRoot = (Resolve-Path $ScriptDirectory).Path
} elseif (Test-Path (Join-Path $ScriptDirectory "..\backend\app\main.py")) {
    $ProjectRoot = (Resolve-Path (Join-Path $ScriptDirectory "..")).Path
} else {
    throw "Could not find the project root. Run this script from the ShipProof-AI/ParcelProof-AI folder or its scripts folder."
}

$ParentDirectory = Split-Path -Parent $ProjectRoot
$Destination = Join-Path $ParentDirectory $NewRepoName

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required. Install Git for Windows and run this script again."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI is required. Install it from https://cli.github.com/ and run: gh auth login"
}
if (Test-Path $Destination) {
    throw "Destination already exists: $Destination. Rename or move that folder before retrying."
}

Write-Host "Checking GitHub CLI authentication..."
gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run: gh auth login"
}

Write-Host "Creating a clean local snapshot from the current working folder..."
Write-Host "This includes your current uncommitted source changes and does not switch branches."

New-Item -ItemType Directory -Path $Destination | Out-Null
$RobocopyArgs = @(
    $ProjectRoot, $Destination, "/E", "/R:2", "/W:1",
    "/XD", ".git", ".venv", "venv", "env", "ENV", "node_modules", "__pycache__", "inspection_photos", "dist", "build", ".sf", ".sfdx", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "/XF", ".env", "*.db", "*.sqlite", "*.sqlite3", "*.pyc", "*.pyo", "*.log"
)
& robocopy @RobocopyArgs | Out-Host
$CopyExitCode = $LASTEXITCODE
if ($CopyExitCode -ge 8) {
    throw "Could not copy the project files (robocopy exit code $CopyExitCode)."
}

# Remove nested local environment files while preserving the checked-in .env.example.
Get-ChildItem -LiteralPath $Destination -Force -Recurse -File |
    Where-Object {
        ($_.Name -eq ".env") -or
        ($_.Name -like ".env.*" -and $_.Name -ne ".env.example") -or
        ($_.Name -match '\.(db|sqlite|sqlite3|pyc|pyo|log)$')
    } |
    Remove-Item -Force

# The copy excludes .git, so this starts a genuinely clean history.
Push-Location $Destination
try {
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize the clean main branch." }

    git add -A
    if ($LASTEXITCODE -ne 0) { throw "Could not stage the clean project files." }

    git commit -m "Initial release: ParcelProof AI"
    if ($LASTEXITCODE -ne 0) { throw "Could not create the initial repository commit." }

    Write-Host "Creating the new public GitHub repository and pushing main..."
    gh repo create $NewRepoFullName --public --source . --remote origin --push --description "PayPal-connected order fulfilment and AI-assisted shipment evidence review."
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub could not create or push the repository. Check whether $NewRepoFullName already exists and run gh auth status."
    }

    Write-Host ""
    Write-Host "ParcelProof AI is now on GitHub:"
    Write-Host "https://github.com/$NewRepoFullName"
    Write-Host ""
    Write-Host "Local clean project: $Destination"
    Write-Host "Default branch: main"
    Write-Host "The original ShipProof-AI folder and repository were not changed."
}
finally {
    Pop-Location
}
