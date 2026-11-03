# 阴阳师 OAS · DSH 左侧入口插件

把 OnmyojiAutoScript 的本地控制台接进 DeepSeek Harness：左侧栏新增「阴阳师 OAS」鸟居入口，
主区域提供 **总览 / 任务库 / 计划 / 设备 / 诊断**，并可在总览里检查、预览、应用、回滚 OAS 上游更新。

插件本身是纯前端 + Host 路由的 DSH bundle，**不包含 Python/FastAPI/OAS 源码**，
也不硬编码任何本机目录；控制台地址可配置，因此可以从 GitHub 安装到任意机器。

## 环境要求

- DeepSeek Harness（Web profile）。
- 一个正在运行的 OAS 控制台后端，默认 `http://127.0.0.1:8787`。控制台是独立项目，
  通常在自己的仓库里用 `./start.sh` 启动；插件不负责安装它。
- 可选：控制台仓库目录（仅用于在插件里一键启动/停止服务）。没有该目录时，
  插件仍可连接已运行的控制台，只是隐藏启动/停止按钮。

## 从 GitHub 安装

先把本目录作为独立仓库推到 GitHub（见下方「发布到 GitHub」），然后：

```text
plugin_manager install_bundle target="github:githubdadada/dsh-onmyoji-oas#main"
```

或使用完整 URL：

```text
plugin_manager install_bundle target="https://github.com/githubdadada/dsh-onmyoji-oas.git"
```

安装后刷新 DSH 页面，左侧栏出现「阴阳师 OAS」入口。

> 仓库根目录必须就是本包根目录（`package.json` 在仓库根），不要上传整个父项目。

## 更新插件（加载上游更新）

DSH 的 `plugin_manager` 没有单独的 update 动作；更新 = 移除旧包 + 安装新版本：

```text
plugin_manager remove_bundle target="@local/dsh-onmyoji-console"
plugin_manager install_bundle target="github:githubdadada/dsh-onmyoji-oas#main"
```

建议用 tag 固定版本，升级时换 tag：

```text
plugin_manager remove_bundle target="@local/dsh-onmyoji-console"
plugin_manager install_bundle target="github:githubdadada/dsh-onmyoji-oas#v1.4.1"
```

若结果返回 `restart-required`（替换已运行的包且未启用 HMR），重启 DSH 后生效。
新装、启用和替换后的页面通常刷新一次即可加载新的 Client bundle。

## 配置控制台

插件按以下优先级读取配置（前者覆盖后者）：

1. `~/.dsh/onmyoji-oas.json`
2. 环境变量 `ONMYOJI_CONSOLE_URL` / `ONMYOJI_ROOT` / `ONMYOJI_OAS_ROOT` / `ONMYOJI_OAS_MIRROR` / `ONMYOJI_OAS_BRANCH` / `ONMYOJI_BASELINE_DIR` / `ONMYOJI_BACKEND_DIR` / `ONMYOJI_CONSOLE_BUNDLE`
3. 插件行的 `config.consoleUrl` / `config.root` / `config.oasRoot` / `config.oasMirrorUrl` / `config.oasBranch` / `config.baselineDir` / `config.backendDir` / `config.consoleBundleUrl`（在 profile patch 里覆盖）

```json
{
  "consoleUrl": "http://127.0.0.1:8787",
  "root": "/absolute/path/to/OAS-console",
  "oasRoot": "/absolute/path/to/OAS-console/OAS",
  "oasMirrorUrl": "https://github.com/githubdadada/OnmyojiAutoScript.git",
  "oasBranch": "dev",
  "baselineDir": "/Users/you/.dsh/onmyoji-oas/baselines",
  "backendDir": "/Users/you/.dsh/onmyoji-oas/backend",
  "consoleBundleUrl": "https://github.com/githubdadada/onmyoji-backend/releases/latest/download/console-backend-{platform}.tar.gz"
}
```

- `consoleUrl`：控制台后端地址；支持 `http` / `https`，也可带路径前缀。
- `root`：控制台仓库目录，必须包含 `start.sh` 与 `web/server.py`；只影响启动/停止。
  不填时插件只连接已运行的控制台，页面不显示启动/停止。
