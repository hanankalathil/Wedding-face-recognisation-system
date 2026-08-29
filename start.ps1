# PowerShell script to run the Face Recognition System (Cyberpunk / Hacker UI)

# Clean up logs on start
Remove-Item -Path "backend_out.log", "backend_err.log", "cloudflared_out.log", "cloudflared.log" -ErrorAction SilentlyContinue

$e = [char]27
$C_CYAN = "$e[1;36m"
$C_GREEN = "$e[1;32m"
$C_MAGENTA = "$e[1;35m"
$C_YELLOW = "$e[1;33m"
$C_WHITE = "$e[1;37m"
$C_DARK = "$e[1;30m"
$C_RESET = "$e[0m"
$C_RED = "$e[1;31m"

function Draw-CyberBanner {
    Clear-Host
    Write-Host "$C_GREEN  _   _    _    ____ _  _____ _   _  ____ $C_RESET"
    Write-Host "$C_GREEN | | | |  / \  / ___| |/ / ____| \ | |/ ___|$C_RESET"
    Write-Host "$C_CYAN | |_| | / _ \| |   | ' /|  _| |  \| | |  _ $C_RESET"
    Write-Host "$C_CYAN |  _  |/ ___ \ |___| . \| |___| |\  | |_| |$C_RESET"
    Write-Host "$C_MAGENTA |_| |_/_/   \_\____|_|\_\_____|_| \_|\____|$C_RESET"
    Write-Host "$C_YELLOW  >>> N E U R A L   F A C E   R E C O N   S Y S T E M <<< $C_RESET"
    Write-Host "$C_CYAN+====================================================================+$C_RESET"
    Write-Host ""
}

# Initial Storage System Prompt on Launch
Draw-CyberBanner
Write-Host "$C_GREEN+--[ STEP 1: SELECT STORAGE SYSTEM ]-----------------------------------+$C_RESET"
Write-Host "$C_GREEN|                                                                      |$C_RESET"
Write-Host "$C_GREEN|  $C_YELLOW[01] LOCAL DISK MODE      $C_WHITE-- Fast Local Windows Storage (Offline) $C_GREEN|$C_RESET"
Write-Host "$C_GREEN|  $C_GREEN[02] SUPABASE CLOUD MODE  $C_WHITE-- Cloud Database & Bucket Sync       $C_GREEN|$C_RESET"
Write-Host "$C_GREEN|                                                                      |$C_RESET"
Write-Host "$C_GREEN+----------------------------------------------------------------------+$C_RESET"
Write-Host ""
$initialStorageChoice = Read-Host " $C_CYAN> SELECT STORAGE MODE CHOICE [1 or 2] (default=1)$C_RESET "
if ($initialStorageChoice -eq "2") {
    $newMode = "supabase"
} else {
    $newMode = "local"
}

$envFile = "$PSScriptRoot\.env"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile | Where-Object { $_ -notmatch "^STORAGE_MODE=" }
    $lines += "STORAGE_MODE=$newMode"
    Set-Content -Path $envFile -Value $lines
} else {
    Set-Content -Path $envFile -Value "STORAGE_MODE=$newMode"
}

Write-Host ""
Write-Host "  $C_GREEN[OK] STORAGE SYSTEM SET TO: $($newMode.ToUpper())$C_RESET"
Start-Sleep -Seconds 1

$mainLoop = $true

