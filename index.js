/**
 * Host half of the 平安京管家 / Onmyoji OAS DSH bundle.
 *
 * Standalone by design:
 *  - It never hardcodes a checkout path. The console service is reached through
 *    a configurable URL (default http://127.0.0.1:8787), so the plugin can be
 *    installed from GitHub on any machine.
 *  - Starting/stopping the console is optional. It only works when a console
 *    checkout is configured (config, env, or a neighbouring checkout); without
 *    one the page connects to an already running console and hides the controls.
 *
 * Configuration (first match wins):
 *   ~/.dsh/onmyoji-oas.json   { "consoleUrl": "...", "root": "...", "oasRoot": "...", "baselineDir": "..." }
 *   ONMYOJI_CONSOLE_URL / ONMYOJI_ROOT / ONMYOJI_OAS_ROOT / ONMYOJI_BASELINE_DIR
 *   the row's `config` object in the profile patch
 *
 * Routes:
 *   GET/POST /onmyoji/api/*       -> <consoleUrl>/api/*
 *   GET      /onmyoji/backend/status
 *   POST     /onmyoji/backend/start
 *   POST     /onmyoji/backend/stop
 *   GET      /onmyoji/baseline/status
 *   POST     /onmyoji/baseline/create
 *   POST     /onmyoji/baseline/restore
 */
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  chmodSync,
  closeSync,
  fstatSync,
  readSync,
  mkdtempSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { get as httpGet, request as httpRequest } from 'node:http'
import { get as httpsGet, request as httpsRequest } from 'node:https'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { createConnection } from 'node:net'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const ROUTE_PREFIX = '/onmyoji'
const CONFIG_PATH = join(homedir(), '.dsh', 'onmyoji-oas.json')
const DEFAULT_CONSOLE_URL = 'http://127.0.0.1:8787'
const DEFAULT_OAS_MIRROR = 'https://github.com/githubdadada/OnmyojiAutoScript.git'
const DEFAULT_BACKEND_DIR = join(homedir(), '.dsh', 'onmyoji-oas', 'backend')
const DEFAULT_CONSOLE_BUNDLE = 'https://github.com/githubdadada/onmyoji-backend/releases/latest/download/console-backend-{platform}.tar.gz'
const DEFAULT_BASELINE_DIR = join(homedir(), '.dsh', 'onmyoji-oas', 'baselines')
const CORE_BUILDS = { 'darwin-arm64': { version: '1.5.0', sha256: 'db5a33ca70e05ccbe7eb1336514a65b6f48d083fd3c45d130f437bab738c1587' } }
const installStates = new Map()
const DEFAULT_LOCAL_LLM_URL = 'https://github.com/githubdadada/onmyoji-backend/releases/download/local-llm-v1.0.0/local-llm-{platform}.tar.gz'
const MODULE_DEFS = [
  {
    id: 'local-llm',
    name: '本地 LLM 运行时',
    version: '1.0.0',
    requiresCore: '1.5.0',
    description: 'torch / transformers / accelerate 等本地 LLM 依赖；模型文件需单独放置。',
    urlTemplate: DEFAULT_LOCAL_LLM_URL,
    platforms: {
      'darwin-arm64': { size: 164294411, sha256: '9c61384bd903a00caafb9f9e9ee2005e2c56bc6a041969d4544d8d41f9cfc21b' },
    },
  },
]
const moduleStates = new Map()
const runtimeOperations = new Set()
const NO_ROOT_MESSAGE = `未找到 OAS 控制台目录（需要 start.sh 与 web/server.py）。请先启动控制台，或在 ${CONFIG_PATH} 中配置 root。`

function readConfigFile() {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeConsoleUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url
  } catch {
    return undefined
  }
}

/** A console checkout: an explicit path plus the markers this bundle needs. */
function findRoot(explicit) {
  const candidates = [
    explicit,
    process.env.ONMYOJI_ROOT,
    resolve(PLUGIN_DIR, '../..'),
    resolve(PLUGIN_DIR, '..'),
    process.cwd(),
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const dir = resolve(String(candidate))
    if (existsSync(join(dir, 'start.sh')) && existsSync(join(dir, 'web', 'server.py'))) return dir
  }
  return undefined
}

/** The OAS git checkout inside (or beside) the console checkout. */
function findOasRoot(explicit, consoleRoot, file) {
  const candidates = [file.oasRoot, process.env.ONMYOJI_OAS_ROOT, explicit]
  if (consoleRoot) {
    candidates.push(join(consoleRoot, 'OAS'))
    candidates.push(consoleRoot)
  }
  for (const candidate of candidates) {
    if (!candidate) continue
    const dir = resolve(String(candidate))
    if (existsSync(join(dir, '.git'))) return dir
    if (existsSync(join(dir, 'OAS', '.git'))) return join(dir, 'OAS')
  }
  return undefined
}

function resolveSettings(rowConfig) {
  const file = readConfigFile()
  const consoleUrl = normalizeConsoleUrl(
    file.consoleUrl
      || process.env.ONMYOJI_CONSOLE_URL
      || rowConfig?.consoleUrl
      || DEFAULT_CONSOLE_URL,
  ) || normalizeConsoleUrl(DEFAULT_CONSOLE_URL)
  const basePath = consoleUrl.pathname.replace(/\/+$/, '')
  const consoleHref = `${consoleUrl.origin}${basePath}`
  const port = Number(consoleUrl.port || (consoleUrl.protocol === 'https:' ? 443 : 80))
  const root = findRoot(file.root || process.env.ONMYOJI_ROOT || rowConfig?.root)
  const existingOas = findOasRoot(rowConfig?.oasRoot, root, file)
  const oasRoot = existingOas
    || (root ? join(root, 'OAS') : join(homedir(), '.dsh', 'onmyoji-oas', 'OAS'))
  const oasMirrorUrl = String(
    file.oasMirrorUrl
      || process.env.ONMYOJI_OAS_MIRROR
      || rowConfig?.oasMirrorUrl
      || DEFAULT_OAS_MIRROR,
  ).trim()
  const oasBranch = String(
    file.oasBranch
      || process.env.ONMYOJI_OAS_BRANCH
      || rowConfig?.oasBranch
      || 'dev',
  ).trim() || 'dev'
  const baselineDir = resolve(
    file.baselineDir
      || process.env.ONMYOJI_BASELINE_DIR
      || rowConfig?.baselineDir
      || DEFAULT_BASELINE_DIR,
  )
  const backendDir = resolve(
    file.backendDir
      || process.env.ONMYOJI_BACKEND_DIR
      || rowConfig?.backendDir
      || DEFAULT_BACKEND_DIR,
  )
  const consoleBundleUrl = String(
    file.consoleBundleUrl
      || process.env.ONMYOJI_CONSOLE_BUNDLE
      || rowConfig?.consoleBundleUrl
      || DEFAULT_CONSOLE_BUNDLE,
  ).trim().replace(/\{platform\}/g, `${process.platform}-${process.arch}`)
  const localLlmUrl = String(
    file.localLlmUrl
      || process.env.ONMYOJI_LOCAL_LLM_URL
      || rowConfig?.localLlmUrl
      || DEFAULT_LOCAL_LLM_URL,
  ).trim().replace(/\{platform\}/g, `${process.platform}-${process.arch}`)
  return {
    consoleUrl, basePath, consoleHref, port, root,
    oasRoot, oasMirrorUrl, oasBranch, baselineDir,
    backendDir, consoleBundleUrl, localLlmUrl,
    consoleBundleSha256: String(file.consoleBundleSha256 || process.env.ONMYOJI_CONSOLE_SHA256 || rowConfig?.consoleBundleSha256 || CORE_BUILDS[`${process.platform}-${process.arch}`]?.sha256 || ''),
    configPath: CONFIG_PATH,
  }
}

