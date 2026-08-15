# 桌面便签

一块默认 **420×340**、轻量透明的 Windows 桌面便签。待办与图文暂存共用同一窗口，内容只保存在本机，完全离线。

## 下载

到 [GitHub Releases](https://github.com/nirrra/desktop-note/releases/latest) 下载最新版：

- **推荐** [`desktop-note-0.3.21-x64.zip`](https://github.com/nirrra/desktop-note/releases/download/v0.3.21/desktop-note-0.3.21-x64.zip)：解压一次后双击 `桌面便签.exe`，后续启动更快
- 或 [`desktop-note-0.3.21-x64.exe`](https://github.com/nirrra/desktop-note/releases/download/v0.3.21/desktop-note-0.3.21-x64.exe)：单文件便携版，无需解压，但每次启动会慢一些

可用同目录的 `SHA256SUMS.txt` 校验完整性。当前构建没有商业代码签名，Windows 首次运行可能提示“未知发布者”，属预期现象。

## 已实现

- 中性灰、暖白纸、石墨、雾面、编辑、侘寂六款皮肤；可调窗口透明度、正文字号（12–20）和大小
- 待办就地编辑、自动保存；空待办单击删除，有内容的待办需二次确认
- 列表底部固定「新建待办 / 上传图片」；也支持 `Ctrl + N`
- 拖动手柄排序，或 `Alt + ↑/↓`
- 时间可分别选择日期与时刻，均可留空；只选时刻则只显示时刻，两个都空则时间为空。时刻可直接键入 `14:44` 或 `1444`
- 暂存文字、图片和文件路径：`Ctrl + V`、拖入或点击添加；图片仍复制到本机暂存目录，其他文件只记路径并用默认程序打开；光标停在图标上可悬浮预览
- 四边吸附隐藏；托盘、置顶、可选开机自启动；`Ctrl + Shift + Space` 唤回

## 开发运行

```powershell
pnpm install
pnpm start
pnpm check
pnpm dist
```

## 数据位置

待办、排序、皮肤、透明度和字号保存在 Electron 本地存储键 `desktop-notes:v3`；暂存索引、原图和缩略图保存在应用的 `userData/staging`；窗口位置、大小、边缘隐藏和置顶状态保存在 `userData/window-state.json`。开机自启动由 Windows 当前用户启动项管理。清理应用数据前请先复制重要便签和暂存素材。
