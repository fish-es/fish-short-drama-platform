# Fish Studio — V5 设计系统文档

> 所有设计 Token 和 CSS 类定义在 `src/app/globals.css`。本文件是快速参考手册。

---

## 1. 设计 Token

### 颜色

| 变量 | 值 | 用途 |
|------|------|------|
| `--color-bg` | `#FAF7F2` | 页面背景（暖米白） |
| `--color-surface` | `#F3EFE8` | 卡片/面板背景 |
| `--color-surface-alt` | `#EDE8E0` | 输入框背景、hover 态 |
| `--color-border` | `#DDD7CD` | 边框、分割线 |
| `--color-text` | `#2C2416` | 正文文字（深褐） |
| `--color-text-secondary` | `#8C8275` | 次要文字（标签、描述） |
| `--color-text-tertiary` | `#B5AB9E` | 辅助文字（时间戳、占位符） |
| `--color-accent` | `#C7512E` | 主色（砖红），按钮/链接/选中态 |
| `--color-accent-hover` | `#A84325` | 主色 hover |
| `--color-accent-soft` | `#F5E6DE` | 主色浅底（badge、高亮背景） |
| `--color-success` | `#4A7C59` | 成功状态 |
| `--color-success-bg` | `#DEE8DF` | 成功状态背景 |
| `--color-warning` | `#C29B3A` | 警告状态 |
| `--color-error` | `#C0392B` | 错误状态 |
| `--color-error-bg` | `rgba(192,57,43,0.08)` | 错误状态背景 |
| `--bg-overlay` | `rgba(44,36,22,0.5)` | 模态框遮罩 |

### 字体

| 变量 | 值 | 用途 |
|------|------|------|
| `--font-display` | `Georgia, 'Times New Roman', serif` | 标题、项目名、品牌名 |
| `--font-sans` | `'Segoe UI', -apple-system, sans-serif` | 正文、按钮、表单 |
| `--font-mono` | `'Consolas', 'Courier New', monospace` | 代码、令牌 |

### 圆角

| 变量 | 值 | 用途 |
|------|------|------|
| `--radius-sm` | `4px` | 按钮、badge、小元素 |
| `--radius-md` | `8px` | 输入框、卡片、面板 |
| `--radius-lg` | `16px` | 模态框、大卡片 |

### 阴影

| 变量 | 值 | 用途 |
|------|------|------|
| `--shadow-sm` | `0 1px 2px rgba(44,36,22,0.06)` | 轻微浮起 |
| `--shadow-md` | `0 4px 12px rgba(44,36,22,0.08)` | 卡片、下拉 |
| `--shadow-lg` | `0 8px 30px rgba(44,36,22,0.12)` | 模态框、弹层 |

### 布局

| 变量 | 值 | 用途 |
|------|------|------|
| `--sidebar-w` | `200px` | 侧边栏固定宽度 |

---

## 2. 布局组件

### 侧边栏 `.sidebar`

```html
<nav class="sidebar">
  <div class="sidebar-brand">
    <div class="sidebar-logo">F</div>
    <span class="sidebar-brand-text">Fish Studio</span>
  </div>
  <div class="sidebar-nav">
    <button class="active"><span class="icon">▶</span><span>项目</span></button>
  </div>
  <div class="sidebar-bottom">
    <button><span class="icon">?</span><span>教程</span></button>
  </div>
</nav>
```

- 固定宽度 200px，深色背景 `#2C2416`，全高 `100vh`
- `.sidebar-nav button.active` — 砖红色文字 + 半透明背景
- `.sidebar-bottom` — 底部区域，`margin-top: auto` 自动贴底

### 主内容区 `.main-content`

- `margin-left: 200px`（避开侧边栏）
- `display: flex; flex-direction: column; height: 100vh`

### 顶栏 `.topbar`

```html
<div class="topbar">
  <div class="topbar-left">
    <span class="topbar-bc">短剧开发平台 <span class="sep">/</span> 项目工作台</span>
    <span class="badge badge-green">正式环境</span>
  </div>
  <div class="topbar-right">
    <button class="btn-sm">API Key</button>
  </div>
</div>
```

