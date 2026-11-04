import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function fixture(fetch = async () => ({ ok: true, text: async () => '{"ok":true}' })) {
  let cursor = 0
  const effects = [], timers = []
  const state = []
  const hook = (initial) => {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
  }
  const React = {
    Component: class {}, createElement: (type, props, ...children) => ({ type, key: props?.key, props: props || {}, children: children.flat(Infinity) }),
    useState: hook, useRef: initial => hook(() => ({ current: initial }))[0],
    useCallback: callback => callback, useEffect: callback => effects.push(callback), useMemo: callback => callback(),
  }
  let audit
  const window = { __ModuleLoader__: { load: ({ factory }) => {
    factory(() => React)
    audit = window.audit
  } } }
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(
    "    return {\n      inject: ['slots', 'locale'],",
    "    window.audit = { useConsole, taskTarget, taskRunReason, executionRows, Tasks, TaskDetail, Plans, safeConsoleHref, TEXT, Diagnostics, Rail, Devices };\n    return {\n      inject: ['slots', 'locale'],",
  )
  vm.runInNewContext(source, { window, fetch, console, URL, AbortController, setTimeout, clearTimeout, setInterval: (callback, delay) => { timers.push({callback, delay}); return timers.length }, clearInterval: () => {} })
  return { audit, effects, timers, renderDevices: props => { cursor = 0; return audit.Devices(props) }, renderRail: props => { cursor = 0; return audit.Rail(props) }, renderDiagnostics: props => { cursor = 0; return audit.Diagnostics(props) }, render: () => { cursor = 0; return audit.useConsole(key => key) } }
}

function nodes(tree) {
  return (Array.isArray(tree) ? tree : [tree]).flatMap(node => node && typeof node === 'object'
    ? [node, ...nodes(node.children || [])] : [])
}

test('refreshing does not unlock a pending schedule or permit duplicate submissions', async () => {
  let finish, submissions = 0
  const f = fixture(async (path, options = {}) => {
    if (path === '/onmyoji/api/schedules' && options.method === 'POST') {
      submissions++
      if (submissions === 1) {
        return new Promise(resolve => { finish = () => resolve({ ok: true, text: async () => '{"ok":true}' }) })
      }
    }
    return { ok: true, text: async () => '{"ok":true}' }
  })
  const first = f.render().createSchedule('daily', 'device-a')
  await f.render().refresh()
  assert.equal(f.render().isBusy('schedule:create'), true)
  await f.render().createSchedule('duplicate', 'device-a')
  assert.equal(submissions, 1)
  finish()
  await first
  assert.equal(f.render().isBusy('schedule:create'), false)
})

test('task targets preserve explicit assignments and otherwise follow the selected device', () => {
  const { audit } = fixture()
  assert.equal(audit.taskTarget({ device: 'selected' }, { device: { assigned: 'assigned' } }), 'assigned')
  assert.equal(audit.taskTarget({ device: 'selected' }, { device: { assigned: '' } }), 'selected')
})

test('unknown execution status blocks submission without treating a healthy service as offline', () => {
  const { audit } = fixture()
  const c = { offline: false, data: { device: 'a', resourceErrors: { running: 'unavailable' }, devices: [], running: {} }, isBusy: () => false }
  assert.equal(audit.taskRunReason(c, { enabled: true, entry_state: 'ready' }, key => key), 'execution.statusUnavailable')
})

test('task detail rejects invalid runs and keeps an unassigned task following the device', () => {
  const { audit } = fixture()
  const c = { offline: false, busy: '', data: { device: 'a', resourceErrors: {}, devices: [{ serial: 'a', online: true }], executions: [], running: {} }, isBusy: () => false }
  const task = { id: 'task', name: 'Task', enabled: true, entry_state: 'ready', device: { assigned: '' }, count: { supported: true, value: 0, max: 99 } }
  const tree = nodes(audit.TaskDetail({ t: key => key, c, task, onClose: () => {} }))
  assert.equal(tree.find(node => node.type === 'select').props.value, '')
  assert.equal(tree.find(node => node.type === 'button' && node.children.includes('actions.run')).props.disabled, true)
  assert.equal(tree.find(node => node.type === 'button' && node.children.includes('actions.save')).props.disabled, true)
})

test('locales have identical keys and no duplicate entries', () => {
  const { audit } = fixture()
  const keys = audit.TEXT.map(([key]) => key)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(audit.TEXT.every(row => row.length === 3 && row.every(value => typeof value === 'string')))
})

