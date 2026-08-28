param(
    [string]$StackName = "cloudsecure-docs",
    [string]$Region = "us-east-2"
)

$ErrorActionPreference = "Stop"

$stackJson = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output json

if ($LASTEXITCODE -ne 0) {
    throw "No fue posible consultar los outputs del stack '$StackName'."
}

$outputs = $stackJson | ConvertFrom-Json
$values = @{}
foreach ($item in $outputs) {
    $values[$item.OutputKey] = $item.OutputValue
}

$required = @("ApiUrl", "UserPoolId", "UserPoolClientId", "AwsRegion", "FrontendBucketName", "FrontendDistributionId", "FrontendUrl")
foreach ($key in $required) {
    if (-not $values.ContainsKey($key)) {
        throw "Falta el output '$key' en CloudFormation."
    }
}

$configPath = Join-Path $PSScriptRoot "..\frontend\config.js"
$config = @"
window.APP_CONFIG = {
  region: '$($values['AwsRegion'])',
  userPoolId: '$($values['UserPoolId'])',
  userPoolClientId: '$($values['UserPoolClientId'])',
  apiUrl: '$($values['ApiUrl'])'
};
"@
Set-Content -Path $configPath -Value $config -Encoding utf8

Write-Host "Publicando frontend en S3..." -ForegroundColor Cyan
aws s3 sync "$PSScriptRoot\..\frontend" "s3://$($values['FrontendBucketName'])" `
    --region $Region `
    --delete `
    --exclude "config.example.js"

Write-Host "Invalidando caché de CloudFront..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
    --distribution-id $values['FrontendDistributionId'] `
    --paths "/*" | Out-Null

Write-Host "Frontend publicado:" -ForegroundColor Green
Write-Host $values['FrontendUrl'] -ForegroundColor Green
