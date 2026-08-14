# Neptune Backend API Endpoint Test Script
# Tests all 5 new endpoints with proper authentication and authorization

Write-Host "`n========== NEPTUNE BACKEND TEST SCRIPT ==========" -ForegroundColor Cyan
Write-Host "Testing all implemented endpoints`n"

$BaseUrl = "http://localhost:3000"

# Test data
$CollectorLogin = @{ loginId = "COL001"; password = "Collector@12345" } | ConvertTo-Json
$RiderLogin = @{ loginId = "RIDER001"; password = "Rider@12345" } | ConvertTo-Json
$AdminLogin = @{ loginId = "ADMIN001"; password = "Admin@12345" } | ConvertTo-Json

# Helper function to test endpoints
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Token,
        [string]$Body,
        [string]$Description,
        [int[]]$ExpectedStatus
    )
    
    Write-Host "Testing: $Description" -ForegroundColor Yellow
    Write-Host "  Method: $Method $Endpoint"
    
    $params = @{
        Uri         = "$BaseUrl$Endpoint"
        Method      = $Method
        ContentType = "application/json"
        ErrorAction = "SilentlyContinue"
    }
    
    if ($Token) {
        $params.Headers = @{ "Authorization" = "Bearer $Token" }
    }
    
    if ($Body) {
        $params.Body = $Body
    }
    
    try {
        $response = Invoke-WebRequest @params
        $status = $response.StatusCode
    }
    catch {
        $status = $_.Exception.Response.StatusCode.Value
        $response = $_
    }
    
    $passed = $ExpectedStatus -contains $status
    $color = if ($passed) { "Green" } else { "Red" }
    
    Write-Host "  Status: $status" -ForegroundColor $color
    if (!$passed) {
        Write-Host "  Expected: $($ExpectedStatus -join ', ')" -ForegroundColor Red
    }
    
    return @{ Passed = $passed; Status = $status; Response = $response }
}

# Step 1: Get authentication tokens
Write-Host "`n========== AUTHENTICATION ==========" -ForegroundColor Cyan

$collectorLogin = Test-Endpoint -Method "POST" -Endpoint "/auth/login" -Body $CollectorLogin -Description "Collector login" -ExpectedStatus 200
$collectorToken = if ($collectorLogin.Passed) { ($collectorLogin.Response.Content | ConvertFrom-Json).access_token } else { $null }
Write-Host "  Token: $($collectorToken ? 'OK' : 'FAILED')`n"

$riderLogin = Test-Endpoint -Method "POST" -Endpoint "/auth/login" -Body $RiderLogin -Description "Rider login" -ExpectedStatus 200
$riderToken = if ($riderLogin.Passed) { ($riderLogin.Response.Content | ConvertFrom-Json).access_token } else { $null }
Write-Host "  Token: $($riderToken ? 'OK' : 'FAILED')`n"

$adminLogin = Test-Endpoint -Method "POST" -Endpoint "/auth/login" -Body $AdminLogin -Description "Admin login" -ExpectedStatus 200
$adminToken = if ($adminLogin.Passed) { ($adminLogin.Response.Content | ConvertFrom-Json).access_token } else { $null }
Write-Host "  Token: $($adminToken ? 'OK' : 'FAILED')`n"

if (!$collectorToken -or !$riderToken) {
    Write-Host "Cannot proceed without valid tokens" -ForegroundColor Red
    exit 1
}

# Step 2: Test Collector Endpoints
Write-Host "`n========== COLLECTOR ENDPOINTS ==========" -ForegroundColor Cyan

# Create a collection request first
$createRequestBody = @{ latitude = 6.9271; longitude = 80.7744 } | ConvertTo-Json
$createResult = Test-Endpoint -Method "POST" -Endpoint "/collector/collection-requests" -Token $collectorToken -Body $createRequestBody -Description "POST /collector/collection-requests (create)" -ExpectedStatus 200
$requestId = if ($createResult.Passed) { ($createResult.Response.Content | ConvertFrom-Json).id } else { $null }
Write-Host "  Created request ID: $requestId`n"

# Task 1: Get collection requests list
Test-Endpoint -Method "GET" -Endpoint "/collector/collection-requests" -Token $collectorToken -Description "GET /collector/collection-requests" -ExpectedStatus 200 | Out-Null
Write-Host ""

# Task 2: Get specific collection request
if ($requestId) {
    Test-Endpoint -Method "GET" -Endpoint "/collector/collection-requests/$requestId" -Token $collectorToken -Description "GET /collector/collection-requests/:id" -ExpectedStatus 200 | Out-Null
    Write-Host ""
    
    # Task 3: Cancel collection request
    Test-Endpoint -Method "PATCH" -Endpoint "/collector/collection-requests/$requestId/cancel" -Token $collectorToken -Description "PATCH /collector/collection-requests/:id/cancel" -ExpectedStatus 200 | Out-Null
    Write-Host ""
}

# Step 3: Test Rider Endpoints
Write-Host "`n========== RIDER ENDPOINTS ==========" -ForegroundColor Cyan

# Task 4: Get rider's assigned requests
Test-Endpoint -Method "GET" -Endpoint "/rider/collection-requests/my" -Token $riderToken -Description "GET /rider/collection-requests/my" -ExpectedStatus 200 | Out-Null
Write-Host ""

# Task 5: Get specific rider request (if any)
$myRequests = Test-Endpoint -Method "GET" -Endpoint "/rider/collection-requests/my" -Token $riderToken -Description "GET /rider/collection-requests/my (fetch)" -ExpectedStatus 200
if ($myRequests.Passed) {
    $requests = $myRequests.Response.Content | ConvertFrom-Json
    if ($requests.Count -gt 0 -or $requests.id) {
        $firstRequestId = if ($requests.Count) { $requests[0].id } else { $requests.id }
        Test-Endpoint -Method "GET" -Endpoint "/rider/collection-requests/$firstRequestId" -Token $riderToken -Description "GET /rider/collection-requests/:id" -ExpectedStatus 200 | Out-Null
        Write-Host ""
    }
}

# Step 4: Test Authorization
Write-Host "`n========== AUTHORIZATION TESTS ==========" -ForegroundColor Cyan

# Admin should not access collector endpoints (403)
Test-Endpoint -Method "GET" -Endpoint "/collector/collection-requests" -Token $adminToken -Description "ADMIN accessing /collector/collection-requests (should be 403)" -ExpectedStatus 403 | Out-Null
Write-Host ""

# Rider should not access collector endpoints (403)
Test-Endpoint -Method "GET" -Endpoint "/collector/collection-requests" -Token $riderToken -Description "RIDER accessing /collector/collection-requests (should be 403)" -ExpectedStatus 403 | Out-Null
Write-Host ""

# Collector should not access rider endpoints (403)
Test-Endpoint -Method "GET" -Endpoint "/rider/collection-requests/my" -Token $collectorToken -Description "COLLECTOR accessing /rider/collection-requests/my (should be 403)" -ExpectedStatus 403 | Out-Null
Write-Host ""

# Step 5: Test Authentication
Write-Host "`n========== AUTHENTICATION TESTS ==========" -ForegroundColor Cyan

# No token should return 401
Test-Endpoint -Method "GET" -Endpoint "/collector/collection-requests" -Description "No token on /collector/collection-requests (should be 401)" -ExpectedStatus 401 | Out-Null
Write-Host ""

Write-Host "`n========== TEST COMPLETE ==========" -ForegroundColor Cyan
Write-Host "Review results above. All tests should show green Status codes."
