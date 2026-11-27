$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
$src = Join-Path $root '_sqlcipher'
if (!(Test-Path "$src/Makefile.msc")) { throw 'Pinned SQLCipher source missing' }
if ((git -C $src rev-parse HEAD).Trim() -ne '355d4db92d3404e71faa8088d071a71d767807f4') { throw 'SQLCipher source mismatch' }
$openssl = Join-Path $root '_vcpkg/installed/x64-windows-static'
$env:NOCTURNE_OPENSSL_DIR = $openssl.Replace('\','/')
if (!(Test-Path "$openssl/lib/libcrypto.lib")) { throw 'Static OpenSSL missing' }
Push-Location $src
try {
 nmake /f Makefile.msc sqlite3.c NO_TCL=1 "OPT_FEATURE_FLAGS=-DSQLITE_HAS_CODEC=1 -DSQLITE_EXTRA_INIT=sqlcipher_extra_init -DSQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown -DSQLITE_TEMP_STORE=3 -DSQLCIPHER_CRYPTO_OPENSSL=1"
 if ($LASTEXITCODE -ne 0) { throw 'SQLCipher amalgamation failed' }
} finally { Pop-Location }
New-Item -Force -ItemType Directory "$root/native/vendor" | Out-Null
Copy-Item "$src/sqlite3.c","$src/sqlite3.h" "$root/native/vendor/"
New-Item -Force -ItemType Directory "$root/native/notices" | Out-Null
Copy-Item "$src/LICENSE.md" "$root/native/notices/SQLCipher-LICENSE.txt"
Copy-Item "$openssl/share/openssl/copyright" "$root/native/notices/OpenSSL-LICENSE.txt"
Push-Location $root
try {
 # Configure first: Electron/Node headers can supply per-configuration CRT defaults.
 & npx --no-install node-gyp clean --directory native
 if ($LASTEXITCODE -ne 0) { throw 'SQLCipher Node-API clean failed' }
 & npx --no-install node-gyp configure --directory native --target=45.5.0 --dist-url=https://electronjs.org/headers --arch=x64 --release
 if ($LASTEXITCODE -ne 0) { throw 'SQLCipher Node-API configure failed' }
 $project = "$root/native/build/nocturne_cipher.vcxproj"
 $runtime = @(Select-Xml -Path $project -XPath "//*[local-name()='ItemDefinitionGroup' and contains(@Condition,'Release|x64')]/*[local-name()='ClCompile']/*[local-name()='RuntimeLibrary']" | ForEach-Object { $_.Node.InnerText })
 Write-Host "SQLCipher Release x64 CRT: $($runtime -join ', ')"
 if ($runtime.Count -ne 1 -or $runtime[0] -ne 'MultiThreaded') { throw 'Expected static Release CRT (/MT) matching OpenSSL x64-windows-static' }
 & npx --no-install node-gyp build --directory native --arch=x64 --release
 if ($LASTEXITCODE -ne 0) { throw 'SQLCipher Node-API build failed' }
} finally { Pop-Location }
if (!(Test-Path "$root/native/build/Release/nocturne_cipher.node")) { throw 'SQLCipher native addon missing' }
# Verify that the addon does not import a separate OpenSSL DLL.
$imports = & dumpbin /dependents "$root/native/build/Release/nocturne_cipher.node"
if ($LASTEXITCODE -ne 0) { throw 'SQLCipher native dependency inspection failed' }
$imports | Write-Host
if (($imports -join "`n") -match '(?i)\b(libcrypto|libssl)[^\s]*\.dll\b') { throw 'Unexpected dynamic OpenSSL dependency' }