- `oasRoot`：OAS 的 git 仓库；默认取 `<root>/OAS`。下载/更新与基线都基于它。
- `oasMirrorUrl`：你的 GitHub OAS 镜像地址；下载/更新只从这个镜像拉取，不依赖上游是否存活。
  默认 `https://github.com/githubdadada/OnmyojiAutoScript.git`；如果你用别的仓库，
  改 `index.js` 的 `DEFAULT_OAS_MIRROR`，或在配置里覆盖。本机测试可先指向
  `file:///…/data/oas_mirror.git`。
- `oasBranch`：镜像分支，默认 `dev`。
- `baselineDir`：基线存放目录；默认 `~/.dsh/onmyoji-oas/baselines`。
- `backendDir`：便携后端安装目录；默认 `~/.dsh/onmyoji-oas/backend`。
- `consoleBundleUrl`：便携后端包地址；`{platform}` 会替换为 `darwin-arm64` / `win32-x64` 等。
- 修改配置文件后需要重新加载插件（或重启 DSH）才会生效。

## OAS 镜像下载/更新

诊断页的「OAS 运行时」卡片：

- **下载 OAS**：从 `oasMirrorUrl` 克隆到 `oasRoot`（默认 `<root>/OAS`）。
  目标目录非空时不会覆盖；已存在 `.git` 时不会重复下载。
- **检查更新**：`git fetch <mirror> <branch>` 后比较落后/领先提交，不改工作区。
- **更新到最新**：只做 `--ff-only` 合并；有未提交的**跟踪文件**改动时拒绝更新，
  未跟踪文件（例如自定义任务目录）不会阻止更新。
- **重启控制台**：下载/更新后让后端重新导入新 OAS 代码。

这条链路只认你配置的 GitHub 镜像：即使 gitcode 原仓库删除，用户仍可从你的镜像下载和更新。

## 建立你的 GitHub OAS 镜像

先在 GitHub 建一个空仓库（例如 `githubdadada/OnmyojiAutoScript`），然后用本地完整镜像推送：

```bash
cd /Users/psd/Documents/mimo-onmyoji-OAS/data/oas_mirror.git

git remote add github git@github.com:githubdadada/OnmyojiAutoScript.git
git push github 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'
```

镜像包含完整提交历史（当前约 87MB）。之后定期从 gitcode 同步并推回 GitHub：
上游还存活时，这样能保证 GitHub 上始终有一份“删除前最新”的完整历史。项目里已带同步脚本：

```bash
scripts/oas_mirror_sync.sh
```

脚本等价于：

```bash
git -C /Users/psd/Documents/mimo-onmyoji-OAS/data/oas_mirror.git \
  fetch https://gitcode.com/OnmyojiAutoScript/OnmyojiAutoScript.git \
  '+refs/heads/*:refs/heads/*' '+refs/tags/*:refs/tags/*'
git -C /Users/psd/Documents/mimo-onmyoji-OAS/data/oas_mirror.git \
  push github 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'
```

更稳妥的做法是在镜像仓库里加一个定时 GitHub Action，在上游还存活时定期把 gitcode 同步过来；
上游删除后，仓库里仍保留最后一次同步的完整历史。插件基线作为第二层保险。

## 一键后端（推荐给其他人）

插件不依赖 `.app`。它下载一个**便携后端包** `console-backend-<platform>.tar.gz`，
解压到 `backendDir` 并启动；包内是 Python runtime + 控制台 + OAS + adb，
用户不需要装 Python、也不需要 macOS 应用。

- 打开「诊断 → 便携后端」或离线首页，点「一键安装后端」；首次约 700MB。
- 安装完成后自动启动；之后用「启动后端 / 停止后端」。
- OAS 更新用下方「OAS 运行时」；升级后端包重新安装即可。
- 包内布局：`runtime/`、`console/`、`platform-tools/`、`run.sh`、`manifest.json`。
  Windows 包用 `runtime/python.exe`，同样布局。

当前已构建 macOS 包（736MB）：

```bash
dist/console-backend-darwin-arm64.tar.gz
```

把它作为 GitHub Release 资产上传到默认仓库：

```bash
gh release create v1.4.0 dist/console-backend-darwin-arm64.tar.gz \
  --repo githubdadada/onmyoji-backend \
  --title "console backend v1.4.0"
```

默认下载地址是：

```text
https://github.com/githubdadada/onmyoji-backend/releases/latest/download/console-backend-{platform}.tar.gz
```