test('console links accept only HTTP URLs without embedded credentials', () => {
  const {audit} = fixture()
  assert.equal(audit.safeConsoleHref('javascript:alert(1)'), 'http://127.0.0.1:8787')
  assert.equal(audit.safeConsoleHref('data:text/html,unsafe'), 'http://127.0.0.1:8787')
  assert.equal(audit.safeConsoleHref('https://user:password@example.invalid/'), 'http://127.0.0.1:8787')
  assert.equal(audit.safeConsoleHref('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/')
})

test('execution stop uses its ID rather than stopping a later run on the device', async () => {
  const requests=[]
  const f=fixture(async (path, options={})=>{
    if(options.method==='POST') requests.push(path)
    return {ok:true,text:async()=>'{"ok":true}'}
  })
  const id='a'.repeat(32)
  await f.render().stopDevice('device-a', id)
  assert.deepEqual(requests, ['/onmyoji/api/executions/'+id+'/stop'])
})

test('schedule run selects asynchronous execution only when advertised', async () => {
  const requests=[]
  const f=fixture(async (path, options={})=>{
    if(options.method==='POST') requests.push(path)
    return {ok:true,text:async()=>JSON.stringify(path.endsWith('/health')
      ? {ok:true,features:{schedule_executions:true}} : {ok:true})}
  })
  await f.render().refresh()
  await f.render().runSchedule('plan-a')
  assert.deepEqual(requests, ['/onmyoji/api/schedules/plan-a/executions'])
})


test('diagnostics starts with troubleshooting and reveals only the chosen maintenance panel', () => {
  const f=fixture(); let baselines=0, checks=0;
  const c={data:{health:{ok:true,instance:{kind:'source'}},scheduler:{running:true},oas:{dirty_count:36},
    backend:{canStart:true},oasRuntime:{exists:true,canUpdate:true,tracked_dirty:26},
    baseline:{canBaseline:true,baselines:[]},backendRuntime:{},modules:{modules:[]}},
    pendingKeys:[],offline:false,isBusy:()=>false,createBaseline:()=>{baselines++},checkOasRuntime:()=>{checks++}};
  const render=()=>nodes(f.renderDiagnostics({t:key=>key,c}));
  const button=(tree,label)=>tree.find(n=>n.type==='button' && nodes(n).some(x=>x.children.includes(label)));
  let tree=render();
  assert.ok(button(tree,'actions.export'));
  assert.equal(button(tree,'actions.stopService'),undefined);
  assert.equal(button(tree,'diag.backendInstall'),undefined);
  assert.equal(button(tree,'diag.baselineCreate'),undefined);
  button(tree,'diag.maintainOas').props.onClick();tree=render();
  assert.equal(button(tree,'diag.baselineCreate'),undefined);
  const disclosure=button(tree,'diag.baseline');
  assert.equal(disclosure.props['aria-expanded'],false);
  disclosure.props.onClick();tree=render();
  assert.equal(button(tree,'diag.baseline').props['aria-expanded'],true);
  button(tree,'diag.baselineCreate').props.onClick();assert.equal(baselines,1);
  button(tree,'diag.mirrorTitle').props.onClick();tree=render();
  assert.equal(button(tree,'diag.baselineCreate'),undefined);
  assert.equal(button(tree,'diag.oasUpdateNow').props.disabled,true);
  button(tree,'actions.checkUpdate').props.onClick();assert.equal(checks,1);
  button(tree,'diag.advanced').props.onClick();tree=render();
  button(tree,'diag.actions').props.onClick();tree=render();
  assert.ok(button(tree,'actions.stopService'));
  button(tree,'diag.summary').props.onClick();tree=render();
  assert.equal(button(tree,'actions.stopService'),undefined);
  assert.ok(button(tree,'actions.export'));
})


test('observation content stays unmounted until requested and expansion does not capture a screen', () => {
  const f=fixture();let captures=0;
  const props={t:key=>key,c:{data:{devices:[],recent:[]},shot:{},refreshScreenshot:()=>{captures++}}};
  let tree=nodes(f.renderRail(props));
  assert.equal(tree.some(n=>n.props.className==='onm-shot'),false);
  tree.find(n=>n.type==='button').props.onClick();
  tree=nodes(f.renderRail(props));
  assert.equal(tree.some(n=>n.props.className==='onm-shot'),true);
  assert.equal(captures,0);
  tree.find(n=>n.props['aria-controls']==='onm-observation-content').props.onClick();
  assert.equal(nodes(f.renderRail(props)).some(n=>n.props.className==='onm-shot'),false);
})


test('newer live state survives an older full refresh', async () => {
let mode='initial', release;
const job={id:'a'.repeat(32),device:'test',task_id:'test'};
const f=fixture(async path=>{
  const snapshot=mode;
  if(snapshot==='old-full' && path==='/onmyoji/backend/status') await new Promise(resolve=>{release=resolve});
  let value={ok:true};
  if(path.endsWith('/health')) value={ok:true,features:{executions:true}};
  if(path.endsWith('/executions')) value={ok:true,executions:[{...job,state:snapshot==='new-live'?'succeeded':'running'}]};
  if(path.endsWith('/running')) value={ok:true,running:snapshot==='new-live'?{}:{test:{task_id:'test'}}};
  return {ok:true,text:async()=>JSON.stringify(value)};
});
f.render();
const initialEffects=[...f.effects];
initialEffects.forEach(effect=>effect());
await f.render().refresh();
f.render();
mode='old-full';
const pending=f.render().refresh();
await new Promise(resolve=>setImmediate(resolve));
assert.ok(release);
mode='new-live';
await f.timers.find(item=>item.delay===3000).callback();
const afterLive=f.render().data.executions[0].state;
release();await pending;
const afterFull=f.render().data.executions[0].state;
assert.equal(afterLive,'succeeded');assert.equal(afterFull,'succeeded');

})

function standaloneFixture(fetch) {
  const source = readFileSync(new URL('../../../web/ui.js', import.meta.url), 'utf8')
    .split('document.addEventListener("click"')[0]
  const sandbox = { location:{protocol:'http:'}, localStorage:{getItem:()=>null,setItem:()=>{}},
    fetch, URL, AbortController, setTimeout, clearTimeout, console }
  vm.runInNewContext(source + '\nrender = () => {}; globalThis.audit = {state, loadAll, refreshLive};', sandbox)
  return sandbox.audit
}

for (const surface of ['plugin', 'standalone']) {
  for (const older of ['full', 'live']) {
    test(`${surface}: stale ${older} failures cannot erase newer execution or health state`, async () => {
      let mode='initial', release
      const job={id:'b'.repeat(32),device:'test',task_id:'test'}
      const fetch=async path=>{
        const snapshot=mode
        if (snapshot==='old' && path.endsWith('/health')) {
          await new Promise(resolve=>{release=resolve})
          throw new Error('old health failure')
        }
        const value=path.endsWith('/health')?{ok:true,features:{executions:true}}
          :path.endsWith('/executions')?{ok:true,executions:[{...job,state:snapshot==='old'?'running':'succeeded'}]}
          :path.endsWith('/running')?{ok:true,running:snapshot==='old'?{test:{task_id:'test'}}:{}}
          :{ok:true}
        return {ok:true,text:async()=>JSON.stringify(value)}
      }
      let full, live, data, offline
      if(surface==='plugin') {
        const f=fixture(fetch)
        f.render(); [...f.effects].forEach(effect=>effect())
        full=()=>f.render().refresh()
        live=()=>f.timers.find(item=>item.delay===3000).callback()
        data=()=>f.render().data
        offline=()=>f.render().offline
      } else {
        const f=standaloneFixture(fetch)
        full=()=>f.loadAll(); live=()=>f.refreshLive(); data=()=>f.state
        offline=()=>f.state.health?.ok!==true
      }
      await full()
      mode='old'
      const pending=(older==='full'?full:live)()
      await new Promise(resolve=>setImmediate(resolve))
      assert.ok(release)
      mode='new'
      await (older==='full'?live:full)()
      release(); await pending
      assert.equal(data().executions[0].state,'succeeded')
      assert.deepEqual(Object.keys(data().running),[])
      assert.equal(data().resourceErrors.health,undefined)
      assert.equal(offline(),false)
    })
  }
}


test('device stop captures execution identity and refuses serial-only fallback', async()=>{
  const requests=[]
  const f=fixture(async (path,options={})=>{
    if(options.method==='POST') requests.push(path)
    return {ok:true,text:async()=>'{"ok":true}'}
  })
  await f.render().stopDevice('test')
  assert.deepEqual(requests,[])
  const calls=[], id='c'.repeat(32)
  const c={data:{devices:[{serial:'test',online:true}],running:{test:{task_id:'test'}},catalog:[],
    executions:[{id,device:'test',state:'preparing'}]},isBusy:()=>false,
    stopDevice:(...args)=>calls.push(args)}
  const tree=nodes(f.renderDevices({t:key=>key,c,draft:{serial:"",name:""},onDraft:()=>{}}))
  tree.find(n=>n.type==='button' && n.children.includes('actions.stopTask')).props.onClick()
  assert.deepEqual(calls,[['test',id]])
})
