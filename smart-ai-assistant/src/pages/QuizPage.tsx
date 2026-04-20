// ════════════════════════════════════════════════════════════
//  AI QUIZ PAGE — Dynamically generates MCQ quizzes using AI
//  Topics: user picks, AI generates 10 questions with options
//  Score tracking, one question at a time, results screen
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { generateTextWithFallback, getAnyKeyAvailable } from '../services/aiGateway';
import { Storage } from '../utils/storage';
import { TypingDots } from '../components/common/TypingDots';

interface QuizQuestion {
  question: string;
  options:  string[];         // exactly 4 options
  answer:   number;           // index 0-3 of correct option
  explanation: string;
}

interface QuizResult {
  topic:     string;
  score:     number;
  total:     number;
  date:      string;
}

// ── Parse AI-generated JSON quiz ─────────────────────────
function parseQuizJson(raw: string): QuizQuestion[] {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  // Find JSON array
  const start = cleaned.indexOf('[');
  const end   = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in response');

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Expected array');

  return parsed.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    if (!item.question || !Array.isArray(item.options) || item.options.length < 4) {
      throw new Error(`Invalid question format at index ${i}`);
    }
    return {
      question:    String(item.question),
      options:     (item.options as unknown[]).slice(0, 4).map(String),
      answer:      typeof item.answer === 'number' ? item.answer : parseInt(String(item.answer), 10),
      explanation: String(item.explanation || '')
    };
  });
}

// ── Generate quiz via AI ──────────────────────────────────
async function generateQuiz(topic: string, difficulty: string, count: number): Promise<QuizQuestion[]> {
  const prompt = `Generate exactly ${count} multiple choice quiz questions about "${topic}" (difficulty: ${difficulty}).

Return ONLY a valid JSON array, no other text. Format:
[
  {
    "question": "What is ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0,
    "explanation": "Brief explanation of the correct answer."
  }
]

Rules:
- Each question must have exactly 4 options
- "answer" is the index (0-3) of the correct option
- Mix different question types (conceptual, practical, factual)
- Difficulty: ${difficulty}
- Make questions educational and accurate
- NO markdown, NO extra text — JSON array only`;

  const { text } = await generateTextWithFallback(prompt, 'general');
  const questions = parseQuizJson(text);

  if (questions.length === 0) throw new Error('No questions generated');
  return questions;
}

const PRESET_TOPICS = [
  'JavaScript', 'Python', 'React.js', 'Node.js', 'Database (SQL)',
  'DBMS Concepts', 'Operating Systems', 'Computer Networks',
  'Data Structures', 'Machine Learning', 'Artificial Intelligence',
  'Cyber Security', 'HTML & CSS', 'Git & Version Control', 'Cloud Computing'
];

const QUIZ_SCORE_KEY = 'smai_quiz_history';

function saveResult(result: QuizResult) {
  const history = Storage.get<QuizResult[]>(QUIZ_SCORE_KEY, []);
  history.unshift(result);
  Storage.set(QUIZ_SCORE_KEY, history.slice(0, 20)); // keep last 20
}

function getPerformanceMsg(pct: number): { msg: string; emoji: string; color: string } {
  if (pct === 100) return { msg: 'Perfect Score! Outstanding!',    emoji: '🏆', color: '#ffd700' };
  if (pct >= 80)   return { msg: 'Excellent! Great knowledge!',    emoji: '🌟', color: 'var(--accent3)' };
  if (pct >= 60)   return { msg: 'Good job! Keep learning!',       emoji: '👍', color: 'var(--accent-l)' };
  if (pct >= 40)   return { msg: 'Not bad. Review the topic.',     emoji: '📚', color: 'var(--warning)' };
  return              { msg: 'Keep studying — you\'ll get better!', emoji: '💪', color: 'var(--danger)' };
}

