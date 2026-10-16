$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Popula um repositorio Maven local com os artefatos do engine Flutter, usando
# apenas o que ja existe na maquina (cache do Gradle + cache do Flutter SDK).
# Necessario porque o Gradle nao alcanca storage.googleapis.com nesta rede.
#
# Dois detalhes que nao podem ser simplificados:
#
# 1. Os .pom sao copiados do cache do Gradle, nunca gerados. O POM do
#    flutter_embedding_release declara as dependencias AndroidX do embedding;
#    um stub vazio faz o Gradle cair em versoes default antigas que nao estao
#    no cache.
#
# 2. O flutter.jar do cache do engine NAO e o artefato Maven de ABI: ele traz
#    as 437 classes io.flutter.* junto com lib/<abi>/libflutter.so. O artefato
#    real contem so o .so. Copiar o jar inteiro faz cada ABI carregar uma copia
#    das classes, gerando "Duplicate class io.flutter.*" no mergeDexRelease.
#    Por isso filtramos as entradas lib/ ao reempacotar.

$properties = @{}
Get-Content (Join-Path $PSScriptRoot "local.properties") | ForEach-Object {
    if ($_ -match "^([^=]+)=(.+)$") { $properties[$Matches[1].Trim()] = $Matches[2].Trim() }
}
$flutterSdk = $properties["flutter.sdk"]
if (-not $flutterSdk) { throw "flutter.sdk nao encontrado em local.properties" }

$commit  = "69c8c61792f04cc809dfef0c910414fb9afc06cd"
$version = "1.0.0-$commit"
$repoDir = Join-Path $PSScriptRoot "flutter-local-repo"
$engineDir = "$flutterSdk\bin\cache\artifacts\engine"
$gradleCache = "$env:USERPROFILE\.gradle\caches\modules-2\files-2.1\io.flutter"

# Mapeia cada artefato Maven para o diretorio do engine que contem seu flutter.jar.
# O embedding nao vem do precache, so do cache do Gradle.
$artifacts = [ordered]@{
    "flutter_embedding_release" = $null
    "arm64_v8a_release"         = "android-arm64-release"
    "armeabi_v7a_release"       = "android-arm-release"
    "x86_64_release"            = "android-x64-release"
}

function Copy-NativeLibsOnly {
    param($SourceJar, $DestJar)

    if (Test-Path $DestJar) { Remove-Item $DestJar -Force }
    $src = [System.IO.Compression.ZipFile]::OpenRead($SourceJar)
    try {
        $dest = [System.IO.Compression.ZipFile]::Open($DestJar, 'Create')
        try {
            $copied = 0
            foreach ($entry in $src.Entries) {
                if ($entry.FullName -notlike "lib/*") { continue }
                $newEntry = $dest.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Fastest)
                $inStream = $entry.Open()
                $outStream = $newEntry.Open()
                try { $inStream.CopyTo($outStream) } finally { $outStream.Dispose(); $inStream.Dispose() }
                $copied++
            }
        } finally { $dest.Dispose() }
    } finally { $src.Dispose() }
    return $copied
}

$failed = @()

foreach ($artifact in $artifacts.Keys) {
    $artifactDir = Join-Path $repoDir "io\flutter\$artifact\$version"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

    $sourcePom = Get-ChildItem "$gradleCache\$artifact\$version" -Recurse -Filter "*.pom" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($sourcePom) {
        Copy-Item $sourcePom.FullName (Join-Path $artifactDir "$artifact-$version.pom") -Force
        Write-Host "[POM ] $artifact"
    } else {
        Write-Host "[FALHA] POM de $artifact nao esta no cache do Gradle"
        $failed += "$artifact (pom)"
    }

    $destJar = Join-Path $artifactDir "$artifact-$version.jar"
    $engineSubdir = $artifacts[$artifact]

    if ($engineSubdir) {
        $sourceJar = "$engineDir\$engineSubdir\flutter.jar"
        if (Test-Path $sourceJar) {
            $n = Copy-NativeLibsOnly -SourceJar $sourceJar -DestJar $destJar
            $size = [math]::Round((Get-Item $destJar).Length / 1MB, 1)
            Write-Host "[JAR ] $artifact ($n lib nativa, $size MB)"
        } else {
            Write-Host "[FALHA] $sourceJar nao encontrado"
            $failed += "$artifact (jar)"
        }
    } else {
        $sourceJar = (Get-ChildItem "$gradleCache\$artifact\$version" -Recurse -Filter "*.jar" -ErrorAction SilentlyContinue |
            Select-Object -First 1).FullName
        if ($sourceJar) {
            Copy-Item $sourceJar $destJar -Force
            $size = [math]::Round((Get-Item $destJar).Length / 1MB, 1)
            Write-Host "[JAR ] $artifact ($size MB, do cache do Gradle)"
        } else {
            Write-Host "[FALHA] JAR de $artifact nao esta no cache do Gradle"
            $failed += "$artifact (jar)"
        }
    }
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "Faltando: $($failed -join ', ')"
    Write-Host "Rode 'flutter precache --android' e tente de novo."
    exit 1
}

Write-Host "Repositorio local pronto em: $repoDir"
Write-Host "Agora rode: flutter clean; flutter build apk --release"