function requestFor(protocol) {
  return protocol === 'https:' ? httpsRequest : httpRequest
}

function probeHealth(settings, timeoutMs = 1200) {
  return new Promise((resolvePromise) => {
    let healthUrl
    try {
      healthUrl = new URL(settings.consoleHref + '/api/health')
    } catch {
      resolvePromise({ ok: false, error: 'invalid console URL' })
      return
    }
    const requester = settings.consoleUrl.protocol === 'https:' ? httpsGet : httpGet
    const req = requester(healthUrl, { timeout: timeoutMs }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(body) } catch { parsed = undefined }
        resolvePromise({ ok: res.statusCode === 200 && parsed?.ok === true, status: res.statusCode, health: parsed })
      })
    })
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    req.on('error', (error) => resolvePromise({ ok: false, error: error.message }))
  })
}

function sendJSON(res, status, value) {
  if (res.headersSent) {
    res.end()
    return
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function runScript(root, args, port, timeoutMs = 165000) {
  return new Promise((resolvePromise) => {
    const script = process.platform === 'win32' ? 'bash' : '/bin/bash'
    let settled = false
    let timer
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise(result)
    }
    const child = spawn(script, [join(root, 'start.sh'), ...args], {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', (error) => finish({ ok: false, message: error.message }))
    child.on('exit', (code, signal) => finish({ ok: code === 0, code, signal }))
    child.unref()
    timer = setTimeout(() => finish({ ok: false, message: '启动脚本执行超时' }), timeoutMs)
  })
}

async function waitHealthy(settings, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const health = await probeHealth(settings)
    if (health.ok) return true
    await new Promise((done) => setTimeout(done, 600))
  }
  return false
}

/** Reverse proxy for every console REST call made by the plugin page. */
function proxyRequest(req, res, settings) {
  let target = '/'
  try {
    const url = new URL(req.url ?? '/', 'http://local')
    target = settings.basePath + url.pathname.slice(ROUTE_PREFIX.length) + url.search
  } catch {
    sendJSON(res, 400, { ok: false, message: '请求路径无效' })
    return
  }

  const headers = Object.fromEntries(['accept', 'accept-language', 'content-type', 'content-length', 'cache-control'].filter((key) => req.headers[key] !== undefined).map((key) => [key, req.headers[key]]))

  const requester = requestFor(settings.consoleUrl.protocol)
  const upstream = requester({
    protocol: settings.consoleUrl.protocol,
    hostname: settings.consoleUrl.hostname,
    port: settings.consoleUrl.port || undefined,
    method: req.method,
    path: target,
    headers,
    timeout: 180000,
  }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers)
    up.pipe(res)
  })
  upstream.on('timeout', () => upstream.destroy(new Error('proxy timeout')))
  res.on('close', () => { if (!res.writableEnded) upstream.destroy() })
  upstream.on('error', (error) => {
    sendJSON(res, 502, {
      ok: false,
      offline: true,
      message: `本地服务未启动或不可达（${error.code || error.message}）`,
    })
  })
  req.on('aborted', () => upstream.destroy())
  req.pipe(upstream)
}

async function backendStatus(settings) {
  const health = await probeHealth(settings)
  return {
    ok: health.ok,
    running: health.ok,
    mode: health.health?.mode,
    url: settings.consoleHref,
    root: settings.root,
    canStart: Boolean(settings.root),
    configPath: settings.configPath,
    message: health.ok
      ? '控制台服务已连接'
      : settings.root
        ? '控制台服务未运行'
        : NO_ROOT_MESSAGE,
  }
}

async function handleControl(req, res, settings) {
  const url = new URL(req.url ?? '/', 'http://local')
  const action = url.pathname.slice(`${ROUTE_PREFIX}/backend`.length).replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()

  if (action === 'status') {
    sendJSON(res, 200, await backendStatus(settings))
    return
  }
  if (method !== 'POST') {
    sendJSON(res, 405, { ok: false, message: '仅支持 GET status / POST start / POST stop' })
    return
  }
  if (!settings.root) {
    sendJSON(res, 400, {
      ok: false,
      running: false,
      canStart: false,
      url: settings.consoleHref,
      configPath: settings.configPath,
      message: NO_ROOT_MESSAGE,
    })
    return
  }
  if (action === 'start') {
    const current = await probeHealth(settings)
    if (current.ok) {
      sendJSON(res, 200, { ...(await backendStatus(settings)), message: '控制台服务已在运行' })
      return
    }
    const launched = await runScript(settings.root, [], settings.port)
    const healthy = await waitHealthy(settings)
    sendJSON(res, healthy ? 200 : 500, {
      ok: healthy,
      running: healthy,
      canStart: true,
      url: settings.consoleHref,
      root: settings.root,
      configPath: settings.configPath,
      scriptExit: launched,
      message: healthy
        ? '控制台服务已启动'
        : `控制台服务启动失败${launched.message ? `：${launched.message}` : ''}（查看 start.sh 或配置的 root）`,
    })
    return
  }
  if (action === 'stop') {
    const stopped = await runScript(settings.root, ['--stop'], settings.port)
    const health = await probeHealth(settings)
    sendJSON(res, 200, {
      ok: !health.ok,
      running: health.ok,
      canStart: true,
      url: settings.consoleHref,
      root: settings.root,
      configPath: settings.configPath,
      scriptExit: stopped,
      message: health.ok ? '停止指令已执行，但服务仍在响应' : '控制台服务已停止',
    })
    return
  }
  sendJSON(res, 404, { ok: false, message: `未知操作：${action}` })
}

function readJSONBody(req) {
  return new Promise((resolvePromise) => {
    let body = ''
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolvePromise(value)
    }
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1024 * 1024) {
        finish({})
        req.destroy()
      }
    })
    req.on('end', () => {
      try { finish(JSON.parse(body || '{}')) } catch { finish({}) }
    })
    req.on('error', () => finish({}))
  })
}

function execText(command, args, timeoutMs = 120000) {
  return new Promise((resolvePromise) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolvePromise({
        ok: !error,
        code: error && error.code,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        message: error ? String(error.message || error) : '',
      })
    })
  })
}

function gitText(oasRoot, args, timeoutMs = 60000) {
  return execText('git', ['-C', oasRoot, ...args], timeoutMs)
}

function safeName(value) {
  const text = String(value || 'main').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return text || 'main'
}

function fileStamp(date = new Date()) {
  return date.toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-')
}

function sha256File(file) {
  return new Promise((resolvePromise) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
    stream.on('error', () => resolvePromise(''))
  })
}

function readBaselines(dir) {
  if (!existsSync(dir)) return []
  const entries = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const manifest = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (manifest && manifest.name) entries.push(manifest)
    } catch {
      // ignore a partial/corrupt manifest
    }
  }
  return entries.sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
}

