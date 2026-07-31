'use client'

import { chatCompletion } from './agnes.client'

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
- characters 数量根据集数合理安排：3-5集需要3-5个角色，10集需要5-8个角色，20集以上需要8-12个角色
- locations 数量根据集数合理安排：3-5集需要2-4个场景，10集需要4-6个场景，20集以上需要6-10个场景
- 不要只列主要角色和场景，配角和次要场景也要列出
- 只输出JSON，不要输出其他内容`

const VIDEO_OUTLINE_SYSTEM_PROMPT = `你是一个专业的影视编剧AI助手。用户会给你一个想法，你需要将其扩展为一部【完整独立】的长视频剧本大纲。

长视频特点：这是一个完整的作品，只有一集，必须有完整的起承转合（开端、发展、高潮、结局）。绝对不能留悬念到"下一集"，因为没有下一集。故事必须在这一集内讲完整、有明确结局。

你必须以JSON格式输出，结构如下：
{
  "title": "作品名",
  "synopsis": "整个故事的完整简介（2-3句话，包含结局走向）",
  "totalEpisodes": 1,
  "characters": [
    { "name": "角色名", "description": "角色描述", "keywords": "角色外貌关键词（中文，性别、年龄、发型、发色、服装、体型等）", "voiceId": "从音色列表中选择" }
  ],
  "locations": [
    { "name": "地点名", "description": "地点描述", "keywords": "场景关键词（中文，环境、光线、氛围等）" }
  ],
  "episodes": [
    { "number": 1, "title": "作品标题", "summary": "完整剧情概要（详细描述开端→发展→高潮→结局的完整弧线，不留悬念）" }
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
- totalEpisodes 必须为 1（这是一个完整作品，不分集）
- episodes 数组只能有 1 个元素，其 summary 必须包含完整的故事弧线和明确结局
- 故事必须完整、自洽、有始有终，禁止使用"欲知后事""下集揭晓""留下悬念"等表述
- characters 3-6 个，locations 2-5 个，配角和次要场景也要列出
- 只输出JSON，不要输出其他内容`

const VIDEO_EPISODE_SYSTEM_PROMPT = `你是一个专业的影视编剧AI助手。根据提供的完整故事大纲，为这部长视频生成详细的分镜场景。

这是一个【完整作品】，必须把整个故事从开端到结局完整拍出来，覆盖起承转合的每个阶段。

你必须以JSON格式输出，结构如下：
{
  "scenes": [
    { "description": "画面描述（中文，详细描述画面内容、镜头景别）", "speaker": "本场景说话的角色名（必须是出场角色之一；无人说话填空字符串）", "dialogue": "该场景说话角色的台词（纯台词，不带角色名前缀）", "characters": ["出场角色名"], "location": "地点名", "duration": 6 }
  ]
}

要求：
- 所有内容用中文
- 【场景数量非常重要】必须生成足够多的场景以填满目标总时长，见下方用户给出的目标时长和建议场景数
- 每个场景 4-8 秒
- 分镜要覆盖完整故事：开端铺垫、矛盾发展、高潮转折、结局收尾，节奏张弛有度
- description 详细描述角色动作、表情、环境、镜头角度
- speaker 必须准确填写本场景开口说话的角色名，且必须是 characters 中的角色之一
- 一个场景只让一个角色说话，保证口型和台词对得上
- dialogue 是纯台词，禁止写成"角色名：台词"格式
- 结尾必须是完整结局，禁止留悬念
- 只输出JSON，不要输出其他内容`

const EPISODE_SYSTEM_PROMPT = `你是一个专业的短剧编剧AI助手。根据提供的大纲信息，为指定的一集生成详细的分镜场景。

每集时长30-60秒，需要5-10个场景。

你必须以JSON格式输出，结构如下：
{
  "scenes": [
    {
      "description": "画面描述（中文，详细描述画面内容，包括镜头景别）",
      "speaker": "本场景说话的角色名（必须是出场角色之一；如果本场景无人说话，填空字符串）",
      "dialogue": "这个场景说话角色的台词（纯台词内容，不要带角色名前缀）",
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
- description 详细描述角色动作、表情、环境、镜头角度
- speaker 必须准确填写本场景开口说话的角色名，且必须是 characters 中的角色之一
- 一个场景只让一个角色说话，保证口型和台词对得上
- 有对白的场景，尽量用该角色的单人镜头或让说话者处于画面中心
- dialogue 是纯台词，禁止写成"角色名：台词"格式
- 剧情紧凑，节奏快，结尾留悬念
- 只输出JSON，不要输出其他内容`

export interface ParsedOutline {
  title: string
  synopsis: string
  totalEpisodes: number
  characters: Array<{ name: string; description: string; keywords: string; voiceId: string }>
  locations: Array<{ name: string; description: string; keywords: string }>
  episodes: Array<{ number: number; title: string; summary: string }>
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
      name: c.name || '', description: c.description || '', keywords: c.keywords || '', voiceId: c.voiceId || 'zh-CN-XiaoxiaoNeural'
    })),
    locations: (parsed.locations || []).map((l: any) => ({
      name: l.name || '', description: l.description || '', keywords: l.keywords || ''
    })),
    episodes: parsed.episodes.map((e: any, i: number) => ({
      number: e.number || i + 1, title: e.title || `第${i + 1}集`, summary: e.summary || ''
    }))
  }
}

export function parseEpisodeScenesResponse(content: string): { scenes: any[] } {
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
    scene.description = scene.description || ''
    const rawDialogue = (scene.dialogue || '').trim()
    const speaker = (scene.speaker || '').trim()
    // Persist speaker as a prefix ("角色名：台词") so video generation knows who speaks
    if (rawDialogue && speaker && !/^[一-龥\w]+[：:]/.test(rawDialogue)) {
      scene.dialogue = `${speaker}：${rawDialogue}`
    } else {
      scene.dialogue = rawDialogue
    }
  }
  return { scenes: parsed.scenes }
}

export async function generateOutline(prompt: string, apiKey: string, projectType: string = 'drama'): Promise<string> {
  const messages = [
    { role: 'system', content: projectType === 'video' ? VIDEO_OUTLINE_SYSTEM_PROMPT : OUTLINE_SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ]
  return chatCompletion(messages, apiKey)
}

export async function generateEpisodeScenes(
  outlineContent: string, episodeNumber: number, previousSummary: string, apiKey: string,
  opts: { projectType?: string; targetDuration?: number } = {}
): Promise<string> {
  const outline = parseOutlineResponse(outlineContent)
  const episode = outline.episodes.find(e => e.number === episodeNumber)
  if (!episode) throw new Error(`未找到第 ${episodeNumber} 集`)

  const charList = outline.characters.map(c => `${c.name}（${c.keywords}）`).join('\n')
  const locList = outline.locations.map(l => `${l.name}（${l.keywords}）`).join('\n')

  const isVideo = opts.projectType === 'video'
  const targetDuration = opts.targetDuration || 0

  let durationHint = ''
  if (isVideo && targetDuration > 0) {
    // ~6s per scene; ensure enough scenes to fill the target duration
    const sceneCount = Math.max(8, Math.ceil(targetDuration / 6))
    durationHint = `\n【目标总时长：${targetDuration} 秒（约 ${(targetDuration / 60).toFixed(1)} 分钟）】
【必须生成约 ${sceneCount} 个场景】每个场景 4-8 秒，所有场景时长相加要接近 ${targetDuration} 秒。场景数量不足会导致视频太短，务必生成足够多的场景把完整故事铺满整个时长。\n`
  }

  const userContent = isVideo
    ? `作品名：${outline.title}
作品完整简介：${outline.synopsis}

角色列表：
${charList}

地点列表：
${locList}

完整剧情概要：${episode.summary}
${durationHint}
请根据以上信息，把这个完整故事（开端→发展→高潮→结局）拆解成详细分镜场景。这是一个完整作品，结尾必须有明确结局，不留悬念。`
    : `整部剧名：${outline.title}
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

  const messages = [
    { role: 'system', content: isVideo ? VIDEO_EPISODE_SYSTEM_PROMPT : EPISODE_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
  return chatCompletion(messages, apiKey)
}
