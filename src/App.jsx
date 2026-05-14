import { useState, useEffect, useRef } from "react";

const NATURE_PALETTE = {
  bg: "#0d1a0f",
  surface: "#111f13",
  card: "#162018",
  border: "#1e3322",
  accent: "#4ade80",
  accentDim: "#22c55e",
  accentMuted: "#16a34a",
  gold: "#fbbf24",
  text: "#e8f5e9",
  textMuted: "#7dab87",
  textFaint: "#3d6b47",
  danger: "#f87171",
};

const categoryColors = {
  Bird: "#60a5fa",
  Mammal: "#f97316",
  Reptile: "#a3e635",
  Amphibian: "#34d399",
  Fish: "#22d3ee",
  Insect: "#fbbf24",
  Plant: "#4ade80",
  Fungus: "#c084fc",
  Marine: "#38bdf8",
  Other: "#94a3b8",
};

const RARITY_LABELS = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const RARITY_COLORS = ["#94a3b8", "#4ade80", "#60a5fa", "#c084fc", "#fbbf24"];

function getRarityFromAI(aiText) {
  const t = aiText.toLowerCase();
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
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ b64: dataUrl.split(",")[1], mime: "image/jpeg" });
    };
    img.src = `data:${mime};base64,${base64}`;
  });
}

async function identifyWithClaude(base64Image, mimeType) {
  const compressed = await compressImage(base64Image, mimeType);
  base64Image = compressed.b64;
  mimeType = compressed.mime;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64Image }
          },
          {
            type: "text",
            text: `You are a wildlife and nature expert. Identify what is in this photo. Respond ONLY with a JSON object, no markdown, no backticks, no preamble. The JSON must have exactly these keys: name, scientificName, category, description, conservationStatus, confidence. Category must be one of: Bird, Mammal, Reptile, Amphibian, Fish, Insect, Plant, Fungus, Marine, Other. Confidence must be High, Medium, or Low.`
          }
        ]
      }]
    })
  });

  const rawText = await response.text();

  let data;
  try { data = JSON.parse(rawText); }
  catch { throw new Error("Server returned non-JSON: " + rawText.slice(0, 100)); }

  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (!data.content || !data.content.length) throw new Error("Empty response: " + JSON.stringify(data).slice(0, 150));

  const text = data.content.map(i => i.text || "").join("").trim();

  // Strip markdown fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // Last resort: find first { ... } block
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(stripped.slice(start, end + 1)); }
      catch {}
    }
    // Give up gracefully with the raw text as description
    return { name: "Unknown", scientificName: "", category: "Other", description: stripped.slice(0, 300), conservationStatus: "Unknown", confidence: "Low" };
  }
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function Avatar({ name, size = 32 }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : "??";
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 60%, 35%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff",
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function RarityBadge({ rarity }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1,
      color: RARITY_COLORS[rarity],
      border: `1px solid ${RARITY_COLORS[rarity]}44`,
      borderRadius: 4, padding: "2px 6px",
      background: `${RARITY_COLORS[rarity]}11`,
    }}>{RARITY_LABELS[rarity].toUpperCase()}</span>
  );
}

function CategoryTag({ category }) {
  const color = categoryColors[category] || categoryColors.Other;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "2px 8px",
      background: `${color}11`,
    }}>{category}</span>
  );
}

