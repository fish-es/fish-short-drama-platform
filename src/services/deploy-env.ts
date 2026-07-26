export interface DeployInfo {
  env?: string
  pr?: number
  branch?: string
}

export interface DeployEnvBadge {
  label: string
  badgeClass: string
}

// 环境徽章四档映射：正式 / 测试 / 预览 / 本地（issue #22）。
// 优先读部署流水线写入的 env 字段；旧版 deploy-info.json 没有 env，按 pr/branch 兜底推断。
export function getDeployEnv(info: DeployInfo | null | undefined): DeployEnvBadge {
  const env =
    info?.env ??
    (info?.pr != null
      ? 'preview'
      : info?.branch === 'main'
        ? 'production'
        : info?.branch === 'dev'
          ? 'dev'
          : null)

  switch (env) {
    case 'production':
      return { label: '正式环境', badgeClass: 'badge-green' }
    case 'dev':
      return { label: '测试环境', badgeClass: 'badge-blue' }
    case 'preview':
      return { label: '预览环境', badgeClass: 'badge-yellow' }
    default:
      return { label: '本地环境', badgeClass: 'badge-gray' }
  }
}
