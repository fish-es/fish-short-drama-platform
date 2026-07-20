import { ChatMessage, chatCompletion } from './agnes.service'

const OUTLINE_SYSTEM_PROMPT = `你是一个专业的短剧编剧AI助手。用户会给你一个故事想法，你需要将其扩展为一部完整的短剧大纲。

短剧特点：十几集到几十集，每集30-60秒，每集有独立的悬念或反转，让观众想看下一集。

你必须以JSON格式输出，结构如下：
{
  "title": "剧名",
  "synopsis": "整部剧的简介（2-3句话）",
  "totalEpisodes": 15,
  "characters": [
    {
      "name": "角色名",
      "description": "角色描述",
      "keywords": "角色外貌关键词（中文，描述性别、年龄、发型、发色、服装、体型等）",
      "voiceId": "从音色列表中选择"
    }
  ],
  "locations": [
    {
      "name": "地点名",
      "description": "地点描述",
      "keywords": "场景关键词（中文，描述环境、光线、氛围等）"
    }
  ],
  "episodes": [
    {
      "number": 1,
      "title": "本集标题",
      "summary": "本集剧情摘要（2-3句话，包含悬念或反转点）"
    }
  ]
}

可选音色列表（根据角色性别和性格选择）：
- zh-CN-XiaoxiaoNeural: 年轻女性，温柔甜美
- zh-CN-XiaoyiNeural: 年轻女性，活泼可爱
- zh-CN-YunjianNeural: 成年男性，沉稳有力
- zh-CN-YunxiNeural: 年轻男性，阳光活力
- zh-CN-YunxiaNeural: 少年男性，清澈稚嫩
- zh-CN-YunyangNeural: 成年男性，正式权威
- zh-CN-liaoning-XiaobeiNeural: 女性，东北口音，豪爽直率
- zh-CN-shaanxi-XiaoniNeural: 女性，陕西口音，朴实亲切

要求：
- 所有内容都用中文
- totalEpisodes 根据故事复杂度决定（10-30集）
- 每集的 summary 要有明确的情节推进和悬念/反转
- episodes 要覆盖完整的故事弧线（开头、发展、高潮、结局）
- characters 数量根据集数合理安排：3-5集需要3-5个角色，10集需要5-8个角色，20集以上需要8-12个角色。每个角色 keywords 详细描述外貌特征
- characters 的 voiceId 从音色列表中选择
- locations 数量根据集数合理安排：3-5集需要2-4个场景，10集需要4-6个场景，20集以上需要6-10个场景。每个地点 keywords 详细描述环境
- 不要只列主要角色和场景，配角和次要场景也要列出，确保视觉丰富度
- 只输出JSON，不要输出其他内容`

const EPISODE_SYSTEM_PROMPT = `你是一个专业的短剧编剧AI助手。根据提供的大纲信息，为指定的一集生成详细的分镜场景。

每集时长30-60秒，需要5-10个场景。

你必须以JSON格式输出，结构如下：
{
  "scenes": [
    {
      "description": "画面描述（中文，详细描述画面内容，包括人物动作、表情、场景环境、光线、镜头角度等）",
      "dialogue": "这个场景角色说的台词（纯台词内容，不要带角色名前缀）",
      "characters": ["出场角色名"],
      "location": "地点名",
      "duration": 5
    }
  ]
}

要求：
- 所有内容用中文
- 场景数量5-10个
- 每个场景3-8秒，总时长控制在30-60秒
- description 必须详细描述：1.角色具体动作 2.面部表情 3.身体姿态 4.与其他角色的互动 5.镜头角度 6.环境光线
- dialogue 是纯台词文本，禁止写成"角色名：台词"的格式
- 每个场景必须指定 location 和 characters
- 剧情要紧凑，节奏快，结尾留悬念
- 只输出JSON，不要输出其他内容`

export interface ParsedOutline {
  title: string
  synopsis: string
  totalEpisodes: number
  characters: Array<{ name: string; description: string; keywords: string; voiceId: string }>
  locations: Array<{ name: string; description: string; keywords: string }>
  episodes: Array<{ number: number; title: string; summary: string }>
}

export interface ParsedEpisodeScenes {
  scenes: Array<{
    description: string
    dialogue: string
    characters: string[]
    location: string
    duration: number
  }>
}

function fixJsonString(raw: string): string {
  let fixed = raw
  fixed = fixed.replace(/:\s*([^"\[\]{},\d\s\-][^,\}\]]*?)(\s*[,\}\]])/g, ': "$1"$2')
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
  return fixed
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(fixJsonString(raw))
    } catch {
      throw new Error('AI 返回的内容不是有效的 JSON 格式，请重试')
    }
  }
}

export function parseOutlineResponse(content: string): ParsedOutline {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 返回内容中未找到有效的 JSON')

  const parsed = safeJsonParse(jsonMatch[0])
  if (!parsed.episodes || !Array.isArray(parsed.episodes) || parsed.episodes.length === 0) {
    throw new Error('大纲缺少有效的集数列表')
  }

  return {
    title: parsed.title || '未命名短剧',
    synopsis: parsed.synopsis || '',
    totalEpisodes: parsed.totalEpisodes || parsed.episodes.length,
    characters: (parsed.characters || []).map((c: any) => ({
      name: c.name || '',
      description: c.description || '',
      keywords: c.keywords || '',
      voiceId: c.voiceId || 'zh-CN-XiaoxiaoNeural'
    })),
    locations: (parsed.locations || []).map((l: any) => ({
      name: l.name || '',
      description: l.description || '',
      keywords: l.keywords || ''
    })),
    episodes: parsed.episodes.map((e: any, i: number) => ({
      number: e.number || i + 1,
      title: e.title || `第${i + 1}集`,
      summary: e.summary || ''
    }))
  }
}

export function parseEpisodeScenesResponse(content: string): ParsedEpisodeScenes {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 返回内容中未找到有效的 JSON')

  const parsed = safeJsonParse(jsonMatch[0])
  if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('缺少有效的场景列表')
  }

  for (const scene of parsed.scenes) {
    scene.duration = scene.duration || 5
    scene.characters = scene.characters || []
    scene.location = scene.location || ''
    scene.dialogue = scene.dialogue || ''
    scene.description = scene.description || ''
  }

  return { scenes: parsed.scenes }
}

export async function generateOutline(prompt: string, apiKey: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ]
  return chatCompletion(messages, apiKey)
}

export async function generateEpisodeScenes(
  outline: ParsedOutline,
  episodeNumber: number,
  previousSummary: string,
  apiKey: string
): Promise<string> {
  const episode = outline.episodes.find(e => e.number === episodeNumber)
  if (!episode) throw new Error(`未找到第 ${episodeNumber} 集`)

  const charList = outline.characters.map(c => `${c.name}（${c.keywords}）`).join('\n')
  const locList = outline.locations.map(l => `${l.name}（${l.keywords}）`).join('\n')

  const userContent = `整部剧名：${outline.title}
整部剧简介：${outline.synopsis}

角色列表：
${charList}

地点列表：
${locList}

${previousSummary ? `前情提要：${previousSummary}\n` : ''}
当前集数：第 ${episodeNumber} 集
本集标题：${episode.title}
本集剧情摘要：${episode.summary}

请根据以上信息，生成本集的详细分镜场景。`

  const messages: ChatMessage[] = [
    { role: 'system', content: EPISODE_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
  return chatCompletion(messages, apiKey)
}
