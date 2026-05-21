# Phase-Notes · 04 · Editor Integration (TipTap)

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions §4 N-Ed](./00-Decisions.md#4-n-ed-系列--编辑器决策) · [01-Data-Model §3.1 body_json](./01-Data-Model.md#31-notev2扩展既有表) · [03-Frontend-WU §5 WU-FN4](./03-Frontend-WU.md#5-wu-fn4--tiptap-editor-notesid)
> **SSOT 声明**：本文是 TipTap 编辑器集成实现的唯一技术参考。与 00-Decisions N-Ed 系列冲突时以 00-Decisions 为准。

---

## 1. TipTap 架构概览

### 1.1 Headless 架构

TipTap 核心逻辑与 UI 完全解耦：

- **核心层**：ProseMirror 文档模型（Schema → Node/Mark）、事务系统、状态管理
- **视图层**：`@tiptap/react` 提供 `<EditorContent />` + `useEditor` hook
- **扩展系统**：所有功能通过 Extension 注册，无内置 UI

工具栏/菜单由我们实现（`EditorToolbar.tsx`），编辑器只负责文档状态和渲染。

### 1.2 ProseMirror 基础

| 层 | 职责 | TipTap API |
|---|---|---|
| `prosemirror-model` | Schema、Node/Mark 类型、文档树 | `addNodes()` / `addMarks()` |
| `prosemirror-state` | EditorState、Transaction、Plugin | `addProseMirrorPlugins()` |
| `prosemirror-view` | DOM 渲染、事件监听 | `<EditorContent />` + NodeView |
| `prosemirror-transform` | 文档变换（可逆步骤） | `editor.chain()` commands |

### 1.3 Extension 系统

- **Node Extension**：块级/行内节点（heading, image, codeBlock）
- **Mark Extension**：行内标记（bold, italic, highlight）
- **Generic Extension**：功能增强（CharacterCount, Placeholder, History）

生命周期：`onCreate` → `onUpdate` → `onTransaction` → `onDestroy`

---

## 2. P1 扩展配置详细

基于 N-Ed-2，完整配置：

```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,            // P2 用 CodeBlockLowlight 替代
    }),
    Image.configure({
      inline: false,               // 块级图片
      allowBase64: false,          // 强制走上传流程
      HTMLAttributes: { class: 'note-image', loading: 'lazy' },
    }),
    Highlight.configure({
      multicolor: false,           // P1 单色高亮
      HTMLAttributes: { class: 'note-highlight' },
    }),
    Placeholder.configure({
      placeholder: '开始写笔记...', // SSOT: ui-copy
      emptyEditorClass: 'is-editor-empty',
    }),
    CharacterCount,                // 无上限，仅统计（社区 ≥50 字校验在业务层）
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: '-',
      linkify: true,
      breaks: false,
      transformPastedText: true,   // 粘贴 Markdown 自动解析
      transformCopiedText: true,   // 复制时转 Markdown
    }),
  ],
});
```

字数获取：`editor.storage.characterCount.characters()` → `EditorBottomBar`。

---

## 3. 自定义 Node/Mark

**P1 结论：不需要。**

| 需求 | 覆盖方 | 自定义必要性 |
|---|---|---|
| 富文本格式 | StarterKit | 无 |
| 图片 | @tiptap/extension-image | 无 |
| 高亮 | @tiptap/extension-highlight | 无 |
| Markdown 互操作 | tiptap-markdown | 无 |

设计原则：
- 优先官方扩展，避免维护自定义代码
- 如需自定义：继承扩展 class 并 override（不 fork）
- NodeView 仅在需要 React 渲染（公式预览等）时使用 `ReactNodeViewRenderer`

P2 Mathematics/KaTeX 可能需要自定义 NodeView，但 P1 无需预埋。

---

## 4. body_json ↔ body_text 转换管道

### 4.1 extract_text 算法

```typescript
function extractText(doc: TipTapDocument): string {
  const parts: string[] = [];
  function walk(node: TipTapNode): void {
    if (node.type === 'text') { parts.push(node.text ?? ''); return; }
    if (node.type === 'image') { if (node.attrs?.alt) parts.push(node.attrs.alt); return; }
    if (node.type === 'hardBreak') { parts.push('\n'); return; }
    if (node.content) node.content.forEach(walk);
    const blocks = ['heading', 'paragraph', 'listItem', 'blockquote', 'codeBlock'];
    if (blocks.includes(node.type)) parts.push('\n');
  }
  if (doc.content) doc.content.forEach(walk);
  return parts.join('').trim();
}
```

规则：text 直拼 → image 用 alt 兜底 → heading/paragraph 尾部换行 → mark 信息忽略。

### 4.2 执行时机

- **写入时**：PUT/POST handler 同步计算 body_text + word_count
- **迁移**：旧笔记 body → body_text 直接复制（无 body_json 时）

### 4.3 word_count 规则

```python
def compute_word_count(body_text: str) -> int:
    cjk_count = sum(1 for c in body_text if '\u4e00' <= c <= '\u9fff')
    non_cjk = re.sub(r'[\u4e00-\u9fff]', ' ', body_text)
    return cjk_count + len(non_cjk.split())
```

---

## 5. body_json ↔ Markdown 转换

### 5.1 导出

```typescript
const markdown = editor.storage.markdown.getMarkdown();
```

格式：`# ` 标题 / `- ` 列表 / `**bold**` / `*italic*` / `==highlight==` / `![alt](src)` / `---`

### 5.2 Edge Cases

| 场景 | 处理 |
|---|---|
| 图片相对路径 | 保持 `/uploads/notes/...`；zip 包内转相对路径 |
| 嵌套列表 | 2 空格缩进 |
| 高亮 | `==text==` 双向兼容 |
| 空段落 | 导出为空行 |

### 5.3 导入（Markdown → body_json）

```typescript
editor.commands.setContent(markdownString);
// transformPastedText 自动解析
```

老数据路径：用户首次打开旧笔记 → `body` 通过 `setContent` 加载 → 保存写入 `body_json`。

---

## 6. body_json ↔ HTML 转换

用途：导出 API / 社区笔记只读渲染 / 邮件预览。

```typescript
import { generateHTML } from '@tiptap/html';
function bodyJsonToHtml(bodyJson: TipTapDocument): string {
  return generateHTML(bodyJson, [
    StarterKit.configure({ codeBlock: false }), Image, Highlight,
  ]);
}
```

后端备选（Python 自定义 walker）：node_map 映射 AST → 语义 HTML 标签。

输出规范：语义标签 / 图片拼完整 URL / 无内联样式 / XSS sanitize（DOMPurify/bleach）。

---

## 7. content_hash 计算

用于 AI 摘要缓存键（N-AI-7）：`(note_id, content_hash)` → 笔记未变则复用 LLM 结果。

```python
import hashlib, json
def compute_content_hash(body_json: dict) -> str:
    canonical = json.dumps(body_json, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.blake2b(canonical.encode('utf-8'), digest_size=32).hexdigest()
```

规范化规则：

| 规则 | 原因 |
|---|---|
| `sort_keys=True` | 消除 key 顺序不确定性 |
| `separators=(',', ':')` | 消除空格差异 |
| `ensure_ascii=False` | 中文直接输出 |
| 保留 null | attrs nullable 字段不剥离 |

执行：笔记保存时计算存入 `NoteV2.content_hash`。BLAKE2b-256 碰撞概率 2^128 级，完全安全。

---

## 8. 图片上传集成

### 8.1 Upload Handler

```typescript
async function uploadImage(file: File, noteId: number | null): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  if (noteId) formData.append('note_id', String(noteId));
  // 端点为全局 /notes/images（非 note-scoped），支持 note 未保存时上传（BR-N4-5）
  const res = await apiClient.post<{ file_path: string }>(
    `/api/v2/notes/images`, formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.file_path;
}
```

### 8.2 触发流程

| 方式 | 事件 |
|---|---|
| 拖拽 | `editorProps.handleDrop` → `DataTransfer.files` |
| 粘贴 | `editorProps.handlePaste` → `clipboardData.files` |
| 按钮 | `<input type="file">` → 选择后上传 |

### 8.3 Placeholder During Upload

上传中：插入占位 image node（灰色 SVG + `data-uploading=true`）→ 成功后替换 `src` → 失败移除节点 + toast。

### 8.4 错误处理

| 场景 | 处理 |
|---|---|
| >5MB | 客户端拦截 toast |
| 格式不支持 | 客户端拦截 toast |
| 网络错误 | 移除占位 + toast "上传失败" |
| ≥20 张上限 | 客户端拦截 toast |

约束对齐 01-Data-Model §3.3：单张 ≤5MB / png,jpg,gif,webp / 每笔记 ≤20 张 / 路径 `/uploads/notes/{user_id}/{uuid}.{ext}`。

---

## 9. 性能优化

### 9.1 编辑器隔离

- `useEditor` 内部 useRef 持有实例，不放 React state
- `TipTapContent` 用 `React.memo` 包裹
- 工具栏通过 `editor.on('selectionUpdate')` 监听状态，不依赖父 re-render
- 字数统计用 `requestAnimationFrame` 节流

### 9.2 扩展懒加载

P1 轻量无需懒加载。P2 扩展（Table/Math/CodeBlock）按需 `lazy(() => import(...))`，根据文档 AST 检测是否包含对应 node type。

### 9.3 大文档处理（≤50KB JSON）

| 策略 | 说明 |
|---|---|
| 上限 | body_json ≤ 50KB（约 2 万字） |
| 超限 | EditorBottomBar 显示警告 |
| 虚拟化 | P1 不做（50KB ProseMirror 流畅） |
| 保存 | debounce 3s 发完整 body_json |

---

## 10. 移动端适配

### 10.1 Touch Toolbar

- 工具栏固定键盘上方（`position: sticky; bottom: 0`）
- 按钮 44×44px 触摸区域 + `touch-action: manipulation`
- 超宽水平滚动（`overflow-x: auto`）

### 10.2 Viewport Resize

```typescript
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const handle = () => {
    document.documentElement.style.setProperty(
      '--editor-height', `${vv.height - TOOLBAR_H - TOPBAR_H}px`
    );
  };
  vv.addEventListener('resize', handle);
  return () => vv.removeEventListener('resize', handle);
}, []);
```

### 10.3 Scroll-into-View

编辑器 focus 时延迟 100ms（等键盘弹出）执行 `editor.commands.scrollIntoView()`。

---

## 11. 测试策略

### 11.1 单元测试（转换器）

| 目标 | 用例数 |
|---|---|
| `extractText()` | 8-10 |
| `computeContentHash()` | 4-5 |
| `bodyJsonToHtml()` | 6-8 |
| `computeWordCount()` | 5-6 |

### 11.2 集成测试（Editor Mount）

| 目标 | 说明 |
|---|---|
| Editor 初始化 | useEditor 加载扩展正确 |
| 工具栏操作 | Bold 按钮 → 文本加粗 |
| 自动保存 | debounce 3s 触发 PUT |
| 图片上传 | MSW mock → 上传 → 插入 |
| Dirty state | 编辑→dirty / 保存→clean |

### 11.3 E2E（Save Flow）

- 创建笔记流程（新建→输入→自动保存→列表可见）
- 编辑持久化（修改→刷新验证）
- 图片拖拽上传
- 离开未保存确认弹窗
- Markdown 导出验证

### 11.4 覆盖率目标

转换器 ≥95% / Editor hooks ≥80% / UI ≥70% / E2E 5 条核心路径。

---

## 12. P2 扩展路线

### 12.1 Table

- 用途：知识对比表格
- 前置：`@tiptap/extension-table` + table-row + table-header + table-cell
- body_json 新增 `table`/`tableRow`/`tableHeader`/`tableCell` nodes
- Markdown 导出支持 GFM table

### 12.2 Mathematics / KaTeX

- 用途：数量关系公式（C(n,k)、概率等）
- 前置：`katex` + KaTeX CSS（~150KB，必须 code-split）
- 渲染：`ReactNodeViewRenderer` 公式预览
- 输入：`$...$` 行内 / `$$...$$` 块级

### 12.3 CodeBlockLowlight

- 用途：逻辑推理伪代码
- 前置：`lowlight` + 按需注册语言（python, javascript）
- 替代 StarterKit 内置 codeBlock（P1 已禁用）

---

## 13. 引用矩阵

| 本文档引用 | 章节 |
|---|---|
| [00-Decisions](./00-Decisions.md) §4 N-Ed-1~7 | 全文 |
| [00-Decisions](./00-Decisions.md) §10 N-AI-7 | §7 content_hash |
| [01-Data-Model](./01-Data-Model.md) §3.1 body_json | §4, §5, §6 |
| [01-Data-Model](./01-Data-Model.md) §3.3 NoteImageV2 | §8 |
| [03-Frontend-WU](./03-Frontend-WU.md) §5 WU-FN4 | §2, §8, §9, §10 |

| 本文档被引用 |
|---|
| [03-Frontend-WU](./03-Frontend-WU.md) §5 WU-FN4 实现细节 |
| [05-AI-Summary](./05-AI-Summary.md) content_hash + extractText |
| [06-Testing](./06-Testing.md) 编辑器测试清单 |
| [README.md](./README.md) §技术文档索引 |
