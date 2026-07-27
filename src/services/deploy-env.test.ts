import { describe, expect, it } from 'vitest'
import { getDeployEnv } from './deploy-env'

describe('getDeployEnv', () => {
  it('env 字段优先：production → 正式环境', () => {
    expect(getDeployEnv({ env: 'production', branch: 'main' })).toEqual({
      label: '正式环境',
      badgeClass: 'badge-green',
    })
  })

  it('env 字段优先：dev → 测试环境', () => {
    expect(getDeployEnv({ env: 'dev', branch: 'dev' })).toEqual({
      label: '测试环境',
      badgeClass: 'badge-blue',
    })
  })

  it('env 字段优先：preview → 预览环境', () => {
    expect(getDeployEnv({ env: 'preview', pr: 33 })).toEqual({
      label: '预览环境',
      badgeClass: 'badge-yellow',
    })
  })

  it('无 deploy-info（本地 npm run dev）→ 本地环境', () => {
    expect(getDeployEnv(null)).toEqual({ label: '本地环境', badgeClass: 'badge-gray' })
    expect(getDeployEnv(undefined)).toEqual({ label: '本地环境', badgeClass: 'badge-gray' })
  })

  it('未知 env 值回退为本地环境', () => {
    expect(getDeployEnv({ env: 'staging' })).toEqual({ label: '本地环境', badgeClass: 'badge-gray' })
  })

  it('旧格式无 env：pr 字段 → 预览环境', () => {
    expect(getDeployEnv({ pr: 12 })).toEqual({ label: '预览环境', badgeClass: 'badge-yellow' })
  })

  it('旧格式无 env：branch=main → 正式环境', () => {
    expect(getDeployEnv({ branch: 'main' })).toEqual({ label: '正式环境', badgeClass: 'badge-green' })
  })

  it('旧格式无 env：branch=dev → 测试环境', () => {
    expect(getDeployEnv({ branch: 'dev' })).toEqual({ label: '测试环境', badgeClass: 'badge-blue' })
  })
})