`{platform}` 会按机器替换为 `darwin-arm64`、`win32-x64` 等；也可以用
`consoleBundleUrl` 覆盖。Windows 包按同一布局构建（Windows Python runtime +
console + OAS + `platform-tools/adb.exe`）。

### 源码模式（自用）

如果你已有控制台源码，不需要下载后端包：

1. 安装 DSH 插件。
2. `~/.dsh/onmyoji-oas.json` 里把 `root` 指向控制台目录。
3. `./start.sh` 启动后端；插件负责页面、启停、OAS 下载/更新。

两种模式可以共存；`root` 的源码后端和便携后端谁在 8787 上跑，插件就连谁。

## OAS 基线（离线保底）

诊断页的「OAS 基线」卡片把当前 OAS 做成一份可离线恢复的快照：

- **创建基线**：`git bundle --all` 保存完整提交历史；同时保存
  `工作树 patch` 与 `未跟踪文件 tar.gz`，并写一份 manifest（commit、分支、时间、大小、SHA256）。
- **存放位置**：`~/.dsh/onmyoji-oas/baselines/`，位于插件包之外，插件升级不会丢。
- **恢复**：把基线克隆到 `OAS-restored-<时间戳>` 新目录，**不覆盖现有 OAS**；
  确认后再替换或把 `oasRoot` 指过去。
- 当前 OAS 约 2872 个提交，一份基线约 87MB；不要把 bundle 放进 npm 包，
  需要异地备份时作为 GitHub Release 资产上传即可。
- 基线是静态快照：上游仓库被删后能恢复代码和历史、继续开发；若要继续接收上游提交，
  请把 OAS 镜像/ fork 到你自己的 GitHub，并把 remote 指过去。

## 上游 OAS 更新

总览页的 OnmyojiAutoScript 卡片提供：

1. **检查更新**：只读 `git fetch` + 对比落后/领先提交，不改工作区。
2. **预览变更**：只读预览将要应用的提交、文件清单、本地脏文件与计划步骤，并生成 `confirm_token`。
3. **确认更新**：调用控制台的更新接口；更新前自动备份、stash 本地改动、ff-only 合并。
4. **回滚上一版**：恢复到更新前备份。

这些操作由控制台后端执行，要求控制台已配置 OAS 仓库；更新完成后建议重启控制台服务，
使新代码完全生效。

## 发布到 GitHub

```bash
cd dsh-plugin/onmyoji-console

git init
git add .
git commit -m "feat: standalone DSH Onmyoji OAS console plugin"
git branch -M main

# 在 GitHub 上新建一个空仓库（不要勾选 README），然后：
git remote add origin git@github.com:githubdadada/dsh-onmyoji-oas.git
git push -u origin main
```

有 `gh` 且已登录时可直接：

```bash
gh repo create dsh-onmyoji-oas --public --source=. --remote=origin --push
```

发版本：

```bash
git tag v1.4.1
git push origin v1.4.1
```

然后即可用 `#v1.1.0` 安装。

> 包名目前是 `@local/dsh-onmyoji-console`。从 GitHub 安装不需要改；
> 如果以后要发 npm，把 `package.json` 的 `name` 改成你自己的 scope，并同步修改
> `client.js` 里的模块 id 与 `cordis.patch.yml` 的 `name`。

## 目录

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半侧：同源代理 `<consoleUrl>/api/*`，管理可选的 `start.sh`。 |
| `client.js` | Client 半侧：`sidebar.panellist` 入口 + `main` 面板；总览/任务/计划/设备/诊断。 |
| `cordis.patch.yml` | 插件行 `onmyoji-console`。 |
| `locale/{zh,en}.json` | 插件管理页显示名称与说明。 |
| `icon.svg` | 鸟居图标。 |

## 本地校验

```bash
npm run check          # node --check index.js client.js
npm pack --dry-run     # 查看会随包发布的文件
```

## 边界

- 不嵌入 iframe；页面通过 Host 同源代理调用控制台 REST API，样式只使用 `--dsw-alias-*` 主题变量。
- 代理只暴露控制台的 `/api/*`；默认指向 `127.0.0.1`，不要把它指向不可信主机。
- 插件不修改 OAS 源码；上游更新由控制台后端执行并自带备份。
