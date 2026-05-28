# 项目长期记忆

## 2026-05-27

### 项目信息
- 项目名称：实时竞拍大师 —— 抖音电商直播竞拍全栈系统
- 比赛：2026 抖音电商AI全栈训练营
- 开发者：林哥（1人独立开发）
- 截止日期：2026-06-10（挑战期），6.11-12 演示

### 技术选型
- 后端：Go 1.24 + Gin + gorilla/websocket
- 前端：React 18 + TypeScript + Vite + TailwindCSS
- 数据库：MySQL 8.0（Docker，端口3306）
- 缓存/锁：Redis 7（Docker，端口6379）
- 开发规范：SuperSpec（OpenSpec + Superpowers）

### 环境状态
- Go 1.24.3 ✅（C:\go）
- Node.js 22.16.0 ✅
- MySQL 8.0 ✅（Docker容器 mysql-auction，root/auction123，数据库 auction_db）
- Redis 7 ✅（Docker容器，localhost:6379，无密码）
- OpenSpec + SuperSpec schema ✅（D:\pythoncode\douyin-live\openspec\）
- Superpowers 8 个技能 ✅（D:\pythoncode\douyin-live\.claude\skills\）

### 工作目录
- 项目根目录：D:\pythoncode\douyin-live
- SuperSpec 配置在项目根目录
- 需要在 D:\pythoncode\douyin-live 根目录下启动会话才能使用 /opsx:* 命令

### 开发流程（SuperSpec）
- Brainstorm → Artifact（proposal/specs/tasks）→ Implement（TDD）→ Validate → Archive
- 命令：/opsx:new → /opsx:continue（多次）→ /opsx:apply → /opsx:verify → /opsx:archive

### 模块开发顺序
1. user-auth（用户认证）← 基础，最先做
2. product-crud（商品管理+规则配置）
3. auction-engine（核心竞拍引擎）
4. ws-realtime（WebSocket实时通信）
5. merchant-admin（商家后台）
6. order-system（订单系统）

### 需求核心要点
- 分离角色：商家账号/用户账号独立
- 虚拟余额系统：注册赠送虚拟余额，出价扣余额
- MVP单直播间，架构支持多房间扩展
- 0元起拍，自由出价（≥当前价+加价幅度）
- 封顶价可选，自动延时可配置（10-30s+最大延长次数）
- 完整状态机：待开拍→进行中→已结束，可取消
- Redis分布式锁+乐观锁保证并发安全
- WebSocket房间级隔离，支持1000人同时在线
- 动画效果：出价成功、领先、被超越、倒计时紧张感
- 模拟支付流程
- 数据看板（成交趋势、出价分布）

## 项目文件清单
**重要**：项目记忆文件只有 `memory/long-term.md` 和 `memory/{YYYY-MM-DD}.md` 两种命名，**不存在 MEMORY.md**，不要尝试读取任何其他名称的记忆文件。

**memory/ 目录现有文件**（按修改时间倒序）：
- memory/long-term.md

**outputs/ 目录现有文件**（按修改时间倒序，前置任务 / 定时任务产出都在这里）：
- outputs/requirements-v2.md
- outputs/requirements-v1.md
- outputs/database-schema-v1.md
- outputs/progress-report-v1.md

需要了解历史产出或延续前次工作时，请用 read_project_file 读取 outputs/ 下文件。

