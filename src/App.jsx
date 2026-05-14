import { useState, useEffect, useRef } from "react";

const NATURE_PALETTE = {
  bg: "#0d1a0f", surface: "#111f13", card: "#162018", border: "#1e3322",
  accent: "#4ade80", gold: "#fbbf24", text: "#e8f5e9",
  textMuted: "#7dab87", textFaint: "#3d6b47", danger: "#f87171",
};
const categoryColors = {
  Bird: "#60a5fa", Mammal: "#f97316", Reptile: "#a3e635", Amphibian: "#34d399",
  Fish: "#22d3ee", Insect: "#fbbf24", Plant: "#4ade80", Fungus: "#c084fc",
  Marine: "#38bdf8", Other: "#94a3b8",
};
const RARITY_LABELS = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const RARITY_COLORS = ["#94a3b8", "#4ade80", "#60a5fa", "#c084fc", "#fbbf24"];

function getRarity(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("endangered") || t.includes("critically") || t.includes("extremely rare")) return 4;
  if (t.includes("rare") || t.includes("uncommon") || t.includes("seldom")) return 2;
  if (t.includes("fairly common") || t.includes("occasionally")) return 1;
  return 0;
}

async function compressImage(base64, mime) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 1024;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
      else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ b64: dataUrl.split(",")[1], mime: "image/jpeg" });
    };
    img.src = `data:${mime};base64,${base64}`;
  });
}

async function identifyWithClaude(base64Image, mimeType) {
  const compressed = await compressImage(base64Image, mimeType);
  const response = await fetch("/api/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: compressed.mime, data: compressed.b64 } },
          { type: "text", text: `You are a wildlife and nature expert. Identify what is in this photo. Respond ONLY with a JSON object, no markdown, no backticks, no preamble. Keys: name, scientificName, category, description, conservationStatus, confidence. Category must be one of: Bird, Mammal, Reptile, Amphibian, Fish, Insect, Plant, Fungus, Marine, Other. Confidence: High, Medium, or Low.` }
        ]
      }]
    })
  });
  const rawText = await response.text();
  let data;
  try { data = JSON.parse(rawText); } catch { throw new Error("Server error: " + rawText.slice(0, 100)); }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (!data.content?.length) throw new Error("Empty response");
  const text = data.content.map(i => i.text || "").join("").trim();
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(stripped); } catch {
    const s = stripped.indexOf("{"), e = stripped.lastIndexOf("}");
    if (s !== -1 && e !== -1) { try { return JSON.parse(stripped.slice(s, e + 1)); } catch {} }
    return { name: "Unknown", scientificName: "", category: "Other", description: stripped.slice(0, 300), conservationStatus: "Unknown", confidence: "Low" };
  }
}

function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function Avatar({ name, size = 32 }) {
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},60%,35%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(name || "?").slice(0, 2).toUpperCase()}</div>;
}

function Badge({ rarity }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: RARITY_COLORS[rarity], border: `1px solid ${RARITY_COLORS[rarity]}44`, borderRadius: 4, padding: "2px 6px", background: `${RARITY_COLORS[rarity]}11` }}>{RARITY_LABELS[rarity].toUpperCase()}</span>;
}

