import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { createServer, request } from 'node:http'

const root = mkdtempSync(join(tmpdir(), 'onmyoji-host-test-'))
after(() => rmSync(root, {recursive:true, force:true}))
// Export internals from a disposable copy; production exports stay unchanged.
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
const copy = join(root, 'host.mjs')
writeFileSync(copy, source + '\nexport { installBackendRuntimeAsync, backendRuntimeStatus, createBaseline, restoreBaseline, startBackendRuntime, stopBackendRuntime, extractArchive, processIdentity, proxyRequest, installModuleAsync, moduleDefs };\n')
const host = await import(pathToFileURL(copy))
const settings = name => ({backendDir:join(root,name), consoleHref:'http://127.0.0.1:1',
  consoleUrl:new URL('http://127.0.0.1:1'), oasRoot:join(root,'absent')})
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const psAvailable = (() => {
  try { execFileSync('ps', ['-p', String(process.pid), '-o', 'pid='], {encoding:'utf8'}); return true } catch { return false }
})()
const git = (repo, ...args) => execFileSync('git', ['-C',repo,...args], {
  encoding:'utf8', env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim()

function packageFixture(name) {
  const content = join(root,name+'-content'); mkdirSync(join(content,'console','web'),{recursive:true})
  const python = process.platform === 'win32' ? join(content,'runtime','python.exe') : join(content,'runtime','bin','python3')
  mkdirSync(join(python,'..'),{recursive:true}); writeFileSync(python,'fixture')
  writeFileSync(join(content,'console','web','server.py'),'# fixture')
  writeFileSync(join(content,'manifest.json'),JSON.stringify({platform:process.platform+'-'+process.arch}))
  const archive = join(root,name+'.tar.gz')
  execFileSync('tar',['-czf',archive,'-C',content,'.'])
  return archive
}

test('core SHA failure leaves existing files and removes its partial download', async () => {
  const archive = packageFixture('sha'), config=settings('bad-sha')
  mkdirSync(config.backendDir);writeFileSync(join(config.backendDir,'sentinel'),'user data')
  await assert.rejects(host.installBackendRuntimeAsync({...config,consoleBundleUrl:'file://'+archive,consoleBundleSha256:'0'.repeat(64)}), /SHA256/)
  assert.equal(readFileSync(join(config.backendDir,'sentinel'),'utf8'),'user data')
  assert.ok(!readdirSync(config.backendDir).some(name=>name.startsWith('.core-stage-')))
  assert.equal((await host.backendRuntimeStatus(config)).installed,false)
})

test('truncated but correctly hashed core never becomes installed', async () => {
  const archive = join(root,'truncated.tar.gz');writeFileSync(archive,Buffer.from([31,139,8,0]))
  const config={...settings('truncated'),consoleBundleUrl:'file://'+archive,consoleBundleSha256:hash(archive)}
  await assert.rejects(host.installBackendRuntimeAsync(config))
  assert.equal((await host.backendRuntimeStatus(config)).installed,false)
})

test('core commits only a verified complete staged payload and preserves data', async () => {
  const archive = packageFixture('valid'),config={...settings('valid'),consoleBundleUrl:'file://'+archive,consoleBundleSha256:hash(archive)}
  mkdirSync(join(config.backendDir,'data'),{recursive:true});writeFileSync(join(config.backendDir,'data','keep'),'preserve')
  assert.equal((await host.installBackendRuntimeAsync(config)).installed,true)
  assert.equal(readFileSync(join(config.backendDir,'data','keep'),'utf8'),'preserve')
  assert.equal(JSON.parse(readFileSync(join(config.backendDir,'installed.json'))).sha256,hash(archive))
})

test('baseline includes staged binary and unstaged changes; tampering fails before clone', async () => {
  const repo=join(root,'repo'),baselineDir=join(root,'baselines');mkdirSync(repo)
  git(repo,'init','-b','dev');git(repo,'config','user.name','Test');git(repo,'config','user.email','audit@invalid')
  writeFileSync(join(repo,'binary'),Buffer.from([0,1,2]));writeFileSync(join(repo,'text'),'base')
  git(repo,'add','.');git(repo,'commit','-m','base')
  writeFileSync(join(repo,'binary'),Buffer.from([0,3,4]));git(repo,'add','binary');writeFileSync(join(repo,'text'),'worktree')
  const config={oasRoot:repo,baselineDir},created=await host.createBaseline(config)
  const result=await host.restoreBaseline(config,created.baseline.name)
  assert.equal(result.ok,true);assert.deepEqual(readFileSync(join(result.target,'binary')),Buffer.from([0,3,4]))
  assert.equal(readFileSync(join(result.target,'text'),'utf8'),'worktree')
  writeFileSync(created.baseline.tracked_patch,'tampered')
  await assert.rejects(host.restoreBaseline(config,created.baseline.name),/校验/)
})

test('PID records reject legacy/mismatched identity and stop only a verified owned process', {
  skip: psAvailable ? false : 'process inspection is unavailable in this sandbox',
}, async () => {
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'})
  const exited=new Promise(done=>child.once('exit',done))
  await new Promise(done=>child.once('spawn',done))
  try {
    const config=settings('pid');mkdirSync(config.backendDir);writeFileSync(join(config.backendDir,'backend.pid'),String(child.pid))
    assert.equal((await host.stopBackendRuntime(config)).ok,false)
    process.kill(child.pid,0)
    // Force a syntactically valid identity mismatch so no port/network request is needed before rejection.
    writeFileSync(join(config.backendDir,'backend.pid'),JSON.stringify({pid:child.pid,identity:'not this process',root:config.backendDir}))
    let result
    try { result=await host.stopBackendRuntime(config) } catch(error) { assert.match(error.message,/核验/) }
    if(result) assert.equal(result.ok,false)
    process.kill(child.pid,0)
    assert.ok(existsSync(join(config.backendDir,'backend.pid')))
    writeFileSync(join(config.backendDir,'backend.pid'),JSON.stringify({pid:child.pid,identity:await host.processIdentity(child.pid),root:config.backendDir}))
    assert.equal((await host.stopBackendRuntime(config)).ok,true)
    await exited
  } finally {if(child.exitCode===null && child.signalCode===null)child.kill();await exited}
})

test('a non-console listener blocks startup before any child is launched', async () => {
  const occupied=createServer((req,res)=>{res.writeHead(503);res.end('fixture')})
  await new Promise(done=>occupied.listen(0,'127.0.0.1',done))
  const port=occupied.address().port,config={...settings('busy-port'),port,consoleHref:`http://127.0.0.1:${port}`}
  mkdirSync(join(config.backendDir,'console','web'),{recursive:true})
  mkdirSync(join(config.backendDir,'runtime','bin'),{recursive:true})
  writeFileSync(join(config.backendDir,'console','web','server.py'),'fixture')
  writeFileSync(join(config.backendDir,'runtime','bin','python3'),'must not execute')
  writeFileSync(join(config.backendDir,'installed.json'),'{}')
  try {
    await assert.rejects(host.startBackendRuntime(config),/端口已被/)
    assert.equal(existsSync(join(config.backendDir,'backend.pid')),false)
  } finally {await new Promise(done=>occupied.close(done))}
})

test('proxy preserves API body and target while stripping synthetic host credentials', async () => {
  let observed
  const upstream=createServer((req,res)=>{
    let body='';req.on('data',chunk=>{body+=chunk});req.on('end',()=>{
      observed={headers:req.headers,path:req.url,method:req.method,body}
      res.setHeader('content-type','application/json');res.end('{"ok":true}')
    })
  })
  await new Promise(done=>upstream.listen(0,'127.0.0.1',done))
  const url=new URL(`http://127.0.0.1:${upstream.address().port}`)
  const proxy=createServer((req,res)=>host.proxyRequest(req,res,{consoleUrl:url,basePath:''}))
  await new Promise(done=>proxy.listen(0,'127.0.0.1',done))
  try {
    const body='{"task_id":"fixture"}'
    const result=await new Promise((done,reject)=>{
      const req=request({hostname:'127.0.0.1',port:proxy.address().port,path:'/onmyoji/api/test?fixture=1',method:'POST',headers:{host:'untrusted.invalid',cookie:'synthetic-cookie',authorization:'synthetic-auth','x-dsh-desktop-renderer':'synthetic-marker','content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
        let data='';res.on('data',chunk=>{data+=chunk});res.on('end',()=>done({status:res.statusCode,data}))
      })
      req.on('error',reject);req.end(body)
    })
    assert.equal(result.status,200);assert.equal(result.data,'{"ok":true}')
    assert.equal(observed.path,'/api/test?fixture=1');assert.equal(observed.body,body)
    assert.equal(observed.headers.host,url.host)
    for(const key of ['cookie','authorization','x-dsh-desktop-renderer'])assert.equal(observed.headers[key],undefined)
  } finally {
    await new Promise(done=>proxy.close(done));await new Promise(done=>upstream.close(done))
  }
})

test('module install commits only with a completion marker and checks core version', async (t) => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return t.skip('fixture targets the macOS arm64 module')
  const config = settings('module-install')
  mkdirSync(config.backendDir, {recursive:true})
  writeFileSync(join(config.backendDir,'installed.json'), JSON.stringify({version:'1.5.0'}, null, 2))
  const content = join(root,'module-content')
  mkdirSync(join(content,'site-packages'), {recursive:true})
  writeFileSync(join(content,'manifest.json'), JSON.stringify({id:'local-llm', version:'1.0.0', platform:'darwin-arm64'}))
  writeFileSync(join(content,'site-packages','fixture.txt'), 'fixture')
  const archive = join(root,'module.tar.gz')
  execFileSync('tar',['-czf',archive,'-C',content,'.'])
  const def = {
    id:'local-llm', version:'1.0.0', platform:'darwin-arm64', requiresCore:'1.5.0',
    url:'file://'+archive, sha256:hash(archive), size:1,
  }
  await host.installModuleAsync(config, def)
  const installed = host.moduleDefs(config).find(item => item.id === 'local-llm')
  assert.equal(installed.installed, true)
  assert.ok(existsSync(join(installed.dir, 'installed.json')))
  rmSync(join(installed.dir, 'installed.json'))
  assert.equal(host.moduleDefs(config).find(item => item.id === 'local-llm').installed, false)

  const old = settings('module-old-core')
  mkdirSync(old.backendDir, {recursive:true})
  writeFileSync(join(old.backendDir,'installed.json'), JSON.stringify({version:'1.0.0'}, null, 2))
  await assert.rejects(host.installModuleAsync(old, def), /需要核心/)
})

// Tiny handcrafted archives exercise metadata that a filename-only listing misses.
function tarFixture(name, entries) {
  const blocks=[]
  for(const {path, type='0', link='', data=''} of entries) {
    const body=Buffer.from(data), header=Buffer.alloc(512)
    const put=(offset,length,text)=>header.write(text,offset,length,'utf8')
    put(0,100,path); put(100,8,'0000755\0'); put(108,8,'0000000\0'); put(116,8,'0000000\0')
    put(124,12,body.length.toString(8).padStart(11,'0')+'\0'); put(136,12,'00000000000\0')
    header.fill(32,148,156); put(156,1,type); put(157,100,link); put(257,6,'ustar\0'); put(263,2,'00')
    put(148,8,[...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ')
    blocks.push(header,body,Buffer.alloc((512-body.length%512)%512))
  }
  blocks.push(Buffer.alloc(1024))
  const archive=join(root,name+'.tar.gz')
  writeFileSync(archive,gzipSync(Buffer.concat(blocks)))
  return archive
}
function paxField(key,value) {
  const record=` ${key}=${value}\n`; let size=record.length+1
  while(String(size).length+record.length!==size) size=String(size).length+record.length
  return String(size)+record
}

test('tar preserves package-local runtime symlinks, hardlinks and PAX paths', async()=>{
  const archive=tarFixture('safe-links',[
    {path:'lib/python',data:'runtime'},
    {path:'bin/python',type:'2',link:'../lib/python'},
    {path:'lib/copy',type:'1',link:'lib/python'},
    {path:'pax',type:'x',data:paxField('path','lib/long-name')},
    {path:'placeholder',data:'pax content'},
  ])
  const dest=join(root,'safe-links-output')
  await host.extractArchive(archive,dest)
  assert.equal(readFileSync(join(dest,'bin/python'),'utf8'),'runtime')
  assert.equal(readFileSync(join(dest,'lib/copy'),'utf8'),'runtime')
  assert.equal(readFileSync(join(dest,'lib/long-name'),'utf8'),'pax content')
})

for(const [name,entries] of [
  ['parent',[{path:'../escaped',data:'bad'}]],
  ['absolute',[{path:'/escaped',data:'bad'}]],
  ['windows-drive',[{path:'C:/escaped',data:'bad'}]],
  ['windows-alias',[{path:'.git./config',data:'bad'}]],
  ['windows-device',[{path:'NUL:stream',data:'bad'}]],
  ['gnu-long-path',[{path:'long',type:'L',data:'../escaped\0'},{path:'safe',data:'bad'}]],
  ['pax-global',[{path:'pax',type:'g',data:paxField('path','../escaped')},{path:'safe',data:'bad'}]],
  ['special-file',[{path:'device',type:'3'}]],
  ['symlink-outside',[{path:'link',type:'2',link:'../outside'}]],
  ['hardlink-outside',[{path:'link',type:'1',link:'../outside'}]],
  ['pax-path',[{path:'pax',type:'x',data:paxField('path','../escaped')},{path:'safe',data:'bad'}]],
  ['pax-link',[{path:'pax',type:'x',data:paxField('linkpath','/outside')},{path:'safe',type:'2',link:'safe'}]],
  ['link-child',[{path:'folder',type:'2',link:'inside'},{path:'folder/file',data:'bad'}]],
  ['duplicate',[{path:'file',data:'ok'},{path:'file',type:'2',link:'inside'}]],
  ['repository-metadata',[{path:'.git/config',data:'bad'}]],
]) {
  test(`tar rejects ${name} before extracting any member`, async()=>{
    const archive=tarFixture('reject-'+name,[{path:'sentinel',data:'must not extract'},...entries])
    const dest=join(root,'reject-'+name+'-output')
    await assert.rejects(host.extractArchive(archive,dest))
    assert.equal(existsSync(join(dest,'sentinel')),false)
  })
}


test('tar refuses existing destination symlinks before writing any file', async()=>{
  const outside=join(root,'outside-links'); mkdirSync(outside)
  const dest=join(root,'existing-link-output'); mkdirSync(dest)
  symlinkSync(outside,join(dest,'folder'))
  const archive=tarFixture('existing-link',[{path:'sentinel',data:'no write'},{path:'folder/file',data:'bad'}])
  await assert.rejects(host.extractArchive(archive,dest))
  assert.equal(existsSync(join(dest,'sentinel')),false)
  assert.equal(existsSync(join(outside,'file')),false)
})
