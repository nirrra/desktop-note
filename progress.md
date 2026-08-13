# Progress Log

## Session: 2026-08-11

### Phase 1: Requirements & Discovery
- **Status:** complete
- **Started:** 2026-08-11
- Actions taken:
  - 读取 planning-with-files 与 frontend-design 的完整工作规范。
  - 运行会话恢复检查，确认没有需要接续的旧任务上下文。
  - 检查工作区，确认目录为空。
  - 将用户需求拆解为桌面窗口行为、卡通视觉和默认工具三个层面。
- Files created/modified:
  - `task_plan.md` (created)
  - `findings.md` (created)
  - `progress.md` (created)

### Phase 2: Architecture & Visual Direction
- **Status:** complete
- Actions taken:
  - 选择 Electron + 原生 HTML/CSS/JS。
  - 确定“贴纸玩具盒”卡通视觉方向。
  - 定义 132 × 156 收起窗口与 780 × 260 展开窗口，展开时保持右边缘锚定。
  - 定义主进程状态、renderer 本地数据和最小 preload API 的边界。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `package.json`
  - `main.js`
  - `preload.js`

### Phase 3: Implementation
- **Status:** complete
- Actions taken:
  - 实现透明置顶窗口、位置记忆、系统托盘、全局快捷键和 QA 截图模式。
  - 用 HTML/CSS 绘制小芽角色、收起态、贴纸式展开卡片和三套工具面板。
  - 实现便签自动保存、可恢复的专注计时器、完成通知和常用语复制口袋。
  - 增加离线 CSP、隔离 renderer、白名单 IPC、键盘操作和减少动态效果支持。
  - 生成应用 PNG、Windows ICO 与 32px 托盘图标。
  - 完成首轮 Node 语法检查与零依赖冒烟测试。
  - 下载并锁定 Electron 43.3.0 与 electron-builder 26.15.3。
  - 通过 Electron 独立安装入口补齐 Windows runtime，并显式拒绝未使用的 installer 脚本。
- Files created/modified:
  - `src/index.html`
  - `src/styles.css`
  - `src/app.js`
  - `scripts/generate_icon.py`
  - `tests/smoke.mjs`
  - `.gitignore`
  - `README.md`

### Phase 4: Testing & Visual QA
- **Status:** complete
- Actions taken:
  - 验证 Electron 可执行文件存在且报告 v43.3.0。
  - 使用 lockfile 和离线模式复装，确认依赖状态干净。
  - 启动真实 Electron 窗口并自动捕获收起、便签、专注、常用语四张截图。
  - 视觉检查确认收起、便签、常用语无裁切；发现专注面板 QA 切换失败。
  - 将 QA 切换改成真实 tab 点击，记录 activeTab/visiblePanel 并等待渲染帧；专注截图复测通过。
  - 在隔离的 QA userData 中执行便签、计时、常用语、剪贴板、托盘、快捷键和窗口尺寸检查，全部通过。
- Files created/modified:
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `package.json`
  - `qa-output/qa-results.json`
  - `qa-output/01-compact.png`
  - `qa-output/02-note.png`
  - `qa-output/03-focus.png`
  - `qa-output/04-snippets.png`

### Phase 5: Delivery
- **Status:** complete
- Actions taken:
  - README 已包含运行、快捷键、数据位置与打包说明。
  - 使用 electron-builder 生成 Windows x64 portable 可执行文件。
  - 记录产物大小、SHA-256 与 Authenticode 状态。
  - 直接运行最终 `.exe`，在隔离数据目录中复跑四态截图和 8 项功能 QA，全部通过。
- Files created/modified:
  - `README.md`
  - `release/小芽便利条-0.1.0-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/packaged/qa-results.json`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 会话恢复 | bundled Python 运行 session-catchup.py | 输出无遗留上下文或恢复信息 | 无遗留上下文，退出码 0 | ✓ |
| JavaScript 语法 | Node `--check` 检查 main/preload/renderer | 全部通过 | 全部退出码 0 | ✓ |
| 静态冒烟检查 | `node tests/smoke.mjs` | 安全设置、DOM 契约、离线资源存在 | 全部断言通过 | ✓ |
| 图标生成 | bundled Python 运行 `scripts/generate_icon.py` | 生成 PNG、ICO、托盘 PNG | 3 个文件生成成功 | ✓ |
| Electron runtime | `electron --version` | 返回已锁定版本 | v43.3.0 | ✓ |
| 依赖可复现性 | `pnpm install --offline` | lockfile 无变化且成功 | Already up to date，退出码 0 | ✓ |
| 收起态视觉 | `01-compact.png` | 角色、气泡、状态与拖动把手完整 | 完整，无裁切 | ✓ |
| 便签视觉 | `02-note.png` | 所有布局与状态完整 | 完整，无溢出 | ✓ |
| 专注视觉 | `03-focus.png` | 显示计时器面板 | 表盘、预设、开始与重置完整显示 | ✓ |
| 常用语视觉 | `04-snippets.png` | 添加、复制、删除控件完整 | 完整，无溢出 | ✓ |
| 最终功能 QA | 隔离 userData 的真实 Electron 交互 | 核心功能全部通过 | 便签、计时、常用语、剪贴板、托盘、快捷键与窗口尺寸全部通过 | ✓ |
| 便携版构建 | `pnpm dist` | 生成 Windows x64 portable | 89,688,696 字节 `.exe`，退出码 0 | ✓ |
| 便携版功能 QA | 直接运行最终 `.exe` | 与源码版行为一致 | 8/8 检查通过 | ✓ |
| 便携版视觉 QA | packaged compact/focus screenshots | 资源与布局完整 | 与源码版一致，无裁切或丢失 | ✓ |
| 产物完整性 | SHA-256 | 生成稳定校验值 | B04B2406...D230BB6 | ✓ |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-08-11 | `python` 命令不存在 | 1 | 载入工作区依赖后改用 bundled Python，成功运行 |
| 2026-08-11 | npm registry 在沙箱内返回 EACCES | 1 | 重新以经批准的网络命令安装，271 个包下载完成 |
| 2026-08-11 | `ERR_PNPM_IGNORED_BUILDS`：electron-winstaller 脚本未批准 | 1 | 显式设为 false；独立补齐 Electron runtime，离线复装通过 |
| 2026-08-11 | focus 自动截图没有切换到专注面板 | 1 | 使用真实点击和双 RAF 后复测，DOM 状态与视觉截图均正确 |
| 2026-08-11 | 计划日志补丁未匹配旧文本 | 1 | 重新读取当前文件并使用精确上下文更新 |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | 全部阶段完成 |
| Where am I going? | 向用户交付便携版、源码与操作说明 |
| What's the goal? | 交付可运行的卡通桌面悬浮便利条 |
| What have I learned? | Electron 43 可用；贴纸视觉在 132×156 与 780×260 两种窗口尺寸均完整；所有核心交互通过 QA |
| What have I done? | 完成源码、图标、依赖锁定、真实窗口截图、功能验收、portable 打包与成品复验 |

## Session: 2026-08-12

### Phase 6: V2 Scope & Simplification
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 接收用户反馈，将范围收敛为纯多便签组件。
  - 复读 planning-with-files 与 frontend-design 规范。
  - 检查现有项目、计划、运行时版本与主要文件规模。
  - 从 Electron 43 本地类型定义确认 Windows `moved` / `will-move` 事件语义。
  - 确定四边自动隐藏、36px 拉手恢复和 V1 单便签迁移方案。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 7: V2 Implementation
- **Status:** complete
- Actions taken:
  - 设计 430 × 520 纵向多便签板与清晰正文字体方案。
  - 删除专注计时、常用语和旧展开/收起双态的全部界面与交互代码。
  - 实现多便签的新建、textarea 就地编辑、自动保存、V1 内容迁移、两次点击删除和 50 条上限。
  - 实现 Windows `moved` 边缘检测、四边藏入屏幕外、36px 小芽拉手与点击恢复。
  - 重做为低噪音贴纸便签板，正文固定使用清晰的 Microsoft YaHei UI 15px / 25.5px 行高。
  - 更新版本为 0.2.0、README、冒烟测试与 lockfile。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `main.js`
  - `preload.js`
  - `src/index.html`
  - `src/styles.css`
  - `src/app.js`
  - `tests/smoke.mjs`
  - `README.md`
  - `package.json`

## V2 Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-08-12 | 冒烟测试 `/timer|snippet/i` 命中正常的 `toastTimer` | 1 | 改为只检查已删除工具的专用标识 |
| 2026-08-12 | 左边缘 QA 失败且隐藏截图仍显示便签板 | 1 | 禁用隐藏态入场动画；坐标断言增加 2px 容差并记录四边实际值 |

### Phase 8: V2 Testing & Visual QA
- **Status:** complete
- Actions taken:
  - Node 语法检查与 V2 冒烟测试通过。
  - 全项目扫描确认 renderer、HTML 和主进程不再含旧专注/常用语实现。
  - 首轮真实 Electron QA：多便签新建、直接编辑、保存、删除和清晰字体全部通过。
  - 四边检查右/上/下通过，左侧坐标断言失败；截图发现入场动画覆盖隐藏透明度。
  - 修正隐藏态动画并为 Windows 坐标加入 2px 容差，同时增加每边 bounds 诊断输出。
  - 第二轮 QA：左/右/上/下隐藏、边缘拉手与恢复全部通过；目视确认隐藏截图只剩拉手。
  - 增加 V1 单便签迁移、26px 边缘阈值、中心位置不误隐藏、隐藏 opacity 与拉手 display 回归断言。
  - 最终源码 QA 全部通过；移除视觉截图中尚未超时的删除提示，生成干净交付预览。
- Files created/modified:
  - `tests/smoke.mjs`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 9: V2 Packaging & Delivery
- **Status:** complete
- Actions taken:
  - 版本号与产品名已更新为“小芽便签 0.2.0”。
  - README 已改为纯多便签功能和四边隐藏说明。
  - electron-builder 成功生成 Windows x64 portable 文件，大小 89,687,503 字节。
  - 直接启动最终 `.exe`，在隔离数据目录中复跑完整 V2 QA，全部通过。
  - 目视复核成品多便签和边缘隐藏截图，无资源丢失、裁切或字体回退。
  - 将新版 SHA-256 写入 `release/SHA256SUMS.txt`。
- Files created/modified:
  - `package.json`
  - `pnpm-lock.yaml`
  - `README.md`
  - `release/小芽便签-0.2.0-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v2-packaged/qa-results.json`

## V2 Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| 纯便签范围 | 不含专注、常用语与旧双态 | 静态扫描无旧工具实现 | ✓ |
| 多条新建 | 可连续新建 3 条独立便签 | 本地状态与 DOM 均为 3 条 | ✓ |
| 直接编辑 | 每条正文可直接输入 | 所有正文均为非只读 textarea | ✓ |
| 清晰字体 | 正文至少 15px / 23px 行高 | 15px / 25.5px | ✓ |
| 自动保存与编辑 | 修改任意一条后本地状态同步 | 指定便签文本正确更新 | ✓ |
| 删除保护 | 两次点击后删除一条 | 3 条变 2 条，DOM 同步 | ✓ |
| V1 迁移 | 旧单条便签进入新列表 | 迁移内容完整 | ✓ |
| 边缘阈值 | 四边 26px 内触发，中心不触发 | 5 项断言全部通过 | ✓ |
| 四边隐藏 | 左右上下仅留拉手 | 四边 opacity/display/bounds 均通过 | ✓ |
| 恢复 | 点击/快捷键后回到工作区内 | 通过 | ✓ |
| 便携版复验 | 与源码版功能和视觉一致 | 完整 QA `passed: true` | ✓ |
| 产物完整性 | SHA-256 与记录一致 | F9377681...990BCF2C | ✓ |

### Phase 10: V3 Interaction & Visual System
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 接收四皮肤、B 版统一布局、时间精度、滚动、拖拽和设置需求。
  - 复读 planning-with-files 与 frontend-design 规范；明确最终 UI 应由代码原生实现，不继续使用位图。
  - 将三张设计稿分别映射为雾白、黑曜、烟灰材质，并增加经典黄色纸张材质。
  - 定义 300×200 默认尺寸、自由宽高范围、三种时间模式、拖拽排序和 V2 数据迁移。
  - 计划批量补丁因旧表格文本变化失败一次；重新读取后分段完成，无代码改动受影响。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 11: V3 Implementation
- **Status:** complete
- Actions taken:
  - 将窗口默认尺寸改为 300×200，并实现宽 280–600、高 180–500 的动态尺寸 IPC 与持久化。
  - 用共享 DOM 和 B 版单列结构实现雾白、黑曜、烟灰、经典黄四皮肤；正文在左、时间在右。
  - 实现 100 条事项、内部滚动、textarea 直接编辑、拖拽/Alt+方向键排序与优先级持久化。
  - 实现精确到分钟、仅日期、无时间三种模式及编辑弹层。
  - 实现皮肤、透明度、宽高、置顶设置，并完成 V2/V1 内容迁移。
  - 移除“小芽”名称、角色、拉手与图标，生成中性便签图标。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `main.js`
  - `preload.js`
  - `src/index.html`
  - `src/styles.css`
  - `src/app.js`
  - `scripts/generate_icon.py`
  - `assets/icon.png`
  - `assets/icon.ico`
  - `assets/tray.png`

### Phase 12: V3 Testing & Visual QA
- **Status:** complete
- Actions taken:
  - 更新 V3 语法、结构和安全冒烟检查，全部通过。
  - 真实 Electron QA 连续生成 8 条事项，验证溢出滚动、直接编辑与排序持久化。
  - 验证精确时间 `14:35`、仅日期 `8/21` 与空时间三种显示。
  - 对四款皮肤逐一测量标题栏、事项行、正文区和时间区，`layoutsIdentical: true`。
  - 当前 Windows 125% 缩放下，四张皮肤截图均为 375×250 物理像素，对应相同 300×200 逻辑尺寸。
  - 验证 84% 透明度、360×240 动态调整以及左右上下四边隐藏/恢复。
  - 目视修正浅色皮肤标题继承色和设置页系统滚动条，复测全部通过。
- Artifacts:
  - `qa-output/v3-source/qa-results.json`
  - `qa-output/v3-source/01-theme-ivory.png`
  - `qa-output/v3-source/02-theme-obsidian.png`
  - `qa-output/v3-source/03-theme-smoke.png`
  - `qa-output/v3-source/04-theme-classic.png`
  - `qa-output/v3-source/05-settings.png`
  - `qa-output/v3-source/06-edge-hidden.png`

### Phase 13: V3 Packaging & Delivery
- **Status:** complete
- Actions taken:
  - 产品名更新为“桌面便签”，版本更新为 0.3.0，README 和中性图标同步完成。
  - electron-builder 生成 Windows x64 portable 文件，大小 89,539,386 字节。
  - 直接运行最终便携 `.exe`，在隔离数据目录复跑完整 V3 QA，`passed: true`。
  - 目视复核便携版雾白与经典黄截图，尺寸和布局与源码版一致。
  - SHA-256 写入 `release/SHA256SUMS.txt`。
- Deliverables:
  - `release/桌面便签-0.3.0-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3-packaged/qa-results.json`

## V3 Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| 四皮肤尺寸 | A/B/C/经典黄使用相同窗口与几何布局 | 300×200；测量结果 `layoutsIdentical: true` | ✓ |
| 内容溢出 | 窗口不变大，列表内部滚动 | `scrollHeight > clientHeight` | ✓ |
| 直接编辑 | 每条正文随时可写 | 全部为非只读 textarea | ✓ |
| 优先级调整 | 拖动后顺序即时保存 | DOM、状态和 localStorage 一致 | ✓ |
| 时间精度 | 分钟、日期、空缺均可保存和显示 | 三项检查全部通过 | ✓ |
| 设置 | 皮肤、透明度、宽高、置顶可调 | 84% 与 360×240 实测通过 | ✓ |
| 四边隐藏 | 左右上下仅显示窄拉手 | 四边 bounds/opacity/display 通过 | ✓ |
| 数据迁移 | V2 正文与顺序保留 | 迁移测试通过 | ✓ |
| 便携版复验 | 与源码版一致 | `passed: true` | ✓ |
| 产物完整性 | SHA-256 与记录一致 | 5F769514...7FA84157 | ✓ |

### Phase 14: V3.1 Material Calibration
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 读取用户提供的九张浅黄色便利贴参考图。
  - 确认目标为低饱和、偏白的奶油柠檬黄，并要求保留纸张质感。
  - 明确四皮肤同一透明度数值必须对应同一主材质 alpha，布局与尺寸保持不变。
  - 对参考图九个主体区域取样，典型颜色约为 `rgb(240, 235, 140)`；决定在此基础上略微加白以获得奶油感。
  - 检查现有 CSS 后确认经典黄的双层背景合成路径与其他皮肤不同，需改为共享底色 alpha + 透明纸纹。
  - 将经典黄主色从 `rgb(255, 221, 105)` 调整为奶油柠檬黄 `rgb(246, 240, 169)`，并同步弹层、行、文字、边框和皮肤色板。
  - 经典黄改为与其余皮肤相同的 `background-color: rgba(..., --panel-alpha)`；纸纹仅作为透明叠层，不再替代主材质。
  - 新增 50%、75%、100% 三点实际背景 alpha 自动测量，并将其纳入必过 QA。
  - 版本更新为 0.3.1，README 同步说明统一透明度范围与奶油黄皮肤。
  - V3.1 源码 Electron QA 全部通过：四款皮肤在 50%/75%/100% 的实际背景 alpha 完全一致，`opacityRangesUnified: true`。
  - 目视复核奶油黄和设置面板；新颜色接近参考图，文字可读性、300×200 布局与滚动区域均无回退。
  - electron-builder 成功生成 0.3.1 便携版；portable 启动器先于应用子进程返回，等待后完整 QA 文件正常生成。
  - 最终 exe 独立 QA 为 `passed: true`，四皮肤 50%/75%/100% alpha、布局、滚动、排序、时间、尺寸与四边隐藏全部通过。
  - 目视复核成品奶油黄截图，与源码版及参考图方向一致。
  - SHA-256 `8D6F9CFED03B2C92D255648574A9F43E961CC50DF86FEEC9BF50DF3C404B38E9` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.1-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.1-packaged/qa-results.json`

### Phase 15: V3.2 Typography & Control Polish
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 按用户指定读取并使用 `frontend-design`，方向为保留结构的克制型精修。
  - 目视审查 0.3.1 黑曜成品：确认 12px 正文偏小、固定两行 textarea 导致单行上贴、无时间横杠语义不清。
  - 规划 13px 中文正文、内容驱动高度与时钟胶囊，不改变 300×200、四皮肤或 B 版列结构。
  - 检查本机离线字体：确认 DengXian、Microsoft YaHei 与 Segoe UI 可用，决定使用等线正文并保留雅黑兜底。
  - 时间按钮保持 66px 固定列宽，用统一细线时钟图标覆盖空值和已有时间状态，防止布局跳动。
  - 正文改为 DengXian 优先的 13px / 20px 排版，单行 20px、双行 40px，超过两行在 42px 内部滚动。
  - 新增 `fitEditorHeight`，在渲染与每次输入后按真实内容高度调整 textarea，并由事项网格垂直居中。
  - 无时间状态改为时钟图标 +“时间”，精确时间保留时钟图标，日期状态自动切换日历图标。
  - 删除按钮由字体乘号改为 1.5px 圆角 SVG，避免不同字体下图标风格漂移。
  - 新增正文 13px、单行居中、双行自适应、时间图标状态与四皮肤几何一致性 QA；版本更新为 0.3.2。
  - V3.2 源码真实窗口 QA 全部通过，新增四项视觉/排版断言均为 true，原透明度、滚动、排序、尺寸和四边隐藏无回退。
  - 目视复核雾白、黑曜、奶油黄：13px 等线正文垂直居中，时钟/日历胶囊清晰，四皮肤布局一致。
  - electron-builder 成功生成 0.3.2 Windows x64 portable 文件，大小 89,541,095 字节。
  - 直接启动最终 0.3.2 exe，在隔离数据目录复跑完整 QA；新增字体、单行居中、双行高度和时间控件检查均为 true，总结果 `passed: true`。
  - 目视复核打包后黑曜截图，字体与图标资源无回退。
  - SHA-256 `50E307A2A567B12566EA8F865A83625507C004FCA9DB7E0F8916C306BAEC13C3` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.2-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.2-packaged/qa-results.json`

### Phase 16: V3.3 Reference-Led Redesign & Right-Edge Repair
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 按 `frontend-design` 重新分析用户给出的暖白、黑曜、冷白高保真稿与右侧实拍图。
  - 提取参考比例：大标题、弱计数、方形加号主按钮、14–15px 正文、72×38 时间卡片、轻分隔、内高光和隐藏式删除控件。
  - 定位右侧故障为窗口越界超过 24px 后绝对距离判定失效；现有直接 dock QA 没有覆盖真实手动拖动路径。
  - 规划指针/越界联合判断及 `move` debounce 兜底，保持四边逻辑和多显示器能力。
  - 尝试使用 `computer-use` 对 0.3.2 便携版做真实鼠标拖动；窗口已找到，但截图阶段应用授权超时，转为主进程可重复越界路径 QA。
  - 以参考稿比例重做 300×200 主界面：48px 标题栏、17px 标题、14px 事项正文、34px 加号主按钮、74×38 时间卡片、隐藏式删除按钮和 5px 窄滚动条。
  - 四款皮肤只改变色彩和材质；雾白、黑曜、烟灰、经典奶黄的标题、行、正文和时间区域自动测量完全一致。
  - 重做设置面板为独立高不透明磨砂层，消除下方事项文字透出；主题卡片、输入框、关闭按钮和内部层级同步精修。
  - `detectNearestEdge` 改为同时评估鼠标释放点和窗口越界；`move` 增加 170ms 停止检测，`moved` 仍作为快速路径。
  - 新增 46% 窗口留在屏内、54% 越过右边缘的回归场景，验证真实检测链路后只显示 26px 展开拉手。
  - 源码 Electron QA 全部通过；独立启动最终 0.3.3 便携 EXE 后完整 QA 再次 `passed: true`。
  - 目视复核打包后黑曜、经典奶黄与右侧隐藏截图，字体、图标、材质和隐藏拉手均无打包回退。
  - electron-builder 生成 `release/桌面便签-0.3.3-x64.exe`，大小 89,541,321 字节；SHA-256 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.3-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.3-packaged/qa-results.json`

### Phase 17: V3.4 Item Typography Calibration
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 按用户反馈将改动严格限定在事项可编辑正文，不调整标题、计数、时间卡片或组件尺寸。
  - 选择 13px 作为目标字号，保留微软雅黑 UI 优先字体栈、正文垂直居中和最多两行的现有行为。
  - 正文由 14px/21px 调整为 13px/20px，编辑器单行高度同步由 21px 调整为 20px、两行上限由 42px 调整为 40px。
  - 更新静态与运行时字体断言，版本升级为 0.3.4；`pnpm check` 通过。
  - 源码 Electron QA 为 `passed: true`，`typographyImproved`、`singleLineCentered`、`editorAutoHeightWorks`、四皮肤同布局及全部边缘隐藏检查均通过。
  - 目视复核雾白、黑曜和经典奶黄截图，事项字号更克制且清晰，无垂直位置或裁切回退。
  - electron-builder 生成 `release/桌面便签-0.3.4-x64.exe`，大小 89,541,338 字节。
  - 独立启动最终 0.3.4 EXE，完整成品 QA 再次 `passed: true`；目视截图与源码一致。
  - SHA-256 `1FD6DD559D772B686C2EE5B6307459381355238BC75D8FF5231BB82D138A664F` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.4-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.4-packaged/qa-results.json`

### Phase 18: V3.5 Pale Milk-Yellow Calibration
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 按用户反馈将经典黄目标从偏明显的柠檬奶黄改为更偏白、低饱和的浅奶油黄。
  - 选定 `rgb(249,247,220)` 作为主材质目标，并计划同步降低强调色、阴影和纸纹的黄色倾向。
  - 同步调整经典黄的弹层、行背景、文字辅助色、分隔线、强调色、时间卡片、内高光、阴影与纸纹，设置色板更新为 `#f9f7dc`。
  - 增加经典黄主材质 `249,247,220` 和设置色板的静态回归断言；清理遗留旧色值断言后 `pnpm check` 通过。
  - 源码 Electron QA 为 `passed: true`，三档透明度实测新 RGB 正确，四皮肤布局、编辑、排序、时间和边缘隐藏均无回退。
  - 目视对比雾白、浅奶黄与设置面板：新经典黄更偏白、饱和度明显降低，但仍保留温暖辨识度。
  - electron-builder 生成 `release/桌面便签-0.3.5-x64.exe`，大小 89,541,540 字节。
  - 独立启动最终 0.3.5 EXE，完整成品 QA 再次 `passed: true`；雾白与浅奶黄成品对比符合目标。
  - SHA-256 `DB6529510FC9C18891F339E3A7E56F7DACCFBBB7CD5D768AF74C0B77DA9577F7` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.5-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.5-packaged/qa-results.json`

### Phase 19: V3.6 Integrated Time Metadata
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 用户确认第三版稿：事项 12.5px、时间约 12px，时间为单行纯文本，日期补零，空时间静态留白。
  - 视觉实现方向为编辑型元数据：保留无形点击热区，常态无卡片/图标，hover 只做轻微提亮和短下划线反馈。
  - 事项列字号改为 12.5px，时间列由 74px 卡片收窄为 58px 无形热区；时间为 12px 等宽数字、右对齐。
  - 从事项模板移除日历/时钟 SVG 和二级标签；日期输出改为补零 `MM/DD`，分钟时间只显示 `HH:mm`，空值正文为空。
  - 空时间在静态状态完全留白，事项行 hover 或键盘 focus 时淡入 9px“设置时间”；已有时间 hover 仅切换主题色并展开 1px 短下划线。
  - 更新静态与运行时 QA 断言并升级到 0.3.6；`pnpm check` 通过。
  - 源码真实窗口 QA 为 `passed: true`；行内时间的透明背景、零边框、零阴影、12px 字号、补零日期、空值留白均通过运行时断言。
  - 目视复核四皮肤截图：事项与时间比例接近确认稿，时间完全融入行内，浅奶黄与其他皮肤均无卡片残留。
  - 运行时 QA 进一步验证空时间热区不小于 56×34、伪元素提示存在，并通过真实 `.click()` 打开时间设置面板。
  - 最终源码复跑继续 `passed: true`；四皮肤同布局、统一透明度、直接编辑、三种时间、排序、滚动、尺寸调整与右侧越界隐藏全部通过。
  - electron-builder 生成 `release/桌面便签-0.3.6-x64.exe`，大小 89,541,396 字节。
  - 独立启动最终 0.3.6 EXE，完整成品 QA 再次 `passed: true`；雾白、黑曜和浅奶黄截图均与确认稿一致。
  - SHA-256 `F2F8D2C9FDFED6F6F9866916ED5B86EF426AE241784F5EF7D6843EB55F9B0ABF` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.6-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.6-packaged/qa-results.json`

### Phase 20: V3.7 Direct Time Entry & Hover Reveal
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 需求拆分为直接时间文本输入与边缘 hover 临时预览两条独立状态路径。
  - 确定精确时间继续复用现有 ISO 分钟存储格式，避免迁移用户数据；日期仍由系统日历输入。
  - 确定 hover 预览保留 dock 状态，不抢占焦点；离开窗口自动收回，点击展开内容则正常恢复。
  - 完成现状审查：定位 `datetime-local` 保存路径、renderer 边缘 class 切换、主进程 dock/restore bounds 与 preload 最小 IPC 接口。
  - 精确时间面板拆为系统日期输入和直接时间文本框；支持 `1444`、`905`、`14:44`、中文冒号输入，保存时规范化为补零 `HH:mm` 并拒绝越界时间。
  - 主进程新增 `edgePreviewed`、贴边全展开 bounds、preview/collapse IPC；renderer 新增拉手 mouseenter、窗口 mouseleave 和预览内容 click 常驻展开路径。
  - 自动 QA 新增真实文本输入保存与无效时间解析，并验证临时展开、完全位于工作区、离开后恢复窄拉手。
  - 调整紧凑时间面板间距并新增专门视觉快照；300×200 下日期、时间、提示和操作区完整无裁切。
  - `pnpm check`、源码 Electron QA 与最终 portable QA 全部通过；直接输入、四皮肤统一透明度、列表滚动、排序、尺寸调整、四边隐藏和右侧越界回归均为 true。
  - electron-builder 生成 Windows x64 便携版，大小 89,543,026 字节；成品使用隔离数据目录复验，`passed: true`。
  - SHA-256 `A91F7CAC1450089B68F5F402DBB53F5B16A95E38DE5B62376AD45501902DDEA3` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.7-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.7-source-final/qa-results.json`
  - `qa-output/v3.7-packaged/qa-results.json`

### Phase 21: V3.8 Real Pointer Hover Repair
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 用户确认 0.3.7 在真实桌面上并未形成可用的光标悬浮展开，推翻上一轮仅基于内部 preview/collapse 调用的验收结论。
  - 本轮验收标准改为：系统鼠标真实进入侧边可见拉手后窗口自行展开，鼠标移出展开窗口后自行收回；不再以直接调用主进程函数作为充分证明。
  - 使用 Computer Use 绑定用户当前运行的 0.3.7 便签，实测右侧收起窗口为 26×200；真实系统光标进入拉手并驻留后仍为 26×200，问题稳定复现。
  - 根因方向锁定为 renderer `mouseenter` 触发 BrowserWindow 位移后与 `mouseleave` 的事件竞争；计划将 hover 生命周期改为主进程系统光标命中检测。
  - 已加入 26×68 侧边命中矩形、120ms 进入延迟、220ms 离开延迟与 50ms 系统光标轮询；首次清理旧 renderer IPC 的批量补丁因 preload 实参不一致未应用，改为分文件精确处理。
  - 删除 renderer `mouseenter`/`mouseleave` 展开链路及对应 preload IPC，主进程成为 hover 状态唯一来源；拉手增加克制的 hover/focus 高光反馈。
  - 自动 QA 改为通过真实生产状态机的“离开拉手以 armed → 进入并等待 → 展开 → 离开并等待 → 收回”路径，新增 26×68 命中区域断言；版本升级为 0.3.8，静态检查通过。
  - 用户恢复 Computer Use 后首次隔离实例未留下窗口，状态文件显示被旧单实例路径改写为普通展开；新增仅测试环境变量生效的单实例锁豁免并改用全新隔离目录，生产启动逻辑不变。
  - 全新隔离实例被 Computer Use 唯一绑定：真实光标先离开拉手、再进入并驻留，Windows 捕获宽度从 26px 实际扩展为 300px，真实 hover 展开首次验证成功；继续确认 UI 渲染并测试移出收回。
  - 重复真实 hover 后宽度仍稳定变为 300px，但合成截图显示完整区域保持透明、后方文档透出；新增验收条件为“窗口展开 + widget-shell 可见”，继续排查 renderer 状态同步，而不是误报完成。
  - 将光标移动到独立 Notepad 窗口并停留 520ms，再捕获便签已从 300px 自动回到 26px；真实移出收回通过，问题现只剩展开态 renderer 面板透明。
  - 测试 trace 证明展开时 renderer 已正确应用 preview class、shell opacity=1 且隐藏拉手；缺陷不是 IPC，而是 Windows 透明 BrowserWindow 在从屏外移入后的合成重绘。准备加入显式 invalidate 与 visibility 合成刷新。
  - 加入 invalidate、visibility 与独立合成层后真实 WGC 仍透出背景，trace 却确认 88% 黑曜背景已计算；调整为展开时一帧级 hide/move/showInactive，强制重建原生透明表面。
  - 强制重建表面方案真实通过：光标进入拉手后 WGC 为 300×200，完整黑曜 UI（外框、标题、按钮和事项行）实际可见。继续做最终移出收回复验后发布。
  - 最终真实指针闭环通过：26px 收起 → 悬浮后 300px 完整 UI → 移出 520ms 后 26px 收起；整个测试使用系统输入与 WGC，未直接调用内部状态函数。辅助空白 Notepad 已关闭。
  - `pnpm check` 与 0.3.8 源码完整 Electron QA 均通过：真实状态机命中、展开/收回、四边隐藏、右侧越界、直接时间输入、排序、滚动、尺寸及四皮肤透明度全部为 true；悬浮展开与时间输入截图视觉无回退。
  - 首次 `pnpm dist` 因沙箱阻止 Electron 构建资源请求而 EACCES，转为按权限流程联网重试；代码与 QA 不受影响。
  - electron-builder 已生成 0.3.8 portable；成品完整自动 QA `passed: true`。真实系统光标进入成品拉手后，WGC 从 26px 展开至 300px 且完整 UI 可见，继续完成移出收回。
  - 最终成品真实闭环完成：26px 收起 → 300px 完整 UI → 26px 收起；辅助空白 Notepad 和隔离测试实例均已关闭。
  - 0.3.8 portable 大小 89,543,891 字节，SHA-256 `0FC5BAF70EB6383C004D0D9241E3391079946A14BB07D9B4C1157BB414F7B43C` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.8-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.8-source-final/qa-results.json`
  - `qa-output/v3.8-packaged/qa-results.json`

### Phase 22: V3.9 Center-Facing Edge Handle
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 将用户反馈拆解为四边统一规则：贴着物理屏幕边缘的一侧必须平直，圆弧必须朝向桌面中央。
  - 复核现有 CSS 后确认左、右、上、下四个方向的边框缺口和圆角都与目标相反，需整体镜像而非只修右侧。
  - 已镜像四边圆角与贴屏侧边框，并将版本升级为 0.3.9；自动 QA 新增四边 computed-style 断言与四张独立折叠截图。
  - `pnpm check` 与 0.3.9 源码 Electron QA 均通过；四边实际圆角/边框断言、四边隐藏、悬浮展开/收回及右侧越界停靠全部为 true，四张折叠截图目视方向一致。
  - 首次打包因沙箱拦截 Electron 构建资源连接而 EACCES，按权限流程重试后成功生成 0.3.9 portable。
  - 最终 EXE 完整 QA `passed: true`，四边成品截图目视通过；产物大小 89,544,370 字节，SHA-256 `85CE3BCE8FB90696C46BEF77509B62F80075F893E9A4F674C52BF666B556F359` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.9-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.9-source/qa-results.json`
  - `qa-output/v3.9-packaged/qa-results.json`

### Phase 23: V3.10 Undock by Dragging
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 将预期交互明确为：从折叠拉手拖动时立即解除旧停靠、恢复完整 UI 并随光标移动；普通位置释放时停留，只有重新靠边释放才折叠。
  - 全局 `python` 不可用；改用 Codex 工作区自带 Python 执行会话恢复脚本，脚本提示当前尚不支持解析原生 Codex 会话，按已同步的计划文件继续。
  - 检查主进程移动链路后定位回弹根因：`move` 与 `handleManualMoveFinished` 都在 `dockedEdge` 存在时跳过，拖离折叠边缘没有清除旧停靠状态，也不会保存新的普通位置。
  - 进一步确认实际路径为“折叠拉手 hover 展开 → 拖动标题栏”；拉手仍维持按钮语义，修复集中在主进程首次手动 move，不改 UI 布局与点击展开行为。
  - 已实现手动 move 接管：记录托管 bounds 目标，只有目标一致的程序移动才被忽略；用户拖动一旦产生不同 bounds，立即清除旧 `dockedEdge`、结束 preview 并保存普通窗口位置。
  - 自动 QA 增加左/右/上/下四边“预览展开 → 首帧拖动 → 中央释放”断言；版本升级为 0.3.10，`pnpm check` 通过。
  - 0.3.10 源码 Electron QA `passed: true`，四边拖离均在中央保持完整 UI，既有 hover 展开/收回与重新靠边折叠无回退；准备使用 Computer Use 做真实鼠标拖动复验。
  - 已启动独立 userData 的源码窗口并由 Computer Use 唯一绑定；首次坐标拖动返回“结果未知”，已按规范作废旧截图/坐标，重新观察后再判断当前实际状态。
  - Computer Use 连续三次无法注入拖动；最终诊断显示标题栏坐标被 ChatGPT/Codex 窗口覆盖。按 Computer Use 安全约束停止重试，不控制 Codex UI；此项不计为产品失败，真实输入验收明确标记为环境阻塞。
  - 隔离测试主进程 PID 8552 已关闭，未触碰用户当前运行的既有版本；源码拖离截图目视为完整 300×200 UI，无折叠拉手或透明表面残留。
  - 已生成 0.3.10 portable，成品完整 QA `passed: true`：四边拖离不回弹、中央停留、靠边重新折叠、hover 展开/收回及四皮肤功能全部通过。
  - 成品大小 89,545,184 字节，SHA-256 `5DBEC81CA116BAEB2C744B0D9A36A5D47F001F46300E86F7656D3F431D349868` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.10-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.10-source/qa-results.json`
  - `qa-output/v3.10-packaged/qa-results.json`

### Phase 24: V3.11 Daily Date Header
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 复核标题栏后确定将 17px 中文标题改为 14px 本地日期数字标题，保留现有按钮、计数和整体几何。
  - 日期采用本地年/月/日分量格式化为 `YYYY/MM/DD`，并计划加入常驻刷新以保证应用跨午夜后仍显示当天。
  - 已将标题替换为 `<time id="todayDate">`，采用 14px 等宽数字排版；新增本地日期格式化、每分钟及窗口恢复时刷新，并升级版本为 0.3.11。
  - 静态测试新增日期格式、语义、字号、等宽数字和刷新定时器断言，`pnpm check` 通过。
  - 0.3.11 源码 Electron QA `passed: true`，`headerDateWorks=true`；四皮肤截图目视确认日期标题不挤压右侧按钮，整体比例一致。
  - 已生成并启动 0.3.11 portable；成品 `headerDateWorks=true` 且完整 QA `passed: true`，黑曜截图目视与源码一致。
  - 便携版大小 89,544,762 字节，SHA-256 `5A35978EE6BD01DB6A9ABC75516DD58BBD3DB6270B45B70BD53FDB7280462BA2` 已写入校验文件。
- Deliverables:
  - `release/桌面便签-0.3.11-x64.exe`
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.11-source/qa-results.json`
  - `qa-output/v3.11-packaged/qa-results.json`

### Phase 25: V3.12 Faster Startup
- **Status:** complete
- **Started:** 2026-08-12
- Actions taken:
  - 确认当前仅发布单文件 portable（约 89.5MB），该格式启动前会自解压完整 Electron；准备与同版本 `win-unpacked` 直接比较可见窗口时间。
  - 复核主进程首帧路径：本地页面无网络依赖，托盘、全局快捷键和 hover 监视器属于可延后初始化项，但需先测量确认主要瓶颈。
  - 用户追加的边缘残留截图已定位：设置/时间浮层是主壳体的同级节点，现有折叠 CSS 与状态逻辑只隐藏 `.widget-shell`，导致打开过的浮层可在反复收起后露出屏幕边缘。
  - 计划采用状态清理 + CSS 防线，并新增打开浮层后的多轮四边收起回归；该修复与启动优化一并进入 0.3.12。
  - 完成三轮启动基准：单文件 portable 平均 16,905ms，已解压程序平均 300ms（约快 56 倍）；主要瓶颈确定为 portable 自解压，而不是 renderer 或本地数据加载。
  - 决定 0.3.12 同时交付 ZIP 快速版和单文件便携版：ZIP 解压一次后直接运行可获得约 0.3 秒启动，单文件版继续满足无需解压的使用偏好。
  - 已实现折叠双保险：renderer 关闭所有浮层/toast，CSS 强制隐藏主壳体与同级浮层；collapse 同时重建 Windows 透明合成表面。
  - 自动 QA 新增 6 轮顶部 preview/collapse，交替打开设置与时间面板，每轮检查 hidden 属性、display、主壳体透明度、拉手与窗口边界。
  - 托盘、快捷键和 hover 轮询延后到首帧显示后 120ms；构建目标增加 ZIP 快速版，版本升级为 0.3.12，`pnpm check` 通过。
  - 0.3.12 源码完整 QA `passed: true`：6 轮浮层收回全部清洁，托盘/快捷键/hover/拖离/四边隐藏均通过；收回截图目视仅剩顶部拉手。
  - 用户报告频繁主进程错误；截图堆栈确认是成品 QA 的 `console.log(QA_CAPTURE)` 在 portable 启动宿主退出后写入断开的 stdout，触发 EPIPE。该问题由本轮测试暴露，不涉及便签数据。
  - 已暂停成品结论，准备移除 QA 标准输出、安装 EPIPE 防崩溃监听并重新构建两种成品；此前生成的 0.3.12 不作最终交付。
  - 已移除所有 QA console 输出，将错误改为落盘 `qa-error.txt`，并为 stdout/stderr 安装 GUI EPIPE 防崩溃监听；当前无残留 Error 对话框进程，`pnpm check` 通过。
  - EPIPE 修复后的源码完整 QA 再次 `passed: true`，6 轮重复收回全 true、托盘/快捷键/hover/拖离正常，结果静默落盘且无 `qa-error.txt`。
  - 重新构建 ZIP + portable 后，实际解压 ZIP 的成品 QA 与最终 portable QA 均 `passed: true`；两者都在宿主先退出后静默完成，无 `qa-error.txt` 或 Error 对话框，broken pipe 根治。
  - 最终启动基准三轮：ZIP 快速版平均 300ms，portable 热启动平均 4,944ms，快速版约快 16.5 倍；基准结束后仍无 Error 对话框。
  - 最终 ZIP 收回截图目视只剩顶部拉手；主界面、设置/时间浮层和 toast 均无残留。所有 0.3.12 测试与 Error 对话框进程已退出。
  - ZIP 大小 139,530,149 字节，SHA-256 `66F37C503ECD34BB58F02AE7DB16E1B7302A6F2BE325A019D99280D4DAEF474F`；portable 大小 89,546,106 字节，SHA-256 `D8136DB8FC4F259210D5992CF1946BF1D94A5660D99FA0BBD78E63AED9C31038`，均已写入校验文件。
  - 已清理可重新生成的 ZIP 临时解压副本与启动基准 userData；保留源码、最终成品、截图及三组 QA 结果。
- Deliverables:
  - `release/桌面便签-0.3.12-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.12-x64.exe`（单文件便携版）
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.12-source-final/qa-results.json`
  - `qa-output/v3.12-fast-zip-final/qa-results.json`
  - `qa-output/v3.12-portable-final/qa-results.json`

### Phase 26: V3.13 Optional Launch at Login
- **Status:** complete
- **Started:** 2026-08-13
- Actions taken:
  - 将自启动定义为 Windows 系统级设置：默认关闭，设置面板读取真实状态，用户切换后由 Electron 主进程写入启动项。
  - 视觉继续采用现有精致极简方向，仅新增一行说明文字与紧凑开关，不改变 300×200 主界面布局。
  - 主进程通过 Electron login item API 读写 Windows 当前用户启动项；有效状态同时检查 `openAtLogin` 和 `executableWillLaunchAtLogin`，可反映系统设置中被禁用的情况。
  - portable 优先使用 Electron Builder 提供的 `PORTABLE_EXECUTABLE_FILE`，避免把临时解压目录写入启动项；ZIP/普通成品使用 `process.execPath`，开发模式补充项目路径参数。
  - 设置面板按需读取系统状态，不增加首帧启动查询；切换期间禁用开关，失败时回滚并以说明文字和 toast 告知用户。
  - 自动 QA 使用内存模拟自启动状态，验证默认关闭、开启、关闭及失败安全边界，不修改真实注册表；最终复查 Windows `Run` 中不存在测试启动项。
  - 源码、实际解压 ZIP、最终 portable 三组 QA 均 `passed: true`，`launchAtLoginWorks=true`、`launchAtLoginSettingVisible=true`；6 轮边缘折叠与四边隐藏仍全部通过，无 `qa-error.txt` 或 Error 对话框。
  - 设置底部截图确认 31×17 开关、两级说明文字和滚动位置在 300×200 面板内清晰；主界面布局及四皮肤未改变。
  - 最终 ZIP 大小 139,531,973 字节，SHA-256 `ABDC96274553A8FDF78789B4D71CD7992A011D6E243E73DCB29C6EE5ACACCA85`；portable 大小 89,547,429 字节，SHA-256 `5762B692E47257DC6BA7E4CA5B9EEA22C442C142105B17AF1919A6F17EBAAB12`。
  - 已清理失败 QA 和实际 ZIP 临时解压副本，保留三组最终结果与截图；用户正在运行的旧 0.3.12 进程未被关闭。
- Deliverables:
  - `release/桌面便签-0.3.13-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.13-x64.exe`（单文件便携版）
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.13-source-final-ui/qa-results.json`
  - `qa-output/v3.13-fast-zip-final/qa-results.json`
  - `qa-output/v3.13-portable-final/qa-results.json`
  - `qa-output/v3.13-source-final-ui/06b-settings-autostart.png`

### Phase 27: V3.14 Launch-at-login Verification Fix
- **Status:** complete
- **Started:** 2026-08-13
- Actions taken:
  - 用户截图显示切换自启动后提示“Windows 未能更新开机自启动设置”，开关回到关闭；初步怀疑 Run 项已写入但 `executableWillLaunchAtLogin` 的即时读取存在滞后或 StartupApproved 判定差异。
  - 本阶段先只读核对注册表与当前运行路径，不直接修改用户启动项；修复需同时保留默认关闭和失败回滚语义。
  - 官方接口与独立探针确认：自定义 name 下 `openAtLogin` 持续假阴性，但 `launchItems` 包含完整的名称、路径、参数与 StartupApproved enabled 状态。
  - 新增纯函数解析器，按名称 + 不区分大小写的规范化路径 + 规范化参数精确寻找本软件条目；匹配时以 `launchItems[].enabled` 为真值，无 launchItems 的旧 Electron 才回退到原布尔组合。
  - Windows 可回滚探针验证新增、禁用、重新启用、删除四态全部解析正确，且结束后无 `桌面便签-QA-*` 残留启动项。
  - 版本升级到 0.3.14，静态检查和纯逻辑回归已通过。
  - 0.3.14 源码、实际解压 ZIP 与 portable 三组完整 QA 均 `passed: true`，自启动设置 UI、6 轮边缘收回及四边隐藏保持通过，无 `qa-error.txt`。
  - 最终 ZIP 为 139,532,661 字节，SHA-256 `182301EBF8DE9758803299D8008C241912D11E9EC94CD15FCA9521A67935A152`；portable 为 89,547,600 字节，SHA-256 `3EFF2E5CB6BF1384C1FA671CFD9EC4ADE658264E9CF00399B844DE0441E5D271`。
  - 最终只读复查：测试启动项 0、真实桌面便签启动项 0、0.3.14 测试进程 0、Error 窗口 0；用户正在运行的 0.3.13 进程保持不动。
  - 已删除约 347MB 的 ZIP 临时解压副本，保留三组成品 QA 与系统探针 JSON。
- Deliverables:
  - `release/桌面便签-0.3.14-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.14-x64.exe`（单文件便携版）
  - `release/SHA256SUMS.txt`
  - `qa-output/login-item-probe-v314.json`
  - `qa-output/v3.14-source-final/qa-results.json`
  - `qa-output/v3.14-fast-zip-final/qa-results.json`
  - `qa-output/v3.14-portable-final/qa-results.json`

### Phase 28: V3.15 Settings Reverse-scroll Fix
- **Status:** complete
- **Started:** 2026-08-13
- Actions taken:
  - 用户截图显示设置内容曾向下滚动：标题栏完全移出画面，皮肤卡片上半部被裁切；此后向上滚轮无法恢复顶部，同时面板下半部出现大块空白。
  - 将通过真实 wheel 事件与 `scrollTop/scrollHeight/clientHeight` 记录复现，不仅在打开设置时强制 `scrollTop=0`。
  - 根因定位为 `overflow:hidden` 外层仍可因底部 checkbox 聚焦而被浏览器程序化滚动；内层回顶后外层仍停留在偏移位置，所以标题消失且滚轮无法恢复。
  - 外层改为 `overflow:clip`，内层限制 overscroll chaining；打开/关闭设置与异常外层 scroll 都主动归零。
  - 0.3.15 源码原生 wheel 回归通过：内层从 108 回到 0，外层全程为 0，关闭重开为 0/0 且标题可见；完整既有 QA `passed: true`。
  - 首轮 ZIP 成品在 125% 缩放下回顶值为 0.8px，外层 0、重开 0、标题可见；将顶部断言改为 ≤1 CSS px 的亚像素容差，产品修复逻辑不变，准备重建成品。
  - 第二轮源码因 4 个原生 wheel 刻度不足而停在 2.4px；改为 8 个刻度并等待 160ms 结算，避免继续放宽断言。该失败仍只属于测试输入不足，外层锁定与重开复位均持续正确。
  - 最终源码、实际 ZIP 与 portable 三组回归均稳定达到内层 `108 → 0`、外层 `0`、重开 `0/0` 且标题可见；完整 QA `passed: true`，无错误文件。
  - 最终 ZIP 为 139,533,282 字节，SHA-256 `C38E3D3CD300FD6D4B4A6DE4B2F3E68168448BB5D96BE6F9F249D28AE71D5E6D`；portable 为 89,548,180 字节，SHA-256 `00432DE710DD9EC3A2694DD7374C85F25540C121D7352100EEC79DB473D77BA9`。
  - 最终静态检查、哈希记录及三组 QA 复核通过；临时 ZIP 解压副本已删除，0.3.15 测试进程与 Error 窗口均为 0。
- Deliverables:
  - `release/桌面便签-0.3.15-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.15-x64.exe`（单文件便携版）
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.15-source-final/qa-results.json`
  - `qa-output/v3.15-fast-zip-final/qa-results.json`
  - `qa-output/v3.15-portable-final/qa-results.json`
  - `qa-output/v3.15-source-final/06c-settings-scroll-restored.png`

### Phase 29: V3.16 Staging Workspace
- **Status:** complete
- **Started:** 2026-08-13
- Actions taken:
  - 与用户确认暂存工作区的产品边界：事项与暂存分区、智能粘贴、上传/拖入图片、本地长期保留、应用内预览及图片操作。
  - 用户最终选择第一版 300×200 示意图，并明确暂存项同样保留六点排序手柄；新项默认置顶，排序可手动持久化调整。
  - 选择精致半透明工具界面方向，沿用当前四皮肤、窗口尺寸与标题栏结构，不把暂存做成独立大窗口。
  - 已开始盘点现有主进程、renderer、preload、测试与构建架构，准备按 userData 文件存储实现。
  - 已新增独立 `src/staging-store.cjs`：支持版本化索引、原图/缩略图分目录、图片签名识别、30MB/200 项边界、文字更新、持久排序、删除与清空；所有展示名和存储文件名均做安全约束。
  - 主进程已接入受限 `staging-image://` 图片协议和暂存 IPC：列表、文字创建/编辑、排序、删除、清空、批量导入、文件选择、智能粘贴、复制与另存均不向 renderer 暴露任意磁盘路径。
  - 智能粘贴按“资源管理器图片文件 → 剪贴板位图 → 纯文本”识别；图片协议只接受现有暂存 ID 和原图/缩略图两个枚举类型。
  - preload 已增加参数收窄后的暂存 API；BrowserWindow 继续保持 sandbox、contextIsolation 和 nodeIntegration=false。
  - 主界面已按确认稿加入“事项 / 暂存”导航；暂存工作区保留六点手柄，提供图片缩略图、两级元数据、直接编辑文字、创建时间、复制/另存/删除与底部粘贴提示。
  - 已加入应用内图片预览、空状态、清空二次确认和全窗拖入提示；所有新视觉使用现有四皮肤令牌，300×200 壳体与透明度映射不变。
  - renderer 已接入非编辑状态智能粘贴、图片拖放、文件选择、文字保存防抖、暂存排序持久化与工作区记忆；编辑 textarea/input 时仍保留原生粘贴。
  - 当前 `main.js`、`preload.js`、`src/app.js` 与暂存存储模块均通过 JavaScript 语法检查。
  - 首轮 `pnpm check` 的 JavaScript 语法阶段通过，随后按预期停在旧 `.title-copy time` 静态断言；产品代码没有运行错误，测试需随工作区标题 DOM 更新。
  - 首次隔离 Electron 完整回归仍 `passed:true`，四皮肤、透明度、时间、设置滚动、边缘悬浮与四边隐藏全部未回退；雾白实拍确认新标题栏在 300×200 内无裁切。
  - renderer QA 已扩展为真实创建两张 Canvas PNG 和一条暂存文字，覆盖持久排序、编辑、删除、协议加载、复制/另存与图片预览；主进程新增暂存工作区及预览截图验收。
  - 新增独立暂存存储单元测试，并将版本升级为 0.3.16；静态检查已同步到新工作区 DOM、CSP、受限 IPC、拖放与图片协议。
  - 第二轮源码端到端 QA `passed:true`：暂存创建、排序、编辑持久化、删除、复制/另存、协议加载、预览、滚动和三只排序手柄全部通过；既有功能仍全部通过。
  - 目视检查 `06d-staging-workspace.png` 与 `06e-staging-preview.png`：300×200 内排版清晰、手柄与缩略图尺寸合适、预览无外部窗口，符合用户选择的第一版方向。
  - 回归进一步加入四皮肤暂存布局签名一致性，并在 6 轮侧边折叠中轮流打开设置、时间和图片预览，防止新增浮层复现此前残留问题。
  - README 已补充智能粘贴、上传/拖放、支持格式、30MB 边界、排序和 `userData/staging` 数据位置。
  - 最终源码 QA `passed:true`；四皮肤暂存布局签名逐项完全一致（291×190 壳体、55px 行、18px 手柄、40×36 缩略图、22px 页脚、11.5px 图片标题）。
  - 6 轮设置/时间/图片预览交替展开后侧边收起全部清洁，图片预览和拖入遮罩均为 hidden/display:none；四边隐藏、悬浮展开和设置反向滚动继续通过。
  - 首次 `pnpm dist` 在 Electron Windows 资源下载阶段被网络沙箱以 `EACCES 198.18.0.111:443` 阻止；代码编译与 native dependency 步骤已完成，按权限规范改为受控联网重试。
  - 受控联网重试构建成功，生成 0.3.16 ZIP 快速版和单文件 portable；实际 ZIP 解压版与 portable 均完成同一套完整端到端 QA 并 `passed:true`。
  - 最终 ZIP 大小 139,546,992 字节，SHA-256 `15D3FCBD9889112CC680347555407129CC3562303785D146FEB7F6A38D75F5D1`；portable 大小 89,560,392 字节，SHA-256 `8612030D96DFAE8230D6FC1B9C62E295AE6BF7A025C41C7A75440A8F1C7ECCE7`，均写入校验文件。
  - 最终 `pnpm check`、成品哈希复算和三组 `qa-results.json` 复核全部通过，无 `qa-error.txt`；已删除约数百 MB 的临时 ZIP 解压测试副本。
- Deliverables:
  - `release/桌面便签-0.3.16-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.16-x64.exe`（单文件便携版）
  - `release/SHA256SUMS.txt`
  - `qa-output/v3.16-source-final/qa-results.json`
  - `qa-output/v3.16-fast-zip-final/qa-results.json`
  - `qa-output/v3.16-portable-final/qa-results.json`
  - `qa-output/v3.16-source-final/06d-staging-workspace.png`
  - `qa-output/v3.16-source-final/06e-staging-preview.png`

### Phase 30: V3.17 Floating Preview & Interaction Polish
- **Status:** complete
- **Started:** 2026-08-13
- Actions taken:
  - 用户要求移除标题左上六点、将“事项”改为“待办”、空待办直接删除、长图使用超出主组件的悬浮完整预览，并为暂存项加入右键操作。
  - 参考图为约 278×513 的纵向文档截图；现有 300×200 内嵌浮层不适合阅读，决定使用按图片比例和当前显示器工作区计算尺寸的独立悬浮 BrowserWindow。
  - 右键菜单采用 Electron 原生 Menu，图片提供预览/复制/另存/删除，文字提供复制/另存/删除；所有操作继续走既有受控存储函数。
  - 已从标题栏 DOM/CSS 移除左上六点装饰，日期区域继续保留 `-webkit-app-region:drag`；同时将主界面、空状态、时间说明和待办编辑控件中的“事项”改为“待办”。
  - 已移除受 300×200 限制的组件内图片预览面板及其样式，为独立悬浮预览窗腾出单一交互路径。
  - 已新增独立 sandbox 悬浮预览窗口：按图片宽高和当前显示器工作区计算窗口尺寸，天然大于 300×200 且不越出屏幕；长图按 `object-fit:contain` 完整缩放展示。
  - 悬浮窗使用专用最小权限 preload，只能读取当前预览项、关闭、复制和另存；标题栏可拖动，Esc 关闭，并提供 Ctrl+C/Ctrl+S 快捷操作。
  - 主进程已建立暂存右键动作执行器与 Windows 原生菜单：图片含悬浮预览、复制、下载/另存、删除，文字含复制、另存、删除；删除会关闭对应预览并返回最新列表快照。
  - 空待办单击删除会立即移除且不出现感叹号；非空待办仍保留二次确认，避免误删已有内容。
  - 已移除 renderer 中全部旧内嵌预览引用，并在靠边停靠、悬浮收回、隐藏到托盘、主窗口关闭、删除/清空暂存和应用退出时统一销毁悬浮预览，防止残留窗口。
  - 完整源码 QA `passed:true`：278×513 长图以 360×602 独立窗口完整 `contain` 展示；标题六点移除、“待办”术语、空项直接删除、文字/图片右键复制/另存/删除、6 轮侧边收回清理和四边隐藏全部通过。
  - 0.3.17 ZIP 解压成品与单文件 portable 均完成同一套端到端回归并 `passed:true`，没有生成 `qa-error.txt`。
  - 最终 ZIP 为 139,552,374 字节，SHA-256 `27A0248B7C63D71E29C6DF3D1658335DEEA23BDF62F1BC59A02E7612EC74B456`；portable 为 89,564,720 字节，SHA-256 `D1DAB4E6D47A3ECB32D87A1C147C2C23363C80BA30A78DA1BDB92D0B83E6A6D4`。
- Deliverables:
  - `release/桌面便签-0.3.17-x64.zip`（推荐快速版）
  - `release/桌面便签-0.3.17-x64.exe`（单文件便携版）
  - `qa-output/v3.17-source-final/qa-results.json`
  - `qa-output/v3.17-fast-final/qa-results.json`
  - `qa-output/v3.17-portable-final/qa-results.json`
  - `qa-output/v3.17-source-final/06e-floating-preview.png`
