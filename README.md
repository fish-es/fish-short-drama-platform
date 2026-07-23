# AI 短剧生成平台

一个基于 AI 的短剧自动生成工具。输入一个创意，自动生成剧本、分镜、画面、视频，最终合成完整短剧。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **前端状态**: Zustand
- **样式**: Tailwind CSS
- **数据库**: sql.js (SQLite WASM)
- **AI 接口**: Agnes AI (文本/图片/视频生成)
- **视频合成**: FFmpeg
- **部署**: Docker + GitHub Actions CI/CD

## 功能

- AI 生成完整剧本大纲（人物、场景、分集）
- 自动生成每集分镜场景
- AI 图片生成（场景画面，支持 9:16 / 16:9 / 1:1）
- AI 视频生成（中文对白，自动计算时长）
- 自动流水线（图片→视频，失败自动重试）
- FFmpeg 合成成片 + 字幕
- 邮箱账户登录与多用户数据隔离
- 资产库管理（角色/场景参考图）

## 本地运行

```bash
npm install
npm run dev
```

访问 http://localhost:3000，注册账户并设置你的 Agnes API Key 即可使用。

## 账户与会话

- 密码在服务端使用 `scrypt` 加盐哈希后保存。
- 登录会话保存在数据库中，浏览器只接收 `HttpOnly` Cookie，有效期为 30 天。
- 可通过 `ADMIN_EMAILS` 环境变量设置管理员邮箱，多个邮箱使用逗号分隔。
- 数据目录默认是项目下的 `data`，可通过 `FISH_DATA_DIR` 覆盖。
- 生产环境 Cookie 默认只允许 HTTPS；仅在本地以生产模式运行 HTTP 时，可设置 `AUTH_COOKIE_SECURE=false`。

## API Key

本项目使用 [Agnes AI](https://agnes-ai.com) 的 API 服务：
- 对话模型: agnes-2.0-flash
- 图片生成: agnes-image-2.0-flash
- 视频生成: agnes-video-v2.0

注册 Agnes AI 账号后，在控制台创建 API Key。新用户有免费额度。
API Key 存储在浏览器 localStorage 中，仅在模型调用和旧项目迁移时发送，服务端不会持久化保存。

## Docker 部署

```bash
docker build -t fish-drama .
docker run -d -p 3000:3000 -v ~/fish-drama-data:/app/data --name fish-drama fish-drama
```

## 如何贡献

我们欢迎任何水平的开发者参与贡献。

### 找到要做的事

1. 查看 [Issues](../../issues) 里有没有感兴趣的问题
2. 在正式环境的"问题与建议"栏看用户反馈
3. 自己跑项目，发现 bug 或有改进想法

确定后，在 Issues 里新建一条（或在已有 Issue 下留言"我来解决"），等待分配。

**注意**: 新建前先看看有没有类似的、未关闭的 Issue，避免重复开发。

### 开发流程

1. **Fork** 本仓库到你的账号
2. **Clone** 到本地
   ```bash
   git clone https://github.com/你的用户名/仓库名.git
   cd 仓库名
   npm install
   npm run dev
   ```
3. **创建功能分支**
   ```bash
   git checkout -b feature/你的功能描述
   ```
4. **开发并自测**，确保本地运行正常
5. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 简要描述你做了什么"
   git push origin feature/你的功能描述
   ```

### 提交 PR

1. 来到本仓库，点击 "New Pull Request"
2. 选择 base 分支为 `dev`，compare 为你的功能分支
3. **第一次提交**：标题写 `test`，等待自动部署到预览环境
4. 机器人会评论预览地址，点进去验证你的功能
5. 验证通过后，**编辑 PR**：
   - 标题改为 Issue 编号，如 `fix #12` 或 `feat #15`
   - 描述里写清楚你解决了什么问题
   - 附上功能截图
6. 等待审核，通过后合并到 dev

### PR 规范

- 目标分支始终是 `dev`，不要直接 PR 到 `main`
- 一个 PR 只解决一个问题
- commit message 格式：`feat:` / `fix:` / `refactor:` / `docs:` + 简短描述
- 附上截图或 GIF 演示效果

### 分支说明

| 分支 | 用途 |
|------|------|
| `main` | 正式环境，定期从 dev 合并 |
| `dev` | 开发环境，PR 目标分支 |
| `feature/*` | 功能开发分支 |

## 部署架构

| 环境 | 端口 | 触发条件 |
|------|------|---------|
| Production | 3000 | push 到 main |
| Development | 3001 | push 到 dev |
| Preview | 3002 | PR 到 dev |

## 项目结构

```
src/
├── app/              # Next.js App Router
│   ├── api/          # API 路由
│   │   ├── project/  # 项目 CRUD
│   │   ├── script/   # 剧本生成
│   │   ├── episode/  # 分集生成
│   │   ├── scene/    # 场景图片生成
│   │   ├── video/    # 视频生成
│   │   ├── ffmpeg/   # 视频合成
│   │   ├── asset/    # 资产库
│   │   ├── feedback/ # 问题反馈
│   │   └── changelog/# 更新日志
│   └── page.tsx      # 入口页面
├── components/       # React 组件
├── services/         # 服务层
│   ├── agnes.service.ts   # AI API 调用
│   ├── db.service.ts      # 数据库
│   ├── script.service.ts  # 剧本逻辑
│   ├── api.client.ts      # 前端 API 客户端
│   ├── retry.ts           # 重试机制
│   └── user.service.ts    # 用户标识
└── store/            # Zustand 状态管理
```

## License

MIT