async function baselineStatus(settings) {
  const base = {
    ok: false,
    canBaseline: false,
    oasRoot: settings.oasRoot,
    baselineDir: settings.baselineDir,
    baselines: [],
    message: '',
  }
  if (!settings.oasRoot || !existsSync(join(settings.oasRoot, '.git'))) {
    base.message = `未找到 OAS git 仓库（需要 oasRoot 或 <root>/OAS）。可在 ${settings.configPath} 中配置 oasRoot。`
    return base
  }
  const [commit, short, subject, branch, dirty] = await Promise.all([
    gitText(settings.oasRoot, ['rev-parse', 'HEAD']),
    gitText(settings.oasRoot, ['rev-parse', '--short', 'HEAD']),
    gitText(settings.oasRoot, ['log', '-1', '--format=%s']),
    gitText(settings.oasRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitText(settings.oasRoot, ['status', '--porcelain']),
  ])
  if (!commit.ok) {
    base.message = `无法读取 OAS 仓库：${commit.stderr || commit.message}`
    return base
  }
  const dirtyCount = dirty.ok ? dirty.stdout.split('\n').filter((line) => line.trim()).length : 0
  return {
    ok: true,
    canBaseline: true,
    oasRoot: settings.oasRoot,
    baselineDir: settings.baselineDir,
    head: {
      commit: commit.stdout.trim(),
      short: short.stdout.trim(),
      subject: subject.stdout.trim(),
      branch: branch.stdout.trim() || 'HEAD',
    },
    dirty_count: dirtyCount,
    baselines: readBaselines(settings.baselineDir),
  }
}

async function createBaseline(settings) {
  if (!settings.oasRoot || !existsSync(join(settings.oasRoot, '.git'))) {
    throw new Error('未找到 OAS git 仓库，无法创建基线')
  }
  mkdirSync(settings.baselineDir, { recursive: true })
  const [short, branch, dirty] = await Promise.all([
    gitText(settings.oasRoot, ['rev-parse', '--short', 'HEAD']),
    gitText(settings.oasRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitText(settings.oasRoot, ['status', '--porcelain']),
  ])
  if (!short.ok) throw new Error(`无法读取 OAS HEAD：${short.stderr || short.message}`)
  const branchName = branch.stdout.trim() || 'HEAD'
  const stamp = fileStamp()
  const base = `oas-${safeName(branchName)}-${short.stdout.trim()}-${stamp}`
  const bundle = join(settings.baselineDir, `${base}.bundle`)
  const temp = `${bundle}.tmp`
  try { unlinkSync(temp) } catch { /* absent */ }

  const bundled = await gitText(settings.oasRoot, ['bundle', 'create', temp, '--all'], 240000)
  if (!bundled.ok) {
    try { unlinkSync(temp) } catch { /* absent */ }
    throw new Error(`git bundle 失败：${bundled.stderr || bundled.message}`)
  }
  renameSync(temp, bundle)

  const warnings = []
  let trackedPatch = ''
  const diff = await gitText(settings.oasRoot, ['diff', '--binary', 'HEAD'], 60000)
  if (diff.ok && diff.stdout.trim()) {
    trackedPatch = join(settings.baselineDir, `${base}.patch`)
    writeFileSync(trackedPatch, diff.stdout)
  } else if (!diff.ok) {
    warnings.push(`tracked diff 未保存：${diff.stderr || diff.message}`)
  }

  let untrackedArchive = ''
  let untrackedCount = 0
  const untracked = await gitText(settings.oasRoot, ['ls-files', '--others', '--exclude-standard', '-z'], 60000)
  if (untracked.ok) {
    const files = untracked.stdout.split('\0').filter((file) => (
      file
      && !file.startsWith('data/')
      && !file.includes('__pycache__')
      && !file.endsWith('.pyc')
      && !file.endsWith('.DS_Store')
    ))
    untrackedCount = files.length
    if (files.length) {
      const listFile = join(settings.baselineDir, `${base}.untracked.txt`)
      writeFileSync(listFile, files.join('\0') + '\0')
      const archive = join(settings.baselineDir, `${base}.untracked.tar.gz`)
      const tar = await execText('tar', ['-czf', archive, '-C', settings.oasRoot, '--null', '-T', listFile], 120000)
      if (tar.ok) untrackedArchive = archive
      else warnings.push(`未跟踪文件归档失败：${tar.stderr || tar.message}`)
    }
  } else {
    warnings.push(`未跟踪文件列表失败：${untracked.stderr || untracked.message}`)
  }

  let dirtyCount = 0
  if (dirty.ok) dirtyCount = dirty.stdout.split('\n').filter((line) => line.trim()).length
  const manifest = {
    name: base,
    bundle,
    bundle_size: statSync(bundle).size,
    sha256: await sha256File(bundle),
    branch: branchName,
    commit: short.stdout.trim(),
    created_at: new Date().toISOString(),
    dirty_count: dirtyCount,
    tracked_patch: trackedPatch,
    tracked_patch_sha256: trackedPatch ? await sha256File(trackedPatch) : '',
    untracked_archive: untrackedArchive,
    untracked_archive_sha256: untrackedArchive ? await sha256File(untrackedArchive) : '',
    untracked_count: untrackedCount,
    warnings,
  }
  writeFileSync(join(settings.baselineDir, `${base}.json`), JSON.stringify(manifest, null, 2))
  return { ok: true, baseline: manifest, message: `已创建基线 ${base}` }
}

async function restoreBaseline(settings, name) {
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
    throw new Error('基线名称无效')
  }
  const manifestPath = join(settings.baselineDir, `${name}.json`)
  if (!existsSync(manifestPath)) throw new Error(`基线不存在：${name}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.bundle || !existsSync(manifest.bundle)) throw new Error('基线 bundle 文件不存在')
  for (const [field, hashField] of [['bundle', 'sha256'], ['tracked_patch', 'tracked_patch_sha256'], ['untracked_archive', 'untracked_archive_sha256']]) {
    const file = manifest[field]
    if (!file) continue
    if (!existsSync(file)) throw new Error('基线文件不完整，未开始恢复')
    if (dirname(realpathSync(file)) !== realpathSync(settings.baselineDir)) throw new Error('基线文件路径越界，未开始恢复')
    if (manifest[hashField] && await sha256File(file) !== manifest[hashField]) throw new Error('基线校验失败，未开始恢复')
  }

  const target = join(dirname(settings.oasRoot), `OAS-restored-${fileStamp()}`)
  if (existsSync(target)) throw new Error(`恢复目标已存在：${target}`)
  const warnings = []

  const cloned = await execText('git', ['clone', '--no-hardlinks', manifest.bundle, target], 240000)
  if (!cloned.ok) throw new Error(`从基线克隆失败：${cloned.stderr || cloned.message}`)

  if (manifest.branch && manifest.branch !== 'HEAD' && !manifest.branch.startsWith('-')) {
    const checkout = await gitText(target, ['checkout', '-f', manifest.branch], 60000)
    if (!checkout.ok) warnings.push(`切换分支 ${manifest.branch} 失败：${checkout.stderr || checkout.message}`)
  }
  if (manifest.tracked_patch && existsSync(manifest.tracked_patch)) {
    const applied = await gitText(target, ['apply', '--binary', manifest.tracked_patch], 120000)
    if (!applied.ok) warnings.push(`工作树 patch 应用失败：${applied.stderr || applied.message}`)
  }
  if (manifest.untracked_archive && existsSync(manifest.untracked_archive)) {
    await checkArchiveNames(manifest.untracked_archive)
    const extracted = await execText('tar', ['-xzf', manifest.untracked_archive, '-C', target], 120000)
    if (!extracted.ok) warnings.push(`未跟踪文件恢复失败：${extracted.stderr || extracted.message}`)
  }

  return {
    ok: warnings.length === 0,
    partial: warnings.length > 0,
    name,
    target,
    branch: manifest.branch,
    commit: manifest.commit,
    warnings,
    message: `${warnings.length ? '部分恢复，请核对警告：' : '已恢复到 '}${target}（不覆盖现有 OAS；确认后手动替换或配置 oasRoot）`,
  }
}

async function oasRuntimeStatus(settings) {
  const exists = existsSync(join(settings.oasRoot, '.git'))
  const result = {
    ok: true,
    oasRoot: settings.oasRoot,
    mirrorUrl: settings.oasMirrorUrl,
    branch: settings.oasBranch,
    exists,
    canInstall: !exists && Boolean(settings.oasMirrorUrl),
    canUpdate: exists && Boolean(settings.oasMirrorUrl),
    dirty_count: 0,
    tracked_dirty: 0,
    message: '',
  }
  if (!exists) {
    result.message = settings.oasMirrorUrl ? '尚未安装 OAS' : '尚未安装 OAS；请先在配置中填写 oasMirrorUrl'
    return result
  }
  const [commit, short, subject, branch, dirty] = await Promise.all([
    gitText(settings.oasRoot, ['rev-parse', 'HEAD']),
    gitText(settings.oasRoot, ['rev-parse', '--short', 'HEAD']),
    gitText(settings.oasRoot, ['log', '-1', '--format=%s']),
    gitText(settings.oasRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitText(settings.oasRoot, ['status', '--porcelain']),
  ])
  if (!commit.ok) {
    result.message = `无法读取 OAS 仓库：${commit.stderr || commit.message}`
    return result
  }
  const lines = dirty.ok ? dirty.stdout.split('\n').filter((line) => line.trim()) : []
  result.head = {
    commit: commit.stdout.trim(),
    short: short.stdout.trim(),
    subject: subject.stdout.trim(),
    branch: branch.stdout.trim() || 'HEAD',
  }
  result.dirty_count = lines.length
  result.tracked_dirty = lines.filter((line) => !line.startsWith('??')).length
  result.message = 'OAS 已安装'
  return result
}

async function installOasRuntime(settings) {
  if (!settings.oasMirrorUrl) throw new Error('未配置 oasMirrorUrl，无法下载 OAS')
  if (existsSync(join(settings.oasRoot, '.git'))) throw new Error('OAS 已存在，无需下载')
  if (existsSync(settings.oasRoot)) {
    const entries = readdirSync(settings.oasRoot)
    if (entries.length) throw new Error(`目标目录已存在且非空：${settings.oasRoot}`)
    rmSync(settings.oasRoot, { recursive: true, force: true })
  }
  mkdirSync(dirname(settings.oasRoot), { recursive: true })
  let cloned = await execText('git', ['clone', '--branch', settings.oasBranch, settings.oasMirrorUrl, settings.oasRoot], 300000)
  if (!cloned.ok) {
    try { rmSync(settings.oasRoot, { recursive: true, force: true }) } catch { /* absent */ }
    cloned = await execText('git', ['clone', settings.oasMirrorUrl, settings.oasRoot], 300000)
  }
  if (!cloned.ok) throw new Error(`下载 OAS 失败：${cloned.stderr || cloned.message}`)
  return { ...(await oasRuntimeStatus(settings)), ok: true, message: 'OAS 已下载' }
}

async function checkOasRuntime(settings) {
  if (!settings.oasMirrorUrl) throw new Error('未配置 oasMirrorUrl')
  if (!existsSync(join(settings.oasRoot, '.git'))) throw new Error('OAS 尚未安装')
  const fetched = await gitText(settings.oasRoot, ['fetch', settings.oasMirrorUrl, settings.oasBranch], 180000)
  if (!fetched.ok) throw new Error(`检查更新失败：${fetched.stderr || fetched.message}`)
  const [behind, ahead, remoteTip, localTip] = await Promise.all([
    gitText(settings.oasRoot, ['rev-list', '--count', 'HEAD..FETCH_HEAD']),
    gitText(settings.oasRoot, ['rev-list', '--count', 'FETCH_HEAD..HEAD']),
    gitText(settings.oasRoot, ['rev-parse', 'FETCH_HEAD']),
    gitText(settings.oasRoot, ['rev-parse', 'HEAD']),
  ])
  const behindCount = behind.ok && behind.stdout.trim().match(/^\d+$/) ? Number(behind.stdout.trim()) : 0
  return {
    ok: true,
    behind: behindCount,
    ahead: ahead.ok && ahead.stdout.trim().match(/^\d+$/) ? Number(ahead.stdout.trim()) : 0,
    up_to_date: behindCount === 0,
    remote_tip: remoteTip.stdout.trim(),
    local_tip: localTip.stdout.trim(),
    message: behindCount === 0 ? '已是最新' : `落后 ${behindCount} 个提交`,
  }
}

async function updateOasRuntime(settings) {
  if (!settings.oasMirrorUrl) throw new Error('未配置 oasMirrorUrl')
  const status = await oasRuntimeStatus(settings)
  if (!status.exists) throw new Error('OAS 尚未安装')
  if (status.tracked_dirty > 0) {
    throw new Error('OAS 工作树有未提交的跟踪文件改动，请先 commit 或 stash；未跟踪文件不会阻止更新')
  }
  const before = status.head
  const fetched = await gitText(settings.oasRoot, ['fetch', settings.oasMirrorUrl, settings.oasBranch], 180000)
  if (!fetched.ok) throw new Error(`拉取镜像失败：${fetched.stderr || fetched.message}`)
  const merged = await gitText(settings.oasRoot, ['merge', '--ff-only', 'FETCH_HEAD'], 120000)
  if (!merged.ok) throw new Error(`更新失败（非 fast-forward）：${merged.stderr || merged.message}`)
  const after = await oasRuntimeStatus(settings)
  return {
    ok: true,
    before,
    after: after.head,
    message: `OAS 已更新到 ${after.head ? after.head.short : '最新提交'}`,
  }
}

async function handleOasRuntime(req, res, settings) {
  const url = new URL(req.url ?? '/', 'http://local')
  const action = url.pathname.slice(`${ROUTE_PREFIX}/oas-runtime`.length).replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'GET' && action === 'status') {
    sendJSON(res, 200, await oasRuntimeStatus(settings))
    return
  }
  if (method !== 'POST') {
    sendJSON(res, 405, { ok: false, message: '仅支持 GET status / POST install / POST check / POST update' })
    return
  }
  try {
    if (action === 'install') {
      sendJSON(res, 200, await installOasRuntime(settings))
      return
    }
    if (action === 'check') {
      sendJSON(res, 200, await checkOasRuntime(settings))
      return
    }
    if (action === 'update') {
      sendJSON(res, 200, await updateOasRuntime(settings))
      return
    }
    sendJSON(res, 404, { ok: false, message: `未知操作：${action}` })
  } catch (error) {
    sendJSON(res, 500, { ok: false, message: String(error?.message || error) })
  }
}

function logRuntime(backendDir, message) {
  try {
    mkdirSync(backendDir, { recursive: true })
    appendFileSync(join(backendDir, 'install.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    // logging must never fail the operation
  }
}

function tailFile(file, limit = 8000) {
  let fd
  try {
    fd = openSync(file, 'r')
    const size = fstatSync(fd).size
    const bytes = Buffer.alloc(Math.min(size, limit))
    readSync(fd, bytes, 0, bytes.length, Math.max(0, size - bytes.length))
    return bytes.toString('utf8')
  } catch { return '' }
  finally { if (fd !== undefined) closeSync(fd) }
}

function downloadHttp(url, dest, redirects = 0, timeoutMs = 1800000) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (redirects > 6) {
      rejectPromise(new Error('下载重定向过多'))
      return
    }
    const parsed = new URL(url)
    const requester = parsed.protocol === 'https:' ? httpsGet : httpGet
    const req = requester(url, {
      headers: { 'user-agent': 'dsh-onmyoji-oas/1.4' },
    }, (res) => {
      const status = res.statusCode || 0
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume()
        const next = new URL(res.headers.location, url).href
        downloadHttp(next, dest, redirects + 1, timeoutMs).then(resolvePromise, rejectPromise)
        return
      }
      if (status !== 200) {
        res.resume()
        rejectPromise(new Error(`下载失败 HTTP ${status}`))
        return
      }
      pipeline(res, createWriteStream(dest)).then(() => resolvePromise(dest), rejectPromise)
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('下载超时')))
    req.on('error', rejectPromise)
  })
}

async function downloadToFile(source, dest, timeoutMs = 1800000) {
  mkdirSync(dirname(dest), { recursive: true })
  if (String(source).startsWith('file://')) {
    copyFileSync(fileURLToPath(source), dest)
    return dest
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(String(source)) && existsSync(source)) {
    copyFileSync(source, dest)
    return dest
  }
  const parsed = new URL(source)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http(s) 或 file:// 地址')
  }
  return downloadHttp(source, dest, 0, timeoutMs)
}

async function checkArchiveNames(archive) {
  const listing = await execText('tar', ['-tf', archive], 300000)
  if (!listing.ok) throw new Error('归档目录读取失败，未开始解压')
  for (const raw of listing.stdout.split('\n')) {
    const name = raw.replaceAll('\\', '/')
    if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..')) {
      throw new Error('归档含不安全路径，未开始解压')
    }
  }
}

async function extractArchive(archive, dest) {
  await checkArchiveNames(archive)
  mkdirSync(dest, { recursive: true })
  const lower = archive.toLowerCase()
  const isZip = lower.endsWith('.zip')
  if (isZip && process.platform === 'win32') {
    const tar = await execText('tar', ['-xf', archive, '-C', dest], 300000)
    if (tar.ok) return
    const escapedArchive = archive.replace(/'/g, "''")
    const escapedDest = dest.replace(/'/g, "''")
    const ps = await execText('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedDest}' -Force`,
    ], 300000)
    if (!ps.ok) throw new Error(`解压失败：${ps.stderr || ps.message}`)
    return
  }
  const result = await execText('tar', [isZip ? '-xf' : '-xzf', archive, '-C', dest], 300000)
  if (!result.ok) throw new Error(`解压失败：${result.stderr || result.message}`)
}

