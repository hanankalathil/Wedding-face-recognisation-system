# PowerShell script to run the Face Recognition System (Local, Cloudflare, or Ngrok mode)

# Clean up logs on start
Remove-Item -Path "backend_out.log", "backend_err.log", "cloudflared_out.log", "cloudflared.log" -ErrorAction SilentlyContinue

Clear-Host

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         WEDDING FACE RECOGNITION SYSTEM          " -ForegroundColor White -BackgroundColor Blue
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Select Mode:" -ForegroundColor Gray
Write-Host "  [1] Local Mode (Offline/Development)" -ForegroundColor Yellow
Write-Host "  [2] Cloudflare Tunnel Mode (Random trycloudflare URL, or permanent token)" -ForegroundColor Green
Write-Host "  [3] Ngrok Tunnel Mode (Permanent free ngrok subdomain)" -ForegroundColor Magenta
Write-Host ""

$choice = Read-Host " Enter choice (1, 2, or 3, default is 1)"
if ($choice -ne "2" -and $choice -ne "3") {
    $choice = "1"
}

Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
if ($choice -eq "1") {
    Write-Host "      STARTING FACE RECOGNITION SYSTEM LOCAL      " -ForegroundColor White -BackgroundColor Blue
} elseif ($choice -eq "2") {
    Write-Host "      STARTING FACE RECOGNITION SYSTEM CLOUDFLARE " -ForegroundColor White -BackgroundColor Blue
} else {
    Write-Host "      STARTING FACE RECOGNITION SYSTEM NGROK      " -ForegroundColor White -BackgroundColor Blue
}
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check for port 8000 and kill any process occupying it
$port8000Proc = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000Proc) {
    Write-Host " [i] Port 8000 is currently in use. Releasing port..." -ForegroundColor Yellow
    foreach ($conn in $port8000Proc) {
        if ($conn.OwningProcess -gt 0) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
}

# 2. Dependency Checking (cloudflared or ngrok)
$cfExe = "$PSScriptRoot\cloudflared.exe"
$ngrokExe = "$PSScriptRoot\ngrok.exe"
$spinner = @('|', '/', '-', '\')

if ($choice -eq "2") {
    if (-not (Test-Path $cfExe)) {
        Write-Host " [i] cloudflared.exe not found in project directory." -ForegroundColor Yellow
        Write-Host " [i] Downloading latest Cloudflare Tunnel client..." -ForegroundColor Yellow
        
        curl.exe -s -L -o $cfExe "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        
        if (-not (Test-Path $cfExe) -or (Get-Item $cfExe).Length -lt 10MB) {
            Write-Host " [ERROR] Failed to download cloudflared.exe. Please download it manually." -ForegroundColor Red
            Read-Host "Press Enter to exit..."
            exit 1
        }
        Write-Host " [SUCCESS] cloudflared.exe downloaded successfully!" -ForegroundColor Green
    }
}
elseif ($choice -eq "3") {
    if (-not (Test-Path $ngrokExe)) {
        Write-Host " [i] ngrok.exe not found in project directory." -ForegroundColor Yellow
        Write-Host " [i] Downloading Ngrok client..." -ForegroundColor Yellow
        
        $zipPath = "$PSScriptRoot\ngrok.zip"
        curl.exe -s -L -o $zipPath "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
        
        if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -lt 5MB) {
            Write-Host " [ERROR] Failed to download Ngrok. Please download it manually." -ForegroundColor Red
            Read-Host "Press Enter to exit..."
            exit 1
        }
        
        Write-Host " [i] Extracting Ngrok..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $PSScriptRoot -Force
        Remove-Item -Path $zipPath -ErrorAction SilentlyContinue
        Write-Host " [SUCCESS] Ngrok extracted successfully!" -ForegroundColor Green
    }
    
    # Configure authtoken if token file is present
    $ngrokTokenFile = "$PSScriptRoot\ngrok-token.txt"
    if (Test-Path $ngrokTokenFile) {
        $ngrokToken = (Get-Content $ngrokTokenFile -ErrorAction SilentlyContinue).Trim()
        Write-Host " [i] Applying Ngrok authtoken..." -ForegroundColor Yellow
        Start-Process -FilePath $ngrokExe -ArgumentList "config add-authtoken $ngrokToken" -WindowStyle Hidden -Wait
    }
}

$backendProcess = $null
$tunnelProcess = $null

try {
    # 3. Start Backend Server with Hidden Window
    $env:PYTHONPATH = "$PSScriptRoot\backend"
    $env:PORT = "8000"
    
    $backendProcess = Start-Process -FilePath "$PSScriptRoot\venv\Scripts\python.exe" `
        -ArgumentList "backend\run.py" `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput "$PSScriptRoot\backend_out.log" `
        -RedirectStandardError "$PSScriptRoot\backend_err.log"
    
    # 4. Spinner for Backend Server startup
    Write-Host -NoNewline " [ ] Starting backend server..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 20; $i++) {
        $char = $spinner[$i % 4]
        Write-Host -NoNewline "`r [$char] Starting backend server..." -ForegroundColor Yellow
        Start-Sleep -Milliseconds 200
    }
    
    # Double check if backend crashed on launch
    if ($backendProcess.HasExited) {
        Write-Host "`r [x] Backend server failed to start. Check backend_err.log." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
    Write-Host "`r [v] Backend server started successfully!" -ForegroundColor Green
    Write-Host ""

    # 5. Handle Mode Execution
    if ($choice -eq "1") {
        # Local Mode: Open Browser
        Write-Host " [i] Opening browser to http://localhost:8000..." -ForegroundColor Yellow
        Start-Process "http://localhost:8000/index.html"
        Start-Sleep -Seconds 1
        
        Clear-Host
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host "          WEDDING FACE RECOGNITION SYSTEM          " -ForegroundColor White -BackgroundColor Blue
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  SUCCESS: Your local Face Recognition server is running!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Local URL:  " -NoNewline -ForegroundColor White
        Write-Host "http://localhost:8000" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Logs:       Saved to backend_err.log and backend_out.log" -ForegroundColor Gray
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host " Press [CTRL + C] in this window to stop the server" -ForegroundColor DarkGray
        Write-Host "==================================================" -ForegroundColor Cyan
    }
    elseif ($choice -eq "2") {
        # Cloudflare Tunnel Mode
        $tokenFile = "$PSScriptRoot\cloudflare-token.txt"
        $domainFile = "$PSScriptRoot\cloudflare-domain.txt"
        $hasToken = Test-Path $tokenFile
        
        if ($hasToken) {
            $token = (Get-Content $tokenFile -ErrorAction SilentlyContinue).Trim()
            $customDomain = "Configured in Cloudflare Dashboard"
            if (Test-Path $domainFile) {
                $customDomain = (Get-Content $domainFile -ErrorAction SilentlyContinue).Trim()
            }
            
            # Start permanent tunnel using token
            $tunnelProcess = Start-Process -FilePath $cfExe `
                -ArgumentList "tunnel run --token $token" `
                -WindowStyle Hidden `
                -PassThru `
                -RedirectStandardOutput "$PSScriptRoot\cloudflared_out.log" `
                -RedirectStandardError "$PSScriptRoot\cloudflared.log"
            
            # Spinner for connection
            Write-Host -NoNewline " [ ] Connecting permanent Cloudflare Tunnel..." -ForegroundColor Yellow
            for ($i = 0; $i -lt 15; $i++) {
                $char = $spinner[$i % 4]
                Write-Host -NoNewline "`r [$char] Connecting permanent Cloudflare Tunnel..." -ForegroundColor Yellow
                Start-Sleep -Milliseconds 200
            }
            
            if ($tunnelProcess.HasExited) {
                Write-Host "`r [x] Permanent Tunnel failed to start. Check cloudflared.log." -ForegroundColor Red
                Read-Host "Press Enter to exit..."
                exit 1
            }
            Write-Host "`r [v] Permanent Cloudflare Tunnel established!" -ForegroundColor Green
            Write-Host ""
            Start-Sleep -Seconds 1
            
            $url = $customDomain
        }
        else {
            # Start Tunnel with retry logic
            $url = $null
            $retryCount = 0
            $maxRetries = 3
            
            while (-not $url -and $retryCount -lt $maxRetries) {
                $retryCount++
                Remove-Item -Path "$PSScriptRoot\cloudflared.log", "$PSScriptRoot\cloudflared_out.log" -ErrorAction SilentlyContinue
                
                $tunnelProcess = Start-Process -FilePath $cfExe `
                    -ArgumentList "tunnel --url http://localhost:8000" `
                    -WindowStyle Hidden `
                    -PassThru `
                    -RedirectStandardOutput "$PSScriptRoot\cloudflared_out.log" `
                    -RedirectStandardError "$PSScriptRoot\cloudflared.log"

                # Spinner for Tunnel connection
                Write-Host -NoNewline " [ ] Connecting secure Cloudflare Tunnel (Attempt $retryCount/$maxRetries)..." -ForegroundColor Yellow
                $counter = 0
                while (-not $url -and $counter -lt 15) {
                    for ($j = 0; $j -lt 5; $j++) {
                        $char = $spinner[$j % 4]
                        Write-Host -NoNewline "`r [$char] Connecting secure Cloudflare Tunnel (Attempt $retryCount/$maxRetries)..." -ForegroundColor Yellow
                        Start-Sleep -Milliseconds 200
                    }
                    $counter++
                    
                    if (Test-Path "$PSScriptRoot\cloudflared.log") {
                        $logContent = Get-Content "$PSScriptRoot\cloudflared.log" -ErrorAction SilentlyContinue
                        $urlLine = $logContent | Select-String -Pattern "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" | Where-Object { $_.Line -notlike "*api.trycloudflare.com*" } | Select-Object -First 1
                        if ($urlLine) {
                            $url = [regex]::match($urlLine.Line, "https://(?!api\.)[a-zA-Z0-9\-]+\.trycloudflare\.com").Value
                        }
                    }
                    
                    if ($tunnelProcess.HasExited) {
                        break
                    }
                }
                
                if (-not $url -and -not $tunnelProcess.HasExited) {
                    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
                }
            }

            if (-not $url) {
                Write-Host "`r [x] Tunnel failed to start after $maxRetries attempts. Check cloudflared.log." -ForegroundColor Red
                Read-Host "Press Enter to exit..."
                exit 1
            }
            Write-Host "`r [v] Secure Cloudflare Tunnel established!" -ForegroundColor Green
            Write-Host ""
            Start-Sleep -Seconds 1
        }

        if ($url -notlike "http*") {
            $url = "https://$url"
        }

        Clear-Host
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host "          WEDDING FACE RECOGNITION SYSTEM          " -ForegroundColor White -BackgroundColor Blue
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  SUCCESS: Your Face Recognition system is live online!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Public Link (Cloudflare): " -NoNewline -ForegroundColor White
        Write-Host $url -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Tip: Share this URL with your wedding guests." -ForegroundColor Gray
        Write-Host "       They can use their phones to scan faces!" -ForegroundColor Gray
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host " Press [CTRL + C] in this window to stop everything" -ForegroundColor DarkGray
        Write-Host "==================================================" -ForegroundColor Cyan
    }
    else {
        # Ngrok Tunnel Mode
        $ngrokDomainFile = "$PSScriptRoot\ngrok-domain.txt"
        $ngrokArgs = "http 8000"
        
        if (Test-Path $ngrokDomainFile) {
            $ngrokDomain = (Get-Content $ngrokDomainFile -ErrorAction SilentlyContinue).Trim()
            $ngrokArgs = "http 8000 --domain=$ngrokDomain"
        }
        
        # Start Ngrok
        $tunnelProcess = Start-Process -FilePath $ngrokExe `
            -ArgumentList $ngrokArgs `
            -WindowStyle Hidden `
            -PassThru
            
        # Spinner for connection and fetch URL from Local API
        $url = $null
        $counter = 0
        Write-Host -NoNewline " [ ] Connecting secure Ngrok Tunnel..." -ForegroundColor Yellow
        while (-not $url -and $counter -lt 15) {
            for ($j = 0; $j -lt 5; $j++) {
                $char = $spinner[$j % 4]
                Write-Host -NoNewline "`r [$char] Connecting secure Ngrok Tunnel..." -ForegroundColor Yellow
                Start-Sleep -Milliseconds 200
            }
            $counter++
            
            # Query local API
            $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
            if ($tunnels -and $tunnels.tunnels) {
                $url = $tunnels.tunnels[0].public_url
            }
            
            if ($tunnelProcess.HasExited) {
                break
            }
        }
        
        if (-not $url) {
            Write-Host "`r [x] Ngrok Tunnel failed to start. Make sure you set your token in ngrok-token.txt!" -ForegroundColor Red
            Read-Host "Press Enter to exit..."
            exit 1
        }
        
        Write-Host "`r [v] Secure Ngrok Tunnel established!" -ForegroundColor Green
        Write-Host ""
        Start-Sleep -Seconds 1
        
        Clear-Host
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host "          WEDDING FACE RECOGNITION SYSTEM          " -ForegroundColor White -BackgroundColor Blue
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  SUCCESS: Your Face Recognition system is live online!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Public Link (Ngrok): " -NoNewline -ForegroundColor White
        Write-Host $url -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Tip: Share this URL with your wedding guests." -ForegroundColor Gray
        Write-Host "       They can use their phones to scan faces!" -ForegroundColor Gray
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host " Press [CTRL + C] in this window to stop everything" -ForegroundColor DarkGray
        Write-Host "==================================================" -ForegroundColor Cyan
    }

    # Keep script running and monitoring child processes
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backendProcess.HasExited) {
            Write-Host ""
            Write-Host "[WARNING] Backend server has stopped!" -ForegroundColor Red
            break
        }
        if (($choice -eq "2" -or $choice -eq "3") -and $tunnelProcess.HasExited) {
            Write-Host ""
            if ($choice -eq "2") {
                Write-Host "[WARNING] Cloudflare Tunnel has stopped!" -ForegroundColor Red
            } else {
                Write-Host "[WARNING] Ngrok Tunnel has stopped!" -ForegroundColor Red
            }
            break
        }
    }

} finally {
    # 6. Clean up processes on exit
    Write-Host ""
    Write-Host "[INFO] Stopping backend server..." -ForegroundColor DarkGray
    
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (($choice -eq "2" -or $choice -eq "3") -and $tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "[SUCCESS] Stopped successfully." -ForegroundColor Green
    Start-Sleep -Seconds 1
}