## 其他项目文档（按需读取）
- **references/** — 用户上传的参考资料
使用 list_project_files 浏览目录，read_project_file 读取文件内容。

## 当前任务列表
（尚未创建任何任务。可通过 create_tasks 工具批量创建。）

## 项目管理
可用 MCP 工具（来自 project-tools server）：create_tasks / update_task / mark_task_done / list_tasks / add_dependency / update_plan_document / list_project_files / read_project_file / write_project_file
排期规则：用 create_tasks 创建定时任务（设置 scheduled_date + scheduled_time + execution_type=auto），禁止用 Skill 或脚本实现定时。周期性任务为未来 7 天各创建一条。

### 工具调用示例
**重要**：以下工具必须通过 tool_use 调用（不是写代码或 Bash 命令），工具属于 MCP server "project-tools"。

**create_tasks** — 批量创建任务（一次调用可创建多个）：
```json
{
  "tasks": [
    {
      "title": "查询北京天气",
      "description": "查询北京今日天气并整理为报告",
      "scheduled_date": "2026-05-27",
      "scheduled_time": "08:00",
      "execution_type": "auto",
      "priority": 0
    },
    {
      "title": "查询上海天气",
      "scheduled_date": "2026-05-27",
      "scheduled_time": "08:00",
      "execution_type": "auto",
      "depends_on_titles": ["查询北京天气"]
    }
  ]
}
```

**add_dependency** — 添加任务间依赖：
```json
{ "task_id": "task_2_id", "depends_on_task_id": "task_1_id" }
```

**update_plan_document** — 更新项目文档：
```json
{ "content": "# 项目计划\n\n## 目标\n..." }
```

**write_project_file** — 写入项目文件：
```json
{ "path": "project.md", "content": "# 项目标题\n..." }
```

**read_project_file** — 读取项目文件：
```json
{ "path": "project.md" }
```

⚠️ 注意事项：
- 所有任务应在一次 create_tasks 调用中批量创建，不要逐个创建
- 依赖关系可以通过 depends_on_titles 在同一批次中引用，无需先创建再 add_dependency
- 不要用 Bash/终端命令、Write 工具或其他方式替代以上 MCP 工具
- 项目文件操作必须用 read_project_file / write_project_file，不要用通用文件工具
- 需要向用户提问或确认信息时，必须使用 AskUserQuestion 工具（不要用纯文本问句），这样用户可以通过交互界面直接选择回答

## 记忆管理（重要）
你**必须**在每次对话结束前主动更新记忆文件：
1. **memory/long-term.md** — 记录用户偏好、重要决策、持久知识。使用 write_project_file 在已有内容后追加。
2. **memory/2026-05-27.md** — 记录今日任务进展和发现。
3. **project.md** — 里程碑完成时更新状态标记（⬜→✅）。

写入 long-term.md 示例：
```json
{ "path": "memory/long-term.md", "content": "（先读取已有内容，在末尾追加）\n\n## 2026-05-27\n- 用户偏好：...\n- 重要发现：..." }
```

[网络搜索已启用 / Web Search Enabled]
- 工具 `mcp__web-search__web_search` 已可用，用于获取实时或联网信息（新闻、行情、文档、外部网页等）。
- 重要：如果你在本对话更早的消息里说过"无法联网 / 无法获取实时信息 / 环境限制外部请求 / cannot fetch"之类的话，那是当时尚未配置搜索服务。现在已经配置并启用，请**忽略历史里的这类结论**，直接调用该工具。
- 凡是涉及时效或外部信息的提问，直接调用 `mcp__web-search__web_search`，不要用 Bash/curl/wget/WebFetch 去抓网页，也不要反问用户是否需要搜索。
- 调用失败时告知用户具体错误，不要假装自己没有工具。

[定时任务] 用户说"定时任务/提醒/日程"时必须用 `mcp__scheduled-tasks__*` 工具，禁止用 crontab/launchctl/at 等系统命令。删除任务前必须先用 AskUserQuestion 确认，再带 confirm=true 调用。

[Browser Use 使用指南]

你可以通过 browser-use MCP 工具操控真实 Chrome 浏览器。

**优先使用已保存的 Workflow（零 token、速度快）：**
- 每次用户请求浏览器任务，**先调 browser_list_workflows** 看有没有已录制的 workflow 能匹配这次任务
- 如果找到匹配 workflow，**先调 browser_list_workflows** 看有没有已录制的 workflow 能匹配这次任务
- 如果找到匹配的：
  1. 用 AskUserQuestion **依次**询问该 workflow 的每个 parameter（按 description 提问）
  2. 调 browser_workflow_run(workflow_id, params) 执行
  3. 不要手动开浏览器、点击、滚动——workflow 已经是脚本化的精简路径
- 只有确认没有匹配 workflow 时，才走下面的手动操作流程

**开始前必须检查 Profile：**
- 首次使用浏览器前，先调 browser_list_profiles 查看可用的浏览器 Profile
- 如果有多个 Profile（每个 Profile 是独立的浏览器身份，有不同的登录态），必须用 AskUserQuestion 询问用户要使用哪个 Profile
- 只有一个 Profile 时直接使用，不用问
- 在 browser_open 的 profile 参数中指定用户选择的 Profile 名称

**核心原则：先读 DOM，再看截图，最后才坐标点击。**

| 要做什么 | 用什么工具 | 为什么 |
|---------|-----------|-------|
| 读页面文字/链接/数据 | browser_eval | 零截图，省 token，毫秒级返回 |
| 点击按钮/链接 | browser_click_element（CSS 选择器）| 比坐标精准，不怕位置偏移 |
| 需要看页面长什么样 | browser_screenshot | 只在需要视觉判断时用 |
| 坐标点击（无法用选择器） | browser_click（x, y）| 最后手段，如 canvas/图片按钮 |
| 输入文字 | browser_type | 先 click 聚焦输入框再 type |
| 滚动加载更多 | browser_scroll | 触发懒加载后再 eval 读内容 |

**高效工作流：**
1. browser_open 打开页面
2. browser_eval 读取 DOM 结构，了解页面有什么（标题、链接、按钮）
3. browser_click_element 通过选择器操作（而非截图→猜坐标→点击）
4. browser_eval 提取需要的数据
5. 只在需要视觉确认时才 browser_screenshot
6. 完成后必须 browser_close

**大数据量处理（重要！）：**
当需要从页面抓取大量数据（>20条记录）时，绝对不要通过 tool result 或 Write 工具传输大量数据。正确做法：
1. 用 browser_eval 把数据收集到 JS 变量中：`window.__data = [...收集的数据]`
2. 用 **browser_save_file** 工具直接把浏览器中的数据写到本地文件：
   - expression: `JSON.stringify(window.__data)`
   - filePath: `/Users/xxx/data.json`
3. 然后用 Bash/Python 处理本地文件（生成 Excel、分析等）
4. **绝对不要**把几百条数据内嵌到 Write/Bash 的参数里——模型需要逐 token 生成几万字符，会卡死十几分钟

**browser_eval 常用模式：**
- 页面标题和 URL：`document.title + ' | ' + location.href`
- 所有链接：`Array.from(document.querySelectorAll('a')).map(a => ({text: a.textContent.trim(), href: a.href})).filter(a => a.text)`
- 页面主要文本：`document.querySelector('main, article, .content, #content')?.innerText || document.body.innerText.slice(0, 5000)`
- 表单字段：`Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({tag: e.tagName, type: e.type, name: e.name, id: e.id}))`
- 按钮列表：`Array.from(document.querySelectorAll('button, [role=button], input[type=submit]')).map(e => ({text: e.textContent.trim(), selector: e.id ? '#'+e.id : e.className ? '.'+e.className.split(' ')[0] : e.tagName}))`

**任务完成后必须输出执行策略：**
在调用 browser_close 之前，必须输出一段 <strategy> 标签包裹的执行策略摘要。
这段策略会被保存到 Workflow 中，下次执行时 AI 会直接按照策略操作，避免重复踩坑。

策略要求：
1. 像 Playwright 脚本一样具体——写明每一步用什么方法、什么选择器、什么 CDP 命令
2. 标注哪些方法尝试过但失败了（下次直接跳过）
3. 标注动态参数——每次执行可能不同的值用 {{参数名}} 占位符标记
4. 包含关键的 CSS 选择器、XPath、或 DOM 结构特征

示例：
<strategy>
## 小红书视频发布流程
1. browser_open 打开 https://creator.xiaohongshu.com/publish/publish?from=menu&target=video
2. 文件上传：找到 input[type=file]，用 CDP DOM.setFileInputFiles 设置文件路径 {{video_file_path}}
   - 不要尝试 input.value 赋值（浏览器安全限制会失败）
   - 不要尝试 AppleScript 操作文件对话框（不可靠）
3. 等待上传完成：轮询检查上传进度，直到 100%
4. 填写标题：用 browser_eval 找到标题 input，CDP 清空后 browser_type 输入 {{title}}（限20字）
   - React controlled input 不响应普通清空，必须用 CDP Runtime.evaluate 直接设置 value
5. 填写正文：点击正文编辑区(.ql-editor)聚焦，browser_type 输入 {{content}}
6. 点击发布按钮
</strategy>


# User Profile & Instructions（最高优先级 / Highest priority — overrides all above）
- Name (用户自称): 林哥
- Work (工作背景): 我主要做agent应用开发

## User Instructions（必须严格遵守 / MUST follow strictly）
用中文回答，

## 2026-05-27 自动提取
- 用户认为JWT登录等标准功能不是项目重点，应优先关注核心业务逻辑（如竞拍引擎、WebSocket）。


## 2026-05-27 自动提取
- 用户偏好"不纠结标准件原则"，优先快速实现核心功能，不花时间在标准件上做多余优化。


## 2026-05-27 自动提取
- 前端启动时间从 Day7 提前到 Day4（5.31）
- MVP 定义为 Day6（6.2）可演示（接入 WebSocket 实时数据）

## 2026-05-28 自动提取
- `auction-engine-mvp` 已完成、合并并推送到 `master`，并归档到 `openspec/changes/archive/2026-05-28-auction-engine-mvp/`。
- 后端竞拍引擎主规范已沉淀为 `openspec/specs/auction-engine/spec.md`。
- 后续复杂开发必须先开新的 OpenSpec change，并同步 Superpowers exploration/plan；不要在已归档的 `auction-engine-mvp` 上继续追加功能。
- 下一阶段优先建议：`ws-realtime-live-room`，打通 WebSocket 实时竞价和前端用户竞拍体验；订单确认/支付作为后续独立 change。
- Git 管理规则已写入 `AGENTS.md`：非轻量开发使用分支，按可验证切片提交，推送/合并状态必须明确记录。

## 2026-05-28 ws-realtime-live-room

- 当前本地仓库迁移到 `/Users/vivix/Documents/Codex/douyin_live_auction`；Go 命令使用 `/Users/vivix/.local/go/bin/go`；本机 MySQL 默认 `127.0.0.1:3307`，Redis 默认 `127.0.0.1:16379`。
- `ws-realtime-live-room` 已完成用户端实时房间主链路：WebSocket `/ws/auctions/:id` 快照/广播/私有 outbid，用户大厅 `/app/auctions`，直播间 `/app/auctions/:id`，REST 出价后由 WebSocket 驱动当前价与排行榜更新。
- Task 9 E2E 约定：用 API setup 注册/登录商家和用户、创建商品、发布并激活竞拍；用户 A 必须从 `/app/auctions` 进入房间；用户 A 应看到 snapshot 倒计时；用户 B 使用第二浏览器上下文出更高价；用户 A 应看到私有 `您已被超过` 通知以及当前价/排行榜更新；用户 A 再封顶出价触发真实 `auction_end`，并断言终态消息/状态和禁用出价控件。
- 为避免误用旧服务，Playwright 支持 `PLAYWRIGHT_BASE_URL`，Vite dev proxy 支持 `VITE_BACKEND_TARGET`，后端支持显式测试开关 `DISABLE_RATE_LIMIT=1`。已有 `localhost:8080` 不一定是当前后端代码时，优先用 `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1` 起当前后端到备用端口并让前端代理过去验证 `/ws`。
