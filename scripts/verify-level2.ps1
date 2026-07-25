Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

try {
    [Console]::OutputEncoding =
        New-Object System.Text.UTF8Encoding($false)

    $OutputEncoding = [Console]::OutputEncoding
}
catch {
    Write-Host "Console encoding was not changed." `
        -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PEER REVIEW LOG - LEVEL 2 AUDIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [string[]]$Arguments = @(),

        [switch]$AllowNonZeroExit,

        [switch]$Quiet
    )

    $PreviousPreference = $ErrorActionPreference
    $RawOutput = @()
    $ExitCode = -1

    try {
        $ErrorActionPreference = "Continue"

        $RawOutput = @(
            & $FilePath @Arguments 2>&1
        )

        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    $Lines = @(
        $RawOutput |
        ForEach-Object {
            $_.ToString()
        } |
        Where-Object {
            $_ -ne "System.Management.Automation.RemoteException"
        }
    )

    if (-not $Quiet) {
        $Lines |
            ForEach-Object {
                Write-Host $_
            }
    }

    if (
        (-not $AllowNonZeroExit) -and
        ($ExitCode -ne 0)
    ) {
        $RenderedArguments = $Arguments -join " "

        throw (
            "Command failed with exit code " +
            "${ExitCode}: $FilePath $RenderedArguments"
        )
    }

    return [pscustomobject]@{
        ExitCode = $ExitCode
        Lines = $Lines
        Text = $Lines -join "`n"
    }
}

function Assert-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $Command = Get-Command `
        $Name `
        -ErrorAction SilentlyContinue

    if (-not $Command) {
        throw "Required command was not found: $Name"
    }
}

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        throw "Required file was not found: $Path"
    }
}