- 高度 56px，底部边框，flex 两端对齐
- `.topbar-bc` 面包屑，`.topbar-bc .sep` 分隔符
- `.topbar-bc a` 可点击链接，hover 变主色

### 内容区 `.page-content`

- `padding: 28px; flex: 1; overflow-y: auto`
- 所有页面内容放在此处

### 子导航 `.subnav`

```html
<div class="subnav">
  <button class="subnav-tab active">剧本创作</button>
  <button class="subnav-tab">资产库</button>
  <div class="subnav-spacer" />
</div>
```

- Tab 使用下划线风格，`.active` 时下划线变主色

---

## 3. 按钮体系

| 类名 | 外观 | 用途 |
|------|------|------|
| `.btn-accent` | 实心砖红，白字 | 主操作（创建、提交、生成） |
| `.btn-outline` | 线框，hover 变主色 | 次要操作（取消、编辑） |
| `.btn-sm` | 小型线框按钮 | topbar 操作按钮 |
| `.btn-ghost-sm` | 无边框文字按钮 | 行内操作（设为公开） |
| `.btn-danger` | 红色线框 | 删除操作 |
| `.btn-success` | 绿色浅底 | 保存操作 |
| `.btn-accent-sm` | 小型实心砖红 | 紧凑主操作 |

```html
<button class="btn-accent">创建项目</button>
<button class="btn-outline">取消</button>
<button class="btn-danger">删除</button>
```

---

## 4. 表单组件

### 输入框 `.input-field`

```html
<input class="input-field" placeholder="输入项目名称" />
<select class="input-field"><option>9:16</option></select>
```

- 背景 `--color-surface-alt`，边框 `--color-border`
- `:focus` 时边框变主色 + 3px 阴影

### 字段容器 `.field`

```html
<div class="field">
  <label>项目名称</label>
  <input class="input-field" />
</div>
```

- `label` 字号 11px，颜色 `--color-text-secondary`

### 创建表单 `.create-form`

```html
<div class="create-form">
  <div class="field">...</div>  <!-- 1.4fr 名称 -->
  <div class="field">...</div>  <!-- 0.8fr 类型 -->
  <div class="field">...</div>  <!-- 0.8fr 比例 -->
  <div class="field">...</div>  <!-- 0.8fr 集数 -->
  <div class="field">...</div>  <!-- 0.9fr 模板 -->
  <button class="btn-accent">创建</button>  <!-- auto -->
</div>
```

- CSS Grid 布局，响应式下自动变单列

---

## 5. 卡片与列表

### 项目列表行 `.project-row`

```html
<div class="project-row">
  <div class="pr-left">
    <div>封面</div>
    <span class="project-name">霸总替身复仇记</span>
    <div class="project-meta">
      <span>9:16</span>
      <span>短剧</span>
    </div>
  </div>
  <div class="pr-right">
    <button class="btn-ghost-sm">设为公开</button>
    <button class="btn-outline">打开</button>
    <button class="btn-danger">删除</button>
  </div>
</div>
```

- flex 两端对齐，hover 背景变 `--color-surface`
- `.project-name` 使用 `--font-display`
- `.project-meta span` 带浅色背景 pill

### 信息卡片 `.info-card`

```html
<div class="info-card">
  <h4>更新日志</h4>
  <div class="cl-item">
    <span class="cl-date">2024/1/1</span>
    内容文字
  </div>
</div>
```

- 背景 `--color-surface`，无圆角，无边框
- `.cl-item` 底部边框分割
- `.fb-item` 反馈项，`.fb-status.open` / `.fb-status.closed` 状态标签

### 底部双栏 `.home-bottom`

```html
<div class="home-bottom">
  <div class="info-card">更新日志</div>
  <div class="info-card">问题与建议</div>
</div>
```

- CSS Grid `1fr 1fr`，响应式下变单列

---

## 6. 模态框