function findFile(dir, name) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return full
    if (entry.isDirectory()) {
      const found = findFile(full, name)
      if (found) return found
    }
  }
  return undefined
}

function uvAssetName() {
  const map = {
    'darwin-arm64': 'uv-aarch64-apple-darwin.tar.gz',
    'darwin-x64': 'uv-x86_64-apple-darwin.tar.gz',
    'win32-x64': 'uv-x86_64-pc-windows-msvc.zip',
    'win32-arm64': 'uv-aarch64-pc-windows-msvc.zip',
    'linux-x64': 'uv-x86_64-unknown-linux-gnu.tar.gz',
    'linux-arm64': 'uv-aarch64-unknown-linux-gnu.tar.gz',
  }
  return map[`${process.platform}-${process.arch}`]
}

function runtimeRequirementsName() {
  if (process.platform === 'darwin') return 'requirements-macos.txt'
  if (process.platform === 'win32') return 'requirements-windows.txt'
  return 'requirements-linux.txt'
}

async function ensureUv(settings) {
  if (settings.uvPath && existsSync(settings.uvPath)) return settings.uvPath
  const system = await execText('uv', ['--version'], 15000)
  if (system.ok) return 'uv'
  const asset = uvAssetName()
  if (!asset) throw new Error(`当前平台不支持自动安装 uv：${process.platform}-${process.arch}`)
  const tooling = join(settings.backendDir, 'tooling')
  const extractDir = join(tooling, 'uv')
  const archive = join(tooling, asset)
  if (!existsSync(archive)) {
    logRuntime(settings.backendDir, `download uv ${asset}`)
    await downloadToFile(`https://github.com/astral-sh/uv/releases/latest/download/${asset}`, archive)
  }
  const binName = process.platform === 'win32' ? 'uv.exe' : 'uv'
  let bin = findFile(extractDir, binName)
  if (!bin) {
    await extractArchive(archive, extractDir)
    bin = findFile(extractDir, binName)
  }
  if (!bin) throw new Error('uv 解压后未找到可执行文件')
  if (process.platform !== 'win32') chmodSync(bin, 0o755)
  return bin
}