while ($mainLoop) {
    $activeStorageMode = "LOCAL"
    if (Test-Path $envFile) {
        $modeLine = Get-Content $envFile | Where-Object { $_ -match "^STORAGE_MODE=" }
        if ($modeLine -match "supabase") { $activeStorageMode = "SUPABASE" }
    }

    Draw-CyberBanner
    Write-Host "$C_YELLOW  >>> ACTIVE STORAGE MODE: $activeStorageMode <<< $C_RESET"
    Write-Host ""

    Write-Host "$C_GREEN+--[ SELECT DEPLOYMENT MODE ]------------------------------------------+$C_RESET"
    Write-Host "$C_GREEN|                                                                      |$C_RESET"
    Write-Host "$C_GREEN|  $C_YELLOW[01] GUEST PORTAL         $C_WHITE-- Offline Local Recon (http://localhost:8000)  $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_GREEN[02] CLOUDFLARE MATRIX    $C_WHITE-- Encrypted Global Tunnel (*.trycloudflare)  $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_MAGENTA[03] NGROK CYBERPORT      $C_WHITE-- Secure Subdomain Tunnel (*.ngrok-free.app)  $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_CYAN[04] ADMIN DASHBOARD      $C_WHITE-- Full Control Center (http://localhost:8000/admin)$C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_YELLOW[05] WI-FI BROADCAST      $C_WHITE-- Local Network Share (http://<LAN_IP>:8000) $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_MAGENTA[06] SYSTEM MAINTENANCE    $C_WHITE-- Vector DB Sync and Avatar Crop Utility    $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_CYAN[07] TOGGLE STORAGE MODE  $C_WHITE-- Switch between LOCAL and SUPABASE storage $C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|  $C_RED[08] EXIT SYSTEM         $C_WHITE-- Close Active Processes and Shutdown Matrix$C_GREEN|$C_RESET"
    Write-Host "$C_GREEN|                                                                      |$C_RESET"
    Write-Host "$C_GREEN+----------------------------------------------------------------------+$C_RESET"
    Write-Host ""

    $choice = Read-Host " $C_CYAN> ENTER MATRIX MODE CHOICE [1 - 8] (default=1)$C_RESET "
    if ($choice -eq "8") {
        Write-Host "$C_YELLOW[!] SHUTTING DOWN RECON MATRIX SYSTEM...$C_RESET"
        break
    }
    if ($choice -eq "7") {
        Write-Host ""
        Write-Host "  $C_CYAN+--[ SELECT STORAGE SYSTEM ]------------------------------------+$C_RESET"
        Write-Host "  $C_CYAN|                                                               |$C_RESET"
        Write-Host "  $C_CYAN|  $C_YELLOW[1] LOCAL DISK MODE     $C_WHITE-- Fast Local Windows Storage (Offline) $C_CYAN|$C_RESET"
        Write-Host "  $C_CYAN|  $C_GREEN[2] SUPABASE CLOUD MODE $C_WHITE-- Cloud Database & Bucket Sync       $C_CYAN|$C_RESET"
        Write-Host "  $C_CYAN|                                                               |$C_RESET"
        Write-Host "  $C_CYAN+----------------------------------------------------------------+$C_RESET"
        Write-Host ""
        $modeChoice = Read-Host "  $C_YELLOW> SELECT STORAGE SYSTEM CHOICE [1 or 2] (default=1)$C_RESET "
        if ($modeChoice -eq "2") {
            $newMode = "supabase"
        } else {
            $newMode = "local"
        }
        if (Test-Path $envFile) {
            $lines = Get-Content $envFile | Where-Object { $_ -notmatch "^STORAGE_MODE=" }
            $lines += "STORAGE_MODE=$newMode"
            Set-Content -Path $envFile -Value $lines
        } else {
            Set-Content -Path $envFile -Value "STORAGE_MODE=$newMode"
        }
        Write-Host ""
        Write-Host "  $C_GREEN[OK] STORAGE SYSTEM SET TO: $($newMode.ToUpper())$C_RESET"
        Start-Sleep -Seconds 2
        continue
    }
    if ($choice -notmatch '^[1-8]$') {
        $choice = "1"
    }

    Draw-CyberBanner

    Write-Host "$C_CYAN+--[ SYSTEM INITIALIZATION LOGS ]-------------------------------------+ $C_RESET"

    # 1. Check for port 8000 and kill any process occupying it
    $port8000Proc = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($port8000Proc) {
        Write-Host "  $C_YELLOW[!] PORT 8000 OCCUPIED -- RELEASING RECON SOCKET...$C_RESET"
        foreach ($conn in $port8000Proc) {
            if ($conn.OwningProcess -gt 0) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
    }

    # 2. Dependency Checking (cloudflared or ngrok)
    $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cfCmd) {
        $cfExe = $cfCmd.Source
    } else {
        $cfExe = "$PSScriptRoot\cloudflared.exe"
    }
    
    $ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($ngrokCmd) {
        $ngrokExe = $ngrokCmd.Source
    } else {
        $ngrokExe = "$PSScriptRoot\ngrok.exe"
    }

    if ($choice -eq "2") {
        if (-not (Test-Path $cfExe)) {
            Write-Host "  $C_YELLOW[!] CLOUDFLARED CLIENT MISSING -- DOWNLOADING NEURAL BRIDGE...$C_RESET"
            curl.exe -s -L -o $cfExe "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
            if (-not (Test-Path $cfExe) -or (Get-Item $cfExe).Length -lt 10MB) {
                Write-Host "  $C_RED[X] DOWNLOAD FAILED. MANUAL INTERVENTION REQUIRED.$C_RESET"
                Read-Host "Press Enter to return to menu..."
                continue
            }
            Write-Host "  $C_GREEN[OK] CLOUDFLARED CLIENT INSTALLED.$C_RESET"
        }
    }
    elseif ($choice -eq "3") {
        if (-not (Test-Path $ngrokExe)) {
            Write-Host "  $C_YELLOW[!] NGROK CLIENT MISSING -- DOWNLOADING CYBER BRIDGE...$C_RESET"
            $zipPath = "$PSScriptRoot\ngrok.zip"
            curl.exe -s -L -o $zipPath "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
            if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -lt 5MB) {
                Write-Host "  $C_RED[X] NGROK DOWNLOAD FAILED.$C_RESET"
                Read-Host "Press Enter to return to menu..."
                continue
            }
            Expand-Archive -Path $zipPath -DestinationPath $PSScriptRoot -Force
            Remove-Item -Path $zipPath -ErrorAction SilentlyContinue
            Write-Host "  $C_GREEN[OK] NGROK EXTRACTED.$C_RESET"
        }
        
        $ngrokTokenFile = "$PSScriptRoot\ngrok-token.txt"
        if (Test-Path $ngrokTokenFile) {
            $ngrokToken = (Get-Content $ngrokTokenFile -ErrorAction SilentlyContinue).Trim()
            Write-Host "  $C_YELLOW[+] APPLYING NGROK AUTH KEY...$C_RESET"
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
            -WorkingDirectory "$PSScriptRoot" `
            -WindowStyle Hidden `
            -PassThru `
            -RedirectStandardOutput "$PSScriptRoot\backend_out.log" `
            -RedirectStandardError "$PSScriptRoot\backend_err.log"
        
        # Spinner animation
        Write-Host -NoNewline "  $C_YELLOW[....] MOUNTING ARCFACE RECOGNITION ENGINE...$C_RESET"
        for ($i = 0; $i -lt 12; $i++) {
            Write-Host -NoNewline "`r  $C_YELLOW[>>>>] MOUNTING ARCFACE RECOGNITION ENGINE...$C_RESET"
            Start-Sleep -Milliseconds 200
        }
        
        if ($backendProcess.HasExited) {
            Write-Host "`r  $C_RED[X] BACKEND ENGINE FAILED TO BOOT. CHECK backend_err.log.$C_RESET"
            Read-Host "Press Enter to return to menu..."
            continue
        }
        Write-Host "`r  $C_GREEN[OK] RECOGNITION BACKEND ONLINE // PORT 8000 ACTIVATED$C_RESET"
        Write-Host "$C_CYAN+----------------------------------------------------------------------+ $C_RESET"
        Write-Host ""

        # 4. Execute Selected Mode UI
        if ($choice -eq "1") {
            Write-Host "$C_YELLOW[+] LAUNCHING LOCAL GUEST RECON PORTAL...$C_RESET"
            Start-Process "http://localhost:8000/index.html"
            Start-Sleep -Seconds 1
            
            Draw-CyberBanner
            Write-Host "$C_GREEN+====================================================================+$C_RESET"
            Write-Host "$C_GREEN|                    CYBER RECON RECEPTOR ONLINE                     |$C_RESET"
            Write-Host "$C_GREEN+====================================================================+$C_RESET"
            Write-Host "$C_GREEN|  $C_WHITE DEPLOYMENT MODE : $C_YELLOW LOCAL OFFLINE RECON$C_GREEN                             |$C_RESET"
            Write-Host "$C_GREEN|  $C_WHITE ACCESS ENDPOINT  : $C_CYAN http://localhost:8000$C_GREEN                         |$C_RESET"
            Write-Host "$C_GREEN|  $C_WHITE SYSTEM LOGS     : $C_DARK backend_out.log // backend_err.log$C_GREEN             |$C_RESET"
            Write-Host "$C_GREEN+====================================================================+$C_RESET"
            Write-Host "$C_GREEN|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_GREEN           |$C_RESET"
            Write-Host "$C_GREEN+====================================================================+$C_RESET"
        }
        elseif ($choice -eq "2") {
            $tokenFile = "$PSScriptRoot\cloudflare-token.txt"
            $domainFile = "$PSScriptRoot\cloudflare-domain.txt"
            $hasToken = Test-Path $tokenFile
            $url = $null

            if ($hasToken) {
                $token = (Get-Content $tokenFile -ErrorAction SilentlyContinue).Trim()
                $customDomain = "Configured in Cloudflare Dashboard"
                if (Test-Path $domainFile) {
                    $customDomain = (Get-Content $domainFile -ErrorAction SilentlyContinue).Trim()
                }
                $tunnelProcess = Start-Process -FilePath $cfExe `
                    -ArgumentList "tunnel run --token $token" `
                    -WindowStyle Hidden `
                    -PassThru `
                    -RedirectStandardOutput "$PSScriptRoot\cloudflared_out.log" `
                    -RedirectStandardError "$PSScriptRoot\cloudflared.log"
                
                Write-Host -NoNewline "$C_YELLOW[....] ESTABLISHING PERMANENT CLOUDFLARE NEURAL LINK...$C_RESET"
                Start-Sleep -Seconds 3
                if ($tunnelProcess.HasExited) {
                    Write-Host "`r$C_RED[X] CLOUDFLARE PERMANENT TUNNEL FAILED.$C_RESET"
                    Read-Host "Press Enter to return to menu..."
                    continue
                }
                $url = $customDomain
            }
            else {
                # Stop any existing cloudflared processes
                Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

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

                    Write-Host -NoNewline "$C_YELLOW[....] CONSTRUCTING ENCRYPTED CLOUDFLARE TUNNEL (ATTEMPT $retryCount/$maxRetries)...$C_RESET"
                    $counter = 0
                    while (-not $url -and $counter -lt 50) {
                        Start-Sleep -Milliseconds 500
                        $counter++
                        foreach ($logFile in @("$PSScriptRoot\cloudflared.log", "$PSScriptRoot\cloudflared_out.log")) {
                            if (Test-Path $logFile) {
                                $logContent = Get-Content $logFile -ErrorAction SilentlyContinue
                                $urlLine = $logContent | Select-String -Pattern "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" | Where-Object { $_.Line -notlike "*api.trycloudflare.com*" } | Select-Object -First 1
                                if ($urlLine) {
                                    $url = [regex]::match($urlLine.Line, "https://(?!api\.)[a-zA-Z0-9\-]+\.trycloudflare\.com").Value
                                    break
                                }
                            }
                        }
                        if ($tunnelProcess.HasExited) { break }
                    }
                    if (-not $url -and -not $tunnelProcess.HasExited) {
                        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
                    }
                }

                if (-not $url) {
                    Write-Host ""
                    Write-Host "$C_RED[X] CLOUDFLARE TUNNEL FAILED TO SECURE PUBLIC ENDPOINT.$C_RESET"
                    Read-Host "Press Enter to return to menu..."
                    continue
                }
            }

            if ($url -notlike "http*") { $url = "https://$url" }

            Draw-CyberBanner
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|                    GLOBAL CLOUDFLARE MATRIX ONLINE                 |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE DEPLOYMENT MODE : $C_GREEN PUBLIC ENCRYPTED TUNNEL$C_CYAN                             |$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE LIVE PUBLIC LINK : $C_YELLOW $url$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE SHARE WITH GUESTS: Mobile camera scanning enabled globally!         |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_CYAN           |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
        }
        elseif ($choice -eq "3") {
            $ngrokDomainFile = "$PSScriptRoot\ngrok-domain.txt"
            $ngrokArgs = "http 8000"
            if (Test-Path $ngrokDomainFile) {
                $ngrokDomain = (Get-Content $ngrokDomainFile -ErrorAction SilentlyContinue).Trim()
                $ngrokArgs = "http 8000 --domain=$ngrokDomain"
            }
            
            $tunnelProcess = Start-Process -FilePath $ngrokExe -ArgumentList $ngrokArgs -WindowStyle Hidden -PassThru
            $url = $null
            $counter = 0
            Write-Host -NoNewline "$C_YELLOW[....] ESTABLISHING NGROK SECURE TUNNEL...$C_RESET"
            while (-not $url -and $counter -lt 15) {
                Start-Sleep -Milliseconds 500
                $counter++
                $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction SilentlyContinue
                if ($tunnels -and $tunnels.tunnels) {
                    $url = $tunnels.tunnels[0].public_url
                }
                if ($tunnelProcess.HasExited) { break }
            }

            if (-not $url) {
                Write-Host "`r$C_RED[X] NGROK TUNNEL FAILED. CHECK YOUR TOKEN IN ngrok-token.txt!$C_RESET"
                Read-Host "Press Enter to return to menu..."
                continue
            }

            Draw-CyberBanner
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|                    NGROK CYBERPORT ACTIVE                          |$C_RESET"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE DEPLOYMENT MODE : $C_MAGENTA NGROK SUBDOMAIN TUNNEL$C_MAGENTA                           |$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE LIVE PUBLIC LINK : $C_YELLOW $url$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE SHARE WITH GUESTS: Direct encrypted guest access online!          |$C_MAGENTA"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_MAGENTA           |$C_RESET"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
        }
        elseif ($choice -eq "4") {
            Write-Host "$C_CYAN[+] OPENING ADMIN CONTROL CENTER...$C_RESET"
            Start-Process "http://localhost:8000/archive/admin.html"
            Start-Sleep -Seconds 1
            
            Draw-CyberBanner
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|                    ADMIN DASHBOARD MATRIX ONLINE                   |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE ACCESS CONTROL  : $C_CYAN FULL ADMIN SYSTEM CONTROL$C_CYAN                       |$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE DASHBOARD LINK  : $C_YELLOW http://localhost:8000/archive/admin.html$C_CYAN       |$C_RESET"
            Write-Host "$C_CYAN|  $C_WHITE LOGS FILE       : $C_DARK backend_out.log // backend_err.log$C_CYAN             |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
            Write-Host "$C_CYAN|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_CYAN           |$C_RESET"
            Write-Host "$C_CYAN+====================================================================+$C_RESET"
        }
        elseif ($choice -eq "5") {
            $lanIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.254*" -and $_.IPAddress -notlike "127*" }).IPAddress | Select-Object -First 1
            if (-not $lanIP) { $lanIP = "localhost" }
            $wifiUrl = "http://${lanIP}:8000"
            
            Start-Process "http://localhost:8000"
            Start-Sleep -Seconds 1
            
            Draw-CyberBanner
            Write-Host "$C_YELLOW+====================================================================+$C_RESET"
            Write-Host "$C_YELLOW|                    WI-FI BROADCAST MATRIX ONLINE                   |$C_RESET"
            Write-Host "$C_YELLOW+====================================================================+$C_RESET"
            Write-Host "$C_YELLOW|  $C_WHITE LOCAL WI-FI LINK : $C_YELLOW $wifiUrl$C_RESET"
            Write-Host "$C_YELLOW|  $C_WHITE LOCALHOST LINK  : $C_CYAN http://localhost:8000$C_YELLOW                         |$C_RESET"
            Write-Host "$C_YELLOW|  $C_WHITE INSTRUCTIONS    : Connect phones to same Wi-Fi and open link above! |$C_RESET"
            Write-Host "$C_YELLOW+====================================================================+$C_RESET"
            Write-Host "$C_YELLOW|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_YELLOW           |$C_RESET"
            Write-Host "$C_YELLOW+====================================================================+$C_RESET"
        }
        else {
            Write-Host "$C_MAGENTA[+] EXECUTING VECTOR DATABASE SYNCHRONIZATION...$C_RESET"
            Start-Process "$PSScriptRoot\venv\Scripts\python.exe" -ArgumentList "-c ""import sys; sys.path.insert(0, 'backend'); from app.services.face_service import generate_avatars_for_all_persons; count=generate_avatars_for_all_persons(force=True); print(f'Successfully generated avatars for {count} person(s).')""" -Wait -NoNewWindow
            
            Draw-CyberBanner
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|                    SYSTEM MAINTENANCE COMPLETED                    |$C_RESET"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE STATUS          : $C_GREEN VECTOR DB AND AVATARS SYNCHRONIZED CLEANLY$C_MAGENTA   |$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE LOCAL URL       : $C_YELLOW http://localhost:8000$C_MAGENTA                         |$C_RESET"
            Write-Host "$C_MAGENTA|  $C_WHITE ADMIN URL       : $C_CYAN http://localhost:8000/archive/admin.html$C_MAGENTA          |$C_RESET"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
            Write-Host "$C_MAGENTA|  $C_YELLOW [ PRESS 'M' OR 'B' THEN ENTER TO RETURN TO MAIN MENU ]$C_MAGENTA           |$C_RESET"
            Write-Host "$C_MAGENTA+====================================================================+$C_RESET"
        }

        # Prompt input to return to menu or exit cleanly
        Write-Host ""
        $action = Read-Host " $C_CYAN> ENTER 'M' FOR MENU, OR 'Q' TO SHUTDOWN PORTAL$C_RESET "
        if ($action -match '^[qQ]$') {
            $mainLoop = $false
        }

    } finally {
        Write-Host ""
        Write-Host "$C_DARK[+] STOPPING ACTIVE MATRIX PROCESSES...$C_RESET"
        
        if ($backendProcess -and -not $backendProcess.HasExited) {
            Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
        }
        if (($choice -eq "2" -or $choice -eq "3") -and $tunnelProcess -and -not $tunnelProcess.HasExited) {
            Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
        }
        
        Write-Host "$C_GREEN[OK] PROCESSES CLEANED UP.$C_RESET"
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "$C_GREEN[OK] TERMINAL SYSTEM OFFLINE. MATRIX CLEAN.$C_RESET"
Start-Sleep -Seconds 1
