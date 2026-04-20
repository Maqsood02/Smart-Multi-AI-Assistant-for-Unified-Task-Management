// ════════════════════════════════════════════════════════════
//  IMAGE SUMMARIZER PAGE
//  Accepts: file upload OR image URL OR text description
//  Uses Gemini vision (multimodal) for actual image analysis
// ════════════════════════════════════════════════════════════
import { useState, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Auth } from '../../data/auth';
import { DB } from '../../data/db';
import { getGeminiKeys } from '../../services/aiGateway/providerManager';
import { generateTextWithFallback } from '../../services/aiGateway';
import { getAnyKeyAvailable } from '../../services/aiGateway';
import { TypingDots } from '../../components/common/TypingDots';
import { useToasts, ToastContainer } from '../../components/common/Toast';
import type { GenerationStatus } from '../../types';

// ── Gemini vision call with base64 image ─────────────────
async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string,
  userPrompt: string
): Promise<{ text: string; provider: string }> {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error('No Gemini API key configured for vision analysis.');

  const key = keys[0];
  const model = 'gemini-2.0-flash'; // multimodal model

  const requestBody = {
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType,
            data: imageBase64
          }
        },
        {
          text: userPrompt || 'Analyze this image in detail. Describe: what you see, objects, colors, composition, mood, any text, and what this image represents or conveys.'
        }
      ]
    }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 1500 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errData?.error?.message || `Gemini vision error: HTTP ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };

  if (data?.promptFeedback?.blockReason) {
    throw new Error(`Image blocked by safety filters: ${data.promptFeedback.blockReason}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!text) throw new Error('No analysis returned from Gemini vision');

  return { text, provider: 'Gemini Vision' };
}

// ── File → base64 ────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const result = reader.result as string;
      // Remove the "data:image/...;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10MB