async function runUv(uv, args, logFile, timeoutMs, extraEnv = {}) {
  appendFileSync(logFile, `\n$ ${uv} ${args.join(' ')}\n`)
  const result = await new Promise((resolvePromise) => {
    execFile(uv, args, {
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, ...extraEnv },
    }, (error, stdout, stderr) => {
      resolvePromise({
        ok: !error,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        message: error ? String(error.message || error) : '',
      })
    })
  })
  appendFileSync(logFile, `${result.stdout}${result.stderr}\n`)
  if (!result.ok) throw new Error(`uv 失败：${(result.stderr || result.message).slice(-1200)}`)
  return result
}

async function backendRuntimeStatus(settings) {
  const consoleDir = join(settings.backendDir, 'console')
  const runtimePython = process.platform === 'win32'
    ? join(settings.backendDir, 'runtime', 'python.exe')
    : join(settings.backendDir, 'runtime', 'bin', 'python3')
  const installed = existsSync(join(consoleDir, 'web', 'server.py')) && existsSync(runtimePython) && existsSync(join(settings.backendDir, 'installed.json'))
  const oasInstalled = existsSync(join(consoleDir, 'OAS', '.git'))
  const health = installed ? await probeHealth(settings) : { ok: false }
  const running = Boolean(health.ok && (health.health?.instance
    ? health.health.instance.kind === 'portable' && resolve(health.health.instance.root || '.') === resolve(consoleDir)
    : await ownsPortablePort(settings)))
  const state = installStates.get(settings.backendDir)
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(settings.backendDir, 'manifest.json'), 'utf8'))
  } catch {
    manifest = undefined
  }
  return {
    ok: true,
    backendDir: settings.backendDir,
    consoleDir,
    runtimePython,
    installed,
    oasInstalled,
    running,
    connectedInstance: health.health?.instance || null,
    installing: Boolean(state && state.running),
    installError: state ? (state.error || '') : '',
    platform: `${process.platform}-${process.arch}`,
    consoleBundleUrl: settings.consoleBundleUrl,
    oasMirrorUrl: settings.oasMirrorUrl,
    canInstall: !installed && !(state && state.running) && Boolean(settings.consoleBundleUrl) && /^[a-f0-9]{64}$/i.test(settings.consoleBundleSha256 || ''),
    manifest,
    log: tailFile(join(settings.backendDir, 'install.log'), 8000),
    message: installed
      ? (running ? '后端已安装并运行' : '后端已安装，未运行或来源未确认')
      : (state && state.running ? '后端安装中' : '后端尚未安装'),
  }
}