function FindCard({ find, onLike, currentUser, compact = false }) {
  const rarity = find.rarity ?? 0;
  const liked = find.likes?.includes(currentUser);

  return (
    <div style={{
      background: NATURE_PALETTE.card,
      border: `1px solid ${NATURE_PALETTE.border}`,
      borderRadius: 16,
      overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px #000a`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {find.imageUrl && (
        <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
          <img src={find.imageUrl} alt={find.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, #0d1a0fcc 30%, transparent 70%)"
          }} />
          <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: compact ? 16 : 18, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{find.name}</div>
            {find.scientificName && <div style={{ fontSize: 11, color: "#ffffffaa", fontStyle: "italic" }}>{find.scientificName}</div>}
          </div>
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
            <RarityBadge rarity={rarity} />
< truncated lines 193-564 >
          </p>
          <input
            placeholder="Choose a username"
            value={usernameInput}
            onChange={e => setUsernameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSetUsername()}
            style={{
              width: "100%", padding: "14px 16px",
              background: NATURE_PALETTE.card,
              border: `1px solid ${NATURE_PALETTE.border}`,
              borderRadius: 12, color: NATURE_PALETTE.text,
              fontSize: 15, marginBottom: 12, boxSizing: "border-box",
              outline: "none", fontFamily: "inherit",
            }}
          />
          <button onClick={handleSetUsername} style={{
            width: "100%", padding: "14px",
            background: NATURE_PALETTE.accent, color: "#0d1a0f",
            border: "none", borderRadius: 12, fontWeight: 700,
            fontSize: 15, cursor: "pointer",
          }}>Start Exploring →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NATURE_PALETTE.bg, fontFamily: "'Lato', sans-serif", color: NATURE_PALETTE.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${NATURE_PALETTE.bg}; }
        ::-webkit-scrollbar-thumb { background: ${NATURE_PALETTE.border}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: NATURE_PALETTE.surface,
        borderBottom: `1px solid ${NATURE_PALETTE.border}`,
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🌿</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>WildFind</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={username} size={32} />
          <span style={{ fontSize: 13, color: NATURE_PALETTE.textMuted }}>{username}</span>
          <button onClick={() => setShowUpload(true)} style={{
            background: NATURE_PALETTE.accent, color: "#0d1a0f",
            border: "none", borderRadius: 20, padding: "8px 16px",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>+ Add Find</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", background: NATURE_PALETTE.surface,
        borderBottom: `1px solid ${NATURE_PALETTE.border}`,
        padding: "0 20px",
      }}>
        {[
          { id: "feed", label: "🌍 Community Feed" },
          { id: "mine", label: "🎒 My Collection" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none",
            padding: "14px 16px",
            color: tab === t.id ? NATURE_PALETTE.accent : NATURE_PALETTE.textMuted,
            fontWeight: tab === t.id ? 700 : 400,
            borderBottom: `2px solid ${tab === t.id ? NATURE_PALETTE.accent : "transparent"}`,
            cursor: "pointer", fontSize: 14, transition: "color 0.2s",
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{
        padding: "12px 20px", display: "flex", gap: 8, overflowX: "auto",
        borderBottom: `1px solid ${NATURE_PALETTE.border}`,
        background: NATURE_PALETTE.surface,
      }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            background: filter === cat ? (cat === "All" ? NATURE_PALETTE.accent : (categoryColors[cat] || NATURE_PALETTE.accent)) : NATURE_PALETTE.card,
            color: filter === cat ? "#0d1a0f" : NATURE_PALETTE.textMuted,
            border: `1px solid ${filter === cat ? "transparent" : NATURE_PALETTE.border}`,
            borderRadius: 20, padding: "6px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.15s",
          }}>{cat}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px", maxWidth: 1000, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            Loading finds...
          </div>
        ) : tab === "feed" ? (
          filteredCommunity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>No community finds yet</div>
              <div style={{ fontSize: 13 }}>Be the first to share a discovery!</div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {filteredCommunity.map(find => (
                <FindCard key={find.id} find={find} onLike={handleLike} currentUser={username} />
              ))}
            </div>
          )
        ) : (
          filteredMy.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: NATURE_PALETTE.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎒</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>Your collection is empty</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Upload a photo to identify and track your finds</div>
              <button onClick={() => setShowUpload(true)} style={{
                background: NATURE_PALETTE.accent, color: "#0d1a0f",
                border: "none", borderRadius: 10, padding: "12px 24px",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>+ Add Your First Find</button>
            </div>
          ) : (
            <>
              <div style={{
                display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
              }}>
                <div style={{
                  background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`,
                  borderRadius: 12, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: NATURE_PALETTE.accent }}>{myFinds.length}</div>
                  <div style={{ fontSize: 12, color: NATURE_PALETTE.textMuted }}>Total Finds</div>
                </div>
                <div style={{
                  background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`,
                  borderRadius: 12, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: NATURE_PALETTE.gold }}>
                    {new Set(myFinds.map(f => f.category)).size}
                  </div>
                  <div style={{ fontSize: 12, color: NATURE_PALETTE.textMuted }}>Categories</div>
                </div>
                <div style={{
                  background: NATURE_PALETTE.card, border: `1px solid ${NATURE_PALETTE.border}`,
                  borderRadius: 12, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#c084fc" }}>
                    {myFinds.filter(f => f.rarity >= 2).length}
                  </div>
                  <div style={{ fontSize: 12, color: NATURE_PALETTE.textMuted }}>Rare+ Finds</div>
                </div>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
              }}>
                {filteredMy.map(find => (
                  <FindCard key={find.id} find={find} currentUser={username} />
                ))}
              </div>
            </>
          )
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSave={handleSave}
          username={username}
        />
      )}
    </div>
  );
}
