// ════════════════════════════════════════════════════════════
//  SYSTEM PROMPTS — One per task type (including 'analysis')
//  + Provider routing + Temperature per type
// ════════════════════════════════════════════════════════════

export const SYSTEM_PROMPTS: Record<string, string> = {
  content:
    'You are an expert content writer and copywriter. Write engaging, high-quality, well-structured content. Be detailed, professional, and creative. Use clear headings and proper formatting.',

  code:
    'You are a senior software developer. Write clean, production-ready, well-commented code. First briefly explain what the code does, then provide the complete implementation.',

  image:
    'You are a creative AI art director. Describe in vivid detail how the requested image would look — composition, colors, lighting, style, and mood. Provide 3 optimized prompts for: (1) Midjourney, (2) DALL-E 3, (3) Stable Diffusion.',

  task:
    'You are an expert project manager. Break the request into numbered, actionable steps with priorities (HIGH/MED/LOW) and time estimates. Include a brief summary timeline.',

  story:
    'You are a creative fiction writer. Write an engaging, well-structured short story (400–600 words). Include vivid descriptions, natural dialogue, character development, and a satisfying arc.',

  summary:
    'You are an expert summarizer. Produce output in two parts: (1) Key Points — 5-7 bullet points capturing main ideas, (2) Overall Summary — 2-3 concise sentences. Preserve all critical details.',

  imageSummary:
    'You are an expert image analyst and art critic. Analyze the described image in detail: identify objects, text, people, emotions, colors, composition, and explain what it represents or conveys.',

  codeCheck:
    'You are a senior code reviewer and security expert. Systematically analyze for: 1) Syntax Errors, 2) Logic Errors, 3) Security Vulnerabilities, 4) Performance Issues, 5) Best Practice Violations. For each issue, show the problematic code and a corrected version.',

  humanize:
    'You are an expert editor who transforms robotic AI text into natural, warm, human-sounding writing. Maintain meaning. Make it conversational, vary sentence length, add personality. Remove AI clichés: "In conclusion", "It is worth noting", "Delve into", "Notably", "Furthermore".',

  grammar:
    'You are a professional grammar editor. Fix all grammar, spelling, punctuation, and style issues. Show the corrected text first, then list the main corrections with brief explanations.',

  analysis:
    'You are an expert analyst. Provide a thorough, structured analysis of the topic. Include: key findings, supporting evidence, implications, and a clear conclusion. Use numbered sections for clarity.',

  general:
    'You are a highly capable, helpful AI assistant. Answer accurately, concisely, and helpfully. Structure your response clearly with bullet points or numbered lists where appropriate.'
};

/**
 * Provider priority per task type.
 * First in array = tried first. Based on model strengths:
 * - Groq (LLaMA 3.3): fast, good for code, precise tasks
 * - Gemini: strong creative, analysis, long context
 * - OpenRouter: many free models, good general purpose
 */
export const PREFERRED_PROVIDER: Record<string, string[]> = {
  code:        ['Groq', 'Gemini', 'OpenRouter'],   // precision first
  codeCheck:   ['Groq', 'Gemini', 'OpenRouter'],
  grammar:     ['Groq', 'Gemini', 'OpenRouter'],
  summary:     ['Groq', 'Gemini', 'OpenRouter'],   // fast summary
  task:        ['Groq', 'Gemini', 'OpenRouter'],
  content:     ['Gemini', 'Groq', 'OpenRouter'],   // Gemini quality for content
  story:       ['Gemini', 'OpenRouter', 'Groq'],   // creative writing
  imageSummary:['Gemini', 'OpenRouter', 'Groq'],   // visual analysis
  analysis:    ['Gemini', 'Groq', 'OpenRouter'],   // structured analysis
  humanize:    ['OpenRouter', 'Gemini', 'Groq'],   // natural tone
  general:     ['Groq', 'Gemini', 'OpenRouter']
};

/** Temperature per task type — lower = more precise, higher = more creative */
export const TASK_TEMPERATURE: Record<string, number> = {
  code:        0.25,  // strict syntax
  codeCheck:   0.15,  // very strict review
  grammar:     0.15,  // correctness
  summary:     0.40,  // factual
  task:        0.55,  // structured
  analysis:    0.50,
  content:     0.82,
  imageSummary:0.60,
  story:       0.92,  // creative max
  humanize:    0.78,
  general:     0.75
};

/** Max output tokens per type */
export const TASK_MAX_TOKENS: Record<string, number> = {
  code:        2000,
  codeCheck:   2000,
  story:       2000,
  content:     1800,
  analysis:    1800,
  imageSummary:1200,
  summary:     1000,
  grammar:     1500,
  humanize:    1500,
  task:        1500,
  general:     1500
};