function CatTag({ category }) {
  const color = categoryColors[category] || categoryColors.Other;
  return <span style={{ fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", background: `${color}11` }}>{category}</span>;
}

function FindCard({ find, onLike, currentUser }) {
  const rarity = find.rarity ?? 0;
  const liked = find.likes?.includes(currentUser);
  return (
    <div style={{ background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 16, overflow: "hidden" }}>
      {find.imageUrl && (
        <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
          <img src={find.imageUrl} alt={find.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0d1a0fcc 30%, transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>{find.name}</div>
            {find.scientificName && <div style={{ fontSize: 11, color: "#ffffffaa", fontStyle: "italic" }}>{find.scientificName}</div>}
          </div>
          <div style={{ position: "absolute", top: 10, right: 10 }}><Badge rarity={rarity} /></div>
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <CatTag category={find.category} />
          {find.conservationStatus && find.conservationStatus !== "Unknown" && (
            <span style={{ fontSize: 11, color: NATURE_PALETTE.textMuted, padding: "2px 6px", border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 4 }}>{find.conservationStatus}</span>
          )}
        </div>
        {find.description && <p style={{ fontSize: 12, color: NATURE_PALETTE.textMuted, margin: "0 0 10px", lineHeight: 1.5 }}>{find.description}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar name={find.username} size={24} />
            <span style={{ fontSize: 12, color: NATURE_PALETTE.textMuted }}>{find.username}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: NATURE_PALETTE.textFaint }}>{timeAgo(find.timestamp)}</span>
            {onLike && (
              <button onClick={() => onLike(find.id)} style={{ background: "none", border: "none", cursor: "pointer", color: liked ? NATURE_PALETTE.danger : NATURE_PALETTE.textMuted, fontSize: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                {liked ? "♥" : "♡"} <span style={{ fontSize: 11 }}>{find.likes?.length || 0}</span>
              </button>
            )}
          </div>
        </div>
        {find.notes && <div style={{ marginTop: 8, fontSize: 12, color: NATURE_PALETTE.textMuted, fontStyle: "italic", borderTop: `1px solid ${NATURE_PALETTE.border}`, paddingTop: 8 }}>"{find.notes}"</div>}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onSave, username }) {
  const [step, setStep] = useState("upload");
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [shareToFeed, setShareToFeed] = useState(true);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImageUrl(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setImageMime(file.type || "image/jpeg");
    };
    reader.onerror = () => setError("Failed to read image.");
    reader.readAsDataURL(file);
  };

  const identify = async () => {
    setStep("identifying"); setError(null);
    try {
      const result = await identifyWithClaude(imageBase64, imageMime);
      setAiResult(result); setStep("review");
    } catch (err) {
      setError("Error: " + err.message); setStep("upload");
    }
  };

  const save = async () => {
    setStep("saving");
    const find = {
      id: Date.now().toString(), name: aiResult.name, scientificName: aiResult.scientificName || "",
      category: aiResult.category, description: aiResult.description, conservationStatus: aiResult.conservationStatus,
      confidence: aiResult.confidence, rarity: getRarity(aiResult.description + " " + aiResult.conservationStatus),
      imageUrl, notes, username, timestamp: Date.now(), likes: [], sharedToFeed: shareToFeed,
    };
    await onSave(find, shareToFeed);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: NATURE_PALETTE.surface, border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: NATURE_PALETTE.text, margin: 0, fontSize: 22 }}>
            {step === "upload" ? "New Find" : step === "identifying" ? "Identifying..." : step === "review" ? "Review Find" : "Saving..."}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: NATURE_PALETTE.textMuted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {step === "identifying" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ color: NATURE_PALETTE.textMuted }}>Analyzing your photo...</div>
          </div>
        )}

        {step === "saving" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
            <div style={{ color: NATURE_PALETTE.textMuted }}>Saving your find...</div>
          </div>
        )}

        {(step === "upload" || step === "review") && (
          <>
            {!imageUrl ? (
              <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${NATURE_PALETTE.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", marginBottom: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
                <div style={{ color: NATURE_PALETTE.textMuted, fontSize: 14 }}>Tap to choose a photo</div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div style={{ position: "relative", marginBottom: 16, borderRadius: 12, overflow: "hidden" }}>
                <img src={imageUrl} alt="Preview" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
                {step === "upload" && (
                  <button onClick={() => { setImageUrl(null); setImageBase64(null); }} style={{ position: "absolute", top: 8, right: 8, background: "#000a", border: "none", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
                )}
              </div>
            )}

            {error && <div style={{ color: NATURE_PALETTE.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            {step === "upload" && imageBase64 && (
              <button onClick={identify} style={{ width: "100%", padding: "12px", background: NATURE_PALETTE.accent, color: "#0d1a0f", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
                🔍 Identify with AI
              </button>
            )}

            {step === "review" && aiResult && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <CatTag category={aiResult.category} />
                  <Badge rarity={getRarity(aiResult.description + " " + aiResult.conservationStatus)} />
                  <span style={{ fontSize: 11, color: aiResult.confidence === "High" ? NATURE_PALETTE.accent : NATURE_PALETTE.gold, marginLeft: "auto" }}>{aiResult.confidence} confidence</span>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: NATURE_PALETTE.text, fontWeight: 700 }}>{aiResult.name}</div>
                {aiResult.scientificName && <div style={{ fontSize: 12, color: NATURE_PALETTE.textMuted, fontStyle: "italic", marginBottom: 6 }}>{aiResult.scientificName}</div>}
                <p style={{ fontSize: 13, color: NATURE_PALETTE.textMuted, lineHeight: 1.5, margin: "8px 0" }}>{aiResult.description}</p>
                <div style={{ fontSize: 12, color: NATURE_PALETTE.textFaint }}>Conservation: {aiResult.conservationStatus}</div>
              </div>
            )}

            {step === "review" && (
              <>
                <textarea placeholder="Add a note... (optional)" value={notes} onChange={e => setNotes(e.target.value)}
                  style={{ width: "100%", minHeight: 80, padding: 10, background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 10, color: NATURE_PALETTE.text, fontSize: 13, resize: "vertical", marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
                  <div onClick={() => setShareToFeed(!shareToFeed)} style={{ width: 36, height: 20, borderRadius: 10, background: shareToFeed ? NATURE_PALETTE.accent : NATURE_PALETTE.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: shareToFeed ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                  <span style={{ fontSize: 13, color: NATURE_PALETTE.textMuted }}>Share to community feed</span>
                </label>
                <button onClick={save} style={{ width: "100%", padding: "12px", background: NATURE_PALETTE.accent, color: "#0d1a0f", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  ✓ Save to Collection
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("feed");
  const [username, setUsername] = useState(() => localStorage.getItem("wf_user") || "");
  const [usernameInput, setUsernameInput] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [myFinds, setMyFinds] = useState([]);
  const [communityFinds, setCommunityFinds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    loadFinds();
  }, [username]);

  const loadFinds = async () => {
    setLoading(true);
    try {
      const communityRaw = localStorage.getItem("wf_community");
      if (communityRaw) setCommunityFinds(JSON.parse(communityRaw));
      const myRaw = localStorage.getItem("wf_my_" + username);
      if (myRaw) setMyFinds(JSON.parse(myRaw));
    } catch {}
    setLoading(false);
  };

  const handleSetUsername = () => {
    const name = usernameInput.trim();
    if (!name) return;
    localStorage.setItem("wf_user", name);
    setUsername(name);
  };

  const handleSave = async (find, shareToFeed) => {
    const newMy = [find, ...myFinds];
    setMyFinds(newMy);
    localStorage.setItem("wf_my_" + username, JSON.stringify(newMy));
    if (shareToFeed) {
      const newCommunity = [find, ...communityFinds].slice(0, 200);
      setCommunityFinds(newCommunity);
      localStorage.setItem("wf_community", JSON.stringify(newCommunity));
    }
  };

  const handleLike = (findId) => {
    if (!username) return;
    const toggle = finds => finds.map(f => {
      if (f.id !== findId) return f;
      const likes = f.likes || [];
      return { ...f, likes: likes.includes(username) ? likes.filter(u => u !== username) : [...likes, username] };
    });
    const newCommunity = toggle(communityFinds);
    setCommunityFinds(newCommunity);
    localStorage.setItem("wf_community", JSON.stringify(newCommunity));
  };

  const categories = ["All", ...Object.keys(categoryColors)];
  const filteredCommunity = filter === "All" ? communityFinds : communityFinds.filter(f => f.category === filter);
  const filteredMy = filter === "All" ? myFinds : myFinds.filter(f => f.category === filter);

  if (!username) {
    return (
      <div style={{ minHeight: "100vh", background: NATURE_PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato', sans-serif", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400;700&display=swap'); * { box-sizing: border-box; }`}</style>
        <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🦋</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: NATURE_PALETTE.text, fontSize: 36, margin: "0 0 8px" }}>WildFind</h1>
          <p style={{ color: NATURE_PALETTE.textMuted, marginBottom: 32, lineHeight: 1.6 }}>Discover, identify, and share the wildlife around you.</p>
          <input placeholder="Choose a username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetUsername()}
            style={{ width: "100%", padding: "14px 16px", background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 12, color: NATURE_PALETTE.text, fontSize: 15, marginBottom: 12, outline: "none", fontFamily: "inherit" }} />
          <button onClick={handleSetUsername} style={{ width: "100%", padding: "14px", background: NATURE_PALETTE.accent, color: "#0d1a0f", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Start Exploring →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NATURE_PALETTE.bg, fontFamily: "'Lato', sans-serif", color: NATURE_PALETTE.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ background: NATURE_PALETTE.surface, borderBottom: `1px solid ${NATURE_PALETTE.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🌿</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>WildFind</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={username} size={32} />
          <span style={{ fontSize: 13, color: NATURE_PALETTE.textMuted }}>{username}</span>
          <button onClick={() => setShowUpload(true)} style={{ background: NATURE_PALETTE.accent, color: "#0d1a0f", border: "none", borderRadius: 20, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Find</button>
        </div>
      </div>

      <div style={{ display: "flex", background: NATURE_PALETTE.surface, borderBottom: `1px solid ${NATURE_PALETTE.border}`, padding: "0 20px" }}>
        {[{ id: "feed", label: "🌍 Community Feed" }, { id: "mine", label: "🎒 My Collection" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", padding: "14px 16px", color: tab === t.id ? NATURE_PALETTE.accent : NATURE_PALETTE.textMuted, fontWeight: tab === t.id ? 700 : 400, borderBottom: `2px solid ${tab === t.id ? NATURE_PALETTE.accent : "transparent"}`, cursor: "pointer", fontSize: 14, marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "12px 20px", display: "flex", gap: 8, overflowX: "auto", borderBottom: `1px solid ${NATURE_PALETTE.border}`, background: NATURE_PALETTE.surface }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ background: filter === cat ? (cat === "All" ? NATURE_PALETTE.accent : categoryColors[cat]) : NATURE_PALETTE.card, color: filter === cat ? "#0d1a0f" : NATURE_PALETTE.textMuted, border: `1px solid ${filter === cat ? "transparent" : NATURE_PALETTE.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{cat}</button>
        ))}
      </div>

      <div style={{ padding: "20px", maxWidth: 1000, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>Loading finds...
          </div>
        ) : tab === "feed" ? (
          filteredCommunity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>No community finds yet</div>
              <div style={{ fontSize: 13 }}>Be the first to share a discovery!</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filteredCommunity.map(find => <FindCard key={find.id} find={find} onLike={handleLike} currentUser={username} />)}
            </div>
          )
        ) : (
          filteredMy.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎒</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>Your collection is empty</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Upload a photo to identify and track your finds</div>
              <button onClick={() => setShowUpload(true)} style={{ background: NATURE_PALETTE.accent, color: "#0d1a0f", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>+ Add Your First Find</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {[{ label: "Total Finds", value: myFinds.length, color: NATURE_PALETTE.accent }, { label: "Categories", value: new Set(myFinds.map(f => f.category)).size, color: NATURE_PALETTE.gold }, { label: "Rare+ Finds", value: myFinds.filter(f => f.rarity >= 2).length, color: "#c084fc" }].map(s => (
                  <div key={s.label} style={{ background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`, borderRadius: 12, padding: "12px 20px", flex: 1, minWidth: 100, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: NATURE_PALETTE.textMuted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {filteredMy.map(find => <FindCard key={find.id} find={find} currentUser={username} />)}
              </div>
            </>
          )
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSave={handleSave} username={username} />}
    </div>
  );
}
