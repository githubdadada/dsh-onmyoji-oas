/**
 * Client half of the 阴阳师 OAS bundle.
 *
 * Registers two slot cells that share one id:
 *   - sidebar.panellist / 'onmyoji'  -> the icon in the left sidebar
 *   - main            / 'onmyoji'  -> the OAS console page
 *
 * Data comes from the Host half's same-origin proxy (/onmyoji/api/*), so no
 * iframe, no CORS, and the page inherits the Harness theme and locale.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-onmyoji-console',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'onmyoji-console'
    const API = '/onmyoji/api'
    const CONTROL = '/onmyoji/backend'
    const BASELINE = '/onmyoji/baseline'
    const OAS_RUNTIME = '/onmyoji/oas-runtime'
    const BACKEND_RUNTIME = '/onmyoji/backend-runtime'
    const MODULES = '/onmyoji/modules'
    const CONSOLE_URL = 'http://127.0.0.1:8787'
    const OAS_DOCS = 'https://runhey.github.io/OnmyojiAutoScript-website/docs/user-manual/installation/'
    const OAS_REPO = 'https://github.com/runhey/OnmyojiAutoScript'

    // [key, zh, en] keeps both dictionaries structurally identical.
    const TEXT = [
      ['plans.fixedCount', '固定 {n} 次', 'Fixed: {n} runs'],
      ['plans.defaultCount', '次数跟随任务默认设置；未设置次数的任务按自身规则执行', 'Runs follow task defaults; tasks without run counts use their own rules'],
      ['diag.moduleDescription', '本地模型所需依赖；模型文件需单独放置。', 'Dependencies for local models; model files are supplied separately.'],
      ["diag.summary", "状态与排障", "Status and troubleshooting"],
      ["diag.maintainOas", "OAS 更新与备份", "OAS updates and backups"],
      ["diag.environment", "安装与组件", "Installation and modules"],
      ["diag.advanced", "高级操作", "Advanced actions"],
      ["diag.simpleHint", "先确认运行状态；更新、安装和恢复按需打开。", "Check status first. Open updates, installation and recovery only when needed."],
      ["diag.localChangesHint", "OAS 有本地修改。镜像更新已受保护，不影响当前运行；更新前先核对并备份这些修改。", "OAS has local changes. Mirror updates are protected; current operation is unaffected. Review and back up the changes before updating."],
      ["diag.troubleshootHint", "遇到问题时先刷新状态；需要进一步排查时导出诊断包。", "Refresh status first. Export diagnostics when further investigation is needed."],
      ["diag.mirrorTitle", "镜像下载与更新（高级）", "Mirror download and update (advanced)"],
      ["diag.mirrorHint", "此入口直接维护配置的 OAS 目录；已有本地修改时不允许镜像更新。", "This manages the configured OAS directory directly. Mirror updates require a clean tracked working tree."],
      ["diag.pathsTitle", "配置与数据位置", "Configuration and data locations"],
      ["diag.sourceModeHint", "当前使用源码后端；便携包和它的可选组件是另一套环境，不是当前服务的必装项。", "The source backend is connected. The portable package and its modules are a separate, optional environment."],
      ["diag.advancedHint", "以下操作会启动任务、拉起设备或停止服务，请按需要执行。", "These actions may run due tasks, launch devices or stop the service."],
      ["diag.available", "可用", "Available"],
      ["diag.notDetected", "未检测到", "Not detected"],
      ['plans.upgradeBackend', '计划预览需要更新控制台后端；现有计划仍会正常执行。', 'Update the console backend to preview schedules. Existing schedules continue to run.'],
      ['plans.backendDefault', '后端默认设备', 'Backend default device'],
      ['plans.edit', '编辑计划', 'Edit schedule'],
      ['plans.confirm', '确认保存', 'Confirm and save'],
      ['plans.preview', '预览计划', 'Preview schedule'],
      ['plans.reviewHint', '先预览识别出的任务、时间与设备，确认后再保存。', 'Preview the task, timing and device before saving.'],
      ['maintenance.title', '安装、更新与恢复', 'Install, update and recover'],
      ['overview.sunday', '仅周日', 'Sundays only'],
      ['settings.options', '任务选项', 'Task options'],
      ['settings.count', '次数', 'Runs'],
      ['settings.device', '设备', 'Device'],
      ['settings.partial', '保存未全部完成：{saved}。未保存项：{failed}。请核对后重试。', 'Settings were not fully saved. Saved: {saved}. Failed: {failed}. Review before retrying.'],
      ['plans.noResult', '尚未执行', 'Not run yet'],
      ['plans.lastResult', '上次执行', 'Last execution'],
      ['plans.deleteConfirm', '删除这项计划？此操作不会停止已经运行的任务。', 'Delete this schedule? A running task will not be stopped.'],
      ['device.deleteConfirm', '删除设备 {name}？已保存的任务和计划可能仍引用它。', 'Delete device {name}? Saved tasks and schedules may still refer to it.'],
      ['observe.title', '设备画面与执行历史', 'Screen and execution history'],
      ['data.refreshed', '数据更新于 {time}', 'Updated at {time}'],
      ['data.catalogFailed', '任务目录读取失败，请重试', 'Task catalog could not be loaded. Retry to continue.'],
      ['data.partial', '部分数据读取失败；以下内容可能过期', 'Some data could not be loaded and may be stale'],
      ['data.health', '服务', 'Service'],
      ['data.catalog', '任务目录', 'Task catalog'],
      ['data.running', '运行状态', 'Execution status'],
      ['data.devices', '设备', 'Devices'],
      ['data.schedules', '计划', 'Schedules'],
      ['data.executions', '执行结果', 'Execution results'],
      ['data.maintenance', '维护信息', 'Maintenance'],
      ['diag.currentInstance', '当前连接的运行环境', 'Connected runtime'],
      ['diag.sourceInstance', '源码后端', 'Source backend'],
      ['diag.portableInstance', '便携后端', 'Portable backend'],
      ['diag.unknownInstance', '来源未确认；请更新后端后再管理进程', 'Unknown origin; update the backend before managing processes'],
      ['diag.instanceHint', '下方维护按对象分组，停止或重启前请确认当前来源。', 'Maintenance is grouped by target. Check the connected runtime before stopping or restarting.'],
      ['diag.moduleMounted', '当前便携进程已挂载依赖；模型需另行配置', 'Mounted in the portable process; configure a model separately'],
      ['diag.modulePending', '文件已安装，当前进程尚未挂载；需启动或重启便携后端', 'Installed on disk, not mounted in the current process; start or restart the portable backend'],
      ['diag.moduleStopFirst', '先停止便携后端，再移除组件', 'Stop the portable backend before removing this component'],
      ['diag.maintenanceBusy', '已有维护操作，请等待完成', 'Wait for the current maintenance operation'],
      ['diag.result', '最近维护结果', 'Latest maintenance result'],
      ['error.timeout', '请求超时，操作可能仍在进行；请先刷新状态，避免重复提交。', 'Request timed out. The operation may still be running; refresh before retrying.'],
      ['task.moreSettings', '更多设置与说明', 'More settings and information'],
      ['task.invalidCount', '次数必须为 1–{max} 的整数', 'Runs must be an integer from 1 to {max}'],
      ['execution.empty', '暂无执行记录；开始任务后可在所有页面查看和停止。', 'No executions yet. Status and stop controls are available across all pages.'],
      ['execution.legacy', '旧版后端：此记录仅在当前页面保留', 'Older backend: this record is kept on this page only'],
      ['execution.details', '查看结果与步骤', 'View result and steps'],
      ['execution.retryConfirm', '重新运行整项任务可能重复已完成步骤，继续？', 'Running the task again may repeat completed steps. Continue?'],
      ['execution.statusUnavailable', '运行状态暂不可读，确认设备状态后再提交', 'Execution status is unavailable. Refresh before submitting.'],
      ['execution.submitted', '任务已提交，可在执行栏查看状态与结果', 'Task submitted. Follow its status and result in the execution panel.'],
      ['execution.partial', '部分步骤失败', 'Some steps failed'],
      ['execution.failed', '执行失败', 'Failed'],
      ['execution.succeeded', '已完成', 'Completed'],
      ['execution.stopped', '已停止', 'Stopped'],
      ['execution.unknown', '结果待确认，请刷新运行状态', 'Result unknown; refresh execution status'],
      ['execution.stopping', '正在停止', 'Stopping'],
      ['execution.running', '运行中', 'Running'],
      ['execution.preparing', '正在准备', 'Preparing'],
      ['execution.title', '执行与结果', 'Executions and results'],
      ['actions.retryTask', '重新运行', 'Run again'],
      ['actions.settings', '设置', 'Settings'],
      ['actions.stopTask', '停止任务', 'Stop task'],
      ['panel.label', '阴阳师 OAS', 'Onmyoji OAS'],
      ['app.eyebrow', 'ONMYOJI AUTOSCRIPT', 'ONMYOJI AUTOSCRIPT'],
      ['app.title', '阴阳师 OAS', 'Onmyoji OAS'],
      ['app.subtitle', 'OnmyojiAutoScript · 平安京管家控制台', 'OnmyojiAutoScript · Heian-Kyo desk'],
      ['status.on', '服务已连接', 'Service connected'],
      ['status.off', '本地服务离线', 'Service offline'],
      ['status.deviceOn', '设备在线', 'Device online'],
      ['status.deviceOff', '设备离线', 'Device offline'],
      ['actions.refresh', '刷新', 'Refresh'],
      ['actions.openConsole', '打开原控制台', 'Open console'],
      ['actions.startService', '启动本地服务', 'Start service'],
      ['actions.stopService', '停止本地服务', 'Stop service'],
      ['actions.starting', '正在启动…', 'Starting…'],
      ['actions.docs', '安装文档', 'Install docs'],
      ['actions.repo', 'GitHub 仓库', 'GitHub repo'],
      ['actions.run', '开始运行', 'Run'],
      ['actions.running', '执行中…', 'Running…'],
      ['actions.save', '保存为默认', 'Save defaults'],
      ['actions.saving', '保存中…', 'Saving…'],
      ['actions.close', '关闭', 'Close'],
      ['actions.delete', '删除', 'Delete'],
      ['actions.enable', '启用', 'Enable'],
      ['actions.disable', '停用', 'Disable'],
      ['actions.connect', '连接', 'Connect'],
      ['actions.warm', '拉起游戏', 'Launch game'],
      ['actions.setCurrent', '设为当前', 'Use device'],
      ['actions.add', '添加设备', 'Add device'],
      ['actions.adding', '添加中…', 'Adding…'],
      ['actions.create', '创建计划', 'Create schedule'],
      ['actions.creating', '创建中…', 'Creating…'],
      ['actions.more', '显示更多', 'Show more'],
      ['actions.checkUpdate', '检查更新', 'Check updates'],
      ['actions.checking', '检查中…', 'Checking…'],
      ['actions.tick', '检查到期任务', 'Check due tasks'],
      ['actions.warmAll', '拉起已启用设备', 'Warm enabled devices'],
      ['actions.export', '导出诊断包', 'Export diagnostics'],
      ['actions.exporting', '导出中…', 'Exporting…'],
      ['actions.retry', '重试', 'Retry'],
      ['tab.overview', '总览', 'Overview'],
      ['tab.tasks', '任务库', 'Tasks'],
      ['tab.plans', '计划', 'Schedules'],
      ['tab.devices', '设备', 'Devices'],
      ['tab.diagnostics', '诊断', 'Diagnostics'],
      ['common.loading', '正在读取…', 'Loading…'],
      ['common.none', '无', 'None'],
      ['common.unknown', '未知', 'Unknown'],
      ['common.empty', '暂无数据', 'No data'],
      ['common.online', '在线', 'Online'],
      ['common.offline', '离线', 'Offline'],
      ['common.device', '设备', 'Device'],
      ['common.task', '任务', 'Task'],
      ['common.count', '次', 'runs'],
      ['common.nextRun', '下次', 'Next'],
      ['common.lastRun', '上次', 'Last'],
      ['common.service', '服务', 'Service'],
      ['common.version', '版本', 'Version'],
      ['common.branch', '分支', 'Branch'],
      ['common.commit', '提交', 'Commit'],
      ['common.dirty', '本地改动', 'Local changes'],
      ['common.mode', '模式', 'Mode'],
      ['common.notSelected', '未选择', 'Not selected'],
      ['common.notSet', '未标记', 'Not set'],
      ['common.followDevice', '跟随当前设备', 'Follow current device'],
      ['overview.eyebrow', 'OVERVIEW', 'OVERVIEW'],
      ['overview.title', 'OAS 总览', 'OAS overview'],
      ['overview.subtitle', '本地 OnmyojiAutoScript 的运行状态、版本与官方入口', 'Local OnmyojiAutoScript status, version, and official links'],
      ['overview.heroReadyTitle', '设备已连接', 'Device connected'],
      ['overview.heroReadyBody', '当前设备：{name}。提交后会检查游戏状态，再执行任务。', 'Current device: {name}. The game is checked before execution.'],
      ['overview.heroRunTitle', '任务正在执行', 'Task running'],
      ['overview.heroRunBody', '{task} 正在 {device} 上运行，可随时停止。', '{task} is running on {device}; stop it at any time.'],
      ['overview.heroOfflineTitle', '先启动本地服务', 'Start the local service'],
      ['overview.heroOfflineBody', '页面已加载，但本地控制台未运行。启动后即可读取 OAS 任务、设备与证据。', 'The page is loaded, but the local console is not running. Start it to read OAS tasks, devices, and evidence.'],
      ['overview.heroIdleTitle', '先连接一台设备', 'Connect a device'],
      ['overview.heroIdleBody', '连接模拟器并确认阴阳师已打开，再开始一键日常或单项任务。', 'Connect an emulator, make sure Onmyoji is open, then start a routine or a single task.'],
      ['overview.heroRuntimeTitle', '先启动便携后端', 'Start the portable backend'],
      ['overview.heroRuntimeBody', '后端已安装但未运行，点击启动；首次启动需要几秒。', 'The backend is installed but not running. Start it; the first launch takes a few seconds.'],
      ['overview.heroInstallTitle', '一键安装后端', 'Install the backend'],
      ['overview.heroInstallBody', '自动安装 Python、控制台和 OAS；不需要 .app，也不需要手动装 Python。macOS arm64 核心约 534MiB。', 'Installs Python, the console, and OAS automatically; no .app and no manual Python setup. About 700MB on first run.'],
      ['overview.pathHint', '在仓库根目录运行', 'Run in the repository root'],
      ['overview.serviceHint', '也可在终端执行 ./start.sh --foreground', 'Or run ./start.sh --foreground in a terminal'],
      ['overview.oneclick', '一键日常', 'Daily routine'],
      ['overview.browseTasks', '浏览任务库', 'Browse tasks'],
      ['overview.manageDevices', '管理设备', 'Manage devices'],
      ['overview.metricDevice', '当前设备', 'Current device'],
      ['overview.metricTasks', '可执行任务', 'Runnable tasks'],
      ['overview.metricNext', '下一项计划', 'Next schedule'],
      ['overview.metricOas', 'OAS 任务入口', 'OAS task entries'],
      ['overview.running', '当前执行', 'Now running'],
      ['overview.noRunning', '当前没有运行中的任务', 'No task is running'],
      ['overview.noRunningHint', '启动后这里会显示执行设备与停止入口', 'The running device and stop control appear here'],
      ['overview.frequent', '常用任务', 'Frequent tasks'],
      ['overview.sequence', '一键日常执行序', 'Daily routine order'],
      ['overview.allTasks', '全部任务', 'All tasks'],
      ['overview.oasTitle', 'OnmyojiAutoScript', 'OnmyojiAutoScript'],
      ['overview.oasBody', '上游仓库与本地工作树状态', 'Upstream repository and local work tree'],
      ['overview.updateHint', '只读检查，不会改动工作区', 'Read-only check; the work tree is not modified'],
      ['overview.previewHint', '预览只读，不会修改工作区', 'Preview is read-only; the work tree is not modified'],
      ['overview.preview', '预览变更', 'Preview changes'],
      ['overview.previewing', '预览中…', 'Previewing…'],
      ['overview.apply', '确认更新', 'Apply update'],
      ['overview.applying', '更新中…', 'Updating…'],
      ['overview.rollback', '回滚上一版', 'Roll back'],
      ['overview.rollingBack', '回滚中…', 'Rolling back…'],
      ['overview.previewSummary', '将应用 {n} 个提交，改动 {m} 个文件；本地脏文件 {d} 个。', 'Applies {n} commits, {m} files; {d} dirty local files.'],
      ['overview.dirtyNote', '本地改动会先 stash；冲突会如实上报并保留。', 'Local changes are stashed first; conflicts are reported and preserved.'],
      ['overview.applyConfirm', '更新前会自动备份；确定应用上游更新？', 'A backup is created first. Apply the upstream update?'],
      ['overview.rollbackConfirm', '回滚会重置 OAS 工作树到上一份备份，确定？', 'Roll back the OAS work tree to the last backup?'],
      ['overview.updateDone', '更新完成', 'Update finished'],
      ['overview.rollbackDone', '回滚完成', 'Rollback finished'],
      ['overview.previewFirst', '请先预览变更', 'Preview changes first'],
      ['overview.steps', '步骤', 'Steps'],
      ['overview.restartNote', '更新后建议重启本地服务，使新代码完全生效。', 'Restart the local service after updating so the new code takes effect.'],
      ['overview.noRootTitle', '未找到控制台目录', 'Console directory not found'],
      ['overview.noRootBody', '插件已加载，但没有找到 OAS 控制台仓库。请先启动控制台（./start.sh），或在配置文件中填写 root。', 'The plugin loaded, but no OAS console checkout was found. Start the console (./start.sh) or set root in the config file.'],
      ['overview.configHint', '配置文件', 'Config file'],
      ['overview.upToDate', '与远端同步', 'Up to date with upstream'],
      ['overview.behind', '远端领先 {n} 个提交', 'Upstream is ahead by {n} commits'],
      ['overview.ahead', '本地领先 {n} 个提交', 'Local is ahead by {n} commits'],
      ['overview.checkFailed', '检查失败', 'Check failed'],
      ['task.expired', '已过期', 'Expired'],
      ['task.frozen', '代码冻结', 'Frozen'],
      ['task.unwired', '尚无入口', 'No entry'],
      ['task.disabled', '已停用', 'Disabled'],
      ['task.enabled', '已启用', 'Enabled'],
      ['task.setup', '查看与运行 →', 'Configure & run →'],
      ['task.count', '次数', 'Runs'],
      ['task.taskId', '任务 ID', 'Task ID'],
      ['task.source', '来源', 'Source'],
      ['task.entry', '代码入口', 'Entry'],
      ['task.note', '说明', 'Note'],
      ['task.device', '运行设备', 'Device'],
      ['task.advanced', '高级信息', 'Advanced'],
      ['task.energy', '体力', 'Energy'],
      ['task.disabledReason.expired', '活动已过期', 'The event has expired'],
      ['task.disabledReason.frozen', 'OAS 代码门禁已冻结', 'The OAS code gate is frozen'],
      ['task.disabledReason.unwired', '此任务还没有执行入口', 'This task has no execution entry yet'],
      ['task.disabledReason.off', '任务已停用', 'The task is disabled'],
      ['task.disabledReason.noDevice', '所选设备离线', 'The selected device is offline'],
      ['task.disabledReason.busy', '设备正在执行其他任务', 'The device is running another task'],
      ['cycle.daily', '每日', 'Daily'],
      ['cycle.weekly', '每周', 'Weekly'],
      ['cycle.event', '活动', 'Event'],
      ['cycle.other', '任务', 'Task'],
      ['kind.must_do', '日常', 'Routine'],
      ['kind.farm', '刷本', 'Farm'],
      ['kind.reward_only', '领奖', 'Reward'],
      ['kind.activity', '活动', 'Event'],
      ['kind.other', '任务', 'Task'],
      ['tasks.eyebrow', 'TASK LIBRARY', 'TASK LIBRARY'],
      ['tasks.title', '任务库', 'Task library'],
      ['tasks.subtitle', '选择任务即可按当前配置运行；需要调整时打开设置。', 'Run with the displayed settings, or open Settings to adjust them.'],
      ['tasks.search', '搜索任务、模块或说明', 'Search tasks, modules, or notes'],
      ['tasks.all', '全部', 'All'],
      ['tasks.ready', '已启用', 'Enabled'],
      ['tasks.daily', '每日', 'Daily'],
      ['tasks.weekly', '每周', 'Weekly'],
      ['tasks.event', '活动', 'Event'],
      ['tasks.found', '找到 {n} 项 · 已显示 {m} 项', '{n} found · {m} shown'],
      ['tasks.noMatch', '没有匹配任务，试试其他关键词或筛选条件', 'No matching task; try another keyword or filter'],
      ['plans.eyebrow', 'SCHEDULES', 'SCHEDULES'],
      ['plans.title', '计划', 'Schedules'],
      ['plans.subtitle', '用一句话创建定时任务；到点后仍按设备与任务门禁执行', 'Create a schedule from one sentence; device and task gates still apply'],
      ['plans.addTitle', '添加计划', 'Add schedule'],
      ['plans.addHint', '例如「结界寄养每六小时05分执行一次」', 'For example: “run kekkai foster every 6 hours at minute 5”'],
      ['plans.rule', '执行规则', 'Rule'],
      ['plans.placeholder', '每天 10:05 执行一键日常', 'Every day at 10:05 run the daily routine'],
      ['plans.existing', '已创建的计划', 'Created schedules'],
      ['plans.count', '{n} 项计划，{m} 项启用', '{n} schedules, {m} enabled'],
      ['plans.paused', '已暂停', 'Paused'],
      ['plans.enabled', '已启用', 'Enabled'],
      ['plans.runOnce', '运行一次', 'Run once'],
      ['plans.noPlans', '还没有计划，可先用上面的自然语言规则创建一项', 'No schedule yet; create one with the rule above'],
      ['plans.ruleMissing', '规则未提供', 'Rule unavailable'],
      ['devices.eyebrow', 'DEVICES', 'DEVICES'],
      ['devices.title', '设备', 'Devices'],
      ['devices.guess', '模拟器', 'Emulator'],
      ['devices.subtitle', '管理模拟器连接、账号标记与手动拉起', 'Manage emulator connections, account labels, and warm-up'],
      ['devices.serial', 'ADB serial', 'ADB serial'],
      ['devices.name', '显示名称', 'Display name'],
      ['devices.namePlaceholder', '我的模拟器', 'My emulator'],
      ['devices.serialPlaceholder', '127.0.0.1:5555', '127.0.0.1:5555'],
      ['devices.addTitle', '添加设备', 'Add device'],
      ['devices.manage', '设备管理 · 启停与删除', 'Manage devices · enable and delete'],
      ['devices.loginCharacter', '账号角色', 'Account'],
      ['devices.running', '正在执行', 'Running'],
      ['devices.noDevices', '尚未登记设备，可在下方添加模拟器的 ADB 地址', 'No device registered; add an emulator ADB address below'],
      ['devices.offlineHint', '设备离线时先启动模拟器，再点「连接」', 'Start the emulator first, then press Connect'],
      ['diag.eyebrow', 'DIAGNOSTICS', 'DIAGNOSTICS'],
      ['diag.title', '诊断', 'Diagnostics'],
      ['diag.subtitle', '运行状态、OAS 工作树与高级入口', 'Runtime state, OAS work tree, and advanced actions'],
      ['diag.actions', '运行操作', 'Runtime actions'],
      ['diag.scheduler', '调度器', 'Scheduler'],
      ['diag.schedulesEnabled', '{n} 项启用计划', '{n} enabled schedules'],
      ['diag.stopped', '已停止', 'Stopped'],
      ['diag.running', '运行中', 'Running'],
      ['diag.oasTree', 'OAS 工作树', 'OAS work tree'],
      ['diag.ticks', '累计轮询', 'Ticks'],
      ['diag.overdue', '到点未跑', 'Overdue'],
      ['diag.devicesReady', '设备就绪', 'Devices ready'],
      ['diag.autostart', '自动拉起', 'Auto start'],
      ['diag.autostartOn', '已启用', 'Enabled'],
      ['diag.autostartOff', '未启用', 'Disabled'],
      ['diag.exported', '诊断包已生成', 'Diagnostics archive created'],
      ['diag.stopConfirm', '停止本地服务会中断正在执行的任务，确定停止？', 'Stopping the local service interrupts running tasks. Stop it?'],
      ['diag.exportPath', '路径', 'Path'],
      ['diag.healthOffline', '本地服务不可用', 'The local service is unavailable'],
      ['diag.evidence', '证据库', 'Evidence DB'],
      ['diag.screenshots', '截图目录', 'Screenshots'],
      ['diag.exportDir', '导出目录', 'Export dir'],
      ['diag.consoleUrl', '控制台地址', 'Console URL'],
      ['diag.configPath', '配置文件', 'Config file'],
      ['diag.baseline', 'OAS 基线', 'OAS baseline'],
      ['diag.baselineDesc', '完整 git 历史 + 工作树快照，存于插件数据目录；上游删除后可从基线恢复', 'Full git history plus a work-tree snapshot, kept in the plugin data directory; restore after an upstream loss'],
      ['diag.baselineCreate', '创建基线', 'Create baseline'],
      ['diag.baselineCreating', '正在打包…', 'Packing…'],
      ['diag.baselineCreated', '基线已创建', 'Baseline created'],
      ['diag.baselineEmpty', '还没有基线', 'No baseline yet'],
      ['diag.baselineRestore', '恢复到新目录', 'Restore to a new directory'],
      ['diag.baselineRestoring', '恢复中…', 'Restoring…'],
      ['diag.baselineRestored', '已恢复到新目录', 'Restored to a new directory'],
      ['diag.baselineConfirmRestore', '将把基线克隆到一个新目录，不覆盖现有 OAS；继续？', 'Clone this baseline into a new directory; the existing OAS is untouched. Continue?'],
      ['diag.baselineUnavailable', '未找到 OAS git 仓库', 'OAS git repository not found'],
      ['diag.baselineDir', '基线目录', 'Baseline dir'],
      ['diag.baselineHead', '当前 OAS', 'Current OAS'],
      ['diag.baselineDirty', '工作树改动 {n} 项', '{n} work-tree changes'],
      ['diag.baselineDirtyLabel', '工作树改动', 'Work-tree changes'],
      ['diag.baselineSize', '大小', 'Size'],
      ['diag.baselineCreatedAt', '创建时间', 'Created'],
      ['diag.baselineCommit', '提交', 'Commit'],
      ['diag.baselineUntracked', '未跟踪 {n} 项', '{n} untracked'],
      ['diag.baselineNote', '基线包含完整提交历史；工作树 patch 与未跟踪文件归档另存，恢复时一并应用。', 'The baseline includes full commit history; the work-tree patch and untracked archive are stored beside it and re-applied on restore.'],
      ['diag.oasRuntime', 'OAS 运行时', 'OAS runtime'],
      ['diag.oasRuntimeDesc', '从配置的 GitHub 镜像下载/更新 OAS；不依赖上游仓库是否存活', 'Download/update OAS from the configured GitHub mirror; upstream availability is not required'],
      ['diag.oasMirror', '镜像地址', 'Mirror URL'],
      ['diag.oasLocal', '本地目录', 'Local path'],
      ['diag.oasInstall', '下载 OAS', 'Download OAS'],
      ['diag.oasInstalling', '下载中…', 'Downloading…'],
      ['diag.oasInstalled', 'OAS 已下载', 'OAS downloaded'],
      ['diag.oasUpdateNow', '更新到最新', 'Update to latest'],
      ['diag.oasUpdating', '更新中…', 'Updating…'],
      ['diag.oasUpdated', 'OAS 已更新', 'OAS updated'],
      ['diag.oasUpToDate', '已是最新', 'Up to date'],
      ['diag.oasBehind', '落后 {n} 个提交', '{n} commits behind'],
      ['diag.oasAhead', '本地领先 {n} 个提交', '{n} commits ahead'],
      ['diag.oasNoMirror', '未配置镜像地址', 'Mirror URL is not configured'],
      ['diag.oasMirrorHint', '在 ~/.dsh/onmyoji-oas.json 填写 oasMirrorUrl', 'Set oasMirrorUrl in ~/.dsh/onmyoji-oas.json'],
      ['diag.oasNotInstalled', '尚未安装 OAS', 'OAS is not installed'],
      ['diag.oasUpdateHint', '下载或更新后请重启控制台，使新代码生效。', 'Restart the console after downloading or updating.'],
      ['diag.oasRestart', '重启控制台', 'Restart console'],
      ['diag.oasRestarting', '重启中…', 'Restarting…'],
      ['diag.oasTrackedDirty', '已保护本地修改：镜像更新暂不可用，当前运行不受影响。请先核对并备份修改。', 'The update is blocked by uncommitted tracked changes'],
      ['diag.oasInstallHint', '将克隆到 {path}；目标目录非空时不会覆盖', 'Clones into {path}; a non-empty target is not overwritten'],
      ['diag.backendRuntime', '便携后端', 'Portable backend'],
      ['diag.backendRuntimeDesc', '一键安装 Python + 控制台 + OAS；不需要 .app，也不需要手动装 Python', 'Install Python, console, and OAS in one click; no .app and no manual Python setup'],
      ['diag.backendInstall', '一键安装后端', 'Install backend'],
      ['diag.backendInstalling', '安装中…（首次可能较久）', 'Installing… (the first run can take a while)'],
      ['diag.backendInstallingShort', '安装中…', 'Installing…'],
      ['diag.backendInstalled', '后端已安装', 'Backend installed'],
      ['diag.backendStart', '启动后端', 'Start backend'],
      ['diag.backendStarting', '启动中…', 'Starting…'],
      ['diag.backendStop', '停止后端', 'Stop backend'],
      ['diag.backendStopping', '停止中…', 'Stopping…'],
      ['diag.backendDir', '安装目录', 'Install directory'],
      ['diag.backendBundle', '安装包', 'Bundle'],
      ['diag.backendPlatform', '平台', 'Platform'],
      ['diag.backendLog', '安装/启动日志', 'Install / start log'],
      ['diag.backendNotInstalled', '尚未安装', 'Not installed'],
      ['diag.backendRunning', '运行中', 'Running'],
      ['diag.backendStopped', '未运行', 'Stopped'],
      ['diag.backendNoBundle', '未配置安装包地址', 'Bundle URL is not configured'],
      ['diag.backendConfirmInstall', '将下载并安装核心包到 {dir}，macOS arm64 约 464MiB，继续？', 'Download and install the core package into {dir} (about 464MiB on macOS arm64). Continue?'],
      ['diag.backendConfirmStop', '停止后端会中断正在执行的任务，继续？', 'Stopping the backend interrupts running tasks. Continue?'],
      ['diag.backendOas', 'OAS', 'OAS'],
      ['diag.backendOasReady', '已包含', 'Included'],
      ['diag.backendOasMissing', '缺失', 'Missing'],
      ['diag.backendStarted', '后端已安装并启动', 'Backend installed and started'],
      ['diag.coreVersion', '核心包版本', 'Core version'],
      ['diag.oasVersion', '内置 OAS', 'Bundled OAS'],
      ['diag.oasUpstream', '上游', 'upstream'],
      ['diag.checkCore', '检查更新', 'Check for updates'],
      ['diag.coreChecking', '检查中…', 'Checking…'],
      ['diag.coreUpToDate', '核心包已是最新', 'Core is up to date'],
      ['diag.coreUpdateAvailable', '发现核心包 {version}', 'Core {version} is available'],
      ['diag.coreUpdate', '更新到 {version}', 'Update to {version}'],
      ['diag.coreUpdateHint', 'OAS 随核心包更新；不操作 Git、分支或 stash。', 'OAS updates with the core package; no Git, branches, or stashes.'],
      ['diag.coreCheckHint', '可以检查是否有新的核心包；更新不会覆盖配置、计划或历史。', 'Check for a newer core package; updates keep config, plans, and history.'],
      ['diag.backendUpdateHint', 'OAS 随核心包更新；首次安装或更新后会自动启动。', 'OAS updates with the core package; it starts automatically after install or update.'],
      ['diag.modules', '可选组件', 'Optional components'],
      ['diag.modulesDesc', '核心已包含 OAS 日常功能；需要本地 LLM 时再装这个运行时，不装不影响任务。', 'The core already runs OAS. Install this runtime only if you need the local LLM.'],
      ['diag.moduleLocalLlm', '本地 LLM 运行时', 'Local LLM runtime'],
      ['diag.moduleInstalled', '已安装', 'Installed'],
      ['diag.moduleNotInstalled', '未安装', 'Not installed'],
      ['diag.moduleInstall', '安装组件', 'Install module'],
      ['diag.moduleInstalling', '组件安装中…', 'Installing module…'],
      ['diag.moduleRemove', '移除组件', 'Remove module'],
      ['diag.moduleRemoveConfirm', '移除 {name}？请先停止便携后端；模型文件不会被删除。', 'Remove {name}? Stop the portable backend first. Model files are not deleted.'],
      ['diag.moduleInstallConfirm', '将下载 {name}（约 {size}），继续？', 'Download {name} (about {size})?'],
      ['diag.moduleRestartHint', '安装组件后重启便携后端生效；移除组件前先停止后端。', 'Restart the portable backend after installing; stop it before removing a module.'],
      ['diag.moduleModelHint', '组件不包含模型；本地模型目录：{path}。依赖安装成功不代表模型已就绪。', 'Models are not included. Local model directory: {path}. Installed dependencies do not mean the model is ready.'],
      ['diag.moduleUnsupported', '当前平台暂不支持该组件', 'This module is not available on this platform'],
      ['diag.moduleSize', '组件大小', 'Module size'],
      ['diag.moduleRequiresCore', '需要核心版本', 'Requires core'],
      ['diag.moduleCoreVersion', '当前核心 {current}，组件需要 {required} 或更高。', 'Current core {current}; this module requires {required} or newer.'],
      ['diag.moduleError', '组件安装失败', 'Module install failed'],
      ['diag.moduleRestart', '重启便携后端', 'Restart portable backend'],
      ['diag.moduleRestarting', '重启中…', 'Restarting…'],
      ['diag.moduleCoreMissing', '请先安装便携后端；组件安装会校验核心版本。', 'Install the portable backend first; module installation validates the core version.'],
      ['overview.installBackend', '一键安装后端', 'Install backend'],
      ['overview.installBackendHint', 'macOS arm64 核心约 534MiB，自动装好 Python、控制台和 OAS', 'About 700MB on first run; installs Python, console, and OAS'],
      ['overview.startBackendRuntime', '启动后端', 'Start backend'],
      ['rail.screen', '设备画面', 'Device screen'],
      ['rail.refresh', '刷新画面', 'Refresh screen'],
      ['rail.recent', '最近执行', 'Recent runs'],
      ['rail.noShot', '点击「刷新画面」查看当前设备', 'Press Refresh screen to capture the device'],
      ['rail.needDevice', '请先选择设备', 'Select a device first'],
      ['rail.noRecent', '暂无执行记录', 'No run recorded'],
      ['rail.captured', '截于 {time}', 'Captured {time}'],
      ['rail.live', 'LIVE VIEW', 'LIVE VIEW'],
      ['modal.eyebrow', 'TASK', 'TASK'],
      ['toast.refreshed', '数据已刷新', 'Data refreshed'],
      ['toast.started', '已提交任务，正在等待执行结果', 'Task submitted; waiting for the result'],
      ['toast.done', '执行完成', 'Run finished'],
      ['toast.stopped', '停止指令已发送', 'Stop requested'],
      ['toast.saved', '任务默认配置已保存', 'Task defaults saved'],
      ['toast.toggled', '任务开关已更新', 'Task switch updated'],
      ['toast.backendStarted', '本地服务已启动', 'Local service started'],
      ['toast.backendStopped', '本地服务已停止', 'Local service stopped'],
      ['toast.connected', '连接指令已发送', 'Connect requested'],
      ['toast.warmed', '拉起指令已发送', 'Warm-up requested'],
      ['toast.deviceAdded', '设备已登记', 'Device registered'],
      ['toast.deviceDeleted', '设备已删除', 'Device deleted'],
      ['toast.deviceUpdated', '设备状态已更新', 'Device state updated'],
      ['toast.scheduleCreated', '计划已创建', 'Schedule created'],
      ['toast.scheduleUpdated', '计划状态已更新', 'Schedule updated'],
      ['toast.scheduleRun', '已提交计划，正在等待执行结果', 'Schedule submitted; waiting for the result'],
      ['toast.scheduleDeleted', '计划已删除', 'Schedule deleted'],
      ['toast.ticked', '已检查到期任务', 'Due tasks checked'],
      ['toast.warmedAll', '已触发设备拉起', 'Warm-up triggered'],
      ['toast.updated', '已获取远端状态', 'Upstream state refreshed'],
      ['toast.failed', '操作未完成', 'The operation did not complete'],
      ['toast.noDevice', '请先在设备页登记并连接模拟器', 'Register and connect an emulator first'],
    ]
    const ZH = {}
    const EN = {}
    for (const [key, zh, en] of TEXT) {
      ZH[key] = zh
      EN[key] = en
    }
    const DICTS = { zh: ZH, en: EN }

    function enc(value) {
      return encodeURIComponent(String(value ?? ''))
    }

    function safeConsoleHref(value) {
      try {
        const url = new URL(value || CONSOLE_URL)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : CONSOLE_URL
      } catch { return CONSOLE_URL }
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function fmtBytes(value) {
      const size = Number(value) || 0
      if (!size) return '—'
      const mb = size / 1024 / 1024
      return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
    }

    function tf(t, key, vars) {
      let text = t(key)
      for (const [name, value] of Object.entries(vars || {})) {
        text = text.split('{' + name + '}').join(String(value))
      }
      return text
    }

    function fmtTime(value, short) {
      if (value === null || value === undefined || value === '') return '—'
      let date
      if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
        const n = Number(value)
        date = new Date(n < 1e11 ? n * 1000 : n)
      } else {
        date = new Date(String(value).replace(' ', 'T'))
      }
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString(undefined, short
        ? { hour: '2-digit', minute: '2-digit', hour12: false }
        : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    }

    function fmtBytes(value) {
      const bytes = Number(value)
      if (!Number.isFinite(bytes) || bytes <= 0) return '—'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unit = 0
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024
        unit += 1
      }
      return (size >= 100 ? size.toFixed(0) : size.toFixed(1)) + ' ' + units[unit]
    }

    function isExpired(task) {
      if (!task || !task.deadline) return false
      const end = new Date(String(task.deadline) + 'T23:59:59')
      return !Number.isNaN(end.getTime()) && end.getTime() < Date.now()
    }

    function currentDevice(data) {
      return (data.devices || []).find((item) => item.serial === data.device) || null
    }

    function taskById(data, id) {
      return (data.catalog || []).find((item) => item.id === id) || null
    }

    function taskName(data, id, t) {
      const task = taskById(data, id)
      return task ? (task.name || task.id) : (id || t('common.unknown'))
    }

    function cycleLabel(t, cycle) {
      return t(cycle === 'daily' ? 'cycle.daily' : cycle === 'weekly' ? 'cycle.weekly' : cycle === 'event' ? 'cycle.event' : 'cycle.other')
    }

    function kindLabel(t, kind) {
      return t(kind === 'must_do' ? 'kind.must_do' : kind === 'farm' ? 'kind.farm' : kind === 'reward_only' ? 'kind.reward_only' : kind === 'activity' ? 'kind.activity' : 'kind.other')
    }

    function taskState(t, task) {
      if (isExpired(task)) return { label: t('task.expired'), tone: 'warn' }
      if (task.entry_state === 'frozen') return { label: t('task.frozen'), tone: 'warn' }
      if (task.entry_state === 'unwired') return { label: t('task.unwired'), tone: '' }
      if (task.enabled === false) return { label: t('task.disabled'), tone: '' }
      return { label: t('task.enabled'), tone: 'ok' }
    }

    function isRunnable(task) {
      return !!task && task.enabled !== false && task.entry_state === 'ready' && !isExpired(task)
    }

    function isActiveExecution(job) {
      return ['preparing', 'running', 'stopping'].includes(job.state)
    }

    function executionRows(c) {
      const jobs = [...(c.data.executions || []), ...(c.localExecutions || [])]
      const external = Object.entries(c.data.running || {}).filter(([serial]) =>
        !jobs.some((job) => job.device === serial && isActiveExecution(job)))
        .map(([device, run]) => ({ id: 'external-' + device, device, task_id: run.task_id,
          state: 'running', created_at: run.started_at, external: true }))
      return [...external, ...jobs].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
    }

    function taskTarget(data, task) {
      return task.device?.assigned || data.device || ''
    }

    function taskRunReason(c, task, t, serial = taskTarget(c.data, task)) {
      if (c.offline) return t('diag.healthOffline')
      if (c.data.resourceErrors.running) return t('execution.statusUnavailable')
      if (isExpired(task)) return t('task.disabledReason.expired')
      if (task.entry_state === 'frozen') return t('task.disabledReason.frozen')
      if (task.entry_state === 'unwired') return t('task.disabledReason.unwired')
      if (task.enabled === false) return t('task.disabledReason.off')
      const device = c.data.devices.find((item) => item.serial === serial)
      if (!device || !device.online) return t('task.disabledReason.noDevice')
      if (c.isBusy('run:' + serial) || executionRows(c).some((job) => job.device === serial && isActiveExecution(job))) {
        return t('task.disabledReason.busy')
      }
      return ''
    }

    function taskDefaults(task) {
      return Object.fromEntries(Object.entries(task.options || {}).map(([key, meta]) => [key,
        meta.value === undefined ? meta.default : meta.value]))
    }

    async function requestJSON(path, options = {}) {
      const { timeoutMs = options.method && options.method !== 'GET' ? 180000 : 12000, ...init } = options
      const controller = new AbortController()
      const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
      try {
        const response = await fetch(path, { cache: 'no-store', ...init, signal: controller.signal })
        const text = await response.text()
        let value
        try { value = text ? JSON.parse(text) : {} } catch { value = { message: text.slice(0, 300) } }
        if (!response.ok) {
          const detail = Array.isArray(value.detail) ? value.detail.map((item) => item.msg || '').join('; ') : value.detail
          const error = new Error(value.message || detail || `HTTP ${response.status}`)
          error.status = response.status
          throw error
        }
        return value
      } catch (error) {
        if (error.name === 'AbortError') throw new Error(ZH['error.timeout'])
        throw error
      } finally { if (timer) clearTimeout(timer) }
    }

    async function postJSON(path, body) {
      const value = await requestJSON(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body === undefined ? {} : body),
      })
      if (value && value.ok === false) throw new Error(value.message || '操作未完成')
      return value
    }

    async function deleteJSON(path) {
      const value = await requestJSON(API + path, { method: 'DELETE' })
      if (value && value.ok === false) throw new Error(value.message || '操作未完成')
      return value
    }

    const EMPTY_ONE_CLICK = { sequence: [], frozen: [], sunday_only: [], time_limited: [] }

    function useConsole(t) {
      const tRef = useRef(t)
      tRef.current = t
      const [data, setData] = useState(() => ({
        health: null, catalog: [], devices: [], running: {}, schedules: [],
        recent: [], oneclick: EMPTY_ONE_CLICK, scheduler: null, oas: null,
        autostart: null, status: null, backend: null, baseline: null, oasRuntime: null,
        executions: [], resourceErrors: {}, refreshedAt: null,
        backendRuntime: null, modules: null, device: '',
      }))
      const [loading, setLoading] = useState(true)
      const [offline, setOffline] = useState(false)
      const [error, setError] = useState('')
      const [pendingKeys, setPendingKeys] = useState([])
      const pending = useRef(new Set())
      const busy = pendingKeys[0] || ''
      const isBusy = useCallback((key) => pendingKeys.includes(key), [pendingKeys])
      const [localExecutions, setLocalExecutions] = useState([])
      const loadInFlight = useRef(null)
      const liveInFlight = useRef(false)
      const resourceVersions = useRef({})
      const dataRef = useRef(data)
      dataRef.current = data
      const [toast, setToast] = useState(null)
      const [shot, setShot] = useState({ serial: '', data: '', at: null, error: '' })
      const [updateCheck, setUpdateCheck] = useState(null)
      const [oasPreview, setOasPreview] = useState(null)
      const [oasResult, setOasResult] = useState(null)
      const [oasRuntimeCheck, setOasRuntimeCheck] = useState(null)
      const [oasRuntimeResult, setOasRuntimeResult] = useState(null)
      const [coreCheck, setCoreCheck] = useState(null)
      const [exportResult, setExportResult] = useState(null)
      const [maintenanceResult, setMaintenanceResult] = useState(null)
      const toastTimer = useRef(0)
      const mounted = useRef(true)

      useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
          clearTimeout(toastTimer.current)
        }
      }, [])

      const notify = useCallback((message, tone) => {
        if (!mounted.current) return
        setToast({ message, tone: tone === 'fail' ? 'fail' : 'ok', id: Date.now() })
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => {
          if (mounted.current) setToast(null)
        }, tone === 'fail' ? 7000 : 4200)
      }, [])

      const loadAll = useCallback(() => {
        if (loadInFlight.current) return loadInFlight.current
        const work = (async () => {
          const defs = [
            ['health', API + '/health'], ['catalog', API + '/catalog'],
            ['devices', API + '/devices'], ['running', API + '/running'],
            ['schedules', API + '/schedules'], ['oneclick', API + '/oneclick/describe'],
            ['recent', API + '/exec-history'], ['scheduler', API + '/scheduler'],
            ['oas', API + '/oas/status'], ['autostart', API + '/autostart'],
            ['status', API + '/status'], ['executions', API + '/executions'],
            ['backend', CONTROL + '/status'], ['baseline', BASELINE + '/status'],
            ['oasRuntime', OAS_RUNTIME + '/status'], ['backendRuntime', BACKEND_RUNTIME + '/status'],
            ['modules', MODULES + '/status'],
          ]
          const tickets = defs.map(([key]) => resourceVersions.current[key] = (resourceVersions.current[key] || 0) + 1)
          const fresh = index => resourceVersions.current[defs[index][0]] === tickets[index]
          const results = await Promise.allSettled(defs.map(([, path]) => requestJSON(path)))
          if (!mounted.current) return
          setData((prev) => {
          const patch = {}, resourceErrors = { ...prev.resourceErrors }
          results.forEach((result, index) => {
            const key = defs[index][0]
            if (!fresh(index)) return
            delete resourceErrors[key]
            if (result.status !== 'fulfilled') {
              if (key !== 'executions' || dataRef.current.health?.features?.executions) {
                resourceErrors[key] = result.reason?.message || tRef.current('toast.failed')
              }
              return
            }
            const value = result.value
            if (key === 'catalog') patch.catalog = Array.isArray(value) ? value : (value.tasks || value.catalog || [])
            else if (key === 'devices') patch.devices = Array.isArray(value) ? value : (value.devices || [])
            else if (key === 'running') patch.running = value.running || {}
            else if (key === 'schedules') patch.schedules = value.schedules || []
            else if (key === 'recent') patch.recent = value.records || value.history || value.exec_history || []
            else if (key === 'executions') patch.executions = value.executions || []
            else patch[key] = value
          })
            const next = { ...prev, ...patch, resourceErrors, refreshedAt: Date.now() }
            if (!next.devices.some((item) => item.serial === next.device)) {
              next.device = (next.devices.find((item) => item.online) || next.devices[0])?.serial || ''
            }
            return next
          })
          if (fresh(0)) {
            setOffline(results[0].status !== 'fulfilled' || results[0].value?.ok !== true)
            setError(results[0].status === 'rejected' ? results[0].reason?.message || tRef.current('toast.failed') : '')
          }
          setLoading(false)
        })()
        loadInFlight.current = work
        work.finally(() => { loadInFlight.current = null }).catch(() => {})
        return work
      }, [])

      useEffect(() => {
        loadAll()
        const timer = setInterval(async () => {
          if (liveInFlight.current) return
          liveInFlight.current = true
          try {
            const defs = [['health', '/health'], ['running', '/running']]
            if (dataRef.current.health?.features?.executions) defs.push(['executions', '/executions'])
            const tickets = defs.map(([key]) => resourceVersions.current[key] = (resourceVersions.current[key] || 0) + 1)
            const fresh = index => resourceVersions.current[defs[index]?.[0]] === tickets[index]
            const values = await Promise.allSettled(defs.map(([, path]) => requestJSON(API + path)))
            if (!mounted.current) return
            const previous = dataRef.current
            const nextJobs = fresh(2) && values[2]?.status === 'fulfilled' ? values[2].value.executions || [] : null
            const nextRunning = fresh(1) && values[1]?.status === 'fulfilled' ? values[1].value.running || {} : null
            const finished = (nextJobs && previous.executions.some(job => isActiveExecution(job) && nextJobs.some(next => next.id === job.id && !isActiveExecution(next))))
              || (nextRunning && Object.keys(previous.running).some(serial => !nextRunning[serial]))
            setData((prev) => {
              const patch = {}, resourceErrors = { ...prev.resourceErrors }
              values.forEach((result, i) => {
                const key = defs[i][0]
                if (!fresh(i)) return
                if (result.status === 'rejected') resourceErrors[key] = result.reason?.message || 'Unavailable'
                else {
                  delete resourceErrors[key]
                  patch[key] = key === 'running' ? result.value.running || {}
                    : key === 'executions' ? result.value.executions || [] : result.value
                }
              })
              return { ...prev, ...patch, resourceErrors }
            })
            if (fresh(0)) {
              setOffline(values[0].status !== 'fulfilled' || values[0].value?.ok !== true)
              setError(values[0].status === 'rejected' ? values[0].reason?.message || tRef.current('toast.failed') : '')
            }
            if (finished) loadAll()
          } finally { liveInFlight.current = false }
        }, 3000)
        const refreshTimer = setInterval(loadAll, 30000)
        return () => { clearInterval(timer); clearInterval(refreshTimer) }
      }, [loadAll])

      const runAction = useCallback(async (key, operation) => {
        if (pending.current.has(key)) return undefined
        const maintenance = value => /^(backend|module:|baseline:|oas-runtime:|oas:apply|oas:rollback)/.test(value)
        if (maintenance(key) && [...pending.current].some(maintenance)) {
          notify(tRef.current('diag.maintenanceBusy'), 'fail')
          return undefined
        }
        pending.current.add(key)
        setPendingKeys([...pending.current])
        try { return await operation() }
        catch (exception) {
          notify(exception?.message || tRef.current('toast.failed'), 'fail')
          return undefined
        } finally {
          pending.current.delete(key)
          if (mounted.current) setPendingKeys([...pending.current])
        }
      }, [notify])

      const selectDevice = useCallback((serial) => {
        setData((prev) => Object.assign({}, prev, { device: serial }))
      }, [])

      const refresh = useCallback(() => runAction('refresh', async () => {
        await loadAll()
        notify(tRef.current('toast.refreshed'))
      }), [loadAll, notify, runAction])

      const startBackend = useCallback(() => runAction('backend', async () => {
        const result = await requestJSON(CONTROL + '/start', { method: 'POST' })
        if (!result.running) throw new Error(result.message || tRef.current('toast.failed'))
        notify(tRef.current('toast.backendStarted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const stopBackend = useCallback(() => runAction('backend', async () => {
        const result = await requestJSON(CONTROL + '/stop', { method: 'POST' })
        if (result.running) throw new Error(result.message || tRef.current('toast.failed'))
        notify(tRef.current('toast.backendStopped'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const stopDevice = useCallback((serial, executionId) => runAction('stop:' + serial, async () => {
        if (!/^[a-f0-9]{32}$/.test(executionId || '')) throw new Error(tRef.current('execution.statusUnavailable'))
        const path = `/executions/${enc(executionId)}/stop`
        const result = await postJSON(path)
        notify(result.message || tRef.current('toast.stopped'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const runTask = useCallback((taskId, device, count, options) => runAction('run:' + device, async () => {
        if (!device) throw new Error(tRef.current('toast.noDevice'))
        const current = dataRef.current
        if (current.resourceErrors.running) throw new Error(tRef.current('execution.statusUnavailable'))
        const body = { task_id: taskId }
        if (count !== null && count !== undefined && count !== '') body.count = Number(count)
        if (options && Object.keys(options).length) body.options = options
        if (current.health?.features?.executions) {
          await postJSON(`/devices/${enc(device)}/executions`, body)
          notify(tRef.current('execution.submitted'))
          await loadAll()
          return true
        }
        // Older backends use the same persistent result panel, without pretending
        // that a local pending request can survive a backend/page restart.
        const id = 'local-' + Date.now()
        setLocalExecutions((prev) => [{ id, device, task_id: taskId, request: body,
          state: 'preparing', created_at: Date.now() / 1000 }, ...prev].slice(0, 20))
        try {
          const result = await requestJSON(API + `/devices/${enc(device)}/run`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body), timeoutMs: 0,
          })
          if (mounted.current) setLocalExecutions((prev) => prev.map((job) => job.id === id
            ? { ...job, result, state: result.stopped ? 'stopped' : !result.ok ? 'failed' : result.business?.steps?.some(step => step.ok === false && !step.skipped) ? 'partial' : 'succeeded' } : job))
          return result.ok === true
        } catch (exception) {
          if (mounted.current) setLocalExecutions((prev) => prev.map((job) => job.id === id
            ? { ...job, state: 'unknown', result: { ok: false, message: exception.message } } : job))
          throw exception
        } finally { await loadAll() }
      }), [loadAll, notify, runAction])

      const saveTaskDefaults = useCallback((taskId, assignedDevice, count, options) => runAction('save:' + taskId, async () => {
        const body = { device: assignedDevice || '', options: options || {} }
        if (count !== undefined && count !== null && count !== '') body.count = Number(count)
        if (dataRef.current.health?.features?.task_defaults) {
          await postJSON(`/tasks/${enc(taskId)}/defaults`, body)
        } else {
          const saved = []
          const changes = [[tRef.current('settings.device'), () => postJSON(`/tasks/${enc(taskId)}/device`, { device: body.device })]]
          if (body.count !== undefined) changes.push([tRef.current('settings.count'), () => postJSON(`/tasks/${enc(taskId)}/count`, { count: body.count })])
          for (const [key, value] of Object.entries(body.options)) changes.push([key, () => postJSON(`/tasks/${enc(taskId)}/options`, { key, value })])
          for (const [name, apply] of changes) {
            try { await apply(); saved.push(name) }
            catch (error) {
              await loadAll()
              throw new Error(tf(tRef.current, 'settings.partial', { saved: saved.join(', ') || '—', failed: name }) + ' ' + error.message)
            }
          }
        }
        notify(tRef.current('toast.saved'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const toggleTask = useCallback((taskId, enabled) => runAction('toggle:' + taskId, async () => {
        await postJSON(`/tasks/${enc(taskId)}/enabled`, { enabled })
        notify(tRef.current('toast.toggled'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const connectDevice = useCallback((serial) => runAction('connect:' + serial, async () => {
        const result = await postJSON('/adb/connect', { serial })
        notify(result.message || tRef.current('toast.connected'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const warmDevice = useCallback((serial) => runAction('warm:' + serial, async () => {
        const result = await postJSON('/autostart/warmup', { serial })
        if (result.result?.ok === false && !result.result?.skipped) throw new Error(result.result.message || tRef.current('toast.failed'))
        notify(result.result?.message || tRef.current('toast.warmed'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const addDevice = useCallback((serial, name) => runAction('device:add', async () => {
        const result = await postJSON('/devices', { serial, name })
        notify(result.connect_note ? result.connect_note : tRef.current('toast.deviceAdded'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const deleteDevice = useCallback((serial) => runAction('device:delete:' + serial, async () => {
        await deleteJSON(`/devices/${enc(serial)}`)
        notify(tRef.current('toast.deviceDeleted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const toggleDevice = useCallback((serial, enabled) => runAction('device:toggle:' + serial, async () => {
        await postJSON(`/devices/${enc(serial)}/enabled?enabled=${enabled ? 'true' : 'false'}`, {})
        notify(tRef.current('toast.deviceUpdated'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const previewSchedule = useCallback((text, deviceSerial) => runAction('schedule:preview', async () => {
        if (!dataRef.current.health?.features?.schedule_preview) throw new Error(tRef.current('plans.upgradeBackend'))
        const result = await postJSON('/schedules/preview', {
          text, device_serial: deviceSerial || dataRef.current.device || '',
        })
        return result.schedule
      }), [runAction])

      const createSchedule = useCallback((text, deviceSerial, editId) => runAction('schedule:create', async () => {
        const result = await requestJSON(API + (editId ? '/schedules/' + enc(editId) : '/schedules'), {
          method: editId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, device_serial: deviceSerial || dataRef.current.device || '' }),
        })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('toast.scheduleCreated'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const toggleSchedule = useCallback((id, enabled) => runAction('schedule:toggle:' + id, async () => {
        await postJSON(`/schedules/${enc(id)}/enabled`, { enabled })
        notify(tRef.current('toast.scheduleUpdated'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const runSchedule = useCallback((id) => runAction('schedule:run:' + id, async () => {
        notify(tRef.current('toast.scheduleRun'))
        const asynchronous = dataRef.current.health?.features?.schedule_executions
        const result = await postJSON(`/schedules/${enc(id)}/${asynchronous ? 'executions' : 'run'}`)
        notify(result.message || tRef.current(asynchronous ? 'execution.submitted' : 'toast.done'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const deleteSchedule = useCallback((id) => runAction('schedule:delete:' + id, async () => {
        await deleteJSON(`/schedules/${enc(id)}`)
        notify(tRef.current('toast.scheduleDeleted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const tickNow = useCallback(() => runAction('tick', async () => {
        const result = await postJSON('/scheduler/tick')
        notify(result.launched && result.launched.length
          ? tRef.current('toast.ticked') + ' · ' + result.launched.join(', ')
          : tRef.current('toast.ticked'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const warmAll = useCallback(() => runAction('warm:all', async () => {
        await postJSON('/autostart/warmup', {})
        notify(tRef.current('toast.warmedAll'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const exportDiagnose = useCallback(() => runAction('export', async () => {
        const result = await postJSON('/diagnose/export')
        setExportResult({ ok: true, path: result.path, message: result.message })
        notify(result.message || tRef.current('diag.exported'))
        return true
      }), [notify, runAction])

      const checkOasUpdate = useCallback(() => runAction('oas:check', async () => {
        const oas = data.oas || {}
        const result = await requestJSON(API + '/oas/check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ branch: oas.branch || 'dev' }),
        })
        setUpdateCheck(result)
        setOasPreview(null)
        setOasResult(null)
        if (result.ok === false) throw new Error(result.message || tRef.current('overview.checkFailed'))
        notify(tRef.current('toast.updated'))
        return true
      }), [data.oas, notify, runAction])

      const previewOasUpdate = useCallback(() => runAction('oas:preview', async () => {
        const branch = (data.oas && data.oas.branch) || 'dev'
        const result = await requestJSON(API + '/oas/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ branch }),
        })
        setOasPreview(result)
        setOasResult(null)
        if (result.ok === false) throw new Error(result.message || tRef.current('overview.checkFailed'))
        notify(tRef.current('toast.updated'))
        return true
      }), [data.oas, notify, runAction])

      const applyOasUpdate = useCallback(() => runAction('oas:apply', async () => {
        const token = oasPreview && oasPreview.confirm_token
        if (!token) throw new Error(tRef.current('overview.previewFirst'))
        const branch = (data.oas && data.oas.branch) || 'dev'
        const result = await requestJSON(API + '/oas/update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirm_token: token, branch }),
        })
        setOasResult(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        setOasPreview(null)
        notify(result.message || tRef.current('overview.updateDone'))
        await loadAll()
        return true
      }), [data.oas, loadAll, notify, oasPreview, runAction])

      const rollbackOas = useCallback(() => runAction('oas:rollback', async () => {
        const result = await requestJSON(API + '/oas/rollback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        setOasResult(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        setOasPreview(null)
        notify(result.message || tRef.current('overview.rollbackDone'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const createBaseline = useCallback(() => runAction('baseline:create', async () => {
        const result = await requestJSON(BASELINE + '/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('diag.baselineCreated'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const restoreBaseline = useCallback((name) => runAction('baseline:restore:' + name, async () => {
        const result = await requestJSON(BASELINE + '/restore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (mounted.current) setMaintenanceResult(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('diag.baselineRestored'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const installOasRuntime = useCallback(() => runAction('oas-runtime:install', async () => {
        const result = await requestJSON(OAS_RUNTIME + '/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        setOasRuntimeCheck(null)
        setOasRuntimeResult(null)
        notify(result.message || tRef.current('diag.oasInstalled'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const checkOasRuntime = useCallback(() => runAction('oas-runtime:check', async () => {
        const result = await requestJSON(OAS_RUNTIME + '/check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        setOasRuntimeCheck(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('overview.checkFailed'))
        notify(result.message || tRef.current('diag.oasUpToDate'))
        return true
      }), [notify, runAction])

      const updateOasRuntime = useCallback(() => runAction('oas-runtime:update', async () => {
        const result = await requestJSON(OAS_RUNTIME + '/update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        setOasRuntimeResult(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        setOasRuntimeCheck(null)
        notify(result.message || tRef.current('diag.oasUpdated'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const restartBackend = useCallback(() => runAction('backend', async () => {
        const stopped = await requestJSON(CONTROL + '/stop', { method: 'POST' })
        if (stopped.running) throw new Error(stopped.message || tRef.current('toast.failed'))
        const started = await requestJSON(CONTROL + '/start', { method: 'POST' })
        if (!started.running) throw new Error(started.message || tRef.current('toast.failed'))
        notify(tRef.current('toast.backendStarted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const checkCoreUpdate = useCallback(() => runAction('backend-runtime:check', async () => {
        const result = await requestJSON(BACKEND_RUNTIME + '/check')
        setCoreCheck(result)
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('diag.coreUpToDate'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const installBackendRuntime = useCallback(() => runAction('backend-runtime:install', async () => {
        let target = null
        try {
          const check = await requestJSON(BACKEND_RUNTIME + '/check')
          setCoreCheck(check)
          if (check.ok !== false && check.target) target = check.target
        } catch { /* index unavailable; fall back to configured bundle */ }
        const query = target
          ? '?url=' + encodeURIComponent(target.url)
            + '&sha256=' + encodeURIComponent(target.sha256)
            + '&version=' + encodeURIComponent(target.coreVersion)
          : ''
        const before = await requestJSON(BACKEND_RUNTIME + '/status')
        if (before.running) {
          const stopped = await requestJSON(BACKEND_RUNTIME + '/stop', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
          })
          if (stopped.ok === false) throw new Error(stopped.message || tRef.current('toast.failed'))
        }
        const started = await requestJSON(BACKEND_RUNTIME + '/install' + query, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (started.ok === false) throw new Error(started.message || tRef.current('toast.failed'))
        const deadline = Date.now() + 30 * 60 * 1000
        let status = null
        while (Date.now() < deadline) {
          await sleep(2000)
          status = await requestJSON(BACKEND_RUNTIME + '/status')
          if (!mounted.current) return false
          setData((prev) => Object.assign({}, prev, { backendRuntime: status }))
          if (status.installError) throw new Error(status.installError)
          if (!status.installing && status.installed
            && (!target || !target.coreVersion || status.coreVersion === target.coreVersion)
            && (target || status.installed !== before.installed)) break
        }
        if (!status || !status.installed) throw new Error('后端安装超时，请查看安装日志')
        // First install and updates both start immediately; failed start restores the previous core.
        const running = await requestJSON(BACKEND_RUNTIME + '/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (running.ok === false) {
          let rolledBack = false
          try {
            const rollback = await requestJSON(BACKEND_RUNTIME + '/rollback', {
              method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
            })
            rolledBack = rollback.ok !== false
          } catch { /* keep original error */ }
          throw new Error((rolledBack ? '新版启动失败，已恢复上一版：' : '新版启动失败：') + (running.message || ''))
        }
        notify(tRef.current('diag.backendStarted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const startBackendRuntime = useCallback(() => runAction('backend-runtime:start', async () => {
        const result = await requestJSON(BACKEND_RUNTIME + '/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('toast.backendStarted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const stopBackendRuntime = useCallback(() => runAction('backend-runtime:stop', async () => {
        const result = await requestJSON(BACKEND_RUNTIME + '/stop', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('diag.backendStopped'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const restartBackendRuntime = useCallback(() => runAction('backend-runtime:restart', async () => {
        const stopped = await requestJSON(BACKEND_RUNTIME + '/stop', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (stopped.ok === false) throw new Error(stopped.message || tRef.current('toast.failed'))
        const started = await requestJSON(BACKEND_RUNTIME + '/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (started.ok === false) throw new Error(started.message || tRef.current('toast.failed'))
        notify(started.message || tRef.current('toast.backendStarted'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const installModule = useCallback((id) => runAction('module:install', async () => {
        const started = await requestJSON(MODULES + '/install?id=' + enc(id), { method: 'POST' })
        if (started.ok === false) throw new Error(started.message || tRef.current('toast.failed'))
        const deadline = Date.now() + 15 * 60 * 1000
        let mod = null
        while (Date.now() < deadline) {
          await sleep(1500)
          const status = await requestJSON(MODULES + '/status')
          if (!mounted.current) return false
          setData((prev) => Object.assign({}, prev, { modules: status }))
          mod = (status.modules || []).find((item) => item.id === id)
          if (mod && mod.error) throw new Error(mod.error)
          if (mod && mod.installed) break
        }
        if (!mod || !mod.installed) throw new Error('组件安装超时')
        notify(tRef.current('diag.moduleInstalled') + ' · ' + tRef.current('diag.moduleRestartHint'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const removeModule = useCallback((id) => runAction('module:remove', async () => {
        const result = await requestJSON(MODULES + '/remove?id=' + enc(id), { method: 'POST' })
        if (result.ok === false) throw new Error(result.message || tRef.current('toast.failed'))
        notify(result.message || tRef.current('diag.moduleNotInstalled'))
        await loadAll()
        return true
      }), [loadAll, notify, runAction])

      const refreshScreenshot = useCallback(async (serial) => {
        if (!serial) {
          notify(tRef.current('rail.needDevice'), 'fail')
          return
        }
        setShot((prev) => Object.assign({}, prev, { serial, error: '' }))
        try {
          const result = await requestJSON(API + `/screenshot?serial=${enc(serial)}&t=${Date.now()}`)
          if (!result.ok || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(result.data || '')) throw new Error(result.message || tRef.current('rail.noShot'))
          if (!mounted.current) return
          setShot({ serial, data: result.data, at: result.ts || Date.now() / 1000, error: '' })
        } catch (exception) {
          if (!mounted.current) return
          setShot({ serial, data: '', at: null, error: (exception && exception.message) || tRef.current('toast.failed') })
        }
      }, [notify])

      return {
        data, loading, offline, error, busy, isBusy, pendingKeys, localExecutions, toast, shot, updateCheck, oasPreview, oasResult,
        oasRuntimeCheck, oasRuntimeResult, exportResult,
        notify, refresh, loadAll, selectDevice,
        startBackend, stopBackend, restartBackend,
        runTask, saveTaskDefaults, toggleTask,
        stopDevice, connectDevice, warmDevice, addDevice, deleteDevice, toggleDevice,
        previewSchedule, createSchedule, toggleSchedule, runSchedule, deleteSchedule,
        tickNow, warmAll, exportDiagnose, checkOasUpdate, previewOasUpdate, applyOasUpdate, rollbackOas,
        createBaseline, restoreBaseline, maintenanceResult, installOasRuntime, checkOasRuntime, updateOasRuntime,
        installBackendRuntime, startBackendRuntime, stopBackendRuntime, restartBackendRuntime, checkCoreUpdate, coreCheck,
        installModule, removeModule,
        refreshScreenshot,
      }
    }

    function Dot() {
      return h('span', { className: 'onm-dot', 'aria-hidden': true })
    }

    function Badge(props) {
      return h('span', { className: 'onm-badge' + (props.tone ? ' ' + props.tone : '') }, props.children)
    }

    function Field(props) {
      return h('label', { className: 'onm-field' + (props.grow ? ' grow' : '') },
        h('span', null, props.label),
        props.children,
      )
    }

    function Empty(props) {
      return h('div', { className: 'onm-empty' }, props.children || props.t('common.empty'))
    }

    function PanelIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        'aria-hidden': true, style: { display: 'block', opacity: props && props.active ? 1 : 0.86 },
      },
        h('path', { d: 'M3 5.2h18' }),
        h('path', { d: 'M5.4 9.2h13.2' }),
        h('path', { d: 'M7 5.6 5.9 20' }),
        h('path', { d: 'M17 5.6 18.1 20' }),
        h('path', { d: 'M10.2 13.4h3.6' }),
      )
    }

    function Header(props) {
      const t = props.t
      const c = props.c
      const device = currentDevice(c.data)
      const serviceChip = h('span', { className: 'onm-chip ' + (c.offline ? 'bad' : 'ok') },
        h(Dot, null), c.offline ? t('status.off') : t('status.on'))
      const deviceChip = h('span', { className: 'onm-chip ' + (device ? (device.online ? 'ok' : 'warn') : '') },
        h(Dot, null), device ? (device.online ? t('status.deviceOn') : t('status.deviceOff')) : t('common.notSelected'))

      const options = c.data.devices.length
        ? c.data.devices.map((item) => h('option', { key: item.serial, value: item.serial },
            (item.name || item.serial) + (item.online ? '' : ' · ' + t('common.offline'))))
        : [h('option', { key: 'none', value: '' }, t('common.none'))]

      return h('header', { className: 'onm-head' },
        h('div', { className: 'onm-brand' },
          h('span', { className: 'onm-brand-mark', 'aria-hidden': true }, '京'),
          h('div', null,
            h('span', { className: 'onm-eyebrow' }, t('app.eyebrow')),
            h('h1', { className: 'onm-title' }, t('app.title')),
            h('p', { className: 'onm-subtitle' }, t('app.subtitle')),
          ),
        ),
        h('div', { className: 'onm-head-actions' },
          serviceChip,
          deviceChip,
          h('label', { className: 'onm-select-wrap' },
            h('span', { className: 'onm-sr' }, t('common.device')),
            h('select', {
              className: 'onm-select',
              value: device ? device.serial : '',
              onChange: (event) => c.selectDevice(event.target.value),
              'aria-label': t('common.device'),
            }, options),
          ),
          h('button', {
            type: 'button', className: 'onm-btn ghost small',
            onClick: c.refresh, disabled: c.isBusy('refresh'),
          }, c.isBusy('refresh') ? t('common.loading') : t('actions.refresh')),
          h('a', {
            className: 'onm-btn ghost small',
            href: safeConsoleHref(c.data.backend?.url),
            target: '_blank', rel: 'noreferrer',
          }, t('actions.openConsole') + ' ↗'),
        ),
      )
    }

    const TABS = ['overview', 'tasks', 'plans', 'devices', 'diagnostics']

    function TabBar(props) {
      return h('nav', { className: 'onm-tabs', 'aria-label': props.t('app.title') },
        TABS.map((id) => h('button', {
          key: id, type: 'button',
          className: 'onm-tab' + (props.tab === id ? ' active' : ''),
          onClick: () => props.setTab(id),
          'aria-current': props.tab === id ? 'page' : undefined,
        }, props.t('tab.' + id))),
      )
    }

    function Overview(props) {
      const t = props.t
      const c = props.c
      const data = c.data
      const canStart = data.backend?.canStart === true
      const consoleHref = safeConsoleHref(data.backend?.url)
      const runtime = data.backendRuntime || {}
      const runtimeInstalled = runtime.installed === true
      const runtimeRunning = runtime.running === true
      const runtimeCanInstall = runtime.canInstall === true
      const runtimeInstalling = runtime.installing === true
      const device = currentDevice(data)
      const online = !!(device && device.online)
      const run = device ? data.running[device.serial] : null
      const runnable = (data.catalog || []).filter(isRunnable)
      const oasTasks = (data.catalog || []).filter((item) => String(item.source || '').indexOf('OAS:') === 0)
      const nextSchedule = (data.schedules || [])
        .filter((item) => item.enabled && item.next_run_str)
        .sort((left, right) => String(left.next_run_str).localeCompare(String(right.next_run_str)))[0]
      const quickIds = ['courtyard_affairs', 'kekkai_foster', 'bounty', 'daily_gift', 'hyakki', 'guild_collective']
      let quick = quickIds.map((id) => taskById(data, id)).filter(Boolean).filter(isRunnable).slice(0, 4)
      if (quick.length < 4) {
        quick = quick.concat(runnable.filter((item) => item.id !== 'daily_oneclick' && !quick.some((picked) => picked.id === item.id)).slice(0, 4 - quick.length))
      }

      let heroTitle = t('overview.heroIdleTitle')
      let heroBody = t('overview.heroIdleBody')
      if (c.offline) {
        if (canStart) {
          heroTitle = t('overview.heroOfflineTitle')
          heroBody = t('overview.heroOfflineBody')
        } else if (runtimeInstalled) {
          heroTitle = t('overview.heroRuntimeTitle')
          heroBody = t('overview.heroRuntimeBody')
        } else if (runtimeCanInstall || runtimeInstalling) {
          heroTitle = t('overview.heroInstallTitle')
          heroBody = t('overview.heroInstallBody')
        } else {
          heroTitle = canStart ? t('overview.heroOfflineTitle') : t('overview.noRootTitle')
          heroBody = canStart ? t('overview.heroOfflineBody') : t('overview.noRootBody')
        }
      } else if (run) {
        heroTitle = t('overview.heroRunTitle')
        heroBody = tf(t, 'overview.heroRunBody', { task: taskName(data, run.task_id, t), device: device ? (device.name || device.serial) : '' })
      } else if (online) {
        heroTitle = t('overview.heroReadyTitle')
        heroBody = tf(t, 'overview.heroReadyBody', { name: device.name || device.serial })
      }

      const heroActions = []
      if (c.offline) {
        if (canStart) {
          heroActions.push(h('button', {
            key: 'start', type: 'button', className: 'onm-btn primary',
            onClick: c.startBackend, disabled: c.isBusy('backend'),
          }, c.isBusy('backend') ? t('actions.starting') : t('actions.startService')))
        } else if (runtimeInstalled) {
          heroActions.push(h('button', {
            key: 'start-runtime', type: 'button', className: 'onm-btn primary',
            onClick: c.startBackendRuntime,
            disabled: c.isBusy('backend-runtime:start'),
          }, c.isBusy('backend-runtime:start') ? t('diag.backendStarting') : t('overview.startBackendRuntime')))
        } else if (runtimeCanInstall || runtimeInstalling || c.isBusy('backend-runtime:install')) {
          heroActions.push(h('button', {
            key: 'install-runtime', type: 'button', className: 'onm-btn primary',
            onClick: () => {
              if (typeof window === 'undefined' || window.confirm(tf(t, 'diag.backendConfirmInstall', { dir: runtime.backendDir || '' }))) {
                c.installBackendRuntime()
              }
            },
            disabled: c.isBusy('backend-runtime:install') || runtimeInstalling,
          }, (c.isBusy('backend-runtime:install') || runtimeInstalling) ? t('diag.backendInstalling') : t('overview.installBackend')))
        }
        heroActions.push(h('a', {
          key: 'console', className: 'onm-btn ghost', href: consoleHref, target: '_blank', rel: 'noreferrer',
        }, t('actions.openConsole') + ' ↗'))
      } else {
        heroActions.push(h('button', {
          key: 'oneclick', type: 'button', className: 'onm-btn primary',
          onClick: () => props.onOpenTask('daily_oneclick'),
          disabled: !online || !!run,
        }, t('overview.oneclick')))
        heroActions.push(h('button', {
          key: 'tasks', type: 'button', className: 'onm-btn ghost',
          onClick: () => props.onTab(online ? 'tasks' : 'devices'),
        }, online ? t('overview.browseTasks') : t('overview.manageDevices')))
      }

      return [
        h('section', { key: 'hero', className: 'onm-hero' },
          h('span', { className: 'onm-eyebrow' }, t('overview.eyebrow')),
          h('h2', null, heroTitle),
          h('p', null, heroBody),
          c.offline ? h('div', { className: 'onm-hint' },
            runtimeInstalled
              ? [
                  h('span', { key: 'dir-label' }, t('diag.backendDir')),
                  h('code', { key: 'dir' }, runtime.backendDir || '—'),
                ]
              : (runtimeCanInstall || runtimeInstalling)
                ? [
                    h('span', { key: 'install-hint' }, t('overview.installBackendHint')),
                    h('code', { key: 'install-dir' }, runtime.backendDir || '—'),
                  ]
                : canStart
                  ? [
                      h('span', { key: 'path' }, t('overview.pathHint')),
                      h('code', { key: 'script' }, './start.sh'),
                      h('span', { key: 'service' }, t('overview.serviceHint')),
                    ]
                  : [
                      h('span', { key: 'config' }, t('overview.configHint')),
                      h('code', { key: 'file' }, (data.backend && data.backend.configPath) || '~/.dsh/onmyoji-oas.json'),
                    ],
          ) : null,
          h('div', { className: 'onm-hero-actions' }, heroActions),
        ),
        h('section', { key: 'metrics', className: 'onm-grid metrics' },
          h('div', { className: 'onm-card onm-metric' },
            h('span', null, t('overview.metricDevice')),
            h('strong', { title: device ? (device.name || device.serial) : '' }, device ? (device.name || device.serial) : t('common.notSelected')),
            h('em', null, online ? t('status.deviceOn') : t('status.deviceOff')),
          ),
          h('div', { className: 'onm-card onm-metric' },
            h('span', null, t('overview.metricTasks')),
            h('strong', null, String(runnable.length)),
            h('em', null, t('overview.metricOas') + ' · ' + oasTasks.length),
          ),
          h('div', { className: 'onm-card onm-metric' },
            h('span', null, t('overview.metricNext')),
            h('strong', { title: nextSchedule ? (nextSchedule.task_name || nextSchedule.task_id) : '' },
              nextSchedule ? String(nextSchedule.next_run_str) : t('common.none')),
            h('em', null, nextSchedule ? (nextSchedule.task_name || nextSchedule.task_id) : t('plans.noPlans')),
          ),
        ),
        h('div', { key: 'lists', className: 'onm-grid two' },
          h('section', { className: 'onm-card' },
            h('div', { className: 'onm-card-head' },
              h('div', null,
                h('h2', { className: 'onm-card-title' }, t('overview.frequent')),
                h('p', { className: 'onm-card-desc' }, t('overview.allTasks')),
              ),
              h('button', { type: 'button', className: 'onm-btn ghost small', onClick: () => props.onTab('tasks') }, t('overview.allTasks')),
            ),
            quick.length
              ? quick.map((task) => h('div', { key: task.id, className: 'onm-row' },
                  h('div', { className: 'onm-row-main' },
                    h('div', { className: 'onm-row-title' }, task.name || task.id),
                    h('div', { className: 'onm-row-sub' }, cycleLabel(t, task.cycle) + ' · ' + task.id),
                  ),
                  h('div', { className: 'onm-row-actions' },
                    h('button', { type: 'button', className: 'onm-btn small', onClick: () => props.onOpenTask(task.id) }, t('task.setup')),
                  ),
                ))
              : h(Empty, { t }, t('common.empty')),
          ),
          h('section', { className: 'onm-card' },
            h('div', { className: 'onm-card-head' },
              h('div', null,
                h('h2', { className: 'onm-card-title' }, t('overview.sequence')),
                h('p', { className: 'onm-card-desc' }, t('overview.oneclick')),
              ),
            ),
            (data.oneclick && data.oneclick.sequence ? data.oneclick.sequence.slice(0, 6) : []).map((id, index) => {
              const task = taskById(data, id)
              const frozen = (data.oneclick.frozen || []).indexOf(id) !== -1 || (task && task.entry_state === 'frozen')
              const off = task && task.enabled === false
              const sundayOnly = (data.oneclick.sunday_only || []).indexOf(id) !== -1 && new Date().getDay() !== 0
              const label = frozen ? t('task.frozen') : off ? t('task.disabled') : sundayOnly ? t('overview.sunday') : t('kind.must_do')
              return h('div', { key: id, className: 'onm-row' },
                h('div', { className: 'onm-row-main' },
                  h('div', { className: 'onm-row-title' }, String(index + 1).padStart(2, '0') + ' · ' + taskName(data, id, t)),
                  h('div', { className: 'onm-row-sub' }, id),
                ),
                h(Badge, { tone: frozen || off ? '' : 'ok' }, label),
              )
            }).concat(data.oneclick && data.oneclick.sequence && data.oneclick.sequence.length
              ? []
              : [h(Empty, { key: 'empty', t }, t('common.empty'))]),
          ),
        ),
      ]
    }

    function OasCard(props) {
      const t = props.t
      const c = props.c
      const oas = c.data.oas || {}
      const check = c.updateCheck
      const preview = c.oasPreview
      const result = c.oasResult
      const confirmThen = (message, action) => {
        if (typeof window === 'undefined' || window.confirm(message)) action()
      }
      let checkText = ''
      if (check) {
        if (check.ok) {
          if (Number(check.behind) > 0) checkText = tf(t, 'overview.behind', { n: check.behind })
          else if (Number(check.ahead) > 0) checkText = tf(t, 'overview.ahead', { n: check.ahead })
          else checkText = t('overview.upToDate')
        } else {
          checkText = check.message || t('overview.checkFailed')
        }
      }
      const busy = c.busy
      return h('section', { className: 'onm-card' },
        h('div', { className: 'onm-card-head' },
          h('div', null,
            h('h2', { className: 'onm-card-title' }, t('overview.oasTitle')),
            h('p', { className: 'onm-card-desc' }, t('overview.oasBody')),
          ),
          h(Badge, { tone: oas.ok ? 'ok' : '' }, oas.ok ? t('common.online') : (oas.message || t('common.offline'))),
        ),
        h('dl', { className: 'onm-kv' },
          h('dt', null, t('common.branch')),
          h('dd', { className: 'onm-mono' }, oas.branch || '—'),
          h('dt', null, t('common.commit')),
          h('dd', { className: 'onm-mono' }, oas.head ? ((oas.head.short || '') + '  ' + (oas.head.subject || '')) : '—'),
          h('dt', null, t('common.dirty')),
          h('dd', null, String(oas.dirty_count === undefined ? '—' : oas.dirty_count)),
          h('dt', null, t('overview.oasTitle')),
          h('dd', { className: 'onm-mono' }, oas.remote || '—'),
        ),
        h('div', { className: 'onm-hstack', style: { marginTop: '14px' } },
          h('a', { className: 'onm-btn ghost small', href: OAS_DOCS, target: '_blank', rel: 'noreferrer' }, t('actions.docs') + ' ↗'),
          h('a', { className: 'onm-btn ghost small', href: OAS_REPO, target: '_blank', rel: 'noreferrer' }, t('actions.repo') + ' ↗'),
          h('button', {
            type: 'button', className: 'onm-btn small', onClick: c.checkOasUpdate,
            disabled: c.isBusy('oas:check') || c.offline,
          }, c.isBusy('oas:check') ? t('actions.checking') : t('actions.checkUpdate')),
          h('button', {
            type: 'button', className: 'onm-btn small', onClick: c.previewOasUpdate,
            disabled: c.isBusy('oas:preview') || c.offline,
          }, c.isBusy('oas:preview') ? t('overview.previewing') : t('overview.preview')),
          h('button', {
            type: 'button', className: 'onm-btn small',
            onClick: () => confirmThen(t('overview.rollbackConfirm'), c.rollbackOas),
            disabled: c.isBusy('oas:rollback') || c.offline,
          }, c.isBusy('oas:rollback') ? t('overview.rollingBack') : t('overview.rollback')),
        ),
        checkText ? h('div', { className: 'onm-notice ' + (check && check.ok ? '' : 'fail'), style: { marginTop: '12px' } }, checkText) : null,
        preview
          ? h('div', { className: 'onm-notice ' + (preview.ok ? '' : 'fail'), style: { marginTop: '12px' } },
              h('div', null, preview.ok
                ? (Number(preview.behind) > 0
                    ? tf(t, 'overview.previewSummary', {
                        n: preview.behind,
                        m: preview.file_changes_total === undefined ? (preview.file_changes || []).length : preview.file_changes_total,
                        d: preview.dirty_count === undefined ? 0 : preview.dirty_count,
                      })
                    : t('overview.upToDate'))
                : (preview.message || t('overview.checkFailed'))),
              preview.ok && preview.confirm_token && Number(preview.behind) > 0
                ? h('div', { className: 'onm-hstack', style: { marginTop: '10px' } },
                    h('button', {
                      type: 'button', className: 'onm-btn primary small',
                      onClick: () => confirmThen(t('overview.applyConfirm'), c.applyOasUpdate),
                      disabled: c.isBusy('oas:apply'),
                    }, c.isBusy('oas:apply') ? t('overview.applying') : t('overview.apply')),
                  )
                : null,
              preview.ok && preview.dirty_count
                ? h('div', { className: 'onm-row-sub', style: { marginTop: '6px' } }, t('overview.dirtyNote'))
                : null,
              preview.ok && Array.isArray(preview.planned_steps) && preview.planned_steps.length
                ? h('details', { className: 'onm-details', style: { marginTop: '8px' } },
                    h('summary', null, t('overview.steps')),
                    h('div', { style: { marginTop: '6px' } },
                      preview.planned_steps.map((step, index) => h('div', { key: String(index), className: 'onm-row-sub' }, String(index + 1) + '. ' + step))),
                  )
                : null,
            )
          : null,
        result
          ? h('div', { className: 'onm-notice ' + (result.ok ? 'ok' : 'fail'), style: { marginTop: '12px' } },
              h('div', null, result.message || (result.ok ? t('overview.updateDone') : t('overview.checkFailed'))),
              result.ok ? h('div', { className: 'onm-row-sub', style: { marginTop: '6px' } }, t('overview.restartNote')) : null,
              Array.isArray(result.steps) && result.steps.length
                ? h('details', { className: 'onm-details', style: { marginTop: '8px' } },
                    h('summary', null, t('overview.steps')),
                    h('div', { style: { marginTop: '6px' } },
                      result.steps.map((step, index) => h('div', { key: String(index), className: 'onm-row-sub' },
                        (step.ok ? '✓ ' : '✗ ') + (step.step || '') + (step.detail ? ' · ' + step.detail : '')))),
                  )
                : null,
            )
          : null,
      )
    }

    function Tasks(props) {
      const { t, c } = props
      const { search, filter, visible = 24 } = props.draft
      const query = search.trim().toLowerCase()
      const list = c.data.catalog.filter((task) => {
        if (filter === 'ready' && !isRunnable(task)) return false
        if (['daily', 'weekly', 'event'].includes(filter) && task.cycle !== filter) return false
        return !query || [task.name, task.id, task.note, task.source]
          .some((value) => String(value || '').toLowerCase().includes(query))
      }).sort((a, b) => Number(!isRunnable(a)) - Number(!isRunnable(b))
        || (a.order ?? 100) - (b.order ?? 100) || String(a.name).localeCompare(String(b.name)))
      const updateFilter = (patch) => props.onDraft({ ...patch, visible: 24 })
      return [
        h('div', { key: 'head' },
          h('h2', { className: 'onm-page-title' }, t('tasks.title')),
          h('p', { className: 'onm-page-desc' }, t('tasks.subtitle'))),
        h('div', { key: 'filters', className: 'onm-toolbar' },
          h('input', { className: 'onm-input', type: 'search', value: search,
            placeholder: t('tasks.search'), 'aria-label': t('tasks.search'),
            onChange: (e) => updateFilter({ search: e.target.value }) }),
          h('div', { className: 'onm-segmented', role: 'group', 'aria-label': t('tasks.title') },
            ['all', 'ready', 'daily', 'weekly', 'event'].map((id) => h('button', {
              key: id, type: 'button', className: 'onm-seg' + (filter === id ? ' active' : ''),
              'aria-pressed': filter === id, onClick: () => updateFilter({ filter: id }),
            }, t('tasks.' + id))))),
        h('div', { key: 'count', className: 'onm-count', role: 'status' },
          tf(t, 'tasks.found', { n: list.length, m: Math.min(visible, list.length) })),
        c.data.resourceErrors.catalog && !c.data.catalog.length
          ? h('div', { key: 'error', className: 'onm-notice fail' }, t('data.catalogFailed'),
              h('button', { className: 'onm-btn small', onClick: c.refresh }, t('actions.retry')))
          : h('div', { key: 'list', className: 'onm-task-list' }, list.slice(0, visible).map((task) => {
              const serial = taskTarget(c.data, task)
              const device = c.data.devices.find((item) => item.serial === serial)
              const reason = taskRunReason(c, task, t, serial)
              const state = taskState(t, task)
              const summary = [device?.name || serial || t('common.notSelected')]
              if (task.count?.supported) summary.push((task.count.value ?? task.count.default) + ' ' + t('common.count'))
              for (const meta of Object.values(task.options || {})) {
                const value = meta.value === undefined ? meta.default : meta.value
                summary.push((meta.choices || []).find(([id]) => id === value)?.[1] || value)
              }
              return h('article', { key: task.id, className: 'onm-task-row' + (isRunnable(task) ? '' : ' off') },
                h('div', { className: 'onm-row-main' },
                  h('h3', { className: 'onm-task-title' }, task.name || task.id),
                  h('p', { className: 'onm-row-sub' }, summary.filter(Boolean).join(' · ')),
                  reason ? h('p', { className: 'onm-row-sub' }, reason) : null),
                h('div', { className: 'onm-row-actions' },
                  h(Badge, { tone: state.tone }, state.label),
                  h('button', { type: 'button', className: 'onm-btn small',
                    onClick: () => props.onOpenTask(task.id),
                    'aria-label': (task.name || task.id) + ' · ' + t('actions.settings') }, t('actions.settings')),
                  h('button', { type: 'button', className: 'onm-btn primary small', disabled: !!reason,
                    title: reason || summary.join(' · '),
                    'aria-label': (task.name || task.id) + ' · ' + t('actions.run'),
                    onClick: () => c.runTask(task.id, serial,
                      task.count?.supported ? (task.count.value ?? task.count.default) : undefined, taskDefaults(task)),
                  }, t('actions.run'))))
            }), !list.length ? h('div', { className: 'onm-empty' }, t('tasks.noMatch')) : null),
        visible < list.length ? h('button', { key: 'more', type: 'button', className: 'onm-btn small',
          onClick: () => props.onDraft({ visible: visible + 24 }) }, t('actions.more')) : null,
      ]
    }

    function ExecutionPanel({ t, c, onOpenTask }) {
      const rows = executionRows(c)
      const active = rows.filter(isActiveExecution)
      const latest = rows.filter((job) => !isActiveExecution(job))
      const renderJob = (job) => {
        const device = c.data.devices.find((item) => item.serial === job.device)
        const result = job.result || {}
        const steps = result.business?.steps || []
        return h('div', { key: job.id, className: 'onm-execution' },
          h('div', { className: 'onm-row' },
            h('div', { className: 'onm-row-main' },
              h('div', { className: 'onm-row-title' }, taskName(c.data, job.task_id, t)),
              h('div', { className: 'onm-row-sub' }, (device?.name || job.device) + ' · ' + fmtTime(job.created_at)),
              result.message ? h('div', { className: 'onm-row-sub' }, result.message) : null),
            h('div', { className: 'onm-row-actions' },
              h(Badge, { tone: job.state === 'failed' || job.state === 'partial' ? 'bad' : isActiveExecution(job) ? 'warn' : job.state === 'succeeded' ? 'ok' : '' }, t('execution.' + job.state)),
              isActiveExecution(job) ? h('button', {
                type: 'button', className: 'onm-btn danger small',
                disabled: job.state === 'stopping' || c.isBusy('stop:' + job.device),
                onClick: () => c.stopDevice(job.device, job.id),
              }, job.state === 'stopping' ? t('execution.stopping') : t('actions.stopTask'))
                : h('button', { type: 'button', className: 'onm-btn small',
                    onClick: () => onOpenTask(job.task_id, job.request, job.device) }, t('actions.settings')))),
          result.business && Object.keys(result.business).length ? h('details', { className: 'onm-details' },
            h('summary', null, t('execution.details')),
            steps.length ? steps.map((step, i) => h('div', { key: i, className: 'onm-row-sub' },
              (step.skipped ? '— ' : step.ok ? '✓ ' : '✗ ') + taskName(c.data, step.task_id, t) + ' · ' + (step.message || '')))
              : h('pre', { className: 'onm-code' }, JSON.stringify(result.business, null, 2))) : null)
      }
      return h('section', { className: 'onm-card onm-executions', 'aria-label': t('execution.title') },
        h('h2', { className: 'onm-card-title' }, t('execution.title')),
        active.map(renderJob),
        latest.length ? h('details', { className: 'onm-result-history', open: !active.length },
          h('summary', null, t('rail.recent') + ' · ' + latest.length), latest.map(renderJob)) : null,
        !rows.length ? h('p', { className: 'onm-row-sub' }, t('execution.empty')) : null)
    }

    function Plans({ t, c, draft, onDraft }) {
      const { text, device, preview, editId } = draft
      const change = (patch) => onDraft({ ...patch, preview: null })
      const submit = async (event) => {
        event.preventDefault()
        if (!text.trim()) return
        const result = await c.previewSchedule(text.trim(), device || c.data.device)
        if (result) onDraft({ preview: result, __expected: draft._revision || 0 })
      }
      const confirm = async () => {
        if (!preview) return
        const ok = await c.createSchedule(preview.text, preview.device_serial, editId)
        if (ok) onDraft({ text: '', device: '', preview: null, editId: null, __expected: draft._revision || 0 })
      }
      return [
        h('div', { key: 'head' }, h('h2', { className: 'onm-page-title' }, t('plans.title')),
          h('p', { className: 'onm-page-desc' }, t('plans.reviewHint'))),
        h('section', { key: 'form', className: 'onm-card' },
          h('h2', { className: 'onm-card-title' }, editId ? t('plans.edit') : t('plans.addTitle')),
          h('form', { className: 'onm-form', onSubmit: submit, style: { marginTop: '12px' } },
            h(Field, { label: t('plans.rule'), grow: true }, h('input', {
              className: 'onm-input', value: text, required: true, maxLength: 1000,
              placeholder: t('plans.placeholder'), onChange: (e) => change({ text: e.target.value }),
            })),
            h(Field, { label: t('common.device') }, h('select', {
              className: 'onm-select', value: device || c.data.device,
              onChange: (e) => change({ device: e.target.value }),
            }, !c.data.devices.length ? h('option', { value: '' }, t('common.notSelected')) : null,
              c.data.devices.map((item) => h('option', { key: item.serial, value: item.serial }, item.name || item.serial)))),
            h('button', { type: 'submit', className: 'onm-btn',
              disabled: !text.trim() || c.isBusy('schedule:preview') || c.isBusy('schedule:create') || c.offline,
            }, c.isBusy('schedule:preview') ? t('common.loading') : t('plans.preview'))),
          preview ? h('div', { className: 'onm-notice', style: { marginTop: '14px' } },
            h('div', null,
              h('strong', null, preview.task_name),
              h('p', null, preview.description + ' · ' + preview.device_name),
              h('p', null, preview.count != null ? tf(t, 'plans.fixedCount', {n:preview.count}) : t('plans.defaultCount')),
              h('p', null, t('common.nextRun') + ': ' + preview.next_run_str),
              (preview.warnings || []).map((warning, i) => h('p', { key: i }, warning))),
            h('button', { type: 'button', className: 'onm-btn primary', onClick: confirm,
              disabled: c.isBusy('schedule:create') }, c.isBusy('schedule:create') ? t('actions.saving') : t('plans.confirm')))
            : null,
          editId ? h('button', { type: 'button', className: 'onm-btn small', style: { marginTop: '10px' },
            onClick: () => onDraft({ text: '', device: '', preview: null, editId: null }) }, t('actions.close')) : null),
        h('section', { key: 'list' },
          h('h2', { className: 'onm-card-title' }, t('plans.existing')),
          c.data.schedules.map((schedule) => h('article', { key: schedule.id, className: 'onm-card onm-schedule' },
            h('div', { className: 'onm-row-main' },
              h('h3', { className: 'onm-task-title' }, schedule.task_name || taskName(c.data, schedule.task_id, t)),
              h('div', { className: 'onm-row-sub' }, (c.data.devices.find((item) => item.serial === schedule.device_serial)?.name
                || schedule.device_serial || t('plans.backendDefault')) + ' · ' + (schedule.next_run_str || t('common.none'))),
              h('p', { className: 'onm-row-sub' }, schedule.text),
              h('p', { className: 'onm-row-sub' }, schedule.count != null ? tf(t, 'plans.fixedCount', {n:schedule.count}) : t('plans.defaultCount')),
              h('p', { className: 'onm-row-sub' }, t('plans.lastResult') + ': ' + (schedule.last_result
                ? fmtTime(schedule.last_run) + ' · ' + (t('execution.' + (schedule.last_result.state || (schedule.last_result.stopped ? 'stopped' : schedule.last_result.partial ? 'partial' : schedule.last_result.ok ? 'succeeded' : 'failed'))) + (schedule.last_result.message ? ' · ' + schedule.last_result.message : ''))
                : t('plans.noResult')))),
            h('div', { className: 'onm-row-actions' },
              h(Badge, { tone: schedule.status === 'error' ? 'bad' : schedule.enabled ? 'ok' : '' },
                schedule.status === 'running' ? t('execution.running') : schedule.enabled ? t('plans.enabled') : t('plans.paused')),
              h('button', { type: 'button', className: 'onm-btn small',
                disabled: c.isBusy('schedule:toggle:' + schedule.id),
                onClick: () => c.toggleSchedule(schedule.id, !schedule.enabled) }, schedule.enabled ? t('actions.disable') : t('actions.enable')),
              h('button', { type: 'button', className: 'onm-btn small',
                disabled: schedule.status === 'running' || c.isBusy('schedule:run:' + schedule.id),
                onClick: () => c.runSchedule(schedule.id) }, c.isBusy('schedule:run:' + schedule.id) ? t('actions.running') : t('plans.runOnce')),
              c.data.health?.features?.schedule_preview ? h('button', { type: 'button', className: 'onm-btn small',
                disabled: schedule.status === 'running', onClick: () => onDraft({ text: schedule.text,
                  device: schedule.device_serial || c.data.device, preview: null, editId: schedule.id }),
              }, t('plans.edit')) : null,
              h('button', { type: 'button', className: 'onm-btn danger small',
                disabled: schedule.status === 'running' || c.isBusy('schedule:delete:' + schedule.id),
                onClick: () => { if (window.confirm(t('plans.deleteConfirm'))) c.deleteSchedule(schedule.id) },
              }, t('actions.delete'))))),
          !c.data.schedules.length ? h('div', { className: 'onm-card onm-empty' }, t('plans.noPlans')) : null),
      ]
    }

    function Devices(props) {
      const t = props.t
      const c = props.c
      const { serial, name } = props.draft
      const setSerial = (serial) => props.onDraft({ serial })
      const setName = (name) => props.onDraft({ name })
      const adding = c.isBusy('device:add')
      const submit = async (event) => {
        event.preventDefault()
        if (!serial.trim()) return
        const ok = await c.addDevice(serial.trim(), name.trim())
        if (ok) {
          setSerial('')
          setName('')
        }
      }
      const devices = c.data.devices || []
      return [
        h('div', { key: 'head' },
          h('span', { className: 'onm-eyebrow' }, t('devices.eyebrow')),
          h('h2', { className: 'onm-page-title' }, t('devices.title')),
          h('p', { className: 'onm-page-desc' }, t('devices.subtitle')),
        ),
        devices.length
          ? h('section', { key: 'grid', className: 'onm-grid two' },
              devices.map((device) => {
                const run = c.data.running[device.serial]
                return h('article', { key: device.serial, className: 'onm-card' },
                  h('div', { className: 'onm-card-head' },
                    h('div', null,
                      h('span', { className: 'onm-eyebrow' }, device.emulator && device.emulator !== 'auto' ? device.emulator : t('devices.guess')),
                      h('h2', { className: 'onm-card-title' }, device.name || device.serial),
                    ),
                    h(Badge, { tone: device.online ? 'ok' : 'bad' }, device.online ? t('common.online') : t('common.offline')),
                  ),
                  h('dl', { className: 'onm-kv' },
                    h('dt', null, t('devices.serial')),
                    h('dd', { className: 'onm-mono' }, device.serial),
                    h('dt', null, t('devices.loginCharacter')),
                    h('dd', null, device.login_character || t('common.notSet')),
                    h('dt', null, t('devices.running')),
                    h('dd', null, run ? taskName(c.data, run.task_id, t) : t('common.none')),
                  ),
                  h('div', { className: 'onm-hstack', style: { marginTop: '14px' } },
                    h('button', { type: 'button', className: 'onm-btn small', onClick: () => c.selectDevice(device.serial) }, t('actions.setCurrent')),
                    h('button', {
                      type: 'button', className: 'onm-btn small', onClick: () => c.connectDevice(device.serial),
                      disabled: c.isBusy('connect:' + device.serial),
                    }, c.isBusy('connect:' + device.serial) ? t('common.loading') : t('actions.connect')),
                    h('button', {
                      type: 'button', className: 'onm-btn small', onClick: () => c.warmDevice(device.serial),
                      disabled: c.isBusy('warm:' + device.serial),
                    }, c.isBusy('warm:' + device.serial) ? t('common.loading') : t('actions.warm')),
                    run ? h('button', {
                      type: 'button', className: 'onm-btn danger small', onClick: () => c.stopDevice(device.serial, c.data.executions.find(job => job.device === device.serial && isActiveExecution(job))?.id || c.data.running[device.serial]?.execution_id),
                      disabled: c.isBusy('stop:' + device.serial),
                    }, t('actions.stopTask')) : null,
                  ),
                )
              }),
            )
          : h('div', { key: 'empty', className: 'onm-card onm-empty' }, t('devices.noDevices')),
        h('section', { key: 'add', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('devices.addTitle')),
              h('p', { className: 'onm-card-desc' }, t('devices.offlineHint')),
            ),
          ),
          h('form', { className: 'onm-form', onSubmit: submit },
            h(Field, { label: t('devices.serial'), grow: true },
              h('input', {
                className: 'onm-input', value: serial, required: true,
                placeholder: t('devices.serialPlaceholder'),
                onChange: (event) => setSerial(event.target.value),
              }),
            ),
            h(Field, { label: t('devices.name'), grow: true },
              h('input', {
                className: 'onm-input', value: name,
                placeholder: t('devices.namePlaceholder'),
                onChange: (event) => setName(event.target.value),
              }),
            ),
            h('button', { type: 'submit', className: 'onm-btn primary', disabled: adding || !serial.trim() },
              adding ? t('actions.adding') : t('actions.add')),
          ),
        ),
        h('details', { key: 'manage', className: 'onm-card onm-details' },
          h('summary', null, t('devices.manage')),
          h('div', { style: { marginTop: '10px' } },
            devices.map((device) => h('div', { key: device.serial, className: 'onm-row' },
              h('div', { className: 'onm-row-main' },
                h('div', { className: 'onm-row-title' }, device.name || device.serial),
                h('div', { className: 'onm-row-sub onm-mono' }, device.serial),
              ),
              h('div', { className: 'onm-row-actions' },
                h('button', {
                  type: 'button', className: 'onm-btn small',
                  onClick: () => c.toggleDevice(device.serial, device.enabled === false),
                  disabled: c.isBusy('device:toggle:' + device.serial),
                }, device.enabled === false ? t('actions.enable') : t('actions.disable')),
                h('button', {
                  type: 'button', className: 'onm-btn danger small',
                  onClick: () => { if (window.confirm(tf(t, 'device.deleteConfirm', { name: device.name || device.serial }))) c.deleteDevice(device.serial) },
                  disabled: c.isBusy('device:delete:' + device.serial),
                }, t('actions.delete')),
              ),
            )),
            devices.length ? null : h('div', { className: 'onm-empty' }, t('common.empty')),
          ),
        ),
      ]
    }

    function Diagnostics(props) {
      const t = props.t
      const c = props.c
      const [group, setGroup] = useState('summary')
      const [expanded, setExpanded] = useState('')
      const health = c.data.health || {}
      const scheduler = c.data.scheduler || {}
      const oas = c.data.oas || {}
      const backend = c.data.backend || {}
      const canStart = backend.canStart !== false
      const baseline = c.data.baseline || {}
      const baselines = baseline.baselines || []
      const canBaseline = baseline.canBaseline === true
      const runtime = c.data.oasRuntime || {}
      const runtimeExists = runtime.exists === true
      const runtimeMirror = runtime.mirrorUrl || ''
      const runtimeCheck = c.oasRuntimeCheck
      const runtimeResult = c.oasRuntimeResult
      const portable = c.data.backendRuntime || {}
      const portableInstalled = portable.installed === true
      const portableRunning = portable.running === true
      const portableCanInstall = portable.canInstall === true
      const portableInstalling = portable.installing === true
      const portableError = portable.installError || ''
      // Product mode: no source backend available. Product users only see the
      // core package card; source developers keep every advanced tool.
      const productMode = !(c.data.backend && c.data.backend.canStart === true && !portableInstalled)
      const modulesState = c.data.modules || {}
      const modules = modulesState.modules || []
      const autostart = (c.data.autostart && c.data.autostart.config) || {}
      const kind = health.instance?.kind || (portableRunning ? 'portable' : null)
      const maintenanceBusy = c.pendingKeys.some(key => /^(backend|module:|baseline:|oas-runtime:|oas:apply|oas:rollback)/.test(key)) || portableInstalling || modules.some(item => item.installing)
      const sections = [
        c.offline ? h('div', { key: 'offline', className: 'onm-notice fail' }, t('diag.healthOffline') + ' · ' + (c.error || t('status.off'))) : null,
        c.maintenanceResult ? h('section', { key: 'maintenance-result', className: 'onm-card' },
          h('h2', { className: 'onm-card-title' }, t('diag.result')),
          h('div', { className: 'onm-notice ' + (c.maintenanceResult.ok && !c.maintenanceResult.warnings?.length ? 'ok' : 'fail') }, c.maintenanceResult.message),
          (c.maintenanceResult.warnings || []).map((warning,i) => h('p', {key:i, className:'onm-row-sub'}, warning))) : null,
        h('section', { key: 'actions', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.actions')),
              h('p', { className: 'onm-card-desc' }, t('diag.advancedHint')),
            ),
          ),
          h('div', { className: 'onm-hstack' },
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: c.tickNow,
              disabled: c.offline || c.isBusy('tick'),
            }, c.isBusy('tick') ? t('common.loading') : t('actions.tick')),
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: c.warmAll,
              disabled: c.offline || c.isBusy('warm:all'),
            }, c.isBusy('warm:all') ? t('common.loading') : t('actions.warmAll')),
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: c.exportDiagnose,
              disabled: c.offline || c.isBusy('export'),
            }, c.isBusy('export') ? t('actions.exporting') : t('actions.export')),
            (!c.offline && canStart && kind === 'source') ? h('button', {
              type: 'button', className: 'onm-btn small',
              onClick: () => {
                if (typeof window === 'undefined' || window.confirm(t('diag.stopConfirm'))) c.stopBackend()
              },
              disabled: c.isBusy('backend'),
            }, t('actions.stopService')) : null,
          ),
          c.exportResult
            ? h('div', { className: 'onm-notice ok', style: { marginTop: '12px' } },
                t('diag.exported') + ' · ' + t('diag.exportPath') + '：' + (c.exportResult.path || ''))
            : null,
        ),
        h(OasCard, { key: 'source-update', t, c }),
        h('section', { key: 'oas-runtime', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.oasRuntime')),
              h('p', { className: 'onm-card-desc' }, t('diag.oasRuntimeDesc')),
            ),
            h(Badge, { tone: runtimeExists ? 'ok' : '' }, runtimeExists ? t('diag.available') : t('diag.notDetected')),
          ),
          h('dl', { className: 'onm-kv' },
            h('dt', null, t('diag.oasMirror')),
            h('dd', { className: 'onm-mono' }, runtimeMirror || '—'),
            h('dt', null, t('diag.oasLocal')),
            h('dd', { className: 'onm-mono' }, runtime.oasRoot || '—'),
            runtimeExists
              ? h('dt', null, t('common.commit'))
              : null,
            runtimeExists
              ? h('dd', { className: 'onm-mono' }, runtime.head
                  ? ((runtime.head.short || '') + ' · ' + (runtime.head.branch || '') + ' · ' + (runtime.head.subject || ''))
                  : '—')
              : null,
            runtimeExists
              ? h('dt', null, t('diag.baselineDirtyLabel'))
              : null,
            runtimeExists
              ? h('dd', null, tf(t, 'diag.baselineDirty', { n: runtime.dirty_count || 0 }))
              : null,
          ),
          !runtimeMirror
            ? h('div', { className: 'onm-notice fail', style: { marginTop: '12px' } },
                t('diag.oasNoMirror') + ' · ' + t('diag.oasMirrorHint') + '：' + ((c.data.backend && c.data.backend.configPath) || '~/.dsh/onmyoji-oas.json'))
            : null,
          !runtimeExists && runtime.canInstall
            ? h('div', { className: 'onm-hstack', style: { marginTop: '12px' } },
                h('button', {
                  type: 'button', className: 'onm-btn primary small', onClick: c.installOasRuntime,
                  disabled: c.isBusy('oas-runtime:install'),
                }, c.isBusy('oas-runtime:install') ? t('diag.oasInstalling') : t('diag.oasInstall')),
                h('span', { className: 'onm-row-sub' }, tf(t, 'diag.oasInstallHint', { path: runtime.oasRoot || '' })),
              )
            : null,
          runtimeExists
            ? h('div', { className: 'onm-hstack', style: { marginTop: '12px' } },
                h('button', {
                  type: 'button', className: 'onm-btn small', onClick: c.checkOasRuntime,
                  disabled: !runtime.canUpdate || c.isBusy('oas-runtime:check'),
                }, c.isBusy('oas-runtime:check') ? t('actions.checking') : t('actions.checkUpdate')),
                h('button', {
                  type: 'button', className: 'onm-btn small', onClick: c.updateOasRuntime,
                  disabled: !runtime.canUpdate || c.isBusy('oas-runtime:update') || runtime.tracked_dirty > 0,
                }, c.isBusy('oas-runtime:update') ? t('diag.oasUpdating') : t('diag.oasUpdateNow')),
                (c.data.backend && c.data.backend.canStart !== false)
                  ? h('button', {
                      type: 'button', className: 'onm-btn small', onClick: c.restartBackend,
                      disabled: c.isBusy('backend'),
                    }, c.isBusy('backend') ? t('diag.oasRestarting') : t('diag.oasRestart'))
                  : null,
              )
            : null,
          runtimeExists && runtime.tracked_dirty > 0
            ? h('div', { className: 'onm-notice', style: { marginTop: '10px' } }, t('diag.oasTrackedDirty'))
            : null,
          runtimeCheck
            ? h('div', { className: 'onm-notice ' + (runtimeCheck.ok ? '' : 'fail'), style: { marginTop: '10px' } },
                runtimeCheck.ok
                  ? (Number(runtimeCheck.behind) > 0
                      ? tf(t, 'diag.oasBehind', { n: runtimeCheck.behind })
                      : t('diag.oasUpToDate'))
                    + (Number(runtimeCheck.ahead) > 0 ? ' · ' + tf(t, 'diag.oasAhead', { n: runtimeCheck.ahead }) : '')
                  : (runtimeCheck.message || t('overview.checkFailed')))
            : null,
          runtimeResult
            ? h('div', { className: 'onm-notice ' + (runtimeResult.ok && !runtimeResult.warnings?.length ? 'ok' : 'fail'), style: { marginTop: '10px' } },
                runtimeResult.message || (runtimeResult.ok ? t('diag.oasUpdated') : t('toast.failed')))
            : null,
          h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.oasUpdateHint')),
        ),
        h('section', { key: 'backend-runtime', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.backendRuntime')),
              h('p', { className: 'onm-card-desc' }, t('diag.backendRuntimeDesc')),
            ),
            h(Badge, {
              tone: portableRunning ? 'ok' : portableError ? 'bad' : (portableInstalled || portableInstalling) ? 'warn' : '',
            }, portableRunning
              ? t('diag.backendRunning')
              : portableInstalling
                ? t('diag.backendInstallingShort')
                : portableInstalled
                  ? t('diag.backendStopped')
                  : t('diag.backendNotInstalled')),
          ),
          h('dl', { className: 'onm-kv' },
            h('dt', null, t('diag.coreVersion')),
            h('dd', { className: 'onm-mono' }, portable.coreVersion || '—'),
            h('dt', null, t('diag.oasVersion')),
            h('dd', { className: 'onm-mono' },
              (portable.oasVersion || '—') + (portable.oasUpstreamVersion ? ' · ' + t('diag.oasUpstream') + ' ' + String(portable.oasUpstreamVersion).slice(0, 8) : '')),
            h('dt', null, t('diag.backendOas')),
            h('dd', null, portable.oasInstalled ? t('diag.backendOasReady') : t('diag.backendOasMissing')),
            !productMode ? h('dt', null, t('diag.backendPlatform')) : null,
            !productMode ? h('dd', { className: 'onm-mono' }, portable.platform || '—') : null,
            !productMode ? h('dt', null, t('diag.backendDir')) : null,
            !productMode ? h('dd', { className: 'onm-mono' }, portable.backendDir || '—') : null,
            !productMode ? h('dt', null, t('diag.backendBundle')) : null,
            !productMode ? h('dd', { className: 'onm-mono' }, portable.consoleBundleUrl || '—') : null,
          ),
          productMode
            ? h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.coreUpdateHint'))
            : null,
          c.coreCheck
            ? h('div', { className: 'onm-notice ' + (c.coreCheck.compatible === false ? 'fail' : (c.coreCheck.updateAvailable ? 'ok' : '')), style: { marginTop: '10px' }, role: 'status' },
                c.coreCheck.compatible === false
                  ? c.coreCheck.message
                  : (c.coreCheck.updateAvailable
                      ? tf(t, 'diag.coreUpdateAvailable', { version: c.coreCheck.latest })
                      : t('diag.coreUpToDate')))
            : null,
          productMode && portable.installed && !c.coreCheck
            ? h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.coreCheckHint'))
            : null,
          !portable.consoleBundleUrl
            ? h('div', { className: 'onm-notice fail', style: { marginTop: '12px' } }, t('diag.backendNoBundle'))
            : null,
          portableError
            ? h('div', { className: 'onm-notice fail', style: { marginTop: '12px' } }, portableError)
            : null,
          h('div', { className: 'onm-hstack', style: { marginTop: '12px' } },
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: c.checkCoreUpdate,
              disabled: c.isBusy('backend-runtime:check') || portableInstalling,
            }, c.isBusy('backend-runtime:check') ? t('diag.coreChecking') : t('diag.checkCore')),
            (!portableInstalled && (portableCanInstall || portableInstalling || c.isBusy('backend-runtime:install')))
              ? h('button', {
                  type: 'button', className: 'onm-btn primary small',
                  onClick: () => {
                    if (typeof window === 'undefined' || window.confirm(tf(t, 'diag.backendConfirmInstall', { dir: portable.backendDir || '' }))) {
                      c.installBackendRuntime()
                    }
                  },
                  disabled: c.isBusy('backend-runtime:install') || portableInstalling,
                }, (c.isBusy('backend-runtime:install') || portableInstalling) ? t('diag.backendInstalling') : t('diag.backendInstall'))
              : null,
            (portableInstalled && c.coreCheck?.updateAvailable && c.coreCheck?.compatible !== false && !portableInstalling)
              ? h('button', {
                  type: 'button', className: 'onm-btn primary small', onClick: c.installBackendRuntime,
                  disabled: c.isBusy('backend-runtime:install') || portableInstalling || c.isBusy('backend-runtime:check'),
                }, tf(t, 'diag.coreUpdate', { version: c.coreCheck.latest }))
              : null,
            (portableInstalled && !portableRunning && c.offline)
              ? h('button', {
                  type: 'button', className: 'onm-btn primary small', onClick: c.startBackendRuntime,
                  disabled: maintenanceBusy,
                }, c.isBusy('backend-runtime:start') ? t('diag.backendStarting') : t('diag.backendStart'))
              : null,
            portableRunning
              ? h('button', {
                  type: 'button', className: 'onm-btn danger small',
                  onClick: () => {
                    if (typeof window === 'undefined' || window.confirm(t('diag.backendConfirmStop'))) c.stopBackendRuntime()
                  },
                  disabled: maintenanceBusy,
                }, c.isBusy('backend-runtime:stop') ? t('diag.backendStopping') : t('diag.backendStop'))
              : null,
          ),
          portable.log
            ? h('details', { className: 'onm-details', style: { marginTop: '10px' } },
                h('summary', null, t('diag.backendLog')),
                h('pre', { className: 'onm-code' }, portable.log),
              )
            : null,
          h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.backendUpdateHint')),
        ),
        h('section', { key: 'modules', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.modules')),
              h('p', { className: 'onm-card-desc' }, t('diag.modulesDesc')),
            ),
          ),
          modules.length === 0
            ? h('div', { className: 'onm-hint' }, t('diag.moduleUnsupported'))
            : modules.map((def) => {
              const installing = def.installing === true
              return h('div', { key: def.id, className: 'onm-module' },
                h('div', { className: 'onm-module-head' },
                  h('div', null,
                    h('h3', null, def.name),
                    h('p', { className: 'onm-card-desc' }, def.id === 'local-llm' ? t('diag.moduleDescription') : def.description),
                  ),
                  h(Badge, {
                    tone: def.installed ? 'ok' : def.error ? 'bad' : installing ? 'warn' : '',
                  }, def.installed
                    ? t('diag.moduleInstalled')
                    : installing
                      ? t('diag.moduleInstalling')
                      : t('diag.moduleNotInstalled')),
                ),
                h('div', { className: 'onm-hstack', style: { marginTop: '8px' } },
                  h('span', { className: 'onm-row-sub' }, `${t('diag.moduleSize')} ${fmtBytes(def.size)}`),
                  h('span', { className: 'onm-row-sub' }, `${t('diag.moduleRequiresCore')} ${def.requiresCore}`),
                  !def.supported ? h('span', { className: 'onm-row-sub' }, t('diag.moduleUnsupported')) : null,
                ),
                def.installed ? h('p', {className:'onm-row-sub'},
                  portableRunning && (health.instance?.modules || []).includes(def.id + '@' + def.version)
                    ? t('diag.moduleMounted') : t('diag.modulePending')) : null,
                def.installed && portableRunning ? h('p', {className:'onm-row-sub'}, t('diag.moduleStopFirst')) : null,
                (!def.installed && def.supported && !def.coreReady && !def.installing)
                  ? h('p', { className: 'onm-row-sub' }, def.coreVersion
                      ? tf(t, 'diag.moduleCoreVersion', { current: def.coreVersion, required: def.requiresCore })
                      : t('diag.moduleCoreMissing'))
                  : null,
                def.error
                  ? h('div', { className: 'onm-notice fail', style: { marginTop: '8px' } }, def.error)
                  : null,
                h('div', { className: 'onm-hstack', style: { marginTop: '8px' } },
                  (!def.installed && def.canInstall)
                    ? h('button', {
                        type: 'button', className: 'onm-btn primary small',
                        onClick: () => {
                          if (typeof window === 'undefined' || window.confirm(tf(t, 'diag.moduleInstallConfirm', { name: def.name, size: fmtBytes(def.size) }))) {
                            c.installModule(def.id)
                          }
                        },
                        disabled: maintenanceBusy || !portableInstalled,
                      }, (c.isBusy('module:install') || installing) ? t('diag.moduleInstalling') : t('diag.moduleInstall'))
                    : null,
                  def.installed
                    ? h('button', {
                        type: 'button', className: 'onm-btn danger small',
                        onClick: () => {
                          if (typeof window === 'undefined' || window.confirm(tf(t, 'diag.moduleRemoveConfirm', { name: def.name }))) {
                            c.removeModule(def.id)
                          }
                        },
                        disabled: maintenanceBusy || portableRunning,
                      }, c.isBusy('module:remove') ? t('diag.moduleInstalling') : t('diag.moduleRemove'))
                    : null,
                  (portableInstalled || portableRunning)
                    ? h('button', {
                        type: 'button', className: 'onm-btn ghost small',
                        onClick: c.restartBackendRuntime,
                        disabled: maintenanceBusy || (!c.offline && !portableRunning),
                      }, (c.isBusy('backend-runtime:restart') || c.isBusy('backend-runtime:start'))
                        ? t('diag.moduleRestarting')
                        : t('diag.moduleRestart'))
                    : null,
                ),
                (def.installed && def.model)
                  ? h('div', { className: 'onm-row-sub', style: { marginTop: '6px' } }, tf(t, 'diag.moduleModelHint', { path: def.model.path }))
                  : null,
              )
            }),
          h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.moduleRestartHint')),
        ),
        h('section', { key: 'baseline', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.baseline')),
              h('p', { className: 'onm-card-desc' }, t('diag.baselineDesc')),
            ),
            h(Badge, { tone: canBaseline ? 'ok' : '' }, canBaseline ? t('diag.available') : t('diag.notDetected')),
          ),
          canBaseline
            ? h('dl', { className: 'onm-kv' },
                h('dt', null, t('diag.baselineHead')),
                h('dd', { className: 'onm-mono' }, baseline.head
                  ? ((baseline.head.short || '') + ' · ' + (baseline.head.branch || '') + ' · ' + (baseline.head.subject || ''))
                  : '—'),
                h('dt', null, t('diag.baselineDirtyLabel')),
                h('dd', null, tf(t, 'diag.baselineDirty', { n: baseline.dirty_count || 0 })),
                h('dt', null, t('diag.baselineDir')),
                h('dd', { className: 'onm-mono' }, baseline.baselineDir || '—'),
              )
            : h('div', { className: 'onm-notice fail' }, baseline.message || t('diag.baselineUnavailable')),
          canBaseline
            ? h('div', { className: 'onm-hstack', style: { marginTop: '12px' } },
                h('button', {
                  type: 'button', className: 'onm-btn small', onClick: c.createBaseline,
                  disabled: c.isBusy('baseline:create'),
                }, c.isBusy('baseline:create') ? t('diag.baselineCreating') : t('diag.baselineCreate')),
              )
            : null,
          baselines.length
            ? h('div', { className: 'onm-stack', style: { marginTop: '10px' } },
                baselines.map((item) => h('div', { key: item.name, className: 'onm-row' },
                  h('div', { className: 'onm-row-main' },
                    h('div', { className: 'onm-row-title' }, item.name),
                    h('div', { className: 'onm-row-sub' },
                      (item.commit || '—') + ' · ' + fmtTime(item.created_at) + ' · ' + fmtBytes(item.bundle_size)
                        + (item.untracked_count ? ' · ' + tf(t, 'diag.baselineUntracked', { n: item.untracked_count }) : ''),
                    ),
                  ),
                  h('div', { className: 'onm-row-actions' },
                    h('button', {
                      type: 'button', className: 'onm-btn small',
                      onClick: () => {
                        if (typeof window === 'undefined' || window.confirm(t('diag.baselineConfirmRestore'))) c.restoreBaseline(item.name)
                      },
                      disabled: c.isBusy('baseline:restore:' + item.name),
                    }, c.isBusy('baseline:restore:' + item.name) ? t('diag.baselineRestoring') : t('diag.baselineRestore')),
                  ),
                )),
              )
            : h('div', { className: 'onm-empty' }, t('diag.baselineEmpty')),
          h('div', { className: 'onm-row-sub', style: { marginTop: '8px' } }, t('diag.baselineNote')),
        ),
        h('section', { key: 'paths', className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('h2', { className: 'onm-card-title' }, t('diag.pathsTitle')),
              h('p', { className: 'onm-card-desc' }, autostart.enabled ? t('diag.autostartOn') : t('diag.autostartOff')),
            ),
          ),
          h('dl', { className: 'onm-kv' },
            h('dt', null, t('diag.consoleUrl')),
            h('dd', { className: 'onm-mono' }, backend.url || '—'),
            h('dt', null, t('diag.configPath')),
            h('dd', { className: 'onm-mono' }, backend.configPath || '—'),
            h('dt', null, t('diag.evidence')),
            h('dd', { className: 'onm-mono' }, 'data/evidence.db'),
            h('dt', null, t('diag.screenshots')),
            h('dd', { className: 'onm-mono' }, 'data/device_capture/'),
            h('dt', null, t('diag.exportDir')),
            h('dd', { className: 'onm-mono' }, 'data/diagnose/'),
          ),
        ),

      ]
      const byKey = Object.fromEntries(sections.filter(Boolean).map(section => [section.key, section]))
      if (productMode) {
        return [
          h('div', { key: 'title' }, h('h2', { className: 'onm-page-title' }, t('diag.title')),
            h('p', { className: 'onm-page-desc' }, t('diag.simpleHint'))),
          h('div', { key: 'connection', className: 'onm-diagnostic-status', role: 'status' },
            h(Badge, { tone: health.ok ? 'ok' : 'bad' }, health.ok ? t('common.online') : t('diag.healthOffline')),
            h('span', null, kind === 'source' ? t('diag.sourceInstance') : kind === 'portable' ? t('diag.portableInstance') : t('diag.unknownInstance'))),
          byKey.offline, byKey['maintenance-result'],
          maintenanceBusy ? h('p', { key: 'maintenance-progress', className: 'onm-notice', role: 'status' }, t('diag.maintenanceBusy')) : null,
          portableError ? h('div', { key: 'install-error', className: 'onm-notice fail', role: 'status' }, portableError) : null,
          byKey['backend-runtime'],
        ]
      }
      const groups = { summary: 'diag.summary', oas: 'diag.maintainOas', environment: 'diag.environment', advanced: 'diag.advanced' }
      const items = {
        oas: [['source-update', 'diag.maintainOas'], ['baseline', 'diag.baseline'], ['oas-runtime', 'diag.mirrorTitle']],
        environment: [['backend-runtime', 'diag.backendRuntime'], ['modules', 'diag.modules']],
        advanced: [['actions', 'diag.actions'], ['paths', 'diag.pathsTitle']],
      }
      // Mount a maintenance panel only after an explicit choice. This also avoids
      // host details styles exposing every closed card at once.
      const disclosure = ([key, title]) => h('section', { key, className: 'onm-diagnostic-section' },
        h('button', { type: 'button', className: 'onm-disclosure',
          'aria-expanded': expanded === key, 'aria-controls': 'onm-diagnostic-' + key,
          onClick: () => setExpanded(expanded === key ? '' : key) },
          h('span', null, t(title)), h('span', { 'aria-hidden': true }, expanded === key ? '−' : '+')),
        expanded === key ? h('div', { id: 'onm-diagnostic-' + key },
          key === 'oas-runtime' ? h('p', { className: 'onm-row-sub' }, t('diag.mirrorHint')) : null,
          byKey[key]) : null)
      return [
        h('div', { key: 'title' }, h('h2', { className: 'onm-page-title' }, t('diag.title')),
          h('p', { className: 'onm-page-desc' }, t('diag.simpleHint'))),
        h('div', { key: 'connection', className: 'onm-diagnostic-status', role: 'status' },
          h(Badge, { tone: health.ok ? 'ok' : 'bad' }, health.ok ? t('common.online') : t('diag.healthOffline')),
          h('span', null, kind === 'source' ? t('diag.sourceInstance') : kind === 'portable' ? t('diag.portableInstance') : t('diag.unknownInstance')),
          h('span', null, t('diag.scheduler') + ' · ' + (scheduler.running ? t('diag.running') : t('diag.stopped'))),
          h('span', null, t('diag.devicesReady') + ' · ' + (scheduler.device_ready ?? '—') + ' / ' + (scheduler.device_total ?? '—'))),
        byKey.offline, byKey['maintenance-result'],
        maintenanceBusy ? h('p', { key: 'maintenance-progress', className: 'onm-notice', role: 'status' }, t('diag.maintenanceBusy')) : null,
        portableError ? h('div', { key: 'install-error', className: 'onm-notice fail', role: 'status' }, portableError) : null,
        h('nav', { key: 'navigation', className: 'onm-diagnostic-nav', 'aria-label': t('diag.title') },
          Object.entries(groups).map(([key, title]) => h('button', { key, type: 'button',
            className: 'onm-btn small' + (group === key ? ' primary' : ''), 'aria-pressed': group === key,
            onClick: () => { setGroup(key); setExpanded('') } }, t(title)))),
        group === 'summary' ? h('section', { key: 'help', className: 'onm-card' },
          h('h3', { className: 'onm-card-title' }, t('diag.summary')),
          h('p', { className: 'onm-card-desc' }, t('diag.troubleshootHint')),
          h('div', { className: 'onm-hstack', style: { marginTop: '12px' } },
            h('button', { type: 'button', className: 'onm-btn small', onClick: c.refresh, disabled: c.isBusy('refresh') }, t('actions.refresh')),
            h('button', { type: 'button', className: 'onm-btn small', onClick: c.exportDiagnose,
              disabled: c.offline || c.isBusy('export') }, c.isBusy('export') ? t('actions.exporting') : t('actions.export'))),
          c.exportResult ? h('p', { className: 'onm-row-sub', role: 'status' }, c.exportResult.message || t('diag.exported'), ' · ', c.exportResult.path) : null,
          Number(oas.dirty_count || runtime.dirty_count) > 0 ? h('p', { className: 'onm-row-sub', style: { marginTop: '14px' } }, t('diag.localChangesHint')) : null) : null,
        group === 'environment' && kind === 'source' ? h('p', { key: 'source-hint', className: 'onm-notice' }, t('diag.sourceModeHint')) : null,
        group === 'advanced' ? h('p', { key: 'advanced-hint', className: 'onm-notice' }, t('diag.advancedHint')) : null,
        ...(items[group] || []).map(disclosure),
      ]
    }

    function Rail(props) {
      const [expanded, setExpanded] = useState(false)
      const t = props.t
      const c = props.c
      const device = currentDevice(c.data)
      const valid = !!(device && c.shot.serial === device.serial && c.shot.data)
      const recent = (c.data.recent || [])
        .slice()
        .sort((left, right) => Number(right.ts || right.started_at || 0) - Number(left.ts || left.started_at || 0))
        .slice(0, 7)
      return h('section', { className: 'onm-observe' },
        h('button', { type: 'button', className: 'onm-disclosure', 'aria-expanded': expanded,
          'aria-controls': 'onm-observation-content', onClick: () => setExpanded(!expanded) },
          t('observe.title'), h('span', { 'aria-hidden': true }, expanded ? '−' : '+')),
        expanded ? h('div', { className: 'onm-rail', id: 'onm-observation-content' },
        h('section', { className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('span', { className: 'onm-eyebrow' }, t('rail.live')),
              h('h2', { className: 'onm-card-title' }, t('rail.screen')),
            ),
            h('span', { className: 'onm-chip ' + (device && device.online ? 'ok' : 'warn') }, h(Dot, null), device ? (device.online ? t('common.online') : t('common.offline')) : t('common.notSelected')),
          ),
          h('div', { className: 'onm-shot' },
            valid
              ? h('img', { src: c.shot.data, alt: t('rail.screen') })
              : h('div', { className: 'onm-shot-empty' },
                  c.shot.error && c.shot.serial === (device && device.serial)
                    ? c.shot.error
                    : device ? t('rail.noShot') : t('rail.needDevice')),
          ),
          h('div', { className: 'onm-hstack', style: { marginTop: '10px', justifyContent: 'space-between' } },
            h('span', { className: 'onm-row-sub onm-mono' },
              valid && c.shot.at ? tf(t, 'rail.captured', { time: fmtTime(c.shot.at, true) }) : '—'),
            h('button', {
              type: 'button', className: 'onm-btn small',
              onClick: () => c.refreshScreenshot(device ? device.serial : ''),
              disabled: !device,
            }, t('rail.refresh')),
          ),
        ),
        h('section', { className: 'onm-card' },
          h('div', { className: 'onm-card-head' },
            h('div', null,
              h('span', { className: 'onm-eyebrow' }, t('rail.live')),
              h('h2', { className: 'onm-card-title' }, t('rail.recent')),
            ),
          ),
          recent.length
            ? h('div', { className: 'onm-recent' },
                recent.map((record, index) => h('div', { key: String(record.ts || index), className: 'onm-recent-item' },
                  h('div', { className: 'onm-recent-time' }, fmtTime(record.ts || record.started_at)),
                  h('div', { className: 'onm-recent-title' }, record.task_id ? taskName(c.data, record.task_id, t) : (record.intent || t('rail.recent'))),
                  h('p', { className: 'onm-recent-body' }, String(record.message || record.result || '').slice(0, 140) || '—'),
                )),
              )
            : h('div', { className: 'onm-empty' }, t('rail.noRecent')),
        ),
      ) : null)
    }

    function TaskDetail(props) {
      const t = props.t
      const c = props.c
      const task = props.task
      const closeRef = useRef(null)
      const [device, setDevice] = useState(props.draft?.device ?? task.device?.assigned ?? '')
      const [count, setCount] = useState(props.draft?.count !== undefined ? String(props.draft.count) : task.count?.supported ? String(task.count.value ?? task.count.default) : '')
      const [options, setOptions] = useState(() => {
        if (props.draft?.options) return props.draft.options
        const initial = {}
        for (const [key, meta] of Object.entries(task.options || {})) {
          initial[key] = meta.value === undefined ? meta.default : meta.value
        }
        return initial
      })
      const [saving, setSaving] = useState(false)
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        const previous = document.activeElement
        const background = document.querySelector('.onm-page')
        const wasInert = background?.inert
        if (background) background.inert = true
        closeRef.current?.focus()
        const onKey = (event) => {
          if (event.key === 'Escape') { event.preventDefault(); props.onClose() }
          if (event.key === 'Tab') {
            const dialog = closeRef.current?.closest('[role="dialog"]')
            const items = [...(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]') || [])]
              .filter((item) => item.getClientRects().length)
            const first = items[0], last = items[items.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }
        }
        window.addEventListener('keydown', onKey)
        return () => {
          alive.current = false
          window.removeEventListener('keydown', onKey)
          if (background) background.inert = wasInert
          if (previous?.isConnected) previous.focus()
          else document.querySelector('.onm-tab[aria-current="page"]')?.focus()
        }
      }, [props.onClose])

      const target = device || c.data.device || ''
      const selected = (c.data.devices || []).find((item) => item.serial === target) || null
      const running = target ? c.data.running[target] : null
      const state = taskState(t, task)

      const validCount = !task.count?.supported || (Number.isInteger(Number(count))
        && Number(count) >= 1 && Number(count) <= Number(task.count.max))
      const reason = taskRunReason(c, task, t, target) || (!validCount ? tf(t, 'task.invalidCount', { max: task.count.max }) : '')
      const canRun = !reason && !saving && !c.isBusy('save:' + task.id)

      const deviceOptions = [h('option', { key: 'follow', value: '' }, t('common.followDevice'))].concat(
        (c.data.devices || []).map((item) => h('option', {
          key: item.serial, value: item.serial,
        }, (item.name || item.serial) + (item.online ? '' : ' · ' + t('common.offline')))),
      )

      const runNow = () => {
        if (!canRun || !target) return
        const payload = { count: count === '' ? undefined : Number(count), options }
        props.onClose()
        c.runTask(task.id, target, payload.count, payload.options)
      }

      const saveNow = async () => {
        if (!validCount) { c.notify(tf(t, 'task.invalidCount', { max: task.count.max }), 'fail'); return }
        setSaving(true)
        const ok = await c.saveTaskDefaults(task.id, device, count === '' ? undefined : Number(count), options)
        if (alive.current) setSaving(false)
        if (ok) { props.onSaved(); props.onClose() }
      }

      const toggleNow = () => c.toggleTask(task.id, task.enabled === false)

      return h('div', {
        className: 'onm-overlay',
        onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose() },
      },
        h('div', {
          className: 'onm-modal', role: 'dialog', 'aria-modal': 'true',
          'aria-label': task.name || task.id,
          onMouseDown: (event) => event.stopPropagation(),
        },
          h('div', { className: 'onm-modal-head' },
            h('div', null,
              h('span', { className: 'onm-eyebrow' }, t('modal.eyebrow') + ' / ' + cycleLabel(t, task.cycle)),
              h('h2', { className: 'onm-modal-title' }, task.name || task.id),
            ),
            h('button', {
              type: 'button', className: 'onm-icon-btn', ref: closeRef,
              onClick: props.onClose, 'aria-label': t('actions.close'),
            }, '×'),
          ),
          h('p', { className: 'onm-page-desc', style: { marginTop: '6px' } }, task.note || t('common.empty')),
          h('div', { className: 'onm-hstack', style: { marginTop: '10px' } },
            h(Badge, { tone: state.tone }, state.label),
            h(Badge, { tone: 'info' }, kindLabel(t, task.task_kind)),
            task.energy_cost ? h(Badge, { tone: 'warn' }, t('task.energy') + ' ' + task.energy_cost) : null,
          ),
          h('div', { className: 'onm-form', style: { marginTop: '16px', flexDirection: 'column', alignItems: 'stretch' } },
            h(Field, { label: t('task.device') },
              h('select', { className: 'onm-select', value: device, onChange: (event) => { setDevice(event.target.value); props.onDraft({ device: event.target.value }) } }, deviceOptions),
            ),
            task.count && task.count.supported
              ? h(Field, { label: t('task.count') + ' · 1–' + task.count.max },
                  h('input', {
                    className: 'onm-input', type: 'number', min: 1, max: task.count.max,
                    value: count, onChange: (event) => { setCount(event.target.value); props.onDraft({ count: event.target.value }) },
                  }),
                )
              : null,
            Object.entries(task.options || {}).map(([key, meta]) => h(Field, { key, label: meta.label || key },
              h('select', {
                className: 'onm-select', value: options[key] === undefined ? '' : options[key],
                onChange: (event) => { const next = { ...options, [key]: event.target.value }; setOptions(next); props.onDraft({ options: next }) },
              }, (meta.choices || []).map(([value, label]) => h('option', { key: value, value }, label))),
            )),
          ),
          reason ? h('div', { className: 'onm-notice fail', style: { marginTop: '14px' } }, reason) : null,
          h('details', { className: 'onm-details', style: { marginTop: '14px' } },
            h('summary', null, t('task.advanced')),
            h('dl', { className: 'onm-kv', style: { marginTop: '8px' } },
              h('dt', null, t('task.taskId')),
              h('dd', { className: 'onm-mono' }, task.id),
              h('dt', null, t('task.source')),
              h('dd', { className: 'onm-mono' }, task.source || '—'),
              h('dt', null, t('task.entry')),
              h('dd', null, task.entry_state || '—'),
            ),
          ),
          h('div', { className: 'onm-modal-actions' },
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: toggleNow,
              disabled: c.isBusy('toggle:' + task.id),
            }, task.enabled === false ? t('actions.enable') : t('actions.disable')),
            h('button', {
              type: 'button', className: 'onm-btn small', onClick: saveNow,
              disabled: !validCount || saving || task.entry_state !== 'ready' || c.isBusy('save:' + task.id),
            }, saving || c.isBusy('save:' + task.id) ? t('actions.saving') : t('actions.save')),
            h('button', {
              type: 'button', className: 'onm-btn primary', onClick: runNow, disabled: !canRun,
            }, t('actions.run')),
          ),
        ),
      )
    }

    const CSS = `
.onm-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.onm-root *{box-sizing:border-box}
.onm-task-list{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.onm-task-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-top:1px solid var(--dsw-alias-border-l1)}
.onm-task-row:first-child{border-top:0}.onm-task-row.off .onm-row-main{opacity:.65}
.onm-executions{margin:0 0 18px}.onm-execution+.onm-execution{border-top:1px solid var(--dsw-alias-border-l1)}
.onm-result-history{margin-top:8px}.onm-result-history>summary,.onm-observe>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);padding:6px 0}
.onm-observe{width:100%;border-top:1px solid var(--dsw-alias-border-l1);margin-top:18px;padding-top:8px}.onm-observe .onm-rail{position:static;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));margin-top:10px}
.onm-main{width:100%}@media(max-width:600px){.onm-task-row{align-items:flex-start;flex-direction:column;gap:8px}.onm-task-row .onm-row-actions{width:100%;justify-content:flex-start}.onm-page{padding:18px 16px 32px}}
.onm-page{width:100%;max-width:1240px;margin:0 auto;padding:26px 30px 56px}
.onm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:18px}
.onm-brand{display:flex;gap:14px;align-items:center;min-width:0}
.onm-brand-mark{width:44px;height:44px;border-radius:12px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:600;font-family:ui-serif,Georgia,serif;flex:none}
.onm-title{font-size:22px;line-height:1.2;margin:2px 0 2px;font-weight:650;letter-spacing:-0.01em}
.onm-subtitle{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.onm-eyebrow{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:600}
.onm-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.onm-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.onm-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
.onm-chip.ok .onm-dot{background:var(--dsw-alias-state-success-primary)}
.onm-chip.bad .onm-dot{background:var(--dsw-alias-state-error-primary)}
.onm-chip.warn .onm-dot{background:var(--dsw-alias-state-warn-primary)}
.onm-select,.onm-input{font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 10px;outline:none;min-width:0}
.onm-select:focus-visible,.onm-input:focus-visible,.onm-btn:focus-visible,.onm-tab:focus-visible,.onm-icon-btn:focus-visible,.onm-task:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.onm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:12.5px;font-weight:500;padding:7px 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .15s ease,border-color .15s ease,opacity .15s ease}
.onm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.onm-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.onm-btn.primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.9}
.onm-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.onm-btn.ghost{background:transparent}
.onm-btn.small{font-size:11.5px;padding:5px 10px}
.onm-btn:disabled{opacity:.45;cursor:not-allowed}
.onm-tabs{display:flex;gap:2px;min-height:43px;overflow-y:hidden;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:20px;overflow-x:auto}
.onm-tab{appearance:none;background:none;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:9px 14px;margin-bottom:-1px;cursor:pointer;white-space:nowrap}
.onm-tab:hover{color:var(--dsw-alias-label-primary)}
.onm-tab.active{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}
.onm-layout{display:flex;flex-direction:column;gap:20px;align-items:start}
.onm-main{width:100%;display:flex;flex-direction:column;gap:16px;min-width:0}
.onm-rail{display:flex;flex-direction:column;gap:14px;min-width:0;position:sticky;top:0}
@media (max-width:1060px){.onm-layout{grid-template-columns:minmax(0,1fr)}.onm-rail{position:static}}
.onm-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px 18px;min-width:0}
.onm-schedule{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.onm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.onm-card-title{font-size:14px;font-weight:600;margin:0}
.onm-card-desc{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.onm-hero{position:relative;overflow:hidden;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;padding:22px 24px}
.onm-hero::after{content:'';position:absolute;inset:-40% -20% auto auto;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,var(--dsw-alias-bg-layer-2),transparent 68%);pointer-events:none}
.onm-hero h2{position:relative;font-size:20px;margin:6px 0 8px;font-weight:650}
.onm-hero p{position:relative;margin:0;max-width:640px;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.onm-hero-actions{position:relative;display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.onm-hint{position:relative;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.onm-hint code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;padding:2px 7px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.onm-grid{display:grid;gap:12px}
.onm-grid.metrics{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
.onm-grid.two{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.onm-grid.tasks{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.onm-metric span{display:block;color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:.04em}
.onm-metric strong{display:block;font-size:19px;line-height:1.3;margin-top:4px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.onm-metric em{display:block;font-style:normal;color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.onm-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.onm-row:first-child{border-top:0;padding-top:2px}
.onm-row-main{min-width:0}
.onm-row-title{font-weight:550;font-size:12.5px}
.onm-row-sub{color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:1px;overflow-wrap:anywhere}
.onm-row-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:none}
.onm-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);font-size:10.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);white-space:nowrap}
.onm-badge.ok{color:var(--dsw-alias-state-success-primary)}
.onm-badge.warn{color:var(--dsw-alias-state-warn-primary)}
.onm-badge.bad{color:var(--dsw-alias-state-error-primary)}
.onm-badge.info{color:var(--dsw-alias-brand-primary)}
.onm-task{display:flex;flex-direction:column;gap:8px;text-align:left;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 15px;color:inherit;font:inherit;cursor:pointer}
.onm-task:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.onm-task.off{opacity:.62}
.onm-task-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.onm-task-title{font-size:13.5px;font-weight:600;margin:2px 0 0}
.onm-task-note{color:var(--dsw-alias-label-secondary);font-size:11.5px;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4em}
.onm-task-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11px}
.onm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.onm-notice{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:11px 13px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.onm-notice.fail{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.onm-notice.ok{border-color:var(--dsw-alias-state-success-primary)}
.onm-shot{aspect-ratio:16/10;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;overflow:hidden}
.onm-shot img{width:100%;height:100%;object-fit:contain;display:block}
.onm-shot-empty{color:var(--dsw-alias-label-secondary);font-size:11.5px;text-align:center;padding:18px;line-height:1.6}
.onm-recent{display:flex;flex-direction:column;gap:0}
.onm-recent-item{padding:9px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.onm-recent-item:first-child{border-top:0;padding-top:2px}
.onm-recent-time{color:var(--dsw-alias-label-secondary);font-size:10px}
.onm-recent-title{font-size:12px;font-weight:550;margin-top:1px}
.onm-recent-body{color:var(--dsw-alias-label-secondary);font-size:11px;margin:2px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.onm-diagnostic-status{display:flex;gap:12px;flex-wrap:wrap;align-items:center;color:var(--dsw-alias-label-secondary);font-size:12px}
.onm-diagnostic-nav{display:flex;gap:8px;flex-wrap:wrap}
.onm-diagnostic-section{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}
.onm-disclosure{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:16px 18px;border:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.onm-disclosure:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-3px}
.onm-diagnostic-section>div{padding:0 16px 16px}.onm-diagnostic-section .onm-card{border:0;padding:12px 0 0}
.onm-form{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.onm-maintenance>summary{cursor:pointer;font-weight:600;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px}.onm-maintenance[open]>summary{margin-bottom:10px}.onm-executions .onm-result-history{max-height:260px;overflow:auto}.onm-modal .onm-field{flex:none}
.onm-field{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1 1 160px}
.onm-field.grow{flex:1 1 240px}
.onm-field > span{font-size:10.5px;color:var(--dsw-alias-label-secondary);letter-spacing:.03em}
.onm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.onm-toolbar .onm-input{flex:1 1 240px}
.onm-segmented{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}
.onm-seg{appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:5px 10px;border-radius:7px;cursor:pointer}
.onm-seg:hover{color:var(--dsw-alias-label-primary)}
.onm-seg.active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.onm-count{color:var(--dsw-alias-label-secondary);font-size:11px}
.onm-center{display:flex;justify-content:center;margin-top:4px}
.onm-page-title{font-size:20px;font-weight:650;margin:4px 0 4px;letter-spacing:-0.01em}
.onm-page-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;max-width:760px}
.onm-kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 16px;font-size:11.5px;margin:0}
.onm-kv dt{color:var(--dsw-alias-label-secondary)}
.onm-kv dd{margin:0;overflow-wrap:anywhere}
.onm-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:16px;text-align:center}
.onm-details{padding:14px 18px}
.onm-module{padding:14px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.onm-module:first-of-type{border-top:none;padding-top:4px}
.onm-module-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.onm-module h3{margin:0 0 4px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.onm-code{margin:8px 0 0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto}
.onm-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.onm-details[open] summary{color:var(--dsw-alias-label-primary)}
.onm-hstack{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.onm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.onm-overlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.46);display:flex;align-items:center;justify-content:center;padding:24px}
.onm-modal{width:min(580px,100%);max-height:min(86vh,760px);overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:20px 22px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.onm-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.onm-modal-title{font-size:17px;font-weight:650;margin:2px 0 0}
.onm-icon-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);width:28px;height:28px;border-radius:8px;font-size:16px;line-height:1;cursor:pointer;flex:none}
.onm-icon-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.onm-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}
.onm-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:90;max-width:min(520px,90vw);padding:10px 16px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:12px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.onm-toast.fail{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
`

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error) {
        if (typeof console !== 'undefined' && console.error) console.error('onmyoji-console slot failed', error)
      }
      render() {
        if (this.state.failed) {
          return h('div', { className: 'onm-root' },
            h('div', { className: 'onm-page' },
              h('div', { className: 'onm-notice fail' }, '平安京管家页面渲染失败，请刷新后重试。'),
            ),
          )
        }
        return this.props.children
      }
    }

    function ConsolePage(props) {
      const provided = props && typeof props.t === 'function' ? props.t : null
      const t = useCallback((key) => {
        if (provided) {
          const value = provided(key)
          if (value !== key) return value
        }
        return ZH[key] || key
      }, [provided])
      const c = useConsole(t)
      const [tab, setTab] = useState('overview')
      const [detailId, setDetailId] = useState(null)
      const [taskDrafts, setTaskDrafts] = useState({})
      const [drafts, setDrafts] = useState({ tasks: { search: '', filter: 'all', visible: 24 }, plans: { text: '', device: '' }, devices: { serial: '', name: '' } })
      const updateDraft = (page, patch) => setDrafts((prev) => {
        const { __expected, ...values } = patch
        const revision = prev[page]._revision || 0
        if (__expected !== undefined && __expected !== revision) return prev
        return { ...prev, [page]: { ...prev[page], ...values, _revision: revision + 1 } }
      })
      const task = detailId ? taskById(c.data, detailId) : null
      const closeDetail = useCallback(() => setDetailId(null), [])
      const openTask = useCallback((id, request, device) => {
        if (request) setTaskDrafts((prev) => ({ ...prev, [id]: { ...request, device } }))
        if (id) setDetailId(id)
      }, [])

      return h(ErrorBoundary, null,
        h('div', { className: 'onm-root' },
          h('style', null, CSS),
          h('div', { className: 'onm-page' },
            h(Header, { t, c }),
            h(TabBar, { t, tab, setTab }),
            Object.keys(c.data.resourceErrors).length ? h('div', { className: 'onm-notice fail', role: 'status' },
              t('data.partial'), ' · ', Object.keys(c.data.resourceErrors).map(key => t('data.' + (['health','catalog','running','devices','schedules','executions'].includes(key) ? key : 'maintenance'))).join(', '),
              h('button', { type: 'button', className: 'onm-btn small', onClick: c.refresh }, t('actions.retry'))) : null,
            tab !== 'diagnostics' || executionRows(c).length ? h(ExecutionPanel, { t, c, onOpenTask: openTask }) : null,
            h('div', { className: 'onm-layout' },
              h('main', { className: 'onm-main' },
                c.loading && !c.data.catalog.length && c.offline
                  ? h('div', { className: 'onm-card onm-empty' }, t('common.loading'))
                  : null,
                tab === 'overview' ? h(Overview, { t, c, onTab: setTab, onOpenTask: openTask })
                  : tab === 'tasks' ? h(Tasks, { t, c, onOpenTask: openTask, draft: drafts.tasks, onDraft: (patch) => updateDraft('tasks', patch) })
                    : tab === 'plans' ? h(Plans, { t, c, draft: drafts.plans, onDraft: (patch) => updateDraft('plans', patch) })
                      : tab === 'devices' ? h(Devices, { t, c, draft: drafts.devices, onDraft: (patch) => updateDraft('devices', patch) })
                        : h(Diagnostics, { t, c }),
              ),
              h(Rail, { t, c }),
            ),
          ),
          task ? h(TaskDetail, { key: task.id, t, c, task, onClose: closeDetail, draft: taskDrafts[task.id],
            onDraft: (patch) => setTaskDrafts((prev) => ({ ...prev, [task.id]: { ...prev[task.id], ...patch } })),
            onSaved: () => setTaskDrafts((prev) => { const next = { ...prev }; delete next[task.id]; return next }) }) : null,
          c.toast ? h('div', {
            className: 'onm-toast' + (c.toast.tone === 'fail' ? ' fail' : ''),
            role: 'status', 'aria-live': 'polite',
          }, c.toast.message) : null,
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICTS.zh))
        ctx.effect(() => ctx.locale.register(NS, 'zh-CN', DICTS.zh))
        ctx.effect(() => ctx.locale.register(NS, 'en', DICTS.en))
        ctx.effect(() => ctx.locale.register(NS, 'en-US', DICTS.en))
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'onmyoji',
          order: 20,
          label: () => {
            const value = t('panel.label')
            return value === 'panel.label' ? (ZH['panel.label'] || '阴阳师 OAS') : value
          },
        }, PanelIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'onmyoji',
          locale: NS,
        }, ConsolePage))
      },
    }
  },
})