async function installBackendRuntimeAsync(settings) {
  if (!/^[a-f0-9]{64}$/i.test(settings.consoleBundleSha256 || '')) throw new Error('缺少可信的核心包 SHA256；请更新插件或配置 consoleBundleSha256')
  mkdirSync(settings.backendDir, { recursive: true })
  const current = await backendRuntimeStatus(settings)
  if (current.installed) return { ...current, message: '后端已安装' }
  const stage = mkdtempSync(join(settings.backendDir, '.core-stage-'))
  const archive = join(stage, 'download.tar.gz')
  const content = join(stage, 'content')
  const entries = ['console', 'runtime', 'platform-tools', 'run.sh', 'manifest.json', 'installed.json']
  const movedOld = [], movedNew = []
  let backup
  try {
    logRuntime(settings.backendDir, 'download core bundle')
    await downloadToFile(settings.consoleBundleUrl, archive)
    const hash = await sha256File(archive)
    if (hash.toLowerCase() !== settings.consoleBundleSha256.toLowerCase()) throw new Error('核心包 SHA256 校验失败，未修改已有安装')
    logRuntime(settings.backendDir, 'verify and extract core bundle')
    await extractArchive(archive, content)
    const manifest = JSON.parse(readFileSync(join(content, 'manifest.json'), 'utf8'))
    if (manifest.platform !== `${process.platform}-${process.arch}`) throw new Error('核心包平台不匹配')
    const python = process.platform === 'win32' ? join(content, 'runtime', 'python.exe') : join(content, 'runtime', 'bin', 'python3')
    if (!existsSync(python) || !existsSync(join(content, 'console', 'web', 'server.py'))) throw new Error('核心包缺少 Python 或控制台入口')
    writeFileSync(join(content, 'installed.json'), JSON.stringify({ platform: manifest.platform, sha256: hash,
      version: CORE_BUILDS[manifest.platform]?.version || manifest.version || 'unknown', installed_at: new Date().toISOString() }, null, 2))
    backup = join(settings.backendDir, 'backups', 'core-' + Date.now())
    mkdirSync(backup, { recursive: true })
    for (const entry of entries) {
      const old = join(settings.backendDir, entry)
      if (existsSync(old)) { renameSync(old, join(backup, entry)); movedOld.push(entry) }
      const next = join(content, entry)
      if (existsSync(next)) { renameSync(next, old); movedNew.push(entry) }
    }
    logRuntime(settings.backendDir, 'core installation committed; previous files retained in backups')
    return { ...(await backendRuntimeStatus(settings)), ok: true, message: '核心包已校验并安装；原文件保留在 backups', backup }
  } catch (error) {
    const recovery = []
    for (const entry of movedNew.reverse()) {
      try { renameSync(join(settings.backendDir, entry), join(content, entry)) } catch (e) { recovery.push(e.message) }
    }
    for (const entry of movedOld.reverse()) {
      try { renameSync(join(backup, entry), join(settings.backendDir, entry)) } catch (e) { recovery.push(e.message) }
    }
    if (recovery.length) throw new Error(`${error.message}；回退未完成，原文件保留于 ${backup}`)
    throw error
  } finally { rmSync(stage, { recursive: true, force: true }) }
}

function beginBackendInstall(settings) {
  const key = settings.backendDir
  if (runtimeOperations.has(key) || [...moduleStates.entries()].some(([id, state]) => id.startsWith(key + ':') && state.running)) throw new Error('已有维护操作，请稍后重试')
  const existing = installStates.get(key)
  if (existing && existing.running) {
    return { ok: true, installing: true, message: '后端安装正在进行' }
  }
  const state = { running: true, error: '', started_at: Date.now() }
  installStates.set(key, state)
  installBackendRuntimeAsync(settings)
    .then(() => {
      state.running = false
      state.error = ''
    })
    .catch((error) => {
      state.running = false
      state.error = String(error?.message || error)
      logRuntime(settings.backendDir, `install failed: ${state.error}`)
    })
  return { ok: true, installing: true, message: '开始安装后端' }
}

function moduleDefs(settings) {
  const platform = `${process.platform}-${process.arch}`
  const coreVersion = installedCoreVersion(settings)
  return MODULE_DEFS.map((def) => {
    const meta = def.platforms[platform]
    const dir = join(settings.backendDir, 'modules', def.id, def.version)
    const complete = existsSync(join(dir, 'manifest.json')) && existsSync(join(dir, 'installed.json'))
    const installed = Boolean(meta) && complete
    const coreReady = Boolean(coreVersion) && versionAtLeast(coreVersion, def.requiresCore || '0')
    const state = moduleStates.get(settings.backendDir + ':' + def.id)
    const url = (def.id === 'local-llm' ? settings.localLlmUrl : def.urlTemplate.replace(/\{platform\}/g, platform)) || ''
    return {
      id: def.id,
      name: def.name,
      version: def.version,
      requiresCore: def.requiresCore,
      description: def.description,
      platform,
      supported: Boolean(meta),
      size: meta ? meta.size : 0,
      sha256: meta ? meta.sha256 : '',
      dir,
      sitePackages: installed ? join(dir, 'site-packages') : '',
      installed,
      installing: Boolean(state && state.running),
      error: state ? (state.error || '') : '',
      url,
      coreVersion,
      coreReady,
      canInstall: Boolean(meta) && coreReady && !installed && !(state && state.running) && Boolean(url),
      model: def.id === 'local-llm'
        ? {
            path: join(settings.backendDir, 'console', 'Qwen_Qwen2.5-1.5B-Instruct'),
            note: '模型文件不包含在组件内；可放到该目录。',
          }
        : undefined,
    }
  })
}

function versionAtLeast(current, required) {
  const parse = (value) => String(value || '').replace(/^v/i, '').split(/[.-]/).map((part) => Number(part) || 0)
  const left = parse(current)
  const right = parse(required)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a > b) return true
    if (a < b) return false
  }
  return true
}

function installedCoreVersion(settings) {
  try {
    const installed = JSON.parse(readFileSync(join(settings.backendDir, 'installed.json'), 'utf8'))
    return String(installed.version || '')
  } catch {
    return ''
  }
}

function moduleStatus(settings) {
  return {
    ok: true,
    platform: `${process.platform}-${process.arch}`,
    modulesDir: join(settings.backendDir, 'modules'),
    modules: moduleDefs(settings),
  }
}

function installedModuleSitePaths(settings) {
  return moduleDefs(settings)
    .filter((def) => def.installed && def.sitePackages)
    .map((def) => def.sitePackages)
}