function Assert-FileContains {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string[]]$Patterns
    )

    Assert-FileExists -Path $Path

    foreach ($Pattern in $Patterns) {
        $Found = Select-String `
            -Path $Path `
            -SimpleMatch $Pattern `
            -Quiet

        if (-not $Found) {
            throw "$Path is missing required content: $Pattern"
        }
    }
}

Write-Host "[1/10] Checking required tools..." -ForegroundColor Cyan

$RequiredCommands = @(
    "git",
    "cargo",
    "rustc",
    "stellar",
    "node",
    "npm"
)

foreach ($CommandName in $RequiredCommands) {
    Assert-CommandExists -Name $CommandName
}

Write-Host "[2/10] Checking required files..." -ForegroundColor Cyan

$RequiredFiles = @(
    ".\Cargo.toml",
    ".\contracts\peer_review_log\Cargo.toml",
    ".\contracts\peer_review_log\src\lib.rs",
    ".\contracts\peer_review_log\src\test.rs",
    ".\deployments\testnet.json",
    ".\deployments\testnet-cli-test.json",
    ".\frontend\package.json",
    ".\frontend\package-lock.json",
    ".\frontend\.env.example",
    ".\frontend\src\App.tsx",
    ".\frontend\src\contractConfig.ts",
    ".\frontend\src\deployment.ts",
    ".\frontend\src\services\contract.ts",
    ".\frontend\src\services\wallet.ts",
    ".\packages\peer_review_log\package.json",
    ".\README.md"
)

foreach ($RequiredFile in $RequiredFiles) {
    Assert-FileExists -Path $RequiredFile
}

Write-Host "[3/10] Validating contract implementation..." -ForegroundColor Cyan

$ContractSourcePath =
    ".\contracts\peer_review_log\src\lib.rs"

Assert-FileContains `
    -Path $ContractSourcePath `
    -Patterns @(
        "pub fn submit_review",
        "pub fn get_review",
        "pub fn paper_snapshot",
        "pub fn has_reviewed",
        "pub fn total_reviews",
        "#[contractevent]",
        "ReviewSubmitted",
        ".publish(&env)",
        "reviewer.require_auth()",
        "InvalidPaperId",
        "InvalidScore",
        "DuplicateReview",
        "ArithmeticOverflow"
    )

$ContractSource = Get-Content `
    $ContractSourcePath `
    -Raw

$FunctionCount = (
    [regex]::Matches(
        $ContractSource,
        "(?m)^\s*pub fn "
    )
).Count

if ($FunctionCount -ne 5) {
    throw "Expected 5 contract functions, found $FunctionCount."
}

$TestSource = Get-Content `
    ".\contracts\peer_review_log\src\test.rs" `
    -Raw

$TestCount = (
    [regex]::Matches(
        $TestSource,
        "(?m)^\s*#\[test\]\s*$"
    )
).Count

if ($TestCount -ne 5) {
    throw "Expected 5 contract tests, found $TestCount."
}

Write-Host "[4/10] Checking Rust formatting..." -ForegroundColor Cyan

Invoke-External `
    -FilePath "cargo" `
    -Arguments @(
        "fmt",
        "--all",
        "--",
        "--check"
    ) |
    Out-Null

Write-Host "[5/10] Running tests and WASM checks..." -ForegroundColor Cyan

$PreviousRustFlags = $env:RUSTFLAGS

try {
    $env:RUSTFLAGS = "-Dwarnings"

    Invoke-External `
        -FilePath "cargo" `
        -Arguments @(
            "test",
            "--workspace"
        ) |
        Out-Null

    Invoke-External `
        -FilePath "cargo" `
        -Arguments @(
            "check",
            "--workspace",
            "--target",
            "wasm32v1-none"
        ) |
        Out-Null
}
finally {
    $env:RUSTFLAGS = $PreviousRustFlags
}

Write-Host "[6/10] Building Soroban contract..." -ForegroundColor Cyan

$ContractBuild = Invoke-External `
    -FilePath "stellar" `
    -Arguments @(
        "contract",
        "build"
    )

if (
    $ContractBuild.Text -match
    "(?im)^\s*warning:"
) {
    throw "Stellar contract build produced a warning."
}

$WasmPath =
    ".\target\wasm32v1-none\release\peer_review_log.wasm"

Assert-FileExists -Path $WasmPath

$WasmFile = Get-Item $WasmPath

if ($WasmFile.Length -le 0) {
    throw "Compiled WASM file is empty."
}

Write-Host (
    "WASM size: " +
    $WasmFile.Length +
    " bytes"
) -ForegroundColor Green

Write-Host "[7/10] Building generated bindings..." -ForegroundColor Cyan

Push-Location ".\packages\peer_review_log"

try {
    Invoke-External `
        -FilePath "npm" `
        -Arguments @(
            "run",
            "build"
        ) |
        Out-Null
}
finally {
    Pop-Location
}

$BindingFiles = @(
    ".\packages\peer_review_log\dist\index.js",
    ".\packages\peer_review_log\dist\index.d.ts"
)

foreach ($BindingFilePath in $BindingFiles) {
    Assert-FileExists -Path $BindingFilePath

    $BindingFile = Get-Item $BindingFilePath

    if ($BindingFile.Length -le 0) {
        throw "Generated binding file is empty: $BindingFilePath"
    }
}

Write-Host "Generated bindings verified:" -ForegroundColor Green
Write-Host " - packages/peer_review_log/dist/index.js"
Write-Host " - packages/peer_review_log/dist/index.d.ts"

Write-Host "[8/10] Checking frontend..." -ForegroundColor Cyan

Push-Location ".\frontend"

try {
    Invoke-External `
        -FilePath "npm" `
        -Arguments @(
            "run",
            "type-check"
        ) |
        Out-Null

    $FrontendBuild = Invoke-External `
        -FilePath "npm" `
        -Arguments @(
            "run",
            "build"
        )

    if (
        $FrontendBuild.Text -match
        "Circular chunk"
    ) {
        throw "Frontend build contains a circular chunk warning."
    }

    if (
        $FrontendBuild.Text -match
        "Some chunks are larger than"
    ) {
        throw "Frontend build contains a chunk-size warning."
    }

    $AuditResult = Invoke-External `
        -FilePath "cmd.exe" `
        -Arguments @(
            "/d",
            "/s",
            "/c",
            "npm audit --omit=dev --json 2>nul"
        ) `
        -AllowNonZeroExit `
        -Quiet

    try {
        $Audit = $AuditResult.Text |
            ConvertFrom-Json
    }
    catch {
        Write-Host $AuditResult.Text
        throw "Unable to parse npm audit JSON."
    }

    $Low =
        [int]$Audit.metadata.vulnerabilities.low

    $Moderate =
        [int]$Audit.metadata.vulnerabilities.moderate

    $High =
        [int]$Audit.metadata.vulnerabilities.high

    $Critical =
        [int]$Audit.metadata.vulnerabilities.critical

    Write-Host "Low vulnerabilities      : $Low"
    Write-Host "Moderate vulnerabilities : $Moderate"
    Write-Host "High vulnerabilities     : $High"
    Write-Host "Critical vulnerabilities : $Critical"

    if (($High -gt 0) -or ($Critical -gt 0)) {
        throw (
            "Frontend contains high or critical " +
            "vulnerabilities."
        )
    }
}
finally {
    Pop-Location
}

Write-Host "[9/10] Validating deployment and documentation..." -ForegroundColor Cyan

$Deployment = Get-Content `
    ".\deployments\testnet.json" `
    -Raw |
    ConvertFrom-Json

$Evidence = Get-Content `
    ".\deployments\testnet-cli-test.json" `
    -Raw |
    ConvertFrom-Json

if ($Deployment.network -ne "testnet") {
    throw "Deployment network is not Testnet."
}

if (
    $Deployment.contractId -notmatch
    "^C[A-Z2-7]{55}$"
) {
    throw "Deployment contains an invalid Contract ID."
}

if (
    $Evidence.contractId -ne
    $Deployment.contractId
) {
    throw "Evidence and deployment Contract IDs do not match."
}

if (
    $Evidence.transactionHash -notmatch
    "^[0-9a-fA-F]{64}$"
) {
    throw "Evidence contains an invalid transaction hash."
}

if (-not [bool]$Evidence.successful) {
    throw "Evidence transaction is not marked successful."
}

Assert-FileContains `
    -Path ".\README.md" `
    -Patterns @(
        [string]$Deployment.contractId,
        [string]$Evidence.transactionHash,
        "Freighter",
        "Albedo",
        "xBull",
        "ReviewSubmitted",
        "submit_review",
        "paper_snapshot",
        "pending",
        "success",
        "failed"
    )

Assert-FileContains `
    -Path ".\frontend\src\App.tsx" `
    -Patterns @(
        "submitPeerReview",
        "pending",
        "success",
        "failed",
        "refreshContractState"
    )

Assert-FileContains `
    -Path ".\frontend\src\services\contract.ts" `
    -Patterns @(
        "signAndSend",
        "SHA-256",
        "DappErrorCategory",
        "validation",
        "wallet",
        "contract",
        "network"
    )

Assert-FileContains `
    -Path ".\frontend\src\services\wallet.ts" `
    -Patterns @(
        "FreighterModule",
        "AlbedoModule",
        "xBullModule",
        "signTransaction"
    )

$ReadmeContent = Get-Content `
    ".\README.md" `
    -Raw

$FenceCount = (
    [regex]::Matches(
        $ReadmeContent,
        "(?m)^~~~"
    )
).Count

if (($FenceCount % 2) -ne 0) {
    throw "README Markdown fences are not balanced."
}

$UniqueHeadings = @(
    "## Contract errors",
    "## Wallet support",
    "## Repository structure",
    "## Requirements",
    "## Contract setup",
    "## Frontend setup",
    "## Environment configuration"
)

foreach ($Heading in $UniqueHeadings) {
    $HeadingCount = (
        [regex]::Matches(
            $ReadmeContent,
            "(?m)^" +
            [regex]::Escape($Heading) +
            "\s*$"
        )
    ).Count

    if ($HeadingCount -ne 1) {
        throw (
            "README heading appears " +
            "$HeadingCount times: $Heading"
        )
    }
}

Write-Host "[10/10] Checking Git and secret safety..." -ForegroundColor Cyan

$TrackedResult = Invoke-External `
    -FilePath "git" `
    -Arguments @(
        "ls-files"
    ) `
    -Quiet

$TrackedFiles = @(
    $TrackedResult.Lines |
    Where-Object {
        $_
    }
)

$AllowedGeneratedFiles = @(
    "packages/peer_review_log/dist/index.js",
    "packages/peer_review_log/dist/index.d.ts"
)

foreach ($AllowedFile in $AllowedGeneratedFiles) {
    if ($AllowedFile -notin $TrackedFiles) {
        throw "Required binding is not tracked: $AllowedFile"
    }
}

$DisallowedTrackedFiles = @(
    $TrackedFiles |
    Where-Object {
        $TrackedPath = $_

        $AlwaysDisallowed =
            $TrackedPath -match
                "(^|/)(node_modules|target)(/|$)" -or
            $TrackedPath -match
                "\.tsbuildinfo$"

        $OtherDist =
            $TrackedPath -match
                "(^|/)dist/" -and
            $TrackedPath -notin
                $AllowedGeneratedFiles

        $AlwaysDisallowed -or $OtherDist
    }
)

if ($DisallowedTrackedFiles.Count -gt 0) {
    Write-Host "Disallowed tracked files:" -ForegroundColor Red

    $DisallowedTrackedFiles |
        ForEach-Object {
            Write-Host $_
        }

    throw "Disallowed generated files are tracked by Git."
}

Write-Host "Allowed generated bindings:" -ForegroundColor Green

$AllowedGeneratedFiles |
    ForEach-Object {
        Write-Host " - $_"
    }

$SecretScanFiles = @(
    $TrackedFiles |
    Where-Object {
        $_ -notmatch "^packages/peer_review_log/dist/" -and
        (
            $_ -match
                "\.(md|json|toml|rs|ts|tsx|js|mjs|ps1|txt)$" -or
            $_ -eq ".gitignore"
        )
    }
)

foreach ($TrackedFile in $SecretScanFiles) {
    if (-not (Test-Path $TrackedFile)) {
        continue
    }

    $SecretMatch = Select-String `
        -Path $TrackedFile `
        -Pattern "\bS[A-Z2-7]{55}\b" `
        -ErrorAction SilentlyContinue

    if ($SecretMatch) {
        throw (
            "Possible Stellar secret key found in: " +
            $TrackedFile
        )
    }
}

Invoke-External `
    -FilePath "git" `
    -Arguments @(
        "-c",
        "core.pager=cat",
        "diff",
        "--check"
    ) |
    Out-Null

Invoke-External `
    -FilePath "git" `
    -Arguments @(
        "-c",
        "core.pager=cat",
        "diff",
        "--cached",
        "--check"
    ) |
    Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " LEVEL 2 AUDIT PASSED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Contract ID:" -ForegroundColor Cyan
Write-Host $Deployment.contractId

Write-Host ""
Write-Host "Transaction hash:" -ForegroundColor Cyan
Write-Host $Evidence.transactionHash
Write-Host ""
