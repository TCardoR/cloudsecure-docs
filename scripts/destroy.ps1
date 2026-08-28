param(
    [string]$StackName = "cloudsecure-docs",
    [string]$Region = "us-east-2"
)

$ErrorActionPreference = "Stop"

$outputsJson = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output json

$outputs = $outputsJson | ConvertFrom-Json
$values = @{}
foreach ($item in $outputs) { $values[$item.OutputKey] = $item.OutputValue }

if ($values['DocumentsBucketName']) {
    Write-Host "Vaciando bucket de documentos..." -ForegroundColor Yellow
    aws s3 rm "s3://$($values['DocumentsBucketName'])" --recursive --region $Region
}
if ($values['FrontendBucketName']) {
    Write-Host "Vaciando bucket del frontend..." -ForegroundColor Yellow
    aws s3 rm "s3://$($values['FrontendBucketName'])" --recursive --region $Region
}

Write-Host "Eliminando stack..." -ForegroundColor Yellow
sam delete --stack-name $StackName --region $Region --no-prompts