```html
<div class="modal-overlay">
  <div class="modal">
    <h3>标题</h3>
    <p>描述文字</p>
    <!-- 表单内容 -->
    <div class="modal-footer">
      <button class="btn-outline">取消</button>
      <button class="btn-accent">确认</button>
    </div>
  </div>
</div>
```

- `.modal-overlay` — 全屏遮罩 `rgba(44,36,22,0.5)`，flex 居中
- `.modal` — 白底卡片，圆角 16px，最大宽度 560px
- `.modal-footer` — 右对齐按钮组

---

## 7. 徽章系统

```html
<span class="badge badge-green">正式环境</span>
<span class="badge badge-blue">测试环境</span>
<span class="badge badge-yellow">预览环境</span>
<span class="badge badge-gray">本地环境</span>
```

| 类名 | 颜色 | 用途 |
|------|------|------|
| `.badge-green` | 绿色 | 正式环境、成功状态 |
| `.badge-blue` | 砖红浅底 | 测试环境、信息标签 |
| `.badge-yellow` | 黄色 | 预览环境、警告 |
| `.badge-gray` | 灰色 | 本地环境、默认 |

环境徽章使用 `getDeployEnv(deployInfo)` 函数（`src/services/deploy-env.ts`）自动映射。

---

## 8. 动画

| 类名 | 效果 | 用途 |
|------|------|------|
| `.animate-enter-up` | 从下方 12px 淡入上移 | 页面区块入场 |
| `.animate-enter-scale` | 从 97% 缩放淡入 | 弹窗、卡片入场 |
| `.delay-050` | 延迟 0.05s | 入场错位 |
| `.delay-100` | 延迟 0.1s | 入场错位 |
| `.delay-150` | 延迟 0.15s | 入场错位 |

```html
<div class="page-hero animate-enter-up">立即入场</div>
<div class="create-section animate-enter-up delay-050">延迟 50ms 入场</div>
```

- 支持 `prefers-reduced-motion: reduce`，自动禁用动画

---

## 9. 响应式

`@media (max-width: 900px)` 断点行为：

| 组件 | 行为 |
|------|------|
| `.sidebar` | `display: none`（隐藏侧边栏） |
| `.main-content` | `margin-left: 0`（全宽） |
| `.page-content` | `padding: 20px`（缩小内边距） |
| `.create-form` | `grid-template-columns: 1fr`（单列） |
| `.home-bottom` | `grid-template-columns: 1fr`（单列） |
| `.script-view` | `flex-direction: column`（垂直堆叠） |
| `.idea-panel` | `width: 100%; border-bottom`（全宽 + 底部边框） |

---

## 10. 使用示例

```tsx
export default function ExamplePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">F</div>
          <span className="sidebar-brand-text">Fish Studio</span>
        </div>
        <div className="sidebar-nav">
          <button className="active"><span className="icon">▶</span><span>项目</span></button>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-bc">短剧开发平台</span>
            <span className="badge badge-gray">本地环境</span>
          </div>
          <div className="topbar-right">
            <button className="btn-sm">设置</button>
          </div>
        </div>

        <div className="page-content">
          <div className="page-hero animate-enter-up">
            <h1>页面标题</h1>
            <p>副标题描述</p>
          </div>

          <div className="create-section animate-enter-up delay-050">
            <h3>表单区</h3>
            <div className="create-form">
              <div className="field">
                <label>名称</label>
                <input className="input-field" placeholder="输入..." />
              </div>
              <button className="btn-accent">提交</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 规则总结

1. **不硬编码颜色** — 统一使用 `var(--color-*)` CSS 变量
2. **不使用 Tailwind v3 `@apply`** — Tailwind v4 用 `@import "tailwindcss"` + CSS 变量
3. **字体用变量** — `var(--font-display)` / `var(--font-sans)` / `var(--font-mono)`
4. **按钮用类名** — `.btn-accent` / `.btn-outline` / `.btn-danger` 等，不用内联 style
5. **间距用固定值** — padding/margin 用 px，不引入额外间距变量