async function installModuleAsync(settings, def) {
  const modulesDir = join(settings.backendDir, 'modules')
  const tmpDir = join(modulesDir, 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  const archive = join(tmpDir, `${def.id}.tar.gz`)
  const staging = join(tmpDir, `${def.id}-staging-${Date.now()}`)
  logRuntime(settings.backendDir, `module ${def.id}: download ${def.url}`)
  try {
    await downloadToFile(def.url, archive)
    const hash = await sha256File(archive)
    if (def.sha256 && hash.toLowerCase() !== def.sha256.toLowerCase()) {
      throw new Error(`组件 SHA256 校验失败（期望 ${def.sha256}，实际 ${hash}）`)
    }
    await extractArchive(archive, staging)
    if (!existsSync(join(staging, 'manifest.json')) || !existsSync(join(staging, 'site-packages'))) {
      throw new Error('组件包缺少 manifest.json 或 site-packages')
    }
    const manifest = JSON.parse(readFileSync(join(staging, 'manifest.json'), 'utf8'))
    if (manifest.id !== def.id || manifest.version !== def.version || manifest.platform !== def.platform) throw new Error('组件 manifest 与当前平台或版本不匹配')
    const coreVersion = installedCoreVersion(settings)
    if (!coreVersion) throw new Error('核心包缺少完成标记，请先完整安装核心包')
    if (def.requiresCore && !versionAtLeast(coreVersion, def.requiresCore)) {
      throw new Error(`组件需要核心 ${def.requiresCore} 或更高版本，当前为 ${coreVersion}`)
    }
    const target = join(modulesDir, def.id, def.version)
    const backup = `${target}.backup-${Date.now()}`
    const hadOld = existsSync(target)
    // 完成标记必须和内容一起进入 staging；写失败时旧版本保持不动。
    writeFileSync(join(staging, 'installed.json'), JSON.stringify({
      installed_at: new Date().toISOString(),
      source: def.url,
      sha256: hash,
      size: def.size,
      platform: def.platform,
      core_version: coreVersion,
    }, null, 2))
    if (hadOld) renameSync(target, backup)
    try {
      mkdirSync(dirname(target), { recursive: true })
      renameSync(staging, target)
    } catch (error) {
      rmSync(target, { recursive: true, force: true })
      if (hadOld && existsSync(backup)) renameSync(backup, target)
      throw error
    }
    if (hadOld) {
      try { rmSync(backup, { recursive: true, force: true }) } catch { /* 旧版保留，不影响已提交的新版 */ }
    }
    logRuntime(settings.backendDir, `module ${def.id}: installed`)
  } finally {
    rmSync(archive, { force: true })
    rmSync(staging, { recursive: true, force: true })
  }
}

function beginModuleInstall(settings, id) {
  const def = moduleDefs(settings).find((item) => item.id === id)
  if (!def) throw new Error(`未知组件：${id}`)
  if (!def.supported) throw new Error('当前平台暂不支持该组件')
  if (def.installed) return { ok: true, installed: true, message: '组件已安装' }
  const existing = moduleStates.get(settings.backendDir + ':' + id)
  if (existing && existing.running) {
    return { ok: true, installing: true, message: '组件安装正在进行' }
  }
  const state = { running: true, error: '' }
  moduleStates.set(settings.backendDir + ':' + id, state)
  installModuleAsync(settings, def)
    .then(() => {
      state.running = false
      state.error = ''
    })
    .catch((error) => {
      state.running = false
      state.error = String(error?.message || error)
      logRuntime(settings.backendDir, `module ${id} failed: ${state.error}`)
    })
  return { ok: true, installing: true, message: '开始安装组件' }
}

function removeModule(settings, id) {
  const def = moduleDefs(settings).find((item) => item.id === id)
  if (!def) throw new Error(`未知组件：${id}`)
  const state = moduleStates.get(settings.backendDir + ':' + id)
  if (state && state.running) throw new Error('组件正在安装，稍后再移除')
  rmSync(join(settings.backendDir, 'modules', id), { recursive: true, force: true })
  moduleStates.delete(settings.backendDir + ':' + id)
  return { ok: true, message: '组件已移除；重启便携后端后完全生效' }
}

async function handleModules(req, res, settings) {
  const url = new URL(req.url, 'http://127.0.0.1')
  const action = url.pathname.slice(`${ROUTE_PREFIX}/modules`.length).replace(/^\/+/, '')
  try {
    if (req.method === 'GET' && action === 'status') {
      sendJSON(res, 200, moduleStatus(settings))
      return
    }
    if (req.method === 'POST' && action === 'install') {
      if (runtimeOperations.has(settings.backendDir) || installStates.get(settings.backendDir)?.running) throw new Error('已有后端维护操作，请稍后重试')
      if (!existsSync(join(settings.backendDir, 'installed.json'))) throw new Error('请先完整安装核心包')
      sendJSON(res, 200, beginModuleInstall(settings, url.searchParams.get('id') || 'local-llm'))
      return
    }
    if (req.method === 'POST' && action === 'remove') {
      if (runtimeOperations.has(settings.backendDir) || installStates.get(settings.backendDir)?.running || [...moduleStates.entries()].some(([id, state]) => id.startsWith(settings.backendDir + ':') && state.running)) throw new Error('已有维护操作，请稍后重试')
      runtimeOperations.add(settings.backendDir)
      try {
        const health = await probeHealth(settings)
        if (health.ok && health.health?.instance?.kind !== 'source') throw new Error('请先停止便携后端，再移除组件，以免影响正在使用的依赖')
        sendJSON(res, 200, removeModule(settings, url.searchParams.get('id') || 'local-llm'))
      } finally { runtimeOperations.delete(settings.backendDir) }
      return
    }
    sendJSON(res, 404, { ok: false, message: 'not found' })
  } catch (error) {
    sendJSON(res, 500, { ok: false, message: String(error?.message || error) })
  }
}

async function processIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return ''
  const result = process.platform === 'win32'
    ? await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json -Compress`], 10000)
    : await execText('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], 10000)
  if (result.ok) return result.stdout.trim()
  try { process.kill(pid, 0) } catch (error) { if (error.code === 'ESRCH') return '' }
  throw new Error('无法核验进程身份，未继续进程操作')
}

async function ownsPortablePort(settings) {
  // Old cores do not return instance metadata. Verify their PID against the OS
  // listener as well as process birth/command identity, never health alone.
  let record
  try { record = JSON.parse(readFileSync(join(settings.backendDir, 'backend.pid'), 'utf8')) } catch { return false }
  if (!record || record.root !== resolve(settings.backendDir) || !record.identity) return false
  try {
    if (await processIdentity(record.pid) !== record.identity) return false
    const port = Number(settings.port || new URL(settings.consoleHref).port || 80)
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return false
    const listener = process.platform === 'win32'
      ? await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess`], 10000)
      : await execText('lsof', ['-n', '-P', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], 10000)
    return listener.ok && listener.stdout.trim().split(/\s+/).includes(String(record.pid))
  } catch { return false }
}

async function startBackendRuntime(settings) {
  const targetHost = new URL(settings.consoleHref).hostname
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)) throw new Error('便携进程只能在本机控制台地址启动；远程地址仅支持连接')
  if (installStates.get(settings.backendDir)?.running || [...moduleStates.entries()].some(([id, state]) => id.startsWith(settings.backendDir + ':') && state.running)) throw new Error('正在安装后端或组件，请等待完成')
  const status = await backendRuntimeStatus(settings)
  if (!status.installed) throw new Error('后端未完整安装，请先安装或修复')
  if (status.running) return { ...status, ok: true, message: '便携后端已在运行' }
  if ((await probeHealth(settings)).ok) throw new Error('当前地址已有其他或来源未确认的服务；未启动第二个后端')
  const portBusy = await new Promise((done, rejectPromise) => {
    const target = new URL(settings.consoleHref)
    const socket = createConnection({ host: target.hostname, port: Number(target.port || (target.protocol === 'https:' ? 443 : 80)) })
    socket.setTimeout(2000)
    socket.once('connect', () => { socket.destroy(); done(true) })
    socket.once('error', error => { socket.destroy(); if (error.code === 'ECONNREFUSED') done(false); else rejectPromise(new Error('无法确认目标端口是否空闲，未启动后端')) })
    socket.once('timeout', () => { socket.destroy(); rejectPromise(new Error('目标端口检测超时，未启动后端')) })
  })
  if (portBusy) throw new Error('目标端口已被其他服务占用；未启动后端，请检查控制台地址和端口')
  const dataDir = join(settings.backendDir, 'data')
  mkdirSync(dataDir, { recursive: true })
  const adb = join(settings.backendDir, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
  const logPath = join(settings.backendDir, 'backend.log')
  const out = openSync(logPath, 'a')
  let child
  try {
    child = spawn(status.runtimePython, ['-m', 'uvicorn', 'web.server:app', '--host', '127.0.0.1', '--port', String(settings.port)], {
      cwd: status.consoleDir,
      env: { ...process.env, PYTHONPATH: [status.consoleDir, ...installedModuleSitePaths(settings)].join(delimiter),
        ONMYOJI_DATA_DIR: dataDir, ONMYOJI_BACKEND_KIND: 'portable', ONMYOJI_MODULES: moduleDefs(settings).filter((item) => item.installed).map((item) => item.id + '@' + item.version).join(','), PORT: String(settings.port),
        ADB_PATH: existsSync(adb) ? adb : process.env.ADB_PATH, PYTHONUNBUFFERED: '1' },
      detached: true, stdio: ['ignore', out, out], windowsHide: true,
    })
    await new Promise((resolvePromise, rejectPromise) => { child.once('spawn', resolvePromise); child.once('error', rejectPromise) })
  } finally { closeSync(out) }
  child.on('error', (error) => logRuntime(settings.backendDir, 'backend process failed: ' + error.message))
  child.unref()
  let identity
  try { identity = await processIdentity(child.pid) } catch (error) { child.kill(); throw error }
  if (!identity) { child.kill(); throw new Error('无法记录后端进程身份，已取消启动') }
  writeFileSync(join(settings.backendDir, 'backend.pid'), JSON.stringify({ pid: child.pid, identity, root: resolve(settings.backendDir) }))
  if (!(await waitHealthy(settings, 180000))) throw new Error('启动尚未就绪，请查看 backend.log 并刷新状态；不要重复启动')
  const started = await backendRuntimeStatus(settings)
  if (!started.running) throw new Error('服务已响应，但来源未能核验为此次便携后端；请检查端口和进程日志')
  return { ...started, ok: true, message: '后端已启动' }
}

