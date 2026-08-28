param(
    [string]$StackName = "cloudsecure-docs",
    [string]$Region = "us-east-2",
    [ValidateSet("BASIC", "STRICT")]
    [string]$ApiEndpointAccessMode = "STRICT"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$Name' en PATH. Instálalo antes de continuar."
    }
}

Require-Command "aws"
Require-Command "sam"

Write-Host "[1/5] Verificando credenciales AWS..." -ForegroundColor Cyan
aws sts get-caller-identity --region $Region | Out-Null

Write-Host "[2/5] Construyendo backend con AWS SAM..." -ForegroundColor Cyan
sam build --template-file template.yaml

Write-Host "[3/5] Desplegando stack $StackName en $Region..." -ForegroundColor Cyan
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --resolve-s3 `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides "ApiEndpointAccessMode=$ApiEndpointAccessMode" `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset

Write-Host "[4/5] Ajustando retención del grupo de logs legado, si existe..." -ForegroundColor Cyan
$functionName = aws cloudformation describe-stack-resource `
    --stack-name $StackName `
    --logical-resource-id DocumentsFunction `
    --region $Region `
    --query "StackResourceDetail.PhysicalResourceId" `
    --output text

if ($LASTEXITCODE -eq 0 -and $functionName) {
    $legacyLogGroup = "/aws/lambda/$functionName"
    aws logs put-retention-policy `
        --log-group-name $legacyLogGroup `
        --retention-in-days 14 `
        --region $Region 2>$null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Retención de 14 días aplicada al grupo legado $legacyLogGroup." -ForegroundColor DarkGray
    } else {
        Write-Host "No existe un grupo de logs legado que ajustar. Se continúa normalmente." -ForegroundColor DarkGray
    }
}

Write-Host "[5/5] Configurando y publicando frontend..." -ForegroundColor Cyan
& "$PSScriptRoot\deploy-frontend.ps1" -StackName $StackName -Region $Region

Write-Host "Despliegue v1.1 completado." -ForegroundColor Green
