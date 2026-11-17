import { useEffect, useMemo, useRef, useState } from "react";
import usePageStyles from "../hooks/usePageStyles";
import useTitle from "../hooks/useTitle";
import testsCss from "../styles/tests.css?inline";
import quizCss from "../styles/quiz.css?inline";
import chatCss from "../styles/chat.css?inline";
import { chatAsk, chatStatus } from "../api";

const css = testsCss + "\n" + quizCss + "\n" + chatCss;

const STORAGE_KEY = "calm_qualm_chats_v1";
const ACTIVE_KEY = "calm_qualm_active_v1";
const GREETING =
  "Привет, я Квалм — спокойный помощник Calm. Расскажи, что у тебя на душе, или задай вопрос. Я не заменю специалиста, но постараюсь помочь.";

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;
    return list;
  } catch {
    return null;
  }
}
function saveChats(chats) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch { /* storage full */ }
}
function loadActiveId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}
function saveActiveId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

function makeNewChat() {
  return {
    id: newId(),
    title: "Новый разговор",
    createdAt: Date.now(),
    messages: [{ role: "ai", text: GREETING }],
  };
}

function titleFrom(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 40 ? t.slice(0, 40) + "…" : t || "Разговор";
}

export default function Chat() {
  usePageStyles(css);
  useTitle("Квалм");

  // Инициализируем чаты один раз
  const [chats, setChats] = useState(() => loadChats() || [makeNewChat()]);
  const [activeId, setActiveId] = useState(() => {
    const saved = loadActiveId();
    const list = loadChats() || [];
    if (saved && list.some((c) => c.id === saved)) return saved;
    return list[0]?.id || null;
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState(null);
  const [showList, setShowList] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { if (activeId) saveActiveId(activeId); }, [activeId]);

  // Если activeId не указан (первый заход) — создаём и выбираем
  useEffect(() => {
    if (!activeId && chats.length > 0) setActiveId(chats[0].id);
  }, [activeId, chats]);

  useEffect(() => {
    chatStatus()
      .then((s) => setMode(s?.online ? "llm" : "offline"))
      .catch(() => setMode(null));
  }, []);

  const active = useMemo(() => chats.find((c) => c.id === activeId) || null, [chats, activeId]);
  const messages = active?.messages || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, activeId]);

  function updateActive(next) {
    setChats((list) => list.map((c) => (c.id === activeId ? { ...c, ...next } : c)));
  }

  function openNewChat() {
    const fresh = makeNewChat();
    setChats((list) => [fresh, ...list]);
    setActiveId(fresh.id);
    setShowList(false);
  }

  function pickChat(id) {
    setActiveId(id);
    setShowList(false);
  }

  function deleteChat(id) {
    setChats((list) => {
      const next = list.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeNewChat();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !active) return;

    const isFirstUserMessage = !active.messages.some((m) => m.role === "user");
    const nextMessages = [...active.messages, { role: "user", text }];
    updateActive({
      messages: nextMessages,
      title: isFirstUserMessage ? titleFrom(text) : active.title,
    });
    setInput("");
    setSending(true);

    try {
      const historyForServer = nextMessages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
      const res = await chatAsk(text, historyForServer);
      if (res?.mode) setMode(res.mode);
      setChats((list) =>
        list.map((c) =>
          c.id === active.id ? { ...c, messages: [...nextMessages, { role: "ai", text: res.reply }] } : c
        )
      );
    } catch {
      setChats((list) =>
        list.map((c) =>
          c.id === active.id
            ? { ...c, messages: [...nextMessages, { role: "ai", text: "Что-то сорвалось со связью. Попробуй ещё раз через минуту." }] }
            : c
        )
      );
    } finally {
      setSending(false);
    }
  }

  const badge = mode === "llm" ? "нейросеть" : mode === "offline" ? "офлайн-режим" : "подключаюсь";

  return (
    <>
      <main className="main">
        <div className="contaniner">
          <div className="text_t">
            <h4>
              Квалм
              <span className="chat_badge">{badge}</span>
            </h4>
          </div>

          <div className="chat_wrap">
            <div className="chat_toolbar">
              <button type="button" className="chat_tool_btn" onClick={() => setShowList((v) => !v)}>
                {showList ? "Закрыть историю" : `История (${chats.length})`}
              </button>
              <button type="button" className="chat_tool_btn chat_tool_btn_primary" onClick={openNewChat}>
                + Новый чат
              </button>
            </div>

            {showList && (
              <div className="chat_list" role="listbox">
                {chats.map((c) => (
                  <div
                    key={c.id}
                    className={"chat_list_item" + (c.id === activeId ? " is-active" : "")}
                  >
                    <button
                      type="button"
                      className="chat_list_pick"
                      onClick={() => pickChat(c.id)}
                      title={c.title}
                    >
                      <span className="chat_list_title">{c.title}</span>
                      <span className="chat_list_meta">
                        {new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        {" · "}{c.messages.filter((m) => m.role === "user").length} соо.
                      </span>
                    </button>
                    <button
                      type="button"
                      className="chat_list_del"
                      onClick={() => deleteChat(c.id)}
                      aria-label="Удалить чат"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="chat_hint">
              Квалм — твой личный помощник. Он не заменяет специалиста. Если тебе сейчас очень плохо и
              ты думаешь о том, чтобы причинить себе вред, позвони на бесплатную линию:
              8-800-2000-122 (для детей и подростков) или 051 (для взрослых, Москва).
            </div>

            <div className="chat_messages" ref={scrollRef} aria-live="polite">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="chat_bubble chat_bubble_user">{m.text}</div>
                ) : (
                  <div key={i} className="chat_row chat_row_ai">
                    <img className="chat_avatar" src="/static/images/frog.gif" alt="Квалм" />
                    <div className="chat_bubble chat_bubble_ai">{m.text}</div>
                  </div>
                )
              )}
              {sending && (
                <div className="chat_row chat_row_ai">
                  <img className="chat_avatar" src="/static/images/frog.gif" alt="Квалм" />
                  <div className="chat_bubble chat_bubble_ai">
                    <span className="chat_typing" aria-label="печатает">
                      <span /> <span /> <span />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <form className="chat_form" onSubmit={onSubmit}>
              <input
                className="chat_input"
                placeholder="Напишите Квалму..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                aria-label="Сообщение"
                maxLength={2000}
              />
              <button className="chat_send" type="submit" disabled={sending || !input.trim()}>
                →
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="contaniner">
          <div className="taxt_footer">
            <p>Разговор сохраняется только в вашем устройстве. Результаты тестов — не диагноз.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
