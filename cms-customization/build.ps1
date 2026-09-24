$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $repoRoot '.cms-build'
$pinned = '00c44da6b919d15e559f51ca54cd96237ae556ee'
$patch = Join-Path $PSScriptRoot 'publication.patch'

function Invoke-Checked {
  param([Parameter(ValueFromRemainingArguments)] [string[]] $Command)
  & rtk proxy @Command
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $($Command[0])" }
}

if (!(Test-Path -LiteralPath $source)) {
  Invoke-Checked git clone --depth 1 --branch v0.218.0 https://github.com/sveltia/sveltia-cms.git $source
}
Push-Location $source
try {
  $revision = & rtk proxy git rev-parse HEAD
  if ($revision.Trim() -ne $pinned) { throw 'Unexpected upstream revision; refusing to patch.' }
  & rtk proxy git apply --reverse --check $patch
  if ($LASTEXITCODE -ne 0) {
    Invoke-Checked git apply --check $patch
    Invoke-Checked git apply $patch
  }
  Invoke-Checked pnpm install --frozen-lockfile
  Invoke-Checked pnpm exec vitest run --project unit src/lib/services/contents/entry/publication.test.js src/lib/services/contents/draft/save/conflict.test.js src/lib/services/contents/draft/create/index.test.js src/lib/components/contents/list/article-reader.test.js
  Invoke-Checked pnpm build
  $vendor = Join-Path $repoRoot 'admin/vendor'
  New-Item -ItemType Directory -Force -Path $vendor | Out-Null
  Copy-Item -LiteralPath 'package/dist/sveltia-cms.js' -Destination $vendor
  Copy-Item -LiteralPath 'LICENSE.txt' -Destination (Join-Path $vendor 'LICENSE.txt')
  Copy-Item -LiteralPath 'package/dist/chunks' -Destination $vendor -Recurse -Force
} finally {
  Pop-Location
}
