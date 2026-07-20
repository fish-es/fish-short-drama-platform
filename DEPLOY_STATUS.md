# 短剧开发平台 — 当前状态说明

## 项目位置

- **本地 Web 版（Next.js）**: `C:\Users\HT\Desktop\fish-short-drama-platform\`
- **本地 Electron 版（旧）**: `C:\Users\HT\short-drama-platform\`
- **服务器**: `~/fish-short-drama-platform/`（已解压，但 Node 版本不对）

## 当前状态

### ✅ 已完成
- Next.js 全栈项目（前后端一体）
- 本地 `npm run build` 通过
- 本地 `npm run dev` 可运行（http://localhost:3000）
- 所有核心功能已迁移（大纲生成、分集、图片、视频、合成、资产库）
- 图片/视频存 Agnes URL（服务器零存储）
- FFmpeg 合成时临时下载 → 浏览器自动下载成片
- Dockerfile 已有

### ❌ 待解决
- 服务器 Node.js 版本太旧（v14，需要 v20+）
- 决定用 Docker 部署（不需要手动装 Node/FFmpeg）

## Docker 部署步骤（回家后继续）

### 1. 本地确认 Docker 可用
服务器上运行：
```bash
docker --version
```

### 2. 上传项目到服务器
已经在 `~/fish-short-drama-platform/`

### 3. 构建 Docker 镜像
```bash
cd ~/fish-short-drama-platform
docker build -t fish-drama .
```

### 4. 运行
```bash
docker run -d -p 3000:3000 -v ~/fish-drama-data:/app/data --name fish-drama fish-drama
```

### 5. 访问
`http://服务器IP:3000`

## 当前 Dockerfile 内容
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

## 需要注意的点

1. **Docker build 会比较慢**（下载 node_modules + 构建），首次约 3-5 分钟
2. **数据持久化**：用 `-v ~/fish-drama-data:/app/data` 挂载数据目录，数据库不会因容器重启丢失
3. **端口**：默认 3000，可改 `-p 80:3000` 映射到 80 端口直接用 IP 访问
4. **sql-wasm.wasm**：已放在 `public/` 目录，Docker 内可用
5. **上传的 zip 内有 node_modules**：Docker build 时会忽略（.dockerignore），建议加一个 `.dockerignore`

## 建议加 .dockerignore（加速构建）

在项目根目录创建 `.dockerignore`：
```
node_modules
.next
data
dist
*.zip
```

## 后续优化

- [ ] 推到 GitHub
- [ ] 加域名 + HTTPS（nginx 反向代理）
- [ ] pm2 或 docker restart always 保证服务不中断
