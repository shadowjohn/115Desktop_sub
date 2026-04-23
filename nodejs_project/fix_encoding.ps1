$content = "@echo off`r`nchcp 950 >nul`r`necho [INFO] 正在啟動桌面字幕...`r`necho.`r`nnpm start`r`nif errorlevel 1 (`r`n    echo.`r`n    echo [ERROR] 啟動失敗。`r`n    pause`r`n)"
[IO.File]::WriteAllText('run.bat', $content, [System.Text.Encoding]::GetEncoding(950))