export function ImageSummarizerPage() {
  const { refresh } = useApp();
  const user = Auth.current();
  const { toasts, toast } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode,       setMode]       = useState<'upload' | 'url' | 'text'>('upload');
  const [file,       setFile]       = useState<File | null>(null);
  const [preview,    setPreview]    = useState<string>('');
  const [imageUrl,   setImageUrl]   = useState('');
  const [textDesc,   setTextDesc]   = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [output,     setOutput]     = useState('');
  const [provider,   setProvider]   = useState('');
  const [running,    setRunning]    = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [status,     setStatus]     = useState<GenerationStatus | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast('⚠️ Only JPG, PNG, WebP, GIF images are supported.', 'error');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast('⚠️ File too large. Max size is 10MB.', 'error');
      return;
    }

    setFile(f);
    setOutput(''); setSaved(false);
    // Show preview
    const url = URL.createObjectURL(f);
    setPreview(url);
    toast(`✅ Image loaded: ${f.name}`, 'success');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!getAnyKeyAvailable()) {
      toast('⚠️ No API key configured. Contact the developer.', 'error');
      return;
    }

    setRunning(true); setOutput(''); setSaved(false); setStatus({ message: 'Analyzing image…' });

    try {
      if (mode === 'upload' && file) {
        // ── UPLOAD MODE: base64 → Gemini vision ──────────────
        setStatus({ message: 'Converting image to base64…' });
        const base64 = await fileToBase64(file);
        setStatus({ message: 'Sending to Gemini Vision…', provider: 'Gemini Vision' });
        const result = await analyzeImageWithGemini(base64, file.type, userPrompt);
        setOutput(result.text);
        setProvider(result.provider);
        toast('✅ Image analyzed by Gemini Vision!', 'success');

      } else if (mode === 'url' && imageUrl.trim()) {
        // ── URL MODE: fetch image → base64 → Gemini vision ──
        setStatus({ message: 'Fetching image from URL…' });
        try {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`Could not fetch image: HTTP ${res.status}`);
          const blob = await res.blob();
          if (!blob.type.startsWith('image/')) throw new Error('URL does not point to an image');

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          setStatus({ message: 'Sending to Gemini Vision…', provider: 'Gemini Vision' });
          const result = await analyzeImageWithGemini(base64, blob.type || 'image/jpeg', userPrompt);
          setOutput(result.text);
          setProvider(result.provider);
          toast('✅ Image URL analyzed!', 'success');
        } catch {
          // If fetch fails (CORS etc), fall back to text description
          setStatus({ message: 'Using text analysis (CORS issue with URL)…' });
          const prompt = `Analyze this image URL and describe what it likely shows based on the URL context and any visual elements you can infer: ${imageUrl}\n\n${userPrompt || 'Describe in detail.'}`;
          const result = await generateTextWithFallback(prompt, 'imageSummary', (s) => setStatus(s));
          setOutput(result.text);
          setProvider(result.provider);
          toast('📝 Analysis based on URL context (direct vision unavailable due to CORS).', 'info');
        }

      } else if (mode === 'text' && textDesc.trim()) {
        // ── TEXT MODE: describe the image as text ─────────────
        setStatus({ message: 'Analyzing description…' });
        const prompt = `${userPrompt || 'Analyze this image in detail:'}\n\nImage description: ${textDesc}`;
        const result = await generateTextWithFallback(prompt, 'imageSummary', (s) => setStatus(s));
        setOutput(result.text);
        setProvider(result.provider);
        toast('✅ Analysis complete!', 'success');

      } else {
        toast('⚠️ Please provide an image to analyze.', 'error');
        setRunning(false);
        return;
      }

      setStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      toast(`❌ ${msg}`, 'error');
      setStatus(null);
    } finally { setRunning(false); }
  };

  const handleSave = () => {
    if (!user || !output) return;
    const prompt = mode === 'upload' ? `[Image: ${file?.name}] ${userPrompt}` :
                   mode === 'url'    ? `[URL: ${imageUrl}] ${userPrompt}` : textDesc;
    DB.add({
      userId: user.id, taskType: 'imageSummary',
      title: prompt.slice(0, 80) + (prompt.length > 80 ? '…' : ''),
      prompt, aiOutput: output,
      priority: '', dueDate: '', status: 'pending', provider
    });
    refresh(); setSaved(true); toast('✅ Saved!', 'success');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text)', fontSize: 14,
    fontFamily: 'Inter, sans-serif', outline: 'none'
  };

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header" style={{ marginBottom: 22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:14, flexShrink:0, background:'rgba(99,102,241,0.16)', border:'1px solid rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
            🖼️
          </div>
          <div>
            <h2 style={{ color:'#818cf8' }}>Image Summarizer</h2>
            <p>Upload an image, paste a URL, or describe it — AI will analyze and explain it in detail.</p>
          </div>
        </div>
      </div>

      <div className="create-task-layout">
        <div className="ct-card">
          <h3 style={{ color:'#818cf8' }}>🖼️ Image Input</h3>

          {/* Mode Tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {([['upload','📁 Upload File'],['url','🔗 Image URL'],['text','✏️ Describe']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setOutput(''); setSaved(false); }}
                style={{
                  padding:'8px 16px', borderRadius:9, border:'1.5px solid',
                  background: mode === m ? 'rgba(99,102,241,0.18)' : 'var(--surface2)',
                  borderColor: mode === m ? '#818cf8' : 'var(--border)',
                  color: mode === m ? '#818cf8' : 'var(--text2)',
                  fontWeight: mode === m ? 700 : 500, cursor:'pointer', fontSize:13,
                  transition:'all 0.18s', fontFamily:'Inter,sans-serif'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* UPLOAD MODE */}
          {mode === 'upload' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border:'2px dashed var(--border2)', borderRadius:14,
                  padding:'32px 20px', textAlign:'center', cursor:'pointer',
                  background: file ? 'rgba(99,102,241,0.06)' : 'var(--surface2)',
                  transition:'all 0.2s', marginBottom:14
                }}
              >
                {preview ? (
                  <div>
                    <img src={preview} alt="Preview" style={{ maxHeight:200, maxWidth:'100%', borderRadius:10, marginBottom:10 }}/>
                    <div style={{ fontSize:13, color:'var(--accent3)' }}>✅ {file?.name}</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>Click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:40, marginBottom:10 }}>📁</div>
                    <div style={{ fontSize:14, color:'var(--text)', fontWeight:600, marginBottom:4 }}>
                      Click or drag & drop an image
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>
                      JPG, PNG, WebP, GIF — max 10MB
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display:'none' }}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* URL MODE */}
          {mode === 'url' && (
            <div className="form-group">
              <label>Image URL</label>
              <input
                type="url"
                style={inputStyle}
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
              />
            </div>
          )}

          {/* TEXT MODE */}
          {mode === 'text' && (
            <div className="form-group">
              <label>Describe the image</label>
              <textarea
                style={{ ...inputStyle, resize:'vertical', minHeight:120 }}
                placeholder="Describe what's in the image in as much detail as possible…"
                value={textDesc}
                onChange={e => setTextDesc(e.target.value)}
                rows={5}
              />
            </div>
          )}

          {/* Analysis prompt */}
          <div className="form-group" style={{ marginTop:10 }}>
            <label>What do you want to know? <span style={{ color:'var(--text3)', fontSize:11 }}>(optional)</span></label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. What objects are in this image? What is the mood?"
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !running && handleAnalyze()}
            />
          </div>

          <button
            className="run-btn"
            onClick={handleAnalyze}
            disabled={running || (mode === 'upload' && !file) || (mode === 'url' && !imageUrl.trim()) || (mode === 'text' && !textDesc.trim())}
            style={{ background:'linear-gradient(135deg,#818cf8,#6366f1)', boxShadow:'0 4px 18px rgba(99,102,241,0.3)' }}
          >
            {running ? <><TypingDots/>&nbsp;Analyzing…</> : <>🔍 Analyze Image</>}
          </button>

          {running && status && (
            <div className="ai-status-feedback" style={{ marginTop:12 }}>
              <span className="ai-status-dot"/>
              <span>{status.message}</span>
              {status.provider && <span className="ai-badge" style={{ fontSize:10 }}>⚡ {status.provider}</span>}
            </div>
          )}
        </div>

        <div className="ct-tips">
          <h4>🖼️ Image Analysis Tips</h4>
          <div className="tip-item"><span className="tip-num">1</span><span><strong style={{ color:'var(--text)' }}>Upload mode</strong> gives the most accurate results — direct vision analysis.</span></div>
          <div className="tip-item"><span className="tip-num">2</span><span><strong style={{ color:'var(--text)' }}>URL mode</strong> fetches the image for vision if CORS allows, otherwise uses context.</span></div>
          <div className="tip-item"><span className="tip-num">3</span><span><strong style={{ color:'var(--text)' }}>Describe mode</strong> works without an actual image file.</span></div>
          <div className="tip-item"><span className="tip-num">4</span><span>Ask specific questions like "What text is in this image?" for targeted analysis.</span></div>
          <div style={{ marginTop:18, padding:14, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, fontSize:12 }}>
            <div style={{ fontWeight:700, color:'#818cf8', marginBottom:6 }}>🤖 Vision Model</div>
            <div style={{ color:'var(--text2)', lineHeight:1.7 }}>
              Uses <strong>Gemini 2.0 Flash</strong> multimodal model for actual image understanding.
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {running && status && (
        <div className="ai-live-output" style={{ marginTop:22 }}>
          <div className="ai-thinking">
            <div className="ai-loading-icon">🖼️</div>
            <TypingDots/>
            <div className="thinking-text">{status.message}</div>
            {status.provider && <div className="thinking-sub">Using {status.provider}…</div>}
          </div>
        </div>
      )}

      {/* Output */}
      {output && !running && (
        <div className="ai-live-output" style={{ marginTop:22 }}>
          <div className="ai-output-header">
            <div className="ai-output-header-left">
              <span className="ai-badge">🤖 AI Analysis</span>
              <span className="ai-badge gemini">⚡ {provider}</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {user && <button className={`act-btn ${saved ? 'done' : 'run'}`} onClick={handleSave} disabled={saved}>{saved ? '✅ Saved!' : '💾 Save'}</button>}
              <button className="act-btn copy" onClick={() => { navigator.clipboard?.writeText(output); toast('📋 Copied!', 'info'); }}>📋 Copy</button>
            </div>
          </div>
          <div className="ai-response-label">🔍 Image Analysis:</div>
          <div className="ai-response-text">{output}</div>
        </div>
      )}
    </>
  );
}