export function QuizPage() {
  const [phase,       setPhase]      = useState<'setup' | 'loading' | 'quiz' | 'result'>('setup');
  const [topic,       setTopic]      = useState('');
  const [customTopic, setCustomTopic]= useState('');
  const [difficulty,  setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [qCount,      setQCount]     = useState(10);
  const [questions,   setQuestions]  = useState<QuizQuestion[]>([]);
  const [current,     setCurrent]    = useState(0);
  const [selected,    setSelected]   = useState<number | null>(null);
  const [answered,    setAnswered]   = useState(false);
  const [score,       setScore]      = useState(0);
  const [userAnswers, setUserAnswers]= useState<number[]>([]);
  const [loadMsg,     setLoadMsg]    = useState('');
  const [error,       setError]      = useState('');
  const [history,     setHistory]    = useState<QuizResult[]>(() => Storage.get<QuizResult[]>(QUIZ_SCORE_KEY, []));

  const effectiveTopic = topic === '__custom__' ? customTopic.trim() : topic;

  const startQuiz = async () => {
    if (!effectiveTopic) { setError('Please select or enter a topic.'); return; }
    if (!getAnyKeyAvailable()) { setError('No AI API key configured. Contact the developer.'); return; }

    setError('');
    setPhase('loading');
    setLoadMsg('Generating quiz questions with AI…');

    try {
      const qs = await generateQuiz(effectiveTopic, difficulty, qCount);
      setQuestions(qs);
      setCurrent(0);
      setSelected(null);
      setAnswered(false);
      setScore(0);
      setUserAnswers([]);
      setPhase('quiz');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate quiz';
      setError(`❌ ${msg}. Please try again.`);
      setPhase('setup');
    }
  };

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[current].answer) setScore(s => s + 1);
    setUserAnswers(prev => [...prev, idx]);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      // Quiz done
      const finalScore = score + (selected === questions[current].answer ? 0 : 0); // already counted
      const result: QuizResult = {
        topic: effectiveTopic,
        score,
        total: questions.length,
        date:  new Date().toLocaleDateString()
      };
      saveResult(result);
      setHistory(Storage.get<QuizResult[]>(QUIZ_SCORE_KEY, []));
      setPhase('result');
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const resetQuiz = () => {
    setPhase('setup');
    setQuestions([]);
    setCurrent(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setUserAnswers([]);
    setError('');
  };

  const q  = questions[current];
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const perf = getPerformanceMsg(pct);

  // ── SETUP PHASE ──────────────────────────────────────────
  if (phase === 'setup') return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="page-header">
        <h2>🧠 AI Quiz Generator</h2>
        <p>Pick a topic, set difficulty, and let AI generate a custom quiz for you!</p>
      </div>

      <div className="ct-card" style={{ marginBottom: 20 }}>
        <h3>⚙️ Quiz Setup</h3>

        {/* Topic presets */}
        <div className="form-group">
          <label>Select Topic</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
            {PRESET_TOPICS.map(t => (
              <button
                key={t}
                onClick={() => { setTopic(t); setError(''); }}
                style={{
                  padding:'6px 14px', borderRadius:100, border:'1.5px solid',
                  background: topic === t ? 'rgba(91,158,249,0.2)' : 'var(--surface2)',
                  borderColor: topic === t ? 'var(--accent)' : 'var(--border)',
                  color: topic === t ? 'var(--accent-l)' : 'var(--text2)',
                  fontWeight: topic === t ? 700 : 500,
                  cursor:'pointer', fontSize:12.5, transition:'all 0.18s',
                  fontFamily:'Inter,sans-serif'
                }}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => { setTopic('__custom__'); setError(''); }}
              style={{
                padding:'6px 14px', borderRadius:100, border:'1.5px solid',
                background: topic === '__custom__' ? 'rgba(155,135,245,0.2)' : 'var(--surface2)',
                borderColor: topic === '__custom__' ? 'var(--accent2)' : 'var(--border)',
                color: topic === '__custom__' ? 'var(--accent2)' : 'var(--text2)',
                fontWeight: topic === '__custom__' ? 700 : 500,
                cursor:'pointer', fontSize:12.5, transition:'all 0.18s',
                fontFamily:'Inter,sans-serif'
              }}
            >
              ✏️ Custom…
            </button>
          </div>

          {topic === '__custom__' && (
            <input
              type="text"
              className="form-control"
              placeholder="Enter any topic… e.g. World War II, Physics, Cooking"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startQuiz()}
              style={{ marginTop:8 }}
            />
          )}
        </div>

        {/* Difficulty */}
        <div className="form-group">
          <label>Difficulty</label>
          <div style={{ display:'flex', gap:10 }}>
            {(['easy','medium','hard'] as const).map(d => {
              const colors = { easy: '#3dd6a3', medium: '#ffbe45', hard: '#ff7575' };
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex:1, padding:'10px', borderRadius:10, border:'1.5px solid',
                    background: difficulty === d ? `${colors[d]}22` : 'var(--surface2)',
                    borderColor: difficulty === d ? colors[d] : 'var(--border)',
                    color: difficulty === d ? colors[d] : 'var(--text2)',
                    fontWeight: difficulty === d ? 700 : 500,
                    cursor:'pointer', fontSize:13.5, transition:'all 0.18s',
                    fontFamily:'Inter,sans-serif', textTransform:'capitalize'
                  }}
                >
                  {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question count */}
        <div className="form-group">
          <label>Number of Questions: <strong style={{ color:'var(--accent-l)' }}>{qCount}</strong></label>
          <input
            type="range" min={5} max={20} step={5} value={qCount}
            onChange={e => setQCount(Number(e.target.value))}
            style={{ width:'100%', accentColor:'var(--accent)', cursor:'pointer', height:6 }}
          />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'var(--text3)', marginTop:4 }}>
            <span>5 (quick)</span><span>10 (standard)</span><span>15</span><span>20 (full)</span>
          </div>
        </div>

        {error && (
          <div style={{ padding:'10px 14px', background:'rgba(241,107,107,0.1)', border:'1px solid rgba(241,107,107,0.3)', borderRadius:10, fontSize:13, color:'var(--danger)', marginBottom:16 }}>
            {error}
          </div>
        )}

        <button
          className="run-btn"
          onClick={startQuiz}
          disabled={!effectiveTopic}
          style={{ background:'linear-gradient(135deg, var(--accent), var(--accent-d))' }}
        >
          🚀 Start AI Quiz
        </button>
      </div>

      {/* Score history */}
      {history.length > 0 && (
        <div className="ct-card">
          <h3>📊 Recent Scores</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {history.slice(0, 5).map((r, i) => {
              const p = Math.round((r.score / r.total) * 100);
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--surface2)', borderRadius:10, fontSize:13 }}>
                  <span style={{ fontWeight:600, color:'var(--text)' }}>{r.topic}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color:'var(--text3)', fontSize:11 }}>{r.date}</span>
                    <span style={{
                      fontWeight:700, fontSize:14,
                      color: p >= 80 ? 'var(--accent3)' : p >= 60 ? 'var(--accent-l)' : 'var(--warning)'
                    }}>
                      {r.score}/{r.total} ({p}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── LOADING PHASE ─────────────────────────────────────────
  if (phase === 'loading') return (
    <div style={{ maxWidth: 600, margin: '60px auto', textAlign:'center' }}>
      <div className="ct-card">
        <div className="ai-loading-icon" style={{ fontSize:56, marginBottom:16 }}>🧠</div>
        <TypingDots/>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--text)', margin:'14px 0 8px' }}>
          Generating Quiz…
        </div>
        <div style={{ fontSize:13.5, color:'var(--text2)' }}>{loadMsg}</div>
        <div style={{ marginTop:16, fontSize:12.5, color:'var(--text3)' }}>
          Creating {qCount} {difficulty} questions about <strong style={{ color:'var(--accent-l)' }}>{effectiveTopic}</strong>
        </div>
      </div>
    </div>
  );

  // ── QUIZ PHASE ────────────────────────────────────────────
  if (phase === 'quiz' && q) {
    const progress = ((current + 1) / questions.length) * 100;
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:2 }}>
              🧠 {effectiveTopic} Quiz
            </h2>
            <div style={{ fontSize:12.5, color:'var(--text3)' }}>
              Question {current + 1} of {questions.length} · {difficulty}
            </div>
          </div>
          <div style={{
            fontSize:17, fontWeight:800, color:'var(--accent-l)',
            background:'rgba(91,158,249,0.15)', border:'1px solid rgba(91,158,249,0.3)',
            padding:'8px 18px', borderRadius:100
          }}>
            Score: {score}/{current + (answered ? 1 : 0)}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:6, background:'var(--surface2)', borderRadius:100, marginBottom:22, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius:100, transition:'width 0.4s ease' }}/>
        </div>

        {/* Question card */}
        <div className="ct-card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', lineHeight:1.55, marginBottom:22 }}>
            <span style={{ color:'var(--accent-l)', marginRight:8 }}>Q{current + 1}.</span>
            {q.question}
          </div>

          {/* Options */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {q.options.map((opt, idx) => {
              let bg = 'var(--surface2)';
              let borderColor = 'var(--border)';
              let color = 'var(--text)';
              let icon = '';

              if (answered) {
                if (idx === q.answer) {
                  bg = 'rgba(61,214,163,0.18)'; borderColor = 'rgba(61,214,163,0.5)';
                  color = 'var(--accent3)'; icon = '✅ ';
                } else if (idx === selected && idx !== q.answer) {
                  bg = 'rgba(255,117,117,0.18)'; borderColor = 'rgba(255,117,117,0.5)';
                  color = 'var(--danger)'; icon = '❌ ';
                }
              } else if (selected === idx) {
                bg = 'rgba(91,158,249,0.2)'; borderColor = 'var(--accent)';
                color = 'var(--accent-l)';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  style={{
                    width:'100%', padding:'13px 16px', borderRadius:11,
                    border:`1.5px solid ${borderColor}`, background: bg, color,
                    fontWeight:600, fontSize:14, textAlign:'left', cursor: answered ? 'default' : 'pointer',
                    transition:'all 0.2s', fontFamily:'Inter,sans-serif', lineHeight:1.45
                  }}
                >
                  <span style={{ marginRight:10, opacity:0.7, fontWeight:700 }}>
                    {['A','B','C','D'][idx]}.
                  </span>
                  {icon}{opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {answered && q.explanation && (
            <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(91,158,249,0.08)', border:'1px solid rgba(91,158,249,0.2)', borderRadius:10, fontSize:13, color:'var(--text2)', lineHeight:1.65 }}>
              <strong style={{ color:'var(--accent-l)' }}>💡 Explanation:</strong> {q.explanation}
            </div>
          )}
        </div>

        {/* Next button */}
        {answered && (
          <button
            className="run-btn"
            onClick={handleNext}
            style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-d))' }}
          >
            {current + 1 >= questions.length ? '🏁 View Results' : 'Next Question →'}
          </button>
        )}

        {/* Quit */}
        <div style={{ textAlign:'center', marginTop:12 }}>
          <button onClick={resetQuiz} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            ✕ Quit Quiz
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ──────────────────────────────────────────
  if (phase === 'result') return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign:'center' }}>
      <div className="ct-card" style={{ padding:36 }}>
        <div style={{ fontSize:64, marginBottom:12 }}>{perf.emoji}</div>
        <h2 style={{ fontSize:26, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
          Quiz Complete!
        </h2>
        <div style={{ fontSize:16, color:'var(--text2)', marginBottom:24 }}>
          {effectiveTopic} · {difficulty}
        </div>

        {/* Score circle */}
        <div style={{
          width:140, height:140, borderRadius:'50%', margin:'0 auto 24px',
          background:`conic-gradient(${perf.color} ${pct * 3.6}deg, var(--surface2) 0deg)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative'
        }}>
          <div style={{
            width:110, height:110, borderRadius:'50%',
            background:'var(--surface)', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center'
          }}>
            <div style={{ fontSize:30, fontWeight:900, color: perf.color, lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:13, color:'var(--text3)' }}>{score}/{questions.length}</div>
          </div>
        </div>

        <div style={{ fontSize:18, fontWeight:700, color: perf.color, marginBottom:22 }}>
          {perf.msg}
        </div>

        {/* Question review */}
        <div style={{ textAlign:'left', marginBottom:24 }}>
          {questions.map((q, i) => {
            const ua = userAnswers[i];
            const correct = ua === q.answer;
            return (
              <div key={i} style={{
                padding:'10px 14px', borderRadius:10, marginBottom:8,
                background: correct ? 'rgba(61,214,163,0.1)' : 'rgba(255,117,117,0.1)',
                border: `1px solid ${correct ? 'rgba(61,214,163,0.25)' : 'rgba(255,117,117,0.25)'}`
              }}>
                <div style={{ fontSize:12.5, fontWeight:600, color: correct ? 'var(--accent3)' : 'var(--danger)', marginBottom:3 }}>
                  {correct ? '✅' : '❌'} Q{i+1}: {q.question.slice(0, 70)}{q.question.length > 70 ? '…' : ''}
                </div>
                {!correct && (
                  <div style={{ fontSize:11.5, color:'var(--text3)' }}>
                    Your answer: {ua !== undefined ? q.options[ua] : 'Not answered'} | Correct: {q.options[q.answer]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <button className="run-btn" onClick={startQuiz} style={{ flex:1, background:'linear-gradient(135deg,var(--accent3),#14916b)' }}>
            🔄 Retry Same Quiz
          </button>
          <button className="run-btn" onClick={resetQuiz} style={{ flex:1, background:'linear-gradient(135deg,var(--accent),var(--accent-d))' }}>
            🆕 New Quiz
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}
