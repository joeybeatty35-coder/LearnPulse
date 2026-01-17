// ---------- Helpers ----------
function $(id){ return document.getElementById(id); }

function showToast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(()=>{ t.style.display = "none"; }, 2600);
}

// ---------- Preferences ----------
function collect(){
  return {
    topics: {
      skills: $("tSkills")?.checked || false,
      languages: $("tLang")?.checked || false,
      tutorials: $("tTut")?.checked || false,
      popculture: $("tPop")?.checked || false,
      news: $("tNews")?.checked || false
    },
    pop: {
      movies: $("pMovies")?.checked || false,
      tv: $("pTV")?.checked || false,
      music: $("pMusic")?.checked || false,
      gaming: $("pGaming")?.checked || false,
      digital: $("pDigital")?.checked || false
    },
    frequency: $("frequency")?.value || "balanced"
  };
}

function savePrefs(prefs){
  localStorage.setItem("learnpulse_prefs", JSON.stringify(prefs));
}

function loadPrefs(){
  const raw = localStorage.getItem("learnpulse_prefs");
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}

// ---------- Feed ----------
function renderFeed(prefs) {
  const feed = $("feed");
  if (!feed) return;

  const items = [];
  const pushItem = (tag, title, desc) => items.push({ tag, title, desc });

  pushItem("AI Welcome", "Your feed is ready", "Scroll a learning-style feed based on what you selected. Adjust anytime.");

  if (prefs.topics.skills) {
    pushItem("Basics", "Skill Foundations", "Quick tutorials and core concepts for everyday learning.");
  }
  if (prefs.topics.languages) {
    pushItem("Languages", "Language Discovery", "Phrases, fundamentals, and beginner-friendly practice ideas.");
  }
  if (prefs.topics.tutorials) {
    pushItem("Tutorials", "How-To Learning", "Step-by-step guides and resources for independent learning.");
  }

  if (prefs.topics.popculture) {
    pushItem("Pop Culture", "Media & Culture", "Movies, music, gaming, and digital culture—fact-based and non-sensational.");
    const popFocus = [];
    if (prefs.pop.movies) popFocus.push("Movies");
    if (prefs.pop.tv) popFocus.push("TV/Streaming");
    if (prefs.pop.music) popFocus.push("Music");
    if (prefs.pop.gaming) popFocus.push("Gaming");
    if (prefs.pop.digital) popFocus.push("Digital Culture");
    if (popFocus.length) {
      pushItem("Your Focus", "Pop Culture Preferences", popFocus.join(" • "));
    }
  }

  if (prefs.topics.news) {
    pushItem("News", "General Updates", "Informational updates across learning and culture (availability may vary).");
  }

  const freqMap = { light: "Light", balanced: "Balanced", deep: "Deep" };
  pushItem("Settings", "Discovery Frequency", `${freqMap[prefs.frequency] || "Balanced"} mode`);

  feed.innerHTML = items.map((it, idx) => {
    const delay = Math.min(idx * 0.06, 0.5);
    return `
      <div class="feedItem motion-in" style="animation-delay:${delay}s;">
        <div class="feedMeta">
          <span class="tag">${it.tag}</span>
          <span class="badge info">Preview</span>
        </div>
        <div class="feedTitle">${it.title}</div>
        <div class="feedDesc">${it.desc}</div>
        <div class="aiLine"></div>
      </div>
    `;
  }).join("");
}

// ---------- Private 30-Day Test Mode ----------
(function () {
  const ACCESS_KEY = "learnpulse_private_access";
  const START_KEY = "learnpulse_private_start";
  const TEST_DAYS = 30;

  // CHANGE THIS CODE
  const PRIVATE_CODE = "LP-TEST-30";

  const gate = $("privateGate");
  const input = $("accessCodeInput");
  const unlockBtn = $("unlockBtn");
  const lockBtn = $("lockBtn");

  function daysBetween(a, b) {
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }

  function isExpired() {
    const start = localStorage.getItem(START_KEY);
  