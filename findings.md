# Findings & Decisions

## Requirements
- 桌面便利条，而非普通网页。
- 显示方式参考 Codex 宠物：平时以小型卡通伙伴悬浮在桌面上。
- 支持收起/展开，并能隐藏后再次唤回。
- 整体采用有个性的卡通风格。
- 第一版应可运行，且结构便于继续添加工具。
- V2 只保留便签功能，不再显示专注计时或常用语。
- 支持新建多条独立便签，每条正文直接点击编辑并自动保存。
- 正文字体必须清楚易读，避免装饰字体承担长文本。
- 组件拖到靠近桌面任意边缘时自动隐藏，并提供便捷恢复方式。
- V3 默认尺寸 300×200，适配用户当前 2K 桌面。
- A 雾白、B 黑曜、C 烟灰、经典黄四套皮肤均纳入可切换设置。
- 四套皮肤使用相同的 B 版布局：事项正文在左，时间在右。
- 事项超出可视高度时，列表可垂直滚动。
- 事项可上下拖动，以改变并持久化优先级。
- 时间支持精确到分钟、仅日期和空缺。
- 设置面板可调整组件宽高、皮肤和透明度。
- 不再出现“小芽”名称、角色或图标。

## Research Findings
- 当前工作区 `C:\Users\wdyab\Desktop\desktop-note` 为空，可从零选择合适的桌面技术栈。
- Codex 提供的工作区依赖包含 Node.js 与 pnpm，可用于搭建 Electron 项目。
- 透明、无边框、置顶窗口配合系统托盘和全局快捷键可覆盖“宠物式显示 + 隐藏/唤回”的核心桌面行为。
- 工作区不是 Git 仓库，因此交付以完整目录和便携版可执行文件为主，不进行提交操作。
- bundled Node.js 为 v24.14.0、pnpm 为 11.16.0，Pillow 12.2.0 可生成 Windows `.ico` 与托盘 PNG。
- npm 解析到 Electron 43.3.0 与 electron-builder 26.15.3；lockfile 已生成。
- Electron npm 包本体已存在，但 `node_modules/electron/dist/electron.exe` 尚未下载；需要运行 Electron 43 提供的独立 `install-electron` 安装入口。
- pnpm 自动创建了 `pnpm-workspace.yaml`，要求明确将未使用的 `electron-winstaller` 构建脚本设为允许或拒绝。
- 运行独立安装入口后 `electron.exe` 完整落盘，版本验证为 v43.3.0；离线 `pnpm install` 已干净通过。
- electron-builder 成功生成 Windows x64 portable 文件 `release/小芽便利条-0.1.0-x64.exe`，大小 89,688,696 字节。
- 便携版 SHA-256 为 `B04B2406D2FCC8FDD1A38B8DE11CFE25CDCCF54151E64C3C81CFB0323D230BB6`；Authenticode 状态为 `NotSigned`。
- 直接运行便携版后，独立 QA 的 8 项检查全部通过，并成功生成四态截图，证明 asar、preload、图标与 renderer 资源在成品中完整。
- Electron 43 的本地类型定义确认 `BrowserWindow` 在 Windows 支持 `moved` 事件：窗口完成一次手动移动后触发一次，适合在拖动结束时判断是否靠近边缘。
- `will-move` 只在手动移动前触发，而 `setBounds` 等程序移动不会触发 `will-move`；仍将使用状态锁避免自动吸附产生重复处理。
- 当前实现 main 约 456 行、renderer 约 439 行、HTML 193 行、CSS 1288 行；V2 可显著删除旧工具与双态界面代码。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Electron 主进程 + 原生 HTML/CSS/JS 渲染层 | 桌面能力完整，同时避免引入 React 等非必要运行时 |
| 主进程只暴露最小 IPC API | 保持 renderer 隔离，降低权限面 |
| 工具数据优先使用 renderer 的 localStorage | 便签、计时与常用短语数据量小，零额外依赖即可持久化 |
| 窗口位置由主进程保存到 userData JSON | 保证重启后卡通伙伴仍停留在用户熟悉的位置 |
| 视觉方向为“贴纸玩具盒” | 奶油底色、橘红主色与青绿色强调，圆润轮廓、纸张纹理和弹性动效，避免通用渐变卡片感 |
| 使用 CSP、contextIsolation、sandbox 和白名单 IPC | 桌面 renderer 无需直接获得 Node 权限，仍能安全调用隐藏、置顶、剪贴板和通知能力 |
| V2 固定为 430 × 520 单窗口便签板 | 比原 780 × 260 工具横条更适合纵向浏览多条短便签，也无需“展开/收起”状态 |
| 使用 `moved` 事件做边缘判断 | Windows 上在一次手动移动完成后触发，避免拖动过程中反复吸附 |
| 存储键升级为 `sprout-notes:v2` 并兼容读取 V1 `note` | 保留用户已有便签文字，同时让多条便签数据结构保持干净 |
| V3 存储键使用 `desktop-notes:v3` | 数据结构加入 schedule 和 appearance，并明确脱离旧“小芽”命名 |
| UI 默认 300×200，允许宽 280–600、高 180–500 | 兼顾用户当前偏好、最小可用性与未来更大事项列表 |
| 主题用根元素 `data-theme` + CSS 变量实现 | 四皮肤共用同一 DOM 和布局，不产生功能分叉 |
| 透明度只作用于主材质与弹层底色 | 保持文字、图标和边框对比度，不因全窗口 opacity 变得模糊 |
| 拖拽把手使用 HTML Drag and Drop，并提供 Alt+方向键 | 支持直观鼠标排序，同时保留键盘可访问性 |
| 超出列表固定使用 `overflow-y: auto` | 300×200 下维持窗口尺寸稳定，事项数量不限制可用性 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 系统无全局 Python 命令 | 使用 Codex bundled Python 完成 planning-with-files 会话恢复检查 |
| 沙箱内 npm registry 请求返回 EACCES | 经批准后在受控命令中完成依赖下载 |
| pnpm 阻止 `electron-winstaller` 的安装脚本 | 当前 portable 目标不使用该子包；在 workspace policy 中显式设为 false，离线复装通过 |
| focus 首轮自动截图捕获到旧面板 | QA 改为触发真实 `.click()`，等待双 requestAnimationFrame 和 420ms；复测状态与截图一致 |
| V2 “不含计时器”测试使用宽泛 `/timer/` 正则 | 新版提示消息仍合理使用 `toastTimer` 变量；改为检查 `timerToggle`、`toggleTimer` 等旧工具专用标识 |
| 首轮四边 QA 仅左侧失败；隐藏截图仍显示便签板 | CSS 入场动画的最终关键帧 `opacity: 1` 优先于普通隐藏态 `opacity: 0`；隐藏时关闭该动画。Windows 边缘坐标检查采用 2px 容差并记录实际 bounds 复测。 |