async function stopBackendRuntime(settings) {
  const pidPath = join(settings.backendDir, 'backend.pid')
  let record
  try { record = JSON.parse(readFileSync(pidPath, 'utf8')) } catch { /* no verified record */ }
  if (!record && !(await probeHealth(settings)).ok) return { ...(await backendRuntimeStatus(settings)), ok: true, message: '便携后端未运行' }
  if (!record || !Number.isSafeInteger(record.pid) || record.pid <= 1 || !record.identity || record.root !== resolve(settings.backendDir)) {
    return { ...(await backendRuntimeStatus(settings)), ok: false, message: '没有可核验的进程记录；未发送停止信号。旧版 PID 需手动核实后处理。' }
  }
  const actual = await processIdentity(record.pid)
  if (!actual) { rmSync(pidPath, { force: true }); return { ...(await backendRuntimeStatus(settings)), ok: true, message: '所记录的进程已不存在' } }
  if (actual !== record.identity) return { ...(await backendRuntimeStatus(settings)), ok: false, message: 'PID 已被其他进程复用，未发送信号' }
  if (process.platform === 'win32') {
    const stopped = await execText('taskkill', ['/PID', String(record.pid), '/T', '/F'], 15000)
    if (!stopped.ok) throw new Error('停止失败，已保留进程记录')
  } else {
    try { process.kill(record.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
    for (let i = 0; i < 40; i++) {
      const identity = await processIdentity(record.pid)
      if (!identity || identity !== record.identity) break
      await new Promise((done) => setTimeout(done, 250))
    }
    if (await processIdentity(record.pid) === record.identity) process.kill(record.pid, 'SIGKILL')
  }
  for (let i = 0; i < 20 && await processIdentity(record.pid) === record.identity; i++) await new Promise(done => setTimeout(done, 100))
  if (await processIdentity(record.pid) === record.identity) throw new Error('进程尚未退出，已保留进程记录，请刷新状态')
  rmSync(pidPath, { force: true })
  return { ...(await backendRuntimeStatus(settings)), ok: true, message: '已停止经过身份核验的便携后端' }
}

async function handleBackendRuntime(req, res, settings) {
  const url = new URL(req.url ?? '/', 'http://local')
  const action = url.pathname.slice(`${ROUTE_PREFIX}/backend-runtime`.length).replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'GET' && action === 'status') {
    sendJSON(res, 200, await backendRuntimeStatus(settings))
    return
  }
  if (method === 'GET' && action === 'log') {
    sendJSON(res, 200, {
      ok: true,
      install: tailFile(join(settings.backendDir, 'install.log'), 12000),
      backend: tailFile(join(settings.backendDir, 'backend.log'), 12000),
    })
    return
  }
  if (method !== 'POST') {
    sendJSON(res, 405, { ok: false, message: '仅支持 GET status/log 与 POST install/start/stop' })
    return
  }
  try {
    if (action === 'install') {
      sendJSON(res, 200, beginBackendInstall(settings))
      return
    }
    if (action === 'start') {
      if (runtimeOperations.has(settings.backendDir)) throw new Error('已有后端维护操作，请稍后重试')
      runtimeOperations.add(settings.backendDir)
      try { sendJSON(res, 200, await startBackendRuntime(settings)) } finally { runtimeOperations.delete(settings.backendDir) }
      return
    }
    if (action === 'stop') {
      if (runtimeOperations.has(settings.backendDir) || installStates.get(settings.backendDir)?.running || [...moduleStates.entries()].some(([id, state]) => id.startsWith(settings.backendDir + ':') && state.running)) throw new Error('已有维护操作，请稍后重试')
      runtimeOperations.add(settings.backendDir)
      try { sendJSON(res, 200, await stopBackendRuntime(settings)) } finally { runtimeOperations.delete(settings.backendDir) }
      return
    }
    sendJSON(res, 404, { ok: false, message: `未知操作：${action}` })
  } catch (error) {
    sendJSON(res, 500, { ok: false, message: String(error?.message || error) })
  }
}

async function handleBaseline(req, res, settings) {  const url = new URL(req.url ?? '/', 'http://local')
  const action = url.pathname.slice(`${ROUTE_PREFIX}/baseline`.length).replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'GET' && action === 'status') {
    sendJSON(res, 200, await baselineStatus(settings))
    return
  }
  if (method !== 'POST') {
    sendJSON(res, 405, { ok: false, message: '仅支持 GET status / POST create / POST restore' })
    return
  }
  if (!settings.oasRoot || !existsSync(join(settings.oasRoot, '.git'))) {
    sendJSON(res, 400, {
      ok: false,
      canBaseline: false,
      oasRoot: settings.oasRoot,
      baselineDir: settings.baselineDir,
      message: '未找到 OAS git 仓库（需要 oasRoot 或 <root>/OAS）',
    })
    return
  }
  try {
    if (action === 'create') {
      sendJSON(res, 200, await createBaseline(settings))
      return
    }
    if (action === 'restore') {
      const body = await readJSONBody(req)
      sendJSON(res, 200, await restoreBaseline(settings, body.name))
      return
    }
    sendJSON(res, 404, { ok: false, message: `未知操作：${action}` })
  } catch (error) {
    sendJSON(res, 500, { ok: false, message: String(error?.message || error) })
  }
}

export function apply(ctx, config) {
  const settings = resolveSettings(config)

  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/api`,
        handler: (req, res) => proxyRequest(req, res, settings),
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/backend`,
        handler: (req, res) => handleControl(req, res, settings),
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/backend-runtime`,
        handler: (req, res) => handleBackendRuntime(req, res, settings),
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/modules`,
        handler: (req, res) => handleModules(req, res, settings),
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/baseline`,
        handler: (req, res) => handleBaseline(req, res, settings),
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: `${ROUTE_PREFIX}/oas-runtime`,
        handler: (req, res) => handleOasRuntime(req, res, settings),
      }),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'onmyoji-console.routes')

  ctx.logger?.info?.(
    `onmyoji-console: console=${settings.consoleHref}, root=${settings.root ?? '(未配置)'}, oas=${settings.oasRoot ?? '(未发现)'}, backend=${settings.backendDir}, baselines=${settings.baselineDir}`,
  )
}
