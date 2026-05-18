import { storage, FIREBASE_IS_ACTIVE } from './storage.js';
import { useState, useEffect, useRef } from 'react';

// ============================================================
// CONFIG
// ============================================================
const POLL_MS = 1500;
const DEFAULT_PIN = '1410';

const DEFAULT_QUESTIONS = [
  { id: 'q1', text: 'Wie is de Mol?', type: 'players', correctAnswer: '' },
  { id: 'q2', text: 'Welke kleur kleding droeg de Mol vandaag het meest?', type: 'text', correctAnswer: '' },
  { id: 'q3', text: 'Met wie heeft de Mol als laatste een opdracht uitgevoerd?', type: 'players', correctAnswer: '' },
  { id: 'q4', text: 'Heeft de Mol bij de eerste opdracht een fout gemaakt?', type: 'choice', options: ['Ja', 'Nee'], correctAnswer: '' },
];

const STORAGE_KEYS = {
  GAME: 'widm-game-v2',
  ANSWER: (name) => `widm-answer-v2:${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
  ANSWER_PREFIX: 'widm-answer-v2:',
};

const DEFAULT_GAME = {
  phase: 'setup', // 'setup' | 'quiz' | 'revealed-individual' | 'revealed-team'
  players: [],
  mole: null,
  winnerName: null,
  winningTeam: null, // 1 | 2 | null
  teams: {}, // { playerName: 1 | 2 }
  scores: {},
  revealedAt: null,
  teamRevealedAt: null,
  pin: DEFAULT_PIN,
  questions: DEFAULT_QUESTIONS,       // legacy fallback
  questionsTeam1: DEFAULT_QUESTIONS,  // vragen + juiste antwoorden voor team 1
  questionsTeam2: DEFAULT_QUESTIONS,  // vragen + juiste antwoorden voor team 2
  submittedBy: [],
};

// ============================================================
// STYLES
// ============================================================
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Manrope:wght@300;400;500;600;700;800&display=swap';

const css = `
  :root {
    --bg: #050807;
    --bg-elev: #0d1311;
    --bg-card: #131a17;
    --jade: #2eb872;
    --jade-soft: #1f6c47;
    --jade-bright: #5fdc97;
    --jade-glow: rgba(46, 184, 114, 0.15);
    --ivory: #e6efe9;
    --muted: #6f7a73;
    --line: #1d2622;
    --green: #2bb673;
    --green-bright: #4ade80;
    --red: #b91c1c;
    --red-bright: #ef4444;
  }

  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Manrope', sans-serif; background: var(--bg); color: var(--ivory); }

  .widm-app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top, rgba(46, 184, 114, 0.07) 0%, transparent 55%),
      radial-gradient(ellipse at bottom, rgba(0, 0, 0, 0.6) 0%, transparent 70%),
      var(--bg);
    color: var(--ivory);
    font-family: 'Manrope', sans-serif;
    position: relative;
    overflow-x: hidden;
  }

  .widm-app::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2' /%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' /%3E%3C/svg%3E");
    pointer-events: none;
    opacity: 0.5;
    z-index: 1;
  }

  .display { font-family: 'Cormorant Garamond', serif; letter-spacing: 0.01em; }

  .widm-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 20px 80px;
    position: relative;
    z-index: 2;
  }

  .widm-header { text-align: center; margin-bottom: 32px; padding-top: 12px; }
  .widm-eyebrow {
    font-size: 11px;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: var(--jade-soft);
    margin-bottom: 8px;
    font-weight: 500;
  }
  .widm-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 44px;
    line-height: 1;
    font-weight: 600;
    margin: 0;
    color: var(--ivory);
    letter-spacing: 0.02em;
  }
  .widm-title em { font-style: italic; color: var(--jade); font-weight: 500; }
  .widm-divider { width: 60px; height: 1px; background: var(--jade-soft); margin: 16px auto; }
  .widm-subtitle { color: var(--muted); font-size: 13px; letter-spacing: 0.05em; }

  .widm-card {
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 24px;
    margin-bottom: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  .widm-label {
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--jade-soft);
    margin-bottom: 12px;
    font-weight: 600;
  }

  .widm-input, .widm-select, .widm-textarea {
    width: 100%;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    color: var(--ivory);
    padding: 12px 14px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 15px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .widm-select {
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, var(--jade) 50%), linear-gradient(135deg, var(--jade) 50%, transparent 50%);
    background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
    padding-right: 32px;
  }
  .widm-input:focus, .widm-select:focus, .widm-textarea:focus {
    outline: none;
    border-color: var(--jade);
    box-shadow: 0 0 0 3px var(--jade-glow);
  }

  .widm-btn {
    width: 100%;
    padding: 14px 20px;
    background: var(--jade);
    color: var(--bg);
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, transform 0.05s;
  }
  .widm-btn:hover:not(:disabled) { background: var(--jade-bright); }
  .widm-btn:active:not(:disabled) { transform: scale(0.98); }
  .widm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .widm-btn-ghost {
    background: transparent;
    color: var(--jade);
    border: 1px solid var(--jade-soft);
  }
  .widm-btn-ghost:hover:not(:disabled) { background: var(--jade-glow); }

  .widm-btn-danger { background: var(--red); color: var(--ivory); }
  .widm-btn-danger:hover:not(:disabled) { background: var(--red-bright); }

  .widm-btn-small { padding: 8px 14px; font-size: 11px; width: auto; }
  .widm-btn-icon { padding: 8px 12px; font-size: 14px; width: auto; min-width: 36px; }

  .widm-player-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .widm-player-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 14px; background: var(--bg-elev);
    border: 1px solid var(--line); border-radius: 4px;
    gap: 8px; flex-wrap: wrap;
  }
  .widm-player-item.is-mole { border-color: var(--jade); background: var(--jade-glow); }
  .widm-player-name { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .widm-tag {
    font-size: 9px; letter-spacing: 0.2em; padding: 3px 8px; border-radius: 2px;
    font-weight: 700; text-transform: uppercase;
  }
  .widm-tag-mole { background: var(--jade); color: var(--bg); }
  .widm-tag-winner { background: var(--green-bright); color: var(--bg); }
  .widm-tag-submitted { background: var(--bg); color: var(--jade); border: 1px solid var(--jade-soft); }
  .widm-tag-score { background: var(--bg); color: var(--ivory); border: 1px solid var(--line); }

  .widm-question { margin-bottom: 28px; }
  .widm-question-num { font-size: 11px; letter-spacing: 0.3em; color: var(--jade-soft); margin-bottom: 6px; }
  .widm-question-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; line-height: 1.3; margin-bottom: 14px;
    font-weight: 500; color: var(--ivory);
  }
  .widm-choices { display: flex; flex-direction: column; gap: 8px; }
  .widm-choice {
    padding: 12px 16px; background: var(--bg-elev);
    border: 1px solid var(--line); border-radius: 4px;
    cursor: pointer; transition: all 0.15s; font-size: 15px;
    display: flex; align-items: center; gap: 12px;
  }
  .widm-choice:hover { border-color: var(--jade-soft); }
  .widm-choice.selected {
    border-color: var(--jade); background: var(--jade-glow);
    color: var(--jade-bright);
  }
  .widm-choice-dot {
    width: 14px; height: 14px; border: 1px solid var(--jade-soft);
    border-radius: 50%; flex-shrink: 0; transition: all 0.15s;
  }
  .widm-choice.selected .widm-choice-dot {
    border-color: var(--jade); background: var(--jade);
    box-shadow: inset 0 0 0 3px var(--bg-card);
  }

  .widm-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .widm-tab {
    flex: 1; min-width: 80px; padding: 12px 8px; background: transparent; border: none; color: var(--muted);
    font-family: inherit; font-size: 11px; letter-spacing: 0.15em;
    text-transform: uppercase; cursor: pointer; font-weight: 600;
    border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .widm-tab.active { color: var(--jade); border-bottom-color: var(--jade); }

  .widm-status { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .widm-status-item { flex: 1; min-width: 100px; padding: 12px; background: var(--bg-elev); border-radius: 4px; border: 1px solid var(--line); }
  .widm-status-label { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); text-transform: uppercase; }
  .widm-status-value { font-size: 16px; color: var(--jade); margin-top: 4px; font-weight: 600; }

  .widm-admin-link {
    position: fixed; bottom: 12px; right: 12px;
    font-size: 9px; letter-spacing: 0.3em; color: var(--muted);
    background: transparent; border: none; cursor: pointer;
    padding: 8px; z-index: 10; font-family: inherit;
  }
  .widm-admin-link:hover { color: var(--jade-soft); }

  .widm-waiting { text-align: center; padding: 40px 20px; }
  .widm-waiting-icon {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic; font-size: 80px; color: var(--jade);
    line-height: 1; margin-bottom: 24px;
    animation: pulse 2.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  .widm-waiting-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; color: var(--ivory); margin-bottom: 8px;
  }
  .widm-waiting-sub { color: var(--muted); font-size: 13px; letter-spacing: 0.05em; }

  .widm-reveal {
    position: fixed; inset: 0; z-index: 100;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; padding: 24px; text-align: center;
    animation: fadeIn 0.4s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .widm-reveal-eyebrow {
    font-size: 12px; letter-spacing: 0.5em; text-transform: uppercase;
    margin-bottom: 24px; opacity: 0.7;
  }
  .widm-reveal-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 84px; line-height: 0.95; font-weight: 600;
    margin: 0 0 24px; letter-spacing: 0.02em;
    animation: rise 0.8s 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  }
  .widm-reveal-title em { font-style: italic; font-weight: 500; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .widm-reveal-sub {
    font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase;
    opacity: 0.65; max-width: 340px; line-height: 1.6;
    animation: rise 0.8s 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  }
  .widm-reveal-score {
    margin-top: 28px; font-family: 'Cormorant Garamond', serif;
    font-style: italic; font-size: 22px; opacity: 0.85;
    animation: rise 0.8s 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  }

  .widm-reveal-winner {
    background: radial-gradient(ellipse at center, var(--green-bright) 0%, var(--green) 60%, #166534 100%);
    color: #052e16;
  }
  .widm-reveal-winner .widm-reveal-eyebrow,
  .widm-reveal-winner .widm-reveal-sub { color: #052e16; }

  .widm-reveal-loser {
    background: radial-gradient(ellipse at center, var(--red-bright) 0%, var(--red) 60%, #450a0a 100%);
    color: #fef2f2;
  }
  .widm-reveal-loser .widm-reveal-eyebrow,
  .widm-reveal-loser .widm-reveal-sub { color: #fef2f2; opacity: 0.85; }

  .widm-reveal-mole { background: #000; color: var(--jade); }
  .widm-reveal-mole::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 50%, var(--jade-glow) 0%, transparent 60%);
    pointer-events: none;
  }
  .widm-reveal-mole .widm-reveal-eyebrow { color: var(--jade-soft); }
  .widm-reveal-mole .widm-reveal-sub { color: var(--jade-soft); }

  .widm-reveal-team-win {
    background: radial-gradient(ellipse at center, #fde68a 0%, #f59e0b 50%, #92400e 100%);
    color: #1c0a00;
  }
  .widm-reveal-team-win .widm-reveal-eyebrow,
  .widm-reveal-team-win .widm-reveal-sub { color: #1c0a00; }

  .widm-reveal-team-lose {
    background: radial-gradient(ellipse at center, #334155 0%, #1e293b 60%, #0f172a 100%);
    color: #94a3b8;
  }
  .widm-reveal-team-lose .widm-reveal-eyebrow,
  .widm-reveal-team-lose .widm-reveal-sub { color: #64748b; }

  .widm-team-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 16px; border-radius: 4px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
    margin-bottom: 4px;
  }
  .widm-team-badge-1 { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid #3b82f6; }
  .widm-team-badge-2 { background: rgba(234,179,8,0.2); color: #fde68a; border: 1px solid #eab308; }

  .widm-player-item .widm-team-badge { font-size: 9px; padding: 3px 8px; margin: 0; }

  .widm-reveal-q {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic; font-size: 200px; line-height: 1;
    position: absolute; opacity: 0.08; user-select: none;
    pointer-events: none;
  }

  .widm-reveal-close {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: inherit;
    padding: 12px 28px;
    border-radius: 4px;
    font-family: 'Manrope', sans-serif;
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    cursor: pointer;
    font-weight: 700;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10;
    animation: rise 0.8s 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
    transition: background 0.15s;
  }
  .widm-reveal-close:hover { background: rgba(0, 0, 0, 0.6); }

  .widm-helper { font-size: 12px; color: var(--muted); margin-top: 8px; }
  .widm-row { display: flex; gap: 8px; }
  .widm-row > * { flex: 1; }

  .widm-error {
    background: rgba(185, 28, 28, 0.1); border: 1px solid var(--red);
    color: #fca5a5; padding: 10px 14px; border-radius: 4px;
    font-size: 13px; margin-bottom: 12px;
  }
  .widm-success {
    background: rgba(43, 182, 115, 0.12); border: 1px solid var(--jade);
    color: var(--jade-bright); padding: 10px 14px; border-radius: 4px;
    font-size: 13px; margin-bottom: 12px;
  }
  .widm-info {
    background: var(--jade-glow); border: 1px solid var(--jade-soft);
    color: var(--jade-bright); padding: 10px 14px; border-radius: 4px;
    font-size: 13px; margin-bottom: 12px;
  }

  .widm-loading {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    color: var(--jade); font-family: 'Cormorant Garamond', serif;
    font-style: italic; font-size: 24px;
  }

  .widm-q-editor {
    background: var(--bg-elev); border: 1px solid var(--line);
    border-radius: 4px; padding: 16px; margin-bottom: 12px;
  }
  .widm-q-editor-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .widm-q-editor-num {
    font-size: 10px; letter-spacing: 0.25em; color: var(--jade-soft);
    text-transform: uppercase; font-weight: 700;
  }
  .widm-option-row {
    display: flex; gap: 6px; margin-bottom: 6px; align-items: center;
  }
  .widm-option-row > input { flex: 1; padding: 8px 12px; font-size: 14px; }

  .widm-score-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    background: var(--bg-elev); border: 1px solid var(--line);
    border-radius: 4px; margin-bottom: 6px;
  }
  .widm-score-row.is-leader {
    border-color: var(--jade);
    background: var(--jade-glow);
  }
  .widm-score-row.is-mole-row { border-color: var(--jade-soft); opacity: 0.85; }
  .widm-score-rank {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; color: var(--jade); width: 28px; text-align: center;
    font-weight: 600;
  }
  .widm-score-name { flex: 1; font-weight: 500; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .widm-score-value {
    font-family: 'Manrope', sans-serif; font-weight: 700;
    color: var(--jade-bright); font-size: 18px;
  }
  .widm-score-value-total { color: var(--muted); font-weight: 500; font-size: 14px; }

  .widm-summary-card {
    background: linear-gradient(135deg, var(--jade-glow), transparent);
    border: 1px solid var(--jade);
    border-radius: 6px; padding: 20px; margin-bottom: 16px;
  }
  .widm-summary-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--line);
  }
  .widm-summary-row:last-child { border-bottom: none; }
  .widm-summary-label { color: var(--muted); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  .widm-summary-value { color: var(--jade-bright); font-weight: 600; font-family: 'Cormorant Garamond', serif; font-size: 20px; }
`;

// ============================================================
// STORAGE
// ============================================================
async function loadGame() {
  try {
    const result = await storage.get(STORAGE_KEYS.GAME);
    if (result?.value) {
      const parsed = JSON.parse(result.value);
      return { ...DEFAULT_GAME, ...parsed };
    }
  } catch (e) { /* not found */ }
  return { ...DEFAULT_GAME };
}

async function saveGame(game) {
  await storage.set(STORAGE_KEYS.GAME, JSON.stringify(game));
}

async function saveAnswer(name, answers) {
  await storage.set(STORAGE_KEYS.ANSWER(name), JSON.stringify({ name, answers, at: Date.now() }));
}

async function loadAllAnswers() {
  try {
    const list = await storage.list(STORAGE_KEYS.ANSWER_PREFIX);
    const keys = list?.keys || [];
    const out = [];
    for (const key of keys) {
      try {
        const r = await storage.get(key);
        if (r?.value) out.push(JSON.parse(r.value));
      } catch (e) { /* skip */ }
    }
    return out;
  } catch (e) { return []; }
}

async function clearAllAnswers() {
  try {
    const list = await storage.list(STORAGE_KEYS.ANSWER_PREFIX);
    const keys = list?.keys || [];
    for (const key of keys) {
      try { await storage.delete(key); } catch (e) {}
    }
  } catch (e) {}
}

// ============================================================
// SCORING
// ============================================================
function isCorrect(question, answer) {
  if (!question.correctAnswer || answer == null || answer === '') return false;
  if (question.type === 'text') {
    return String(answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
  }
  return answer === question.correctAnswer;
}

function getQuestionsForPlayer(game, playerName) {
  const team = game.teams?.[playerName];
  if (team === 1) return game.questionsTeam1 || game.questions;
  if (team === 2) return game.questionsTeam2 || game.questions;
  return game.questions; // fallback for players without a team
}

function calculateScore(answers, questions) {
  return questions.reduce((sum, q) => sum + (isCorrect(q, answers?.[q.id]) ? 1 : 0), 0);
}

function determineWinner(answersList, game, moleName) {
  let best = null;
  for (const a of answersList) {
    if (a.name === moleName) continue;
    const questions = getQuestionsForPlayer(game, a.name);
    const score = calculateScore(a.answers, questions);
    if (!best || score > best.score || (score === best.score && a.at < best.at)) {
      best = { name: a.name, score, at: a.at };
    }
  }
  return best;
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function Header({ subtitle }) {
  return (
    <div className="widm-header">
      <div className="widm-eyebrow">Studievereniging — Eindspel</div>
      <h1 className="widm-title">Wie is <em>de Mol?</em></h1>
      <div className="widm-divider" />
      {subtitle && <div className="widm-subtitle">{subtitle}</div>}
    </div>
  );
}

// ============================================================
// PLAYER FLOW
// ============================================================
function PickName({ game, onPick }) {
  const [selected, setSelected] = useState('');
  if (!game.players.length) {
    return (
      <div className="widm-card">
        <div className="widm-info">De organisatie heeft het spel nog niet ingericht. Wacht even — refresh over een paar seconden.</div>
      </div>
    );
  }
  return (
    <div className="widm-card">
      <div className="widm-label">Wie ben jij?</div>
      <div className="widm-player-list" style={{ marginBottom: 16 }}>
        {game.players.map((p) => (
          <div
            key={p}
            className={`widm-choice ${selected === p ? 'selected' : ''}`}
            onClick={() => setSelected(p)}
          >
            <div className="widm-choice-dot" />
            <span>{p}</span>
          </div>
        ))}
      </div>
      <button className="widm-btn" disabled={!selected} onClick={() => onPick(selected)}>
        Doorgaan
      </button>
    </div>
  );
}

function QuizForm({ game, name, onSubmit, onBack }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = getQuestionsForPlayer(game, name);
  const setAns = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));
  const allAnswered = questions.every((q) => answers[q.id] && String(answers[q.id]).trim().length > 0);

  const handleSubmit = async () => {
    if (!allAnswered) { setError('Beantwoord alle vragen.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await saveAnswer(name, answers);
      const fresh = await loadGame();
      if (!fresh.submittedBy.includes(name)) {
        fresh.submittedBy = [...fresh.submittedBy, name];
        await saveGame(fresh);
      }
      onSubmit();
    } catch (e) {
      setError('Opslaan mislukt. Probeer opnieuw.');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="widm-card" style={{ marginBottom: 16 }}>
        <div className="widm-label">Speler</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="display" style={{ fontSize: 22, color: 'var(--jade)' }}>{name}</div>
          <button className="widm-btn widm-btn-ghost widm-btn-small" onClick={onBack}>Wissel</button>
        </div>
      </div>

      {error && <div className="widm-error">{error}</div>}

      <div className="widm-card">
        {questions.map((q, i) => (
          <div key={q.id} className="widm-question">
            <div className="widm-question-num">Vraag {i + 1} van {questions.length}</div>
            <div className="widm-question-text">{q.text}</div>
            {q.type === 'text' && (
              <input
                className="widm-input"
                value={answers[q.id] || ''}
                onChange={(e) => setAns(q.id, e.target.value)}
                placeholder="Jouw antwoord…"
              />
            )}
            {q.type === 'choice' && (
              <div className="widm-choices">
                {(q.options || []).filter((o) => o.trim()).map((opt) => (
                  <div
                    key={opt}
                    className={`widm-choice ${answers[q.id] === opt ? 'selected' : ''}`}
                    onClick={() => setAns(q.id, opt)}
                  >
                    <div className="widm-choice-dot" />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}
            {q.type === 'players' && (
              <div className="widm-choices">
                {game.players.filter((p) => p !== name).map((p) => (
                  <div
                    key={p}
                    className={`widm-choice ${answers[q.id] === p ? 'selected' : ''}`}
                    onClick={() => setAns(q.id, p)}
                  >
                    <div className="widm-choice-dot" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="widm-btn" onClick={handleSubmit} disabled={submitting || !allAnswered}>
          {submitting ? 'Verzenden…' : 'Antwoorden vastzetten'}
        </button>
        {!allAnswered && <div className="widm-helper">Vul alle vragen in om door te gaan.</div>}
      </div>
    </div>
  );
}

function WaitingScreen({ name }) {
  return (
    <div className="widm-card widm-waiting">
      <div className="widm-waiting-icon">?</div>
      <div className="widm-waiting-text">Je antwoorden zijn vergrendeld, {name}.</div>
      <div className="widm-waiting-sub">Houd je telefoon open. De ontknoping volgt zo.</div>
    </div>
  );
}

function RevealScreen({ kind, name, score, total, onClose }) {
  const showScore = score != null && total != null;
  const closeBtn = onClose && (
    <button className="widm-reveal-close" onClick={onClose}>← Sluiten</button>
  );
  if (kind === 'mole') {
    return (
      <div className="widm-reveal widm-reveal-mole">
        <div className="widm-reveal-q" style={{ top: '8%', left: '6%' }}>?</div>
        <div className="widm-reveal-q" style={{ bottom: '8%', right: '6%' }}>?</div>
        <div className="widm-reveal-eyebrow">De waarheid</div>
        <h1 className="widm-reveal-title">Jij bent <em>de Mol</em>.</h1>
        <div className="widm-reveal-sub">{name}, het spel was van jou.</div>
        {closeBtn}
      </div>
    );
  }
  if (kind === 'winner') {
    return (
      <div className="widm-reveal widm-reveal-winner">
        <div className="widm-reveal-eyebrow">De ontknoping</div>
        <h1 className="widm-reveal-title">Winnaar.</h1>
        <div className="widm-reveal-sub">{name}, je hebt het spel doorzien.</div>
        {showScore && <div className="widm-reveal-score">{score} van {total} vragen goed</div>}
        {closeBtn}
      </div>
    );
  }
  return (
    <div className="widm-reveal widm-reveal-loser">
      <div className="widm-reveal-eyebrow">De ontknoping</div>
      <h1 className="widm-reveal-title">Afvaller.</h1>
      <div className="widm-reveal-sub">{name}, het zit erop voor jou.</div>
      {showScore && <div className="widm-reveal-score">{score} van {total} vragen goed</div>}
      {closeBtn}
    </div>
  );
}

function TeamRevealScreen({ teamNumber, isWinner, teamName, onClose }) {
  if (isWinner) {
    return (
      <div className="widm-reveal widm-reveal-team-win">
        <div className="widm-reveal-q" style={{ top: '8%', left: '6%' }}>★</div>
        <div className="widm-reveal-q" style={{ bottom: '8%', right: '6%' }}>★</div>
        <div className="widm-reveal-eyebrow">Teamuitslag</div>
        <h1 className="widm-reveal-title" style={{ fontSize: 72 }}>{teamName}<br /><em>wint!</em></h1>
        <div className="widm-reveal-sub">Jullie hebben de meeste euro's verdiend. Gefeliciteerd!</div>
        {onClose && <button className="widm-reveal-close" onClick={onClose} style={{ color: '#1c0a00', borderColor: 'rgba(0,0,0,0.3)' }}>← Sluiten</button>}
      </div>
    );
  }
  return (
    <div className="widm-reveal widm-reveal-team-lose">
      <div className="widm-reveal-eyebrow">Teamuitslag</div>
      <h1 className="widm-reveal-title" style={{ fontSize: 72, color: '#cbd5e1' }}>{teamName}<br /><em style={{ color: '#64748b' }}>verliest.</em></h1>
      <div className="widm-reveal-sub">Het andere team heeft meer euro's verdiend.</div>
      {onClose && <button className="widm-reveal-close" onClick={onClose}>← Sluiten</button>}
    </div>
  );
}

function PostRevealScreen({ game, name, onSwitchPlayer, onShowIndividual, onShowTeam }) {
  const myScore = game.scores?.[name];
  const isMole = game.mole === name;
  const isWinner = game.winnerName === name;
  const myTeam = game.teams?.[name];
  let myStatus = 'Afvaller';
  if (isMole) myStatus = 'De Mol';
  else if (isWinner) myStatus = 'Winnaar';

  const individualRevealed = game.phase === 'revealed-individual' || game.phase === 'revealed-team';
  const teamRevealed = game.phase === 'revealed-team';

  return (
    <div className="widm-container">
      <Header subtitle="De ontknoping" />
      <div className="widm-card">
        <div className="widm-summary-card">
          <div className="widm-label" style={{ color: 'var(--jade-bright)' }}>Jouw resultaat</div>
          <div className="widm-summary-row">
            <span className="widm-summary-label">De Mol was</span>
            <span className="widm-summary-value">{game.mole || '—'}</span>
          </div>
          <div className="widm-summary-row">
            <span className="widm-summary-label">Winnaar</span>
            <span className="widm-summary-value">{game.winnerName || '—'}</span>
          </div>
          <div className="widm-summary-row">
            <span className="widm-summary-label">Jij ({name})</span>
            <span className="widm-summary-value">
              {myStatus}
              {myScore && !isMole && (
                <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 8 }}>
                  ({myScore.score}/{myScore.total})
                </span>
              )}
            </span>
          </div>
          {teamRevealed && myTeam && (
            <div className="widm-summary-row">
              <span className="widm-summary-label">Jouw team</span>
              <span className="widm-summary-value" style={{ color: game.winningTeam === myTeam ? '#fde68a' : '#64748b' }}>
                Team {myTeam} — {game.winningTeam === myTeam ? '🏆 Gewonnen' : 'Verloren'}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="widm-card">
        {individualRevealed && (
          <button className="widm-btn widm-btn-ghost" onClick={onShowIndividual} style={{ marginBottom: 8 }}>
            Toon mijn eindscherm
          </button>
        )}
        {teamRevealed && myTeam && (
          <button className="widm-btn" onClick={onShowTeam} style={{ marginBottom: 8 }}>
            Toon teamuitslag
          </button>
        )}
        <button className="widm-btn widm-btn-ghost" onClick={onSwitchPlayer}>
          Andere speler
        </button>
      </div>
    </div>
  );
}

function PlayerView({ game }) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [screen, setScreen] = useState('summary'); // 'summary' | 'individual' | 'team'

  useEffect(() => {
    if (name && game.submittedBy.includes(name)) setSubmitted(true);
  }, [name, game.submittedBy]);

  const isRevealed = game.phase === 'revealed-individual' || game.phase === 'revealed-team';

  // When phase changes back, reset screen
  useEffect(() => {
    if (!isRevealed) setScreen('summary');
  }, [game.phase]);

  // Auto-show individual reveal when phase first becomes revealed-individual
  useEffect(() => {
    if (game.phase === 'revealed-individual' && name) setScreen('individual');
  }, [game.phase]);

  // Auto-show team reveal when phase becomes revealed-team (if was on summary/individual)
  useEffect(() => {
    if (game.phase === 'revealed-team' && name) setScreen('team');
  }, [game.phase]);

  if (isRevealed && name) {
    const myTeam = game.teams?.[name];
    const teamWon = myTeam && game.winningTeam === myTeam;
    const teamName = myTeam ? `Team ${myTeam}` : '';

    if (screen === 'individual') {
      let kind = 'loser';
      if (game.mole === name) kind = 'mole';
      else if (game.winnerName === name) kind = 'winner';
      const myScore = game.scores?.[name];
      return (
        <RevealScreen
          kind={kind}
          name={name}
          score={myScore?.score}
          total={myScore?.total}
          onClose={() => setScreen('summary')}
        />
      );
    }

    if (screen === 'team' && game.phase === 'revealed-team' && myTeam) {
      return (
        <TeamRevealScreen
          teamNumber={myTeam}
          isWinner={teamWon}
          teamName={teamName}
          onClose={() => setScreen('summary')}
        />
      );
    }

    // summary screen
    return (
      <PostRevealScreen
        game={game}
        name={name}
        onSwitchPlayer={() => { setName(''); setSubmitted(false); setScreen('summary'); }}
        onShowIndividual={() => setScreen('individual')}
        onShowTeam={() => setScreen('team')}
      />
    );
  }

  if (!name) {
    return (
      <div className="widm-container">
        <Header subtitle="Selecteer je naam om te beginnen" />
        <PickName game={game} onPick={setName} />
      </div>
    );
  }

  if (submitted || isRevealed) {
    return (
      <div className="widm-container">
        <Header />
        <WaitingScreen name={name} />
      </div>
    );
  }

  return (
    <div className="widm-container">
      <Header subtitle="De eindquiz" />
      <QuizForm
        game={game}
        name={name}
        onSubmit={() => setSubmitted(true)}
        onBack={() => setName('')}
      />
    </div>
  );
}

// ============================================================
// ADMIN: PIN
// ============================================================
function PinScreen({ game, onUnlock, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (pin === game.pin) onUnlock();
    else { setError('Onjuiste pincode.'); setPin(''); }
  };
  return (
    <div className="widm-container">
      <Header subtitle="Toegang voor de organisatie" />
      <div className="widm-card">
        <div className="widm-label">Pincode</div>
        {error && <div className="widm-error">{error}</div>}
        <input
          className="widm-input"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="••••"
          autoFocus
          style={{ marginBottom: 12, fontSize: 20, textAlign: 'center', letterSpacing: '0.4em' }}
        />
        <div className="widm-row">
          <button className="widm-btn widm-btn-ghost" onClick={onCancel}>Terug</button>
          <button className="widm-btn" onClick={submit}>Ontgrendel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN: QUESTION EDITOR
// ============================================================
function QuestionEditor({ question, index, players, onChange, onDelete }) {
  const updateField = (field, value) => onChange({ ...question, [field]: value });

  const updateOption = (idx, value) => {
    const opts = [...(question.options || [])];
    const oldVal = opts[idx];
    opts[idx] = value;
    let correctAnswer = question.correctAnswer;
    if (correctAnswer === oldVal) correctAnswer = value;
    onChange({ ...question, options: opts, correctAnswer });
  };

  const addOption = () => updateField('options', [...(question.options || []), '']);

  const removeOption = (idx) => {
    const opts = [...(question.options || [])];
    const removed = opts[idx];
    opts.splice(idx, 1);
    let correctAnswer = question.correctAnswer;
    if (correctAnswer === removed) correctAnswer = '';
    onChange({ ...question, options: opts, correctAnswer });
  };

  const handleTypeChange = (newType) => {
    const updated = { ...question, type: newType, correctAnswer: '' };
    if (newType === 'choice' && !question.options) updated.options = ['', ''];
    onChange(updated);
  };

  return (
    <div className="widm-q-editor">
      <div className="widm-q-editor-header">
        <div className="widm-q-editor-num">Vraag {index + 1}</div>
        <button className="widm-btn widm-btn-ghost widm-btn-icon" onClick={onDelete} title="Verwijder vraag">×</button>
      </div>

      <input
        className="widm-input"
        value={question.text}
        onChange={(e) => updateField('text', e.target.value)}
        placeholder="Vraagtekst…"
        style={{ marginBottom: 10 }}
      />

      <select
        className="widm-select"
        value={question.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <option value="text">Open tekstantwoord</option>
        <option value="choice">Meerkeuze</option>
        <option value="players">Speler kiezen</option>
      </select>

      {question.type === 'choice' && (
        <div style={{ marginBottom: 12 }}>
          <div className="widm-label" style={{ marginBottom: 6 }}>Antwoordopties</div>
          {(question.options || []).map((opt, i) => (
            <div key={i} className="widm-option-row">
              <input
                className="widm-input"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Optie ${i + 1}`}
              />
              <button
                className="widm-btn widm-btn-ghost widm-btn-icon"
                onClick={() => removeOption(i)}
                title="Verwijder optie"
              >×</button>
            </div>
          ))}
          <button className="widm-btn widm-btn-ghost widm-btn-small" onClick={addOption} style={{ marginTop: 4 }}>
            + Optie toevoegen
          </button>
        </div>
      )}

      <div>
        <div className="widm-label" style={{ marginBottom: 6 }}>Juist antwoord</div>
        {question.type === 'text' && (
          <input
            className="widm-input"
            value={question.correctAnswer || ''}
            onChange={(e) => updateField('correctAnswer', e.target.value)}
            placeholder="Het juiste antwoord (hoofdletterongevoelig)"
          />
        )}
        {question.type === 'choice' && (
          <select
            className="widm-select"
            value={question.correctAnswer || ''}
            onChange={(e) => updateField('correctAnswer', e.target.value)}
          >
            <option value="">— kies een optie —</option>
            {(question.options || []).filter((o) => o.trim()).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        {question.type === 'players' && (
          <select
            className="widm-select"
            value={question.correctAnswer || ''}
            onChange={(e) => updateField('correctAnswer', e.target.value)}
          >
            <option value="">— kies een speler —</option>
            {players.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN: TABS
// ============================================================
// Shared question editor panel used by both team tabs
function TeamQuestionsPanel({ teamNumber, questions, players, onSave }) {
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Sync when parent questions change (e.g. after reload)
  useEffect(() => {
    setLocalQuestions(questions);
    setDirty(false);
  }, [questions]);

  const updateQuestion = (i, q) => {
    const next = [...localQuestions];
    next[i] = q;
    setLocalQuestions(next);
    setDirty(true);
  };

  const removeQuestion = (i) => {
    if (!confirm('Vraag verwijderen?')) return;
    setLocalQuestions(localQuestions.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const addQuestion = () => {
    const id = 'q' + Date.now();
    setLocalQuestions([...localQuestions, { id, text: '', type: 'text', correctAnswer: '' }]);
    setDirty(true);
  };

  const save = async () => {
    await onSave(localQuestions);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const incomplete = localQuestions.filter((q) => !q.text.trim() || !q.correctAnswer);

  return (
    <div>
      <div className="widm-helper" style={{ marginBottom: 16 }}>
        Zelfde vragen, maar vul hier het juiste antwoord in voor <strong>Team {teamNumber}</strong> — gebaseerd op de Mol van dit team.
      </div>

      {savedFlash && <div className="widm-success">✓ Vragen Team {teamNumber} opgeslagen.</div>}
      {incomplete.length > 0 && (
        <div className="widm-info">{incomplete.length} vraag/vragen mist nog tekst of juist antwoord.</div>
      )}

      {localQuestions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          question={q}
          index={i}
          players={players}
          onChange={(nq) => updateQuestion(i, nq)}
          onDelete={() => removeQuestion(i)}
        />
      ))}

      <button className="widm-btn widm-btn-ghost" onClick={addQuestion} style={{ marginBottom: 12 }}>
        + Vraag toevoegen
      </button>

      <button className="widm-btn" onClick={save} disabled={!dirty}>
        {dirty ? `Wijzigingen opslaan (Team ${teamNumber})` : 'Opgeslagen'}
      </button>
    </div>
  );
}

function QuestionsTab({ game, refresh }) {
  const [teamTab, setTeamTab] = useState(1);

  const saveTeam = async (team, questions) => {
    const fresh = await loadGame();
    if (team === 1) fresh.questionsTeam1 = questions;
    else fresh.questionsTeam2 = questions;
    await saveGame(fresh);
    refresh();
  };

  return (
    <div className="widm-card">
      <div className="widm-label">Vragen per team</div>

      {/* Team sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
        <button
          onClick={() => setTeamTab(1)}
          style={{
            flex: 1, padding: '10px', background: 'transparent', border: 'none',
            borderBottom: teamTab === 1 ? '2px solid #3b82f6' : '2px solid transparent',
            color: teamTab === 1 ? '#93c5fd' : 'var(--muted)',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Team 1 ({(game.questionsTeam1 || game.questions).length} vragen)
        </button>
        <button
          onClick={() => setTeamTab(2)}
          style={{
            flex: 1, padding: '10px', background: 'transparent', border: 'none',
            borderBottom: teamTab === 2 ? '2px solid #eab308' : '2px solid transparent',
            color: teamTab === 2 ? '#fde68a' : 'var(--muted)',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Team 2 ({(game.questionsTeam2 || game.questions).length} vragen)
        </button>
      </div>

      {teamTab === 1 && (
        <TeamQuestionsPanel
          key="team1"
          teamNumber={1}
          questions={game.questionsTeam1 || game.questions}
          players={game.players}
          onSave={(q) => saveTeam(1, q)}
        />
      )}
      {teamTab === 2 && (
        <TeamQuestionsPanel
          key="team2"
          teamNumber={2}
          questions={game.questionsTeam2 || game.questions}
          players={game.players}
          onSave={(q) => saveTeam(2, q)}
        />
      )}
    </div>
  );
}

function ScoresTab({ game, answers }) {
  const scored = answers.map((a) => {
    const questions = getQuestionsForPlayer(game, a.name);
    return {
      name: a.name,
      score: calculateScore(a.answers, questions),
      total: questions.length,
      at: a.at,
      answers: a.answers,
      questions,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.at - b.at);

  const eligibleForWin = scored.filter((s) => s.name !== game.mole);
  const leader = eligibleForWin[0];

  return (
    <div className="widm-card">
      <div className="widm-label">Live scores ({scored.length} van {game.players.length} ingezonden)</div>

      {scored.length === 0 && (
        <div className="widm-helper">Nog geen inzendingen om te scoren.</div>
      )}

      {scored.length > 0 && (
        <>
          {leader && (
            <div className="widm-info" style={{ marginBottom: 16 }}>
              Huidige koploper: <strong>{leader.name}</strong> met {leader.score} / {leader.total} goed
              {eligibleForWin.filter((s) => s.score === leader.score).length > 1 && ' (gelijkspel — vroegste inzending wint)'}
            </div>
          )}

          {scored.map((s) => {
            const isMole = s.name === game.mole;
            const isLeader = !isMole && leader && s.name === leader.name;
            const rank = isMole ? '—' : (eligibleForWin.findIndex((x) => x.name === s.name) + 1);
            const playerTeam = game.teams?.[s.name];
            return (
              <div key={s.name} className={`widm-score-row ${isLeader ? 'is-leader' : ''} ${isMole ? 'is-mole-row' : ''}`}>
                <div className="widm-score-rank">{rank}</div>
                <div className="widm-score-name">
                  {s.name}
                  {playerTeam === 1 && <span className="widm-team-badge widm-team-badge-1">T1</span>}
                  {playerTeam === 2 && <span className="widm-team-badge widm-team-badge-2">T2</span>}
                  {isMole && <span className="widm-tag widm-tag-mole">Mol</span>}
                  {isLeader && <span className="widm-tag widm-tag-winner">Koploper</span>}
                </div>
                <div className="widm-score-value">
                  {s.score}<span className="widm-score-value-total"> / {s.total}</span>
                </div>
              </div>
            );
          })}

          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--jade-soft)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Bekijk alle antwoorden
            </summary>
            <div style={{ marginTop: 12 }}>
              {scored.map((s) => (
                <div key={s.name} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div className="display" style={{ fontSize: 18, color: 'var(--jade)', marginBottom: 6 }}>
                    {s.name} — {s.score}/{s.total}
                  </div>
                  {s.questions.map((q) => {
                    const ans = s.answers[q.id];
                    const correct = isCorrect(q, ans);
                    return (
                      <div key={q.id} style={{ marginBottom: 6, fontSize: 13 }}>
                        <div style={{ color: 'var(--muted)', fontSize: 11 }}>{q.text}</div>
                        <div style={{ color: correct ? 'var(--jade-bright)' : 'var(--ivory)' }}>
                          {ans || '—'} {correct && '✓'}
                          {!correct && q.correctAnswer && (
                            <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                              (juist: {q.correctAnswer})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function PlayersTab({ game, scoresMap, refresh }) {
  const [newPlayer, setNewPlayer] = useState('');
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };

  const addPlayer = async () => {
    const n = newPlayer.trim();
    if (!n) return;
    if (game.players.includes(n)) { flash('Naam bestaat al.'); return; }
    const fresh = await loadGame();
    fresh.players = [...fresh.players, n];
    await saveGame(fresh);
    setNewPlayer('');
    refresh();
  };
  const removePlayer = async (p) => {
    if (!confirm(`${p} verwijderen?`)) return;
    const fresh = await loadGame();
    fresh.players = fresh.players.filter((x) => x !== p);
    if (fresh.mole === p) fresh.mole = null;
    fresh.submittedBy = fresh.submittedBy.filter((x) => x !== p);
    const newTeams = { ...fresh.teams };
    delete newTeams[p];
    fresh.teams = newTeams;
    await saveGame(fresh);
    refresh();
  };
  const setMole = async (p) => {
    const fresh = await loadGame();
    fresh.mole = fresh.mole === p ? null : p;
    await saveGame(fresh);
    refresh();
  };
  const setTeam = async (p, team) => {
    const fresh = await loadGame();
    const current = fresh.teams?.[p];
    fresh.teams = { ...(fresh.teams || {}), [p]: current === team ? null : team };
    await saveGame(fresh);
    refresh();
  };

  const team1 = game.players.filter((p) => game.teams?.[p] === 1);
  const team2 = game.players.filter((p) => game.teams?.[p] === 2);
  const noTeam = game.players.filter((p) => !game.teams?.[p]);

  return (
    <div className="widm-card">
      <div className="widm-label">Speler toevoegen</div>
      <input
        className="widm-input"
        value={newPlayer}
        onChange={(e) => setNewPlayer(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
        placeholder="Naam van de speler"
        style={{ marginBottom: 8, fontSize: 16 }}
      />
      <button className="widm-btn" onClick={addPlayer} style={{ marginBottom: 16 }}>Voeg toe</button>

      {msg && <div className="widm-info">{msg}</div>}

      {game.players.length > 0 && (
        <div className="widm-info" style={{ marginBottom: 12 }}>
          Team 1: {team1.length} spelers · Team 2: {team2.length} spelers
          {noTeam.length > 0 && ` · ${noTeam.length} zonder team`}
        </div>
      )}

      <div className="widm-label">Spelers ({game.players.length})</div>
      {game.players.length === 0 && <div className="widm-helper">Nog geen spelers toegevoegd.</div>}
      <div className="widm-player-list">
        {game.players.map((p) => {
          const score = scoresMap[p];
          const playerTeam = game.teams?.[p];
          return (
            <div key={p} className={`widm-player-item ${game.mole === p ? 'is-mole' : ''}`}>
              <div className="widm-player-name">
                <span>{p}</span>
                {game.mole === p && <span className="widm-tag widm-tag-mole">Mol</span>}
                {playerTeam === 1 && <span className="widm-team-badge widm-team-badge-1">Team 1</span>}
                {playerTeam === 2 && <span className="widm-team-badge widm-team-badge-2">Team 2</span>}
                {game.submittedBy.includes(p) && <span className="widm-tag widm-tag-submitted">Verzonden</span>}
                {score != null && (
                  <span className="widm-tag widm-tag-score">{score} / {game.questions.length} goed</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={`widm-btn widm-btn-small ${playerTeam === 1 ? '' : 'widm-btn-ghost'}`}
                  style={{ minWidth: 58, fontSize: 10 }}
                  onClick={() => setTeam(p, 1)}
                >T1</button>
                <button
                  className={`widm-btn widm-btn-small ${playerTeam === 2 ? '' : 'widm-btn-ghost'}`}
                  style={{ minWidth: 58, fontSize: 10 }}
                  onClick={() => setTeam(p, 2)}
                >T2</button>
                <button className="widm-btn widm-btn-ghost widm-btn-small" onClick={() => setMole(p)}>
                  {game.mole === p ? '✓ Mol' : 'Mol'}
                </button>
                <button className="widm-btn widm-btn-ghost widm-btn-small" onClick={() => removePlayer(p)}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevealTab({ game, answers, refresh }) {
  const [confirmIndividual, setConfirmIndividual] = useState(false);
  const [confirmTeam, setConfirmTeam] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [selectedWinningTeam, setSelectedWinningTeam] = useState(game.winningTeam || '');
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const setPhase = async (phase) => {
    const fresh = await loadGame();
    fresh.phase = phase;
    if (phase === 'setup' || phase === 'quiz') {
      fresh.revealedAt = null;
      fresh.teamRevealedAt = null;
    }
    await saveGame(fresh);
    refresh();
  };

  const revealIndividual = async () => {
    const winner = determineWinner(answers, game, game.mole);
    const scores = {};
    for (const a of answers) {
      const questions = getQuestionsForPlayer(game, a.name);
      scores[a.name] = {
        score: calculateScore(a.answers, questions),
        total: questions.length,
        at: a.at,
      };
    }
    const fresh = await loadGame();
    fresh.phase = 'revealed-individual';
    fresh.revealedAt = Date.now();
    fresh.scores = scores;
    fresh.winnerName = winner?.name || null;
    await saveGame(fresh);
    setConfirmIndividual(false);
    refresh();
    flash('Individuele onthulling gestart! Iedereen ziet zijn eigen scherm.');
  };

  const revealTeam = async () => {
    const fresh = await loadGame();
    fresh.phase = 'revealed-team';
    fresh.winningTeam = Number(selectedWinningTeam);
    fresh.teamRevealedAt = Date.now();
    await saveGame(fresh);
    setConfirmTeam(false);
    refresh();
    flash('Teamuitslag onthuld!');
  };

  const unrevealTeam = async () => {
    const fresh = await loadGame();
    fresh.phase = 'revealed-individual';
    fresh.teamRevealedAt = null;
    await saveGame(fresh);
    refresh();
  };

  const unrevealAll = async () => {
    const fresh = await loadGame();
    fresh.phase = 'quiz';
    fresh.revealedAt = null;
    fresh.teamRevealedAt = null;
    await saveGame(fresh);
    refresh();
  };

  const resetAnswers = async () => {
    await clearAllAnswers();
    const fresh = await loadGame();
    fresh.phase = 'setup';
    fresh.submittedBy = [];
    fresh.scores = {};
    fresh.winnerName = null;
    fresh.winningTeam = null;
    fresh.revealedAt = null;
    fresh.teamRevealedAt = null;
    await saveGame(fresh);
    setConfirmReset(false);
    refresh();
    flash('Antwoorden gewist (spelers en vragen behouden).');
  };

  const fullReset = async () => {
    await clearAllAnswers();
    await saveGame({ ...DEFAULT_GAME, pin: game.pin });
    refresh();
    flash('Volledige reset.');
  };

  const winnerPreview = determineWinner(answers, game, game.mole);
  const incompleteQuestions = game.questions.filter((q) => !q.correctAnswer);
  const isIndividualRevealed = game.phase === 'revealed-individual' || game.phase === 'revealed-team';
  const isTeamRevealed = game.phase === 'revealed-team';

  return (
    <div className="widm-card">
      {msg && <div className="widm-success">{msg}</div>}

      {/* Summary after reveal */}
      {isIndividualRevealed && (
        <div className="widm-summary-card" style={{ marginBottom: 20 }}>
          <div className="widm-label" style={{ color: 'var(--jade-bright)' }}>Resultaat</div>
          <div className="widm-summary-row">
            <span className="widm-summary-label">De Mol was</span>
            <span className="widm-summary-value">{game.mole || '—'}</span>
          </div>
          <div className="widm-summary-row">
            <span className="widm-summary-label">Winnaar</span>
            <span className="widm-summary-value">
              {game.winnerName || '—'}
              {game.winnerName && game.scores?.[game.winnerName] && (
                <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 8 }}>
                  ({game.scores[game.winnerName].score}/{game.scores[game.winnerName].total})
                </span>
              )}
            </span>
          </div>
          {isTeamRevealed && (
            <div className="widm-summary-row">
              <span className="widm-summary-label">Winnend team</span>
              <span className="widm-summary-value" style={{ color: '#fde68a' }}>Team {game.winningTeam}</span>
            </div>
          )}
          <div className="widm-summary-row">
            <span className="widm-summary-label">Onthuld om</span>
            <span className="widm-summary-value" style={{ fontSize: 16 }}>
              {new Date(game.revealedAt).toLocaleTimeString('nl-NL')}
            </span>
          </div>
        </div>
      )}

      {/* Phase controls */}
      <div className="widm-label">Spelfase</div>
      <div className="widm-row" style={{ marginBottom: 12 }}>
        <button
          className={`widm-btn ${game.phase === 'setup' ? '' : 'widm-btn-ghost'}`}
          onClick={() => setPhase('setup')}
        >Setup</button>
        <button
          className={`widm-btn ${game.phase === 'quiz' ? '' : 'widm-btn-ghost'}`}
          onClick={() => setPhase('quiz')}
        >Quiz open</button>
      </div>
      <div className="widm-helper" style={{ marginBottom: 24 }}>
        Zet 'Quiz open' wanneer spelers mogen invullen.
      </div>

      <div className="widm-divider" style={{ margin: '24px auto' }} />

      {/* RONDE 1: Individuele onthulling */}
      <div className="widm-label" style={{ color: 'var(--jade-bright)' }}>Ronde 1 — Individuele onthulling</div>

      {!game.mole && <div className="widm-error">⚠ Stel eerst een Mol in via het Spelers-tabblad.</div>}
      {incompleteQuestions.length > 0 && (
        <div className="widm-error">⚠ {incompleteQuestions.length} vraag/vragen mist een juist antwoord.</div>
      )}
      {answers.length === 0 && !isIndividualRevealed && (
        <div className="widm-info">Nog geen inzendingen — bij onthulling is er geen winnaar.</div>
      )}
      {winnerPreview && !isIndividualRevealed && (
        <div className="widm-info">
          Voorlopige winnaar: <strong>{winnerPreview.name}</strong> ({winnerPreview.score}/{game.questions.length})
        </div>
      )}

      {!isIndividualRevealed && !confirmIndividual && (
        <button
          className="widm-btn"
          disabled={!game.mole}
          onClick={() => setConfirmIndividual(true)}
          style={{ marginBottom: 8 }}
        >
          Onthul individueel
        </button>
      )}

      {confirmIndividual && !isIndividualRevealed && (
        <>
          <div className="widm-info">
            Iedereen ziet zijn eigen scherm (winnaar / afvaller / mol).
            <br />Mol: <strong>{game.mole}</strong>
            {winnerPreview && <> · Winnaar: <strong>{winnerPreview.name}</strong></>}
          </div>
          <div className="widm-row">
            <button className="widm-btn widm-btn-ghost" onClick={() => setConfirmIndividual(false)}>Annuleren</button>
            <button className="widm-btn widm-btn-danger" onClick={revealIndividual}>GO — onthul individueel</button>
          </div>
        </>
      )}

      {isIndividualRevealed && !isTeamRevealed && (
        <div className="widm-success">✓ Individuele onthulling actief</div>
      )}
      {isIndividualRevealed && (
        <button className="widm-btn widm-btn-ghost" onClick={unrevealAll} style={{ marginBottom: 8 }}>
          Individuele onthulling terugdraaien
        </button>
      )}

      <div className="widm-divider" style={{ margin: '24px auto' }} />

      {/* RONDE 2: Team onthulling */}
      <div className="widm-label" style={{ color: '#fde68a' }}>Ronde 2 — Teamuitslag</div>

      {!isIndividualRevealed && (
        <div className="widm-helper" style={{ marginBottom: 12 }}>
          Doe eerst de individuele onthulling (Ronde 1).
        </div>
      )}

      {isIndividualRevealed && !isTeamRevealed && (
        <>
          <div className="widm-label" style={{ marginBottom: 6 }}>Welk team heeft gewonnen?</div>
          <div className="widm-row" style={{ marginBottom: 12 }}>
            <button
              className={`widm-btn ${selectedWinningTeam === 1 ? '' : 'widm-btn-ghost'}`}
              onClick={() => setSelectedWinningTeam(1)}
            >Team 1</button>
            <button
              className={`widm-btn ${selectedWinningTeam === 2 ? '' : 'widm-btn-ghost'}`}
              onClick={() => setSelectedWinningTeam(2)}
            >Team 2</button>
          </div>
          <div className="widm-helper" style={{ marginBottom: 12 }}>
            Het winnende team is het team dat de meeste euro's heeft verdiend.
          </div>

          {!confirmTeam ? (
            <button
              className="widm-btn"
              disabled={!selectedWinningTeam}
              onClick={() => setConfirmTeam(true)}
            >
              Onthul teamuitslag
            </button>
          ) : (
            <>
              <div className="widm-info">
                <strong>Team {selectedWinningTeam}</strong> wint. Iedereen ziet het teamscherm.
              </div>
              <div className="widm-row">
                <button className="widm-btn widm-btn-ghost" onClick={() => setConfirmTeam(false)}>Annuleren</button>
                <button className="widm-btn widm-btn-danger" onClick={revealTeam}>GO — onthul team</button>
              </div>
            </>
          )}
        </>
      )}

      {isTeamRevealed && (
        <>
          <div className="widm-success">✓ Teamuitslag actief — Team {game.winningTeam} heeft gewonnen</div>
          <button className="widm-btn widm-btn-ghost" onClick={unrevealTeam}>
            Teamuitslag terugdraaien
          </button>
        </>
      )}

      <div className="widm-divider" style={{ margin: '32px auto' }} />

      <div className="widm-label">Reset</div>
      {!confirmReset ? (
        <>
          <button className="widm-btn widm-btn-ghost" onClick={() => setConfirmReset(true)} style={{ marginBottom: 8 }}>
            Antwoorden wissen (spelers + vragen behouden)
          </button>
          <button className="widm-btn widm-btn-ghost" onClick={() => { if (confirm('Echt alles resetten?')) fullReset(); }}>
            Volledige reset (alles weg)
          </button>
        </>
      ) : (
        <>
          <div className="widm-error">Hiermee verdwijnen alle inzendingen en gaat de fase terug naar setup.</div>
          <div className="widm-row">
            <button className="widm-btn widm-btn-ghost" onClick={() => setConfirmReset(false)}>Annuleren</button>
            <button className="widm-btn widm-btn-danger" onClick={resetAnswers}>Bevestigen</button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// ADMIN: PANEL
// ============================================================
function AdminPanel({ game, refresh, onExit }) {
  const [tab, setTab] = useState('players');
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const a = await loadAllAnswers();
      if (!cancelled) setAnswers(a);
    };
    load();
    const interval = setInterval(load, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const scoresMap = {};
  for (const a of answers) {
    const questions = getQuestionsForPlayer(game, a.name);
    scoresMap[a.name] = calculateScore(a.answers, questions);
  }

  return (
    <div className="widm-container">
      <Header subtitle="Organisatie — controlepaneel" />

      <div className="widm-status">
        <div className="widm-status-item">
          <div className="widm-status-label">Fase</div>
          <div className="widm-status-value">
            {game.phase === 'setup' ? 'Voorbereiding' : game.phase === 'quiz' ? 'Quiz open' : game.phase === 'revealed-individual' ? 'Individueel onthuld' : 'Team onthuld'}
          </div>
        </div>
        <div className="widm-status-item">
          <div className="widm-status-label">Inzendingen</div>
          <div className="widm-status-value">{game.submittedBy.length} / {game.players.length}</div>
        </div>
        <div className="widm-status-item">
          <div className="widm-status-label">Vragen</div>
          <div className="widm-status-value">{game.questions.length}</div>
        </div>
      </div>

      <div className="widm-tabs">
        <button className={`widm-tab ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Spelers</button>
        <button className={`widm-tab ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>Vragen</button>
        <button className={`widm-tab ${tab === 'scores' ? 'active' : ''}`} onClick={() => setTab('scores')}>Scores</button>
        <button className={`widm-tab ${tab === 'reveal' ? 'active' : ''}`} onClick={() => setTab('reveal')}>Onthulling</button>
      </div>

      {tab === 'players' && <PlayersTab game={game} scoresMap={scoresMap} refresh={refresh} />}
      {tab === 'questions' && <QuestionsTab game={game} refresh={refresh} />}
      {tab === 'scores' && <ScoresTab game={game} answers={answers} />}
      {tab === 'reveal' && <RevealTab game={game} answers={answers} refresh={refresh} />}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="widm-btn widm-btn-ghost widm-btn-small" onClick={onExit}>← Terug naar spelersweergave</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('player');
  const pollRef = useRef();

  const refresh = async () => {
    const g = await loadGame();
    setGame(g);
  };

  useEffect(() => {
    refresh().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  if (loading || !game) {
    return (
      <>
        <link href={FONT_LINK} rel="stylesheet" />
        <style>{css}</style>
        <div className="widm-app">
          <div className="widm-loading">een ogenblik…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <link href={FONT_LINK} rel="stylesheet" />
      <style>{css}</style>
      <div className="widm-app">
        {mode === 'player' && <PlayerView game={game} />}
        {mode === 'admin-pin' && (
          <PinScreen game={game} onUnlock={() => setMode('admin')} onCancel={() => setMode('player')} />
        )}
        {mode === 'admin' && <AdminPanel game={game} refresh={refresh} onExit={() => setMode('player')} />}

        {mode === 'player' && (
          <button className="widm-admin-link" onClick={() => setMode('admin-pin')}>
            ADMIN
          </button>
        )}
      </div>
    </>
  );
}