## Resources
- `C:\Users\wdyab\.codex\skills\planning-with-files\SKILL.md`
- `C:\Users\wdyab\.codex\skills\frontend-design\SKILL.md`
- Codex bundled Node: `C:\Users\wdyab\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- Codex bundled pnpm: `C:\Users\wdyab\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`

## Visual/Browser Findings
- `01-compact.png`：132×156 收起态完整可见；透明背景、点状拖动把手、对话气泡、角色轮廓与底部在线标签均未裁切。
- `02-note.png`：展开卡片边框与硬阴影清晰，标题栏、三个工具标签、便签纸、状态栏在 780×260 内完整显示；信息层级明确。
- `04-snippets.png`：四条默认常用语、添加框、删除按钮和滚动条布局正常；长文本仍有安全宽度。
- `03-focus.png` 异常地仍显示便签面板，自动 QA 的 focus 切换路径未生效；需要检查 renderer 切换逻辑或 QA 执行时序并复测。
- 复测时 DOM 报告 `activeTab=focus`、`visiblePanel=focus`，截图正确显示 25:00 表盘、15/25/45 分钟预设和开始/重置按钮；初次异常属于截图时序，并非用户交互逻辑。
- 最终功能 QA 结果：便签保存、计时递减、暂停、常用语新增、剪贴板复制、托盘、快捷键、展开尺寸全部通过。
- 对便携版重新目视检查收起态与专注态，透明区域、角色、卡片、表盘、按钮和底部提示与源码版一致，无打包后字体或资源丢失。
- 总体视觉符合“贴纸玩具盒”方向：奶油纸张、珊瑚橘角色、青绿功能色与深色手绘轮廓形成统一识别度。
- V2 空状态截图：430×520 纵向卡片完整，无裁切；标题、说明和新建按钮层级清晰，正文采用清晰无衬线字体。
- V2 多便签截图：三种纸张色区分自然，15px 中文正文清楚；每条保存状态、字数与删除按钮可见，列表滚动条正常。
- V2 首轮边缘截图中黄色拉手正确出现，但完整便签板仍被 capturePage 捕获，定位为 CSS 入场动画覆盖隐藏 opacity；已针对性修正并待复测。
- V2 第二轮四边 QA 全部通过。当前 Windows 缩放下 Electron 将请求的 430px 窗口报告为 431px，左侧实际保留 37px、其余侧保留 36px；2px 容差可兼容该像素舍入，视觉差异不可察觉。
- 修正后的边缘截图只显示透明画布与黄色小芽拉手，完整便签板不再被捕获；恢复后窗口完整回到工作区内。
- 最终源码 QA 进一步验证 V1 单便签迁移、26px 内四边触发、中心位置不误触发，以及每个隐藏态的 `notesOpacity=0`、`handleDisplay=flex`，全部通过。
- 最终多便签预览中只存在“新建便签”、置顶、托盘隐藏、就地编辑与逐条删除；视觉层级简洁，滚动列表可容纳多条内容。
- electron-builder 成功生成 `release/小芽便签-0.2.0-x64.exe`，大小 89,687,503 字节，SHA-256 为 `F9377681FC90F7789EB6C6C32064D2A9757F26007841C1D5570027FE990BCF2C`，Authenticode 状态为 `NotSigned`。
- 直接运行 0.2.0 便携版后，完整 V2 QA 再次全部通过；打包后的多便签和边缘拉手截图与源码版一致。
- 三张 GPT Image 2 设计稿已保存在 `designs/`；A 为雾白磨砂、B 为黑曜石玻璃、C 为烟灰亚克力。
- B 版的核心布局特征是标题栏 + 单列事项 + 右侧时间，适合复用到所有皮肤；A/C 仅作为材质系统而不改变组件结构。
- V3 源码版与最终便携版均完成自动功能和视觉 QA：滚动、直接编辑、三种时间、拖拽排序、透明度、尺寸调整、V2 迁移与四边隐藏全部通过。
- 四款皮肤共享同一 DOM；自动测得标题栏、事项行、正文区和时间区尺寸完全一致。当前 125% 系统缩放下四张截图均为 375×250 物理像素，即相同 300×200 逻辑尺寸。
- 最终 Windows x64 便携版为 `release/桌面便签-0.3.0-x64.exe`，89,539,386 字节，SHA-256 为 `5F7695141F525AF5688FFF43F998BF97477C8E88C16A80F460F542567FA84157`。
- V3.1 参考图中的黄色便签是偏白、低饱和的奶油柠檬黄：主体接近柔和浅黄，顶部与边缘有很轻的暖色明暗，而不是当前 `rgb(255, 221, 105)` 的高饱和金黄。
- 四皮肤透明度需要统一为同一数值语义：主面板均直接使用 `--panel-alpha`；经典黄可以保留纸张纹理，但不得另行增加底色 alpha。
- 对参考图九张便签中心和主体裁切区取样后，RGB 均值约落在 `(235–245, 230–238, 129–151)`，典型中心色约为 `rgb(240, 235, 140)`；实现色应在该方向上稍加白，形成更柔和的奶黄色。
- 当前经典黄通过两层 `background` 渐变模拟纸张，和其他三款直接使用 `background-color` 的透明合成路径不同；V3.1 应统一为同一 `rgba(var(--panel-rgb), var(--panel-alpha))` 底色，仅用无底色纹理叠加纸感。
- V3.1 源码 QA 实测四皮肤在 50%、75%、100% 时的 `backgroundColor` alpha 均严格为 0.50、0.75、1.00，`opacityRangesUnified: true`；所有既有功能和布局检查也保持通过。
- 新经典黄截图呈低饱和、偏白的浅柠檬奶油纸色，已消除旧版偏橙的金黄色；深色文字、时间标签和细边框仍有清晰对比。
- 最终 0.3.1 便携版独立 QA 为 `passed: true`，奶油黄成品截图与源码版一致。产物大小 89,541,055 字节，SHA-256 为 `8D6F9CFED03B2C92D255648574A9F43E961CC50DF86FEEC9BF50DF3C404B38E9`。
- V3.2 视觉审查：当前正文为 12px、textarea 固定 42px/两行，单行事项会贴近编辑区顶部；应改为内容驱动的 20–42px 高度并由网格垂直居中。
- 当前无时间状态只显示横杠，语义接近隐藏按钮和删除符号；应换成细线时钟图标 + “时间”短标签的低噪音胶囊。
- 300×200 的信息密度不适合引入大字体或额外栏位；优化应集中在中文优先字体栈、13px 正文、数字等宽特性、图标统一为约 1.5px 圆角描边。
- 当前 Windows 已安装 DengXian（等线）、Microsoft YaHei 和 Segoe UI。V3.2 可离线使用“等线正文 + Segoe UI Variable 数字/控件 + 微软雅黑兜底”，无需增加网络字体或显著扩大安装包。
- 时间控件应维持原 66px 列宽：无时间时显示 13px 时钟图标和“时间”，有时间时图标缩为视觉锚点、右侧继续显示精确时间/日期，避免切换状态时列宽跳动。
- V3.2 源码 QA：`typographyImproved`、`singleLineCentered`、`editorAutoHeightWorks`、`timeControlImproved` 与 `layoutsIdentical` 均为 true，既有功能检查全部保持通过。
- 四皮肤截图显示等线正文更轻盈且中文辨识清楚；单行事项位于 54px 行高中央。无时间、精确时间和日期三种胶囊分别使用时钟、强调时钟和日历图标，固定 66px 且视觉层级稳定。
- V3.2 最终便携版 QA 为 `passed: true`；打包后黑曜截图与源码一致。产物大小 89,541,095 字节，SHA-256 为 `50E307A2A567B12566EA8F865A83625507C004FCA9DB7E0F8916C306BAEC13C3`。
- V3.3 四张参考图的共同结构：大号标题与弱化计数、34px 左右方形加号主按钮、细线齿轮/减号、正文 14–15px、约 72×38 的时间卡片、低对比行分隔、外框内高光和窄滚动条；删除按钮不在常态构图中。
- 参考图的白/黑/暖色方案只改变材质和强调色，几何比例一致；可继续用共享 DOM/CSS 变量，不需要拆分皮肤布局。
- 用户实拍图显示组件在屏幕右侧留下约半个窗口而非 26px 拉手，说明拖动时窗口已明显越过工作区右边界但未进入 dock 状态。
- 根因在 `detectNearestEdge` 使用 `abs(windowRight - workAreaRight) <= 24`：窗口越过右边界超过 24px 后距离重新变大而返回 null。应优先用释放时指针到边缘的距离，并将窗口越界视为零距离候选。
- 当前 QA 直接调用 `dockToEdge('right')`，未覆盖 `moved -> detectNearestEdge -> dockToEdge` 的用户路径；V3.3 必须新增右侧 overshoot 手动路径。
- V3.3 将标题栏改为 48px、正文改为 14px 微软雅黑 UI 优先、时间卡片改为 74×38，并将加号提升为 34px 方形主按钮；四皮肤继续共用完全相同的网格几何。
- 设置层首次截图仍会透出下方列表，造成文字和分隔线叠影；最终改为 98.5% 独立磨砂材质、内高光和更清晰的主题色块，主组件透明度映射不受影响。
- 新边缘算法使用释放时指针与窗口越界共同计算最近边缘：即使 300px 窗口有 162px 被拖出右侧，仍能识别为 `right`；`move` 停止 170ms 后的 debounce 可覆盖 Windows frameless `moved` 偶发缺失。
- V3.3 源码与最终 0.3.3 EXE 的 QA 均为 `passed: true`：`rightOvershootDetected`、`rightOvershootHideWorks`、四边隐藏、四皮肤同几何、统一透明度、滚动、直接编辑、三种时间和排序持久化全部通过。
- 最终 0.3.3 便携版大小 89,541,321 字节，SHA-256 为 `A2C2C20FA88F459EC9FDAB24F07F027D1E7EE8EA48F523CAFF9E8A56D21151B6`。
- V3.4 用户只要求缩小“事项”正文；标题、计数、时间卡片及设置字号不应联动改变。13px 是当前 14px 与早期 12px 之间已经验证过的清晰尺寸，适合保持 300×200 的信息密度。
- V3.4 源码截图显示 13px / 20px 的正文在雾白、黑曜和经典奶黄中均清晰，视觉重量明显低于标题和时间数字；单行仍精确垂直居中，两行自适应、四皮肤同几何和全部既有功能 QA 均通过。
- V3.4 最终 EXE 的雾白与黑曜截图和源码一致，成品 QA 为 `passed: true`。产物大小 89,541,338 字节，SHA-256 为 `1FD6DD559D772B686C2EE5B6307459381355238BC75D8FF5231BB82D138A664F`。
- 当前经典黄 `rgb(246,240,169)` 的最高/最低通道差为 77，黄色倾向仍较强。V3.5 目标采用 `rgb(249,247,220)`：整体更接近白色，通道差降至 29，同时保留轻微暖黄，不会与雾白完全混同。
- V3.5 源码截图中，浅奶黄比雾白略暖但不再呈明显柠檬黄；主面板、时间卡片和设置色板属于同一偏白奶油色阶，深色正文对比度保持清晰。
- 运行时在 50%/75%/100% 三档实测经典黄背景分别为 `rgba(249,247,220,0.5/0.75)` 与 `rgb(249,247,220)`，四皮肤透明度映射和全部既有功能继续通过。
- 最终 0.3.5 EXE 的浅奶黄截图与源码一致，成品 QA 为 `passed: true`。产物大小 89,541,540 字节，SHA-256 为 `DB6529510FC9C18891F339E3A7E56F7DACCFBBB7CD5D768AF74C0B77DA9577F7`。
- V3.6 最终确认稿要求：事项只比当前 13px 略小，采用 12.5px；时间采用约 12px 单行文本，显示 `08/12` 或 `14:44`，不再显示“日期”。
- 时间区的高级感不依赖新装饰，而来自等宽数字、右对齐、接近正文的字号、柔和色阶以及极克制的 hover 细线；常态必须无边框、无底色、无阴影、无图标。
- 空时间在静态状态不占视觉内容，但必须保留可点击热区；仅在事项行 hover/focus 时淡入“设置时间”，兼顾纯净与可发现性。
- V3.6 源码四皮肤截图确认：`08/12` 与 `14:44` 都以单行右对齐元数据呈现，无图标、无容器、无背景；12.5px 事项与 12px 时间的大小接近，雾白/黑曜/烟灰/浅奶黄保持同一几何。
- 移除 74×38 卡片后，事项正文横向空间增加 16px；58×36 的透明按钮仍提供稳定鼠标热区，视觉内容只占右侧约 40px。
- 最终源码 QA 增加真实空时间点击路径：透明热区尺寸不小于 56×34，点击后时间设置面板成功打开；整体结果 `passed: true`，未因极简视觉牺牲交互。
- 最终 0.3.6 EXE 的雾白、黑曜和浅奶黄截图与源码一致，成品 QA 为 `passed: true`。产物大小 89,541,396 字节，SHA-256 为 `F2F8D2C9FDFED6F6F9866916ED5B86EF426AE241784F5EF7D6843EB55F9B0ABF`。
- V3.7 的精确时间输入不能继续使用 `datetime-local`，因为 Windows 原生时间部分仍偏向滚轮/选择器；应拆成 `input[type=date]` 与普通文本时间输入，数据仍保存为兼容现有结构的 `YYYY-MM-DDTHH:mm`。
- 边缘 hover 不能直接调用现有永久 `restoreFromEdge`，否则丢失停靠状态、无法在移出后自动收回；需要主进程保留 `dockedEdge` 并增加独立 preview 状态与边缘全展开 bounds。
- 当前精确时间面板只有单个 `datetime-local`；拆分后应新增 `datetimeDateInput[type=date]` 与 `timeTextInput[type=text,inputmode=numeric]`，并在保存时重新组合 ISO 分钟值。
- 当前边缘状态只包含 `dockedEdge`，renderer 看到边缘即隐藏主面板。V3.7 需要额外公开 `edgePreviewed`，renderer 按 `dockedEdge && !edgePreviewed` 决定隐藏，主进程则在预览时将窗口移至贴边但完全位于工作区内的位置。
- hover 预览期间点击内容应在目标控件处理完 click 后永久恢复窗口；使用 app 冒泡阶段 click 处理比 pointerdown 更安全，避免窗口提前移动导致原目标丢失 click。
- V3.8 使用 Computer Use 观察到用户当前 0.3.7 窗口确实停靠在右侧：Windows 捕获范围仅 26×200，屏幕原点为 `(2528,485)`；侧边拉手真实可见且 UIA 可识别。
- 真实系统输入将光标送入拉手中央并停留 500ms 后，捕获范围仍为 26×200，未变为 300×200，成功复现“悬浮不展开”。上一轮 QA 直接调用 `previewFromEdge()`，没有走 DOM mouseenter/窗口移动/DOM mouseleave 的真实链路，因此是假阳性。
- 现有 renderer 方案在 `mouseenter` 中移动整个 BrowserWindow，随后依赖同一窗口内的 `mouseleave` 决定收回；Windows 对窗口位移会重置鼠标跟踪，容易在展开瞬间产生离开事件并立即回滚。应把驻留判定提升到主进程，使用 `screen.getCursorScreenPoint()` 与窗口/拉手屏幕矩形判断，而不是信任位移中的 DOM enter/leave 顺序。
- V3.8 主进程状态机采用 50ms 轮询、120ms 入场驻留和 220ms 离场宽限；拉手命中矩形严格与 CSS 的 26×68 可见区域一致。拖动贴边时先设为未 armed，只有光标离开拉手后再次进入才允许预览，避免释放拖动后立即反弹展开。
- renderer 的 `mouseenter`/`mouseleave` 与 preview/collapse IPC 已删除，消除了 BrowserWindow 位移和 DOM 鼠标跟踪之间的竞态；renderer 只负责按主进程下发的 `edgePreviewed` 状态切换视觉。
- V3.8 真实指针复测使用全新隔离 Electron 窗口：初始 Windows Graphics Capture 为 26×204（DWM 比逻辑高度多 4px），原点 `(2528,606)`；光标先移动到拉手外的窗口顶部完成 armed，再进入拉手中心并驻留 420ms 后，同一窗口捕获实际变为 300×200、原点移动至 `(2185,606)`。这证明系统光标已真实触发展开，不再是假阳性。
- 展开后的首张透明合成截图主要呈现桌面背景，尚需结合 UIA/后续截图确认 widget-shell 的渲染状态，再测试移出后的 26px 收回。
- 第三次真实指针复测再次从 26×203 展开到 300×200，说明主进程鼠标命中稳定；但展开后的 Windows 合成截图清楚透出其后方文档内容，未看到便签壳体，证明真实路径还有“窗口 bounds 已展开但 renderer 仍透明”的第二层缺陷。不能仅以窗口宽度判定最终通过。
- 真实移出测试使用独立 Notepad 窗口作为安全光标目标：光标离开便签 520ms 后，重新捕获同一 Electron 窗口从 300×200 回到 26×200、原点回到右侧 `(2528,758)`。因此主进程的 open/close 驻留时序均真实生效；剩余缺陷被收窄到 renderer 可见状态同步。
- 新增测试专用主/renderer 联合 trace 后，真实展开 180ms 的记录为：主进程 `dockedEdge=right`、`edgePreviewed=true`、bounds 约 300×201；renderer `edge=right`、`hiddenClass=false`、`previewClass=true`、`shellOpacity=1`、`handleDisplay=none`。因此事件与 CSS 状态同步均正确，屏幕仍透明的根因转为 Windows 透明 BrowserWindow 合成表面未及时重绘。
- 修复方向：状态切换后显式调用 `webContents.invalidate()` 并延迟再刷新一次；CSS 同时用 `visibility` 与独立合成层提示，避免仅 opacity 变化在窗口从屏外移入时留下旧透明表面。
- `invalidate()` + `visibility` 复测仍透明；最新 trace 同时确认 `shellVisibility=visible`、`shellBackground=rgba(21,24,29,0.88)`，说明 Chromium 样式与绘制树正确，但 DWM 的原生透明窗口表面未重新提交。下一层修复需短暂 hide → 移动 → showInactive/moveTop，强制重建 Windows 合成表面且不抢焦点。
- hide → setBounds/send state → 16ms 后 showInactive/moveTop 的真实复测成功：WGC 从 26×203 变为 300×200，并清楚显示黑曜便签的圆角外框、标题、计数、加号、设置、隐藏按钮与事项输入行，不再透出后方桌面。这是首个同时满足“真实系统光标触发 + 原生窗口展开 + 完整 UI 可见”的证据。
- 最终真实闭环：完整 UI 展开后，将系统光标移至独立空白 Notepad 并驻留 520ms，再捕获同一 Electron 窗口已回到 26×200；空白 Notepad 随后关闭。最终路径为 `26px → 真实 hover → 300px 完整 UI → 真实移出 → 26px`，全部来自 Windows 输入与 WGC，不调用内部 preview/collapse 函数。
- 最终 0.3.8 portable EXE 的真实 WGC 同样由 26×203 变为 300×200，黑曜外框、标题、按钮与空状态实际显示；证明透明表面重建逻辑已进入打包产物，非仅源码环境有效。
- 最终成品移出后再次捕获为 26×200，成品真实闭环完整通过。0.3.8 portable 大小 89,543,891 字节，SHA-256 为 `0FC5BAF70EB6383C004D0D9241E3391079946A14BB07D9B4C1157BB414F7B43C`。
- V3.9 当前四边拉手圆角均朝错方向：左侧当前圆左/平右、右侧圆右/平左、顶部圆上/平下、底部圆下/平上。正确映射应完全反转，让屏幕边缘侧无边框且平直，让靠桌面中央的一侧保留两个 9px 圆角。
- V3.9 已将四边样式镜像，并新增基于浏览器实际计算样式的运行时断言；验收不只匹配 CSS 文本，还会逐边核对四个角半径、贴屏侧边框宽度与 26px 隐藏位置。
- V3.9 四张源码截图目视确认：左侧拉手平左圆右、右侧圆左平右、顶部平上圆下、底部圆上平下，四个圆弧均朝桌面中央；箭头仍指向展开方向。源码完整 QA `passed: true`，悬浮展开状态机无回退。
- 最终 0.3.9 EXE 的四边截图与源码一致，成品 QA `passed: true`；便携版大小 89,544,370 字节，SHA-256 为 `85CE3BCE8FB90696C46BEF77509B62F80075F893E9A4F674C52BF666B556F359`。
- V3.10 回弹根因已收窄到主进程移动事件：`mainWindow.on('move')` 仅在 `!dockedEdge` 时记录位置，而折叠拉手被拖动时 `dockedEdge` 始终保留；因此拖动产生的 bounds 被忽略，旧停靠状态随后仍会把窗口计算回原侧边。
- 现有 `handleManualMoveFinished()` 也在 `dockedEdge` 存在时直接返回，意味着折叠态的原生窗口拖动从开始到结束都没有“解除停靠”入口；修复应在首次非程序化 move 时原子地清除旧边、恢复 renderer 可见态并继续普通移动判定。
- 折叠拉手本身是普通按钮且受全局 `button { -webkit-app-region: no-drag }` 约束；实际可拖路径是光标悬浮展开后按住标题栏 `.drag-surface`。该预览窗口仍保留 `dockedEdge`，正好解释“能拖走但最后回原边”的用户现象。
- 不需要改变拉手的点击/悬浮视觉；主进程应在第一条非托管 `move` 事件中将 preview 升级为普通窗口，保持当下完整 bounds 不跳位，再复用既有 `handleManualMoveFinished()` 完成“中央停留或近边重停靠”。
- V3.10 新增 `handleNativeWindowMove()`：只忽略与 `programmaticMoveTarget` 完全一致的 `setBounds` 事件；即使 220ms 托管窗口保护仍有效，只要实际 bounds 已偏离目标，就认定为用户拖动并立即调用 `undockForManualMove()`。
- 解除停靠只改变主进程状态与 renderer class，不主动重设当前窗口坐标，因此标题栏仍保持在光标下方，避免“开始拖动时跳一下”；后续 move/moved 继续更新 `normalBounds` 并执行已有 30px 靠边判定。
- V3.10 源码完整 QA `passed: true`：`undockByDragChecks` 的 left/right/top/bottom 均为 true，悬浮展开、四边隐藏、圆角朝中央和右侧越界重新停靠也全部保持通过。
- 自动 QA 通过托管目标偏离模拟第一帧用户拖动，覆盖了“拖得很快、仍处于 220ms 程序移动保护期”的边界；还需用 Computer Use 的真实 Windows `SendInput` 拖动验证原生标题栏链路。
- Computer Use 最终返回明确原因：测试窗标题栏的屏幕点 `(2240,595)` 实际位于 `ChatGPT.exe` 的 “Chrome Legacy Window” 之下，而非目标 Electron 窗口；安全规则禁止控制或移动 Codex/ChatGPT UI，因此真实 SendInput 验收在此环境不可执行，不能据此否定或宣称通过产品拖动。
- 可重复的源码 QA 已直接覆盖生产绑定的 `mainWindow.on('move', () => handleNativeWindowMove())` 状态函数，并同时验证 `moved` 后中央停留；最终成品仍需运行同一套 QA，用户安装 0.3.10 后可做真实桌面确认。
- `09-drag-undocked.png` 目视确认拖离后呈现完整 300×200 黑曜 UI：标题、三条事项、时间和滚动条均正常，折叠拉手消失，没有残留隐藏/preview 视觉状态。
- 最终 0.3.10 EXE 的 `undockByDragChecks` 四边均为 true，成品截图与源码一致且总 QA `passed: true`。便携版大小 89,545,184 字节，SHA-256 为 `5DBEC81CA116BAEB2C744B0D9A36A5D47F001F46300E86F7656D3F431D349868`。
- V3.11 当前主标题是 17px / 600 的中文“便签”，标题区与计数按 baseline 排列。`YYYY/MM/DD` 长度明显增加，采用 14px 数字字体、tabular numerals 和略收敛字距可保持右侧三个按钮及 300px 总宽度不变。
- 日期必须由本地 `Date` 分量生成，不能截取 `toISOString()`；后者按 UTC 计算，在本地午夜前后可能与用户实际日期不一致。
- V3.11 标题已改为语义化 `<time>`：显示 `YYYY/MM/DD`，`datetime` 同步为 `YYYY-MM-DD`；14px / 600 / tabular-nums 保留清晰度，又比原 17px “便签”更克制。
- 标题日期每 60 秒用本地日期分量刷新一次，窗口从隐藏状态恢复可见时也立即刷新；测试固定用本地构造的 `new Date(2026, 7, 12, 23, 59)`，避免依赖 UTC 或当前系统日期。
- 四皮肤源码截图目视确认：`2026/08/12` 与“8 条”基线协调，日期没有挤压加号、设置或隐藏按钮；14px 数字标题在雾白、黑曜、烟灰和浅奶黄中均清晰，且比原 17px 中文标题更精致克制。
- 源码完整 QA `passed: true`，新增 `headerDateWorks=true`；四皮肤同布局、时间输入、排序、滚动、侧边 hover、拖离不回弹及四边折叠继续全部通过。
- 最终 0.3.11 EXE 的黑曜截图与源码一致，日期、条数和右侧按钮层级清晰；成品 `headerDateWorks=true` 且总 QA `passed: true`。便携版大小 89,544,762 字节，SHA-256 为 `5A35978EE6BD01DB6A9ABC75516DD58BBD3DB6270B45B70BD53FDB7280462BA2`。
- V3.12 当前交付目标仅有 electron-builder `portable`，单文件约 89.5MB；构建目录同时已有 `win-unpacked`。二者应用代码相同，启动差值可以直接量化 portable 自解压开销。
- 主进程 `whenReady` 当前同步创建窗口、启动 hover 轮询、创建托盘、注册快捷键并重建菜单；页面本身为本地 HTML/CSS/JS、无网络请求，应用初始化预计不是秒级瓶颈，但仍可把非首帧必需工作延后。
- 用户截图中的残留内容可精确对应设置浮层底部：可见“组件大小 / 宽 / 300 / 应用”。HTML 中 `settingsPanel` 与 `schedulePanel` 是 `.widget-shell` 的同级节点，而现有 `.app.is-edge-hidden .widget-shell` 只隐藏主壳体，浮层不在选择器范围内。
- `applyWindowState()` 进入 `dockedEdge && !edgePreviewed` 时仅切换 class，从未调用 `closePanels()`；因此只要设置或时间浮层在收起前处于打开状态，它会继续渲染在已移出屏幕的透明窗口里，顶部/侧边仍可能露出一截。
- 修复需要双保险：renderer 在进入真正折叠态时关闭 panels/toast，CSS 同时对 hidden 状态下的 `.overlay-panel/.toast` 强制不可见；QA 应在打开设置和时间面板的情况下循环多次 preview/collapse，而不是只验证 `.widget-shell` opacity。
- 三轮可见窗口基准（同一 0.3.11 代码、隔离 userData）：portable 为 16933/16855/16928ms，平均 16905ms；`win-unpacked` 为 356/266/277ms，平均 300ms。已解压版本约快 56 倍，确认 98% 以上体感等待来自单文件自解压，而非便签业务代码。
- 因此不能承诺把同一个单文件 portable 优化到亚秒：其产品特性就是每次解包完整 Chromium/Electron。正确交付是并行提供 ZIP 快速版（用户只解压一次，后续直接运行内部 exe）与单文件便携版（零解压操作但启动慢）。
- 首帧后延迟托盘、hover 轮询和全局快捷键注册仍值得做，但基于 300ms unpacked 基准，它只属于几十毫秒级精修；核心收益来自发行格式改变。
- V3.12 renderer 进入 `hiddenAtEdge` 时同步关闭设置/时间浮层并清除 toast；CSS 对 `.widget-shell/.overlay-panel/.toast` 同时设置 opacity 0、visibility hidden、pointer-events none，保证状态层和样式层任一延迟都不会再露出浮层。
- `collapseEdgePreview()` 现在也使用 hide → 更新状态/bounds → 16ms 后 showInactive/moveTop，和展开路径一样重建透明窗口表面，防止 Windows DWM 在反复移屏时保留旧的设置面板合成纹理。
- 非首帧服务改为窗口 `ready-to-show` 后 120ms 初始化：托盘、全局快捷键与系统光标 hover 监视器不再竞争首次页面加载；renderer 与窗口状态 IPC 仍在首帧前准备好，不改变可见功能。
- 构建目标已扩展为 portable + zip。ZIP 内是与 `win-unpacked` 相同的预解压应用，数据路径和产品名不变，可继续读取既有本地便签。
- 0.3.12 源码 QA 的 6 轮设置/时间浮层交替收回结果全部为 true，`repeatedEdgeCollapseClean=true`；截图只显示顶部 68×26 拉手，透明画布内无设置字段、主面板或 toast 残留。
- 首帧后延迟服务回归正常：源码 QA 中 `trayReady=true`、`shortcutRegistered=true`、`edgeHoverRevealWorks=true`，说明 120ms 延迟没有造成永久缺失或交互回退。
- 新截图的异常堆栈明确落在 `captureWindow → console.log → Socket._write`，错误为 `EPIPE: broken pipe`；这不是 renderer 业务异常，而是 portable/GUI 子进程继承了已退出测试宿主的 stdout 管道后仍写 `QA_CAPTURE`。
- 当前 QA 每张截图都 `console.log`，结果落盘后又输出完整 `QA_RESULTS`；portable 启动器会早于实际 Electron 子进程退出，因此这种输出在成品自动 QA 中天然不可靠。QA 已有 PNG/JSON 文件作为完整证据，标准输出可以完全移除。
- 除移除 QA 输出外，还应给 `process.stdout/process.stderr` 注册 EPIPE error listener，防止未来任一依赖或异常日志在 GUI 父管道断开时升级为 Electron “A JavaScript error occurred in the main process” 弹窗。
- EPIPE 修复后的源码 QA 不再产生任何 `QA_CAPTURE/QA_RESULTS` 控制台文本，但 PNG 与 `qa-results.json` 全部正常落盘；`passed=true`、6 轮收回全 true，且没有生成 `qa-error.txt`。
- 当前系统复查没有标题为 Error 的残留进程；此前弹窗来自旧的 0.3.12 测试实例，最终产物重新构建后才可交付。
- 实际交付 ZIP 解压后运行完整 QA `passed=true`，6 轮浮层收回全 true、无 `qa-error.txt`，且启动宿主早于子进程结束也没有 Error 对话框；说明 ZIP 文件本体及 EPIPE 防护均有效。
- 最终 portable 在相同“宿主先退出、子进程继续 QA”路径下也 `passed=true`、6 轮全 true、无错误文件和 Error 对话框，原截图中的 broken pipe 已可重复证明根治。
- 最终三轮可见窗口基准：实际 ZIP 解压版 310/294/296ms，平均 300ms；portable 4827/4912/5093ms，平均 4944ms。快速版约快 16.5 倍；portable 的冷启动仍可能因首次自解压与安全扫描接近用户此前的十几秒体验。
- 最终 ZIP 成品的重复收回截图只剩顶部 68×26 拉手，主界面、设置/时间浮层和 toast 均无残留；与用户截图中的露出区域形成直接对照。
- 最终 ZIP 为 139,530,149 字节，SHA-256 `66F37C503ECD34BB58F02AE7DB16E1B7302A6F2BE325A019D99280D4DAEF474F`；portable 为 89,546,106 字节，SHA-256 `D8136DB8FC4F259210D5992CF1946BF1D94A5660D99FA0BBD78E63AED9C31038`。两者已写入校验文件，结束时无 0.3.12 测试或 Error 对话框进程。
- Electron Builder 26.15.3 的 portable 启动器会向应用注入 `PORTABLE_EXECUTABLE_FILE`、`PORTABLE_EXECUTABLE_DIR` 与 `PORTABLE_EXECUTABLE_APP_FILENAME`；开机启动必须优先使用 `PORTABLE_EXECUTABLE_FILE`，否则 `process.execPath` 会指向临时解压目录并在重启后失效。
- Windows 的有效自启动状态不能只看 `openAtLogin`；同时检查 `executableWillLaunchAtLogin` 才能反映用户是否在任务管理器/系统设置中禁用了该启动项。
- V3.13 将系统状态延迟到打开设置面板时读取，不在首帧启动路径增加注册表查询；首次读取期间开关禁用，更新失败时恢复实际状态并给出 toast。
- V3.13 源码隔离 QA 已验证自启动 `关闭 → 开启 → 关闭`、设置底部滚动可见性和 31×17 开关尺寸；模拟层确保测试不会写入真实 Windows 启动项。
- V3.13 的源码、实际 ZIP 解压版和 portable 成品 QA 均完整通过；最终注册表只读复查确认没有名为“桌面便签”的测试启动项，说明默认关闭且 QA 隔离有效。
- 0.3.13 ZIP 为 139,531,973 字节，SHA-256 `ABDC96274553A8FDF78789B4D71CD7992A011D6E243E73DCB29C6EE5ACACCA85`；portable 为 89,547,429 字节，SHA-256 `5762B692E47257DC6BA7E4CA5B9EEA22C442C142105B17AF1919A6F17EBAAB12`。
- 用户在 0.3.13 雾白皮肤中开启自启动后，开关回到关闭，行内提示与 toast 同时显示“Windows 未能更新开机自启动设置”；界面本身正常，问题集中在主进程写入后的即时校验。
- 截图后只读检查 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 与 `Explorer\StartupApproved\Run`，没有名称或命令路径匹配“桌面便签”的条目；当前运行的是解压版 `release\桌面便签-0.3.13-x64\桌面便签.exe`。
- 0.3.13 的成功判定要求 `openAtLogin && executableWillLaunchAtLogin` 立即同时为真。由于最终没有 Run 项，除了 StartupApproved 状态滞后外，还需验证 Electron 在当前 Windows 构建上是否接受显式中文 `name` 与 `enabled` 组合。
- Electron 官方文档要求 `getLoginItemSettings` 使用与 set 相同的 `path`/`args`，并说明 `launchItems[].enabled` 直接表示启动项是否获 StartupApproved 启用；当前代码的参数传递符合文档。
- 独立可回滚探针使用唯一中文名称和最终 EXE 路径：写入后从立即、250ms 到 1000ms，`openAtLogin` 始终为 false，但 `executableWillLaunchAtLogin=true`，且 `launchItems` 始终包含路径/参数完全匹配、`scope=user`、`enabled=true` 的条目；删除后匹配项与 executable 状态均恢复为空/false。
- 根因因此确定为 Electron 43 在自定义 Windows 启动项名称下的 `openAtLogin` 假阴性，而非写入权限、中文路径或状态传播延迟。可靠真值应以 `launchItems` 中“名称、规范化路径、参数均匹配且 enabled=true”的条目为准，并仅将旧布尔字段作为兼容回退。
- V3.14 精确解析器的系统探针闭环通过：新增后即解析为 `{enabled:true, registered:true}`；模拟任务管理器禁用后为 `{enabled:false, registered:true}`；重新启用恢复 true；删除后为 `{enabled:false, registered:false}`。全过程中 Electron 的 `openAtLogin` 仍为 false，进一步确认修复绕过了错误字段但保留真实禁用语义。
- 两次系统探针结束后，Run 与 StartupApproved 中 `桌面便签-QA-*` 条目数量均为 0，没有留下测试启动项。
- 0.3.14 ZIP 为 139,532,661 字节，SHA-256 `182301EBF8DE9758803299D8008C241912D11E9EC94CD15FCA9521A67935A152`；portable 为 89,547,600 字节，SHA-256 `3EFF2E5CB6BF1384C1FA671CFD9EC4ADE658264E9CF00399B844DE0441E5D271`。
- V3.14 设置滚动故障截图中，固定的 `.overlay-header` 也已离开可视区，而 CSS 设计上只有 `.settings-content` 应滚动；皮肤卡片从顶部被裁掉、组件大小下方却留下大块空白，提示实际滚动目标可能是外层 `.overlay-panel`/视口，而不是预期内容容器。
- 修复验收需同时记录外层面板和 `.settings-content` 的 `scrollTop`：向下滚动后内容容器应大于 0、向上后应回到 0，外层面板在全程必须保持 0；关闭重开也应从顶部开始。
- V3.15 将外层 `.overlay-panel` 从仍可被程序化滚动的 `overflow:hidden` 改为非滚动容器 `overflow:clip`，内层增加 `overscroll-behavior-y:contain`；renderer 在打开、关闭和异常外层 scroll 时归零，形成 CSS 与状态双保险。
- 原生 Electron wheel 回归实测：底部聚焦时 `panelScrollTop=0`、`contentScrollTop=108/109`；四次向上滚轮后为 `0/0`；关闭重开仍为 `0/0` 且 headerVisible=true。恢复截图完整显示“设置”标题、皮肤卡片和顶部滚动条位置。
- 0.3.15 最终源码、ZIP 与 portable 均用 8 个原生 wheel 刻度验证 `contentScrollTop 108 → 0`、`panelScrollTop=0`、重开 `0/0`、headerVisible=true，三组完整 QA 均通过。
- 0.3.15 ZIP 为 139,533,282 字节，SHA-256 `C38E3D3CD300FD6D4B4A6DE4B2F3E68168448BB5D96BE6F9F249D28AE71D5E6D`；portable 为 89,548,180 字节，SHA-256 `00432DE710DD9EC3A2694DD7374C85F25540C121D7352100EEC79DB473D77BA9`。
- V3.16 暂存工作区采用用户指定的第一版 300×200 示意图：标题栏保留日期、事项/暂存切换和原有操作按钮；暂存列表由图片缩略图或文本标记、标题/元数据、创建时间及行内操作组成。
- 用户明确要求暂存项也保留六点排序手柄，因此默认新内容置顶后仍允许手动拖动；排序结果必须落盘，不能每次启动重新按创建时间覆盖。
- 已确认的首版导入边界：窗口激活且不在编辑控件内时，Ctrl+V 自动判断剪贴板图片、图片文件或文字；另外支持文件选择与图片拖入。图片格式先覆盖 PNG/JPEG/WebP/GIF/BMP，不接入 OCR、云同步或任意附件。
- 暂存内容默认长期保留至手动删除；图片点击打开应用内预览，并提供复制、另存、删除，文字可直接编辑。图片原始字节和缩略图应放在 Electron `userData/staging`，避免 localStorage 膨胀。
- 现有 renderer 是无框架单页结构：事项状态在 `desktop-notes:v3` localStorage，`renderItems()` 基于 `<template>` 重绘，六点手柄原生 drag/drop 并支持 Alt+↑/↓；暂存列表可复用同一排序语义，但索引真值需经 IPC 落盘。
- 当前 preload 只暴露窗口、自启动和主进程事件，CSP 的 `img-src` 仅允许 self/data；暂存图片需要新增最小权限桥接，并通过自定义 `staging-image://` 协议或安全数据读取显示，不能直接放宽为任意 `file:`。
- 主界面标题仍是“日期 + 条数”，实现暂存切换时需在日期与标题操作区之间加入紧凑的“事项 / 暂存 N”导航，同时让加号在当前工作区执行对应动作。
- 现有壳体固定 `48px` 标题栏、余下列表区，事项行最小高 `50px`，非常适合在 300×200 下显示三行；暂存图片行可保持相同节奏，通过 40×34 左右缩略图、两级文字与右侧操作压缩到约 58px，并继续使用统一滚动条。
- 四皮肤都由同一组材质变量驱动，暂存 UI 应只引用 `--text/--text-soft/--line/--accent/--hover-fill` 等令牌，避免为图片工作区另造颜色而破坏统一透明度和布局。
- 边缘折叠 CSS 已统一隐藏 `.widget-shell`、全部 overlay 和 toast；新增图片预览 overlay 只要沿用 `.overlay-panel` 即可自动继承折叠清理，但 renderer 的 `closePanels()` 仍需显式复位预览状态。
- BrowserWindow 已启用 `contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`，因此所有磁盘与原生剪贴板操作必须留在主进程，经 preload 暴露限定参数的 invoke API；renderer 不应获得路径遍历或任意文件读取能力。
- Electron 主进程已有 `fs/path/nativeImage` 且 QA 使用隔离 `userData`，可在不增加依赖的情况下完成索引、原图写入、缩略图生成和端到端测试；文件对话框、剪贴板及协议注册只需从 Electron 增量引入。
- 现有自动 QA 会调用 renderer `window.__desktopQa.runFunctionalChecks()` 并把必需布尔项汇总到 `qa-results.json`；V3.16 可加入暂存创建/编辑/排序/删除/协议预览检查，同时在 QA userData 中写入可清理的合成 PNG，避免触碰用户真实暂存数据。
- V3.16 首次真实 Electron 启动没有 renderer/main 异常，原有完整 QA 仍 `passed:true`；说明新存储初始化、协议注册、CSP 和扩展 preload 没有破坏四皮肤、设置滚动或四边折叠。
- 雾白皮肤实拍中 300×200 标题栏已稳定容纳“2026/08/13 / 事项 8 / 暂存 0 / 加号 / 设置 / 隐藏”，按钮和日期没有裁切；工作区选中线清晰，事项正文与时间布局保持原样。
- V3.16 QA 将在隔离 userData 中用 Canvas 生成两张小型 PNG，组成“图片 / 文字 / 图片”三项暂存展示；这既能验证真实图片协议、滚动和预览，又不依赖仓库外素材或读取用户剪贴板。
- 自动复制与另存测试在 QA 模式下不会改写系统剪贴板或弹出文件对话框：主进程返回复制成功并把另存副本落到 QA 目录；生产路径仍调用 Electron 原生 clipboard/dialog。
- 新增端到端暂存回归全部通过：三项创建、三只排序手柄、滚动、文字编辑持久化、排序持久化、删除、复制、另存、`staging-image://` 缩略图/原图和应用内预览均为 true；既有设置滚动与边缘折叠仍通过。
- 300×200 雾白实拍与确认稿一致：标题显示“事项 8 / 暂存 3”，每行左侧有六点手柄，图片采用圆角缩略图，名称/尺寸格式与时间形成清晰两级信息，文字项直接编辑；列表内容超出后出现细滚动条。
- 预览浮层在同一组件内完成，原图按比例居中于轻微棋盘纹理上，底部只保留尺寸格式、复制和另存；没有额外窗口或背景色块破坏整体透明材质。
- V3.16 最终源码、实际 ZIP 解压版和 portable 三组完整 QA 均 `passed:true`；四皮肤暂存布局一致、图片协议/预览/排序/编辑/删除/复制/另存通过，6 轮浮层收回与四边隐藏通过且无 `qa-error.txt`。
- 0.3.16 ZIP 为 139,546,992 字节，SHA-256 `15D3FCBD9889112CC680347555407129CC3562303785D146FEB7F6A38D75F5D1`；portable 为 89,560,392 字节，SHA-256 `8612030D96DFAE8230D6FC1B9C62E295AE6BF7A025C41C7A75440A8F1C7ECCE7`。
- 最终校验重新计算两份成品哈希并与 `release/SHA256SUMS.txt` 比对成功；临时 ZIP 解压测试副本已安全删除，保留源码/ZIP/portable 三组 QA 结果与视觉截图。
- V3.17 用户提供的参考长图为窄而高的文档截图（约 278×513）；将它压进 300×200 主组件只能得到难以阅读的缩略效果，因此应由独立悬浮预览窗按自然比例或显示器上限缩放，确保整图可见。
- 标题栏左上六点仅是装饰，真正拖动由 `.drag-surface {-webkit-app-region:drag}` 提供；删除点阵不影响拖动，只需让日期区域继续保留 drag region 并收紧左侧间距。
- 当前图片预览是主组件内 `.overlay-panel`，受 `inset:8px` 和 300×200 边界硬限制；替换为单独 sandbox BrowserWindow 后，主组件的边缘折叠应主动关闭预览窗，避免再出现浮层残留。
- 暂存项的复制、另存、删除能力已经在主进程存在，原生右键菜单可以直接复用这些函数；删除后需把最新 snapshot 返回 renderer 刷新列表，其他动作返回明确 action 供 toast 反馈。
- 独立悬浮预览最终按当前显示器工作区与原图宽高计算窗口，本轮 278×513 长图实测生成 360×602 预览窗，完整图像区域使用 `object-fit:contain`，既没有裁切也没有改变 300×200 主组件。
- 暂存右键操作放在主进程原生 `Menu` 中更符合 Windows 习惯，也能复用已有受控存储 API；文字另存为 `.txt`，图片保持原格式，不向 renderer 暴露文件路径。
- 悬浮预览必须随组件侧边收回和托盘隐藏主动关闭，仅依赖 renderer DOM 清理不足以约束独立窗口；最终在所有窗口生命周期和暂存删除路径统一调用关闭函数。
- V3.17 最终源码、ZIP 解压成品和 portable 三组完整 QA 均 `passed:true`；长图预览、右键动作、空待办直接删除、6 轮侧边清理以及四边隐藏均通过。
- 0.3.17 ZIP 为 139,552,374 字节，SHA-256 `27A0248B7C63D71E29C6DF3D1658335DEEA23BDF62F1BC59A02E7612EC74B456`；portable 为 89,564,720 字节，SHA-256 `D1DAB4E6D47A3ECB32D87A1C147C2C23363C80BA30A78DA1BDB92D0B83E6A6D4`。
