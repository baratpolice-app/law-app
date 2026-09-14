"use strict";
/* ===================== QUESTION BANK ===================== */
/* Starter bank — expand by adding objects to QUESTIONS. Each subject id must match SUBJECTS below. */
/* Subjects are now created automatically from whatever "subject" values appear in your
   Google Sheet (see ensureSubjectMeta below) — no hardcoded/offline subjects or demo
   questions ship with the app anymore. */
var SUBJECTS = [];

/* No offline/demo questions ship with the app anymore — everything comes from your
   Google Sheet via sync. */
var LOCAL_QUESTIONS = [];

/* ===================== ONLINE (GOOGLE SHEET) QUESTIONS ===================== */
/* Merges with LOCAL_QUESTIONS above. QUESTIONS is the live, merged bank used everywhere. */
var REMOTE_QUESTIONS = [];
var QUESTIONS = LOCAL_QUESTIONS.slice();

function ensureSubjectMeta(id){
  if(!id) return;
  if(!SUBJECTS.some(function(s){ return s.id===id; })){
    SUBJECTS.push({id:id, name:id, note:"অনলাইন থেকে যুক্ত হয়েছে"});
  }
}
function mergeRemote(remoteQs){
  REMOTE_QUESTIONS = remoteQs;
  remoteQs.forEach(function(q){ ensureSubjectMeta(q.s); });
  QUESTIONS = LOCAL_QUESTIONS.concat(REMOTE_QUESTIONS);
}
function bnDigitsToAscii(s){
  var map = {"০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9"};
  return String(s).replace(/[০-৯]/g, function(ch){ return map[ch]; });
}
function normalizeRemoteRow(r){
  var opts = Array.isArray(r.o) ? r.o : [r.option_a, r.option_b, r.option_c, r.option_d];
  var ansRaw = r.a!==undefined ? r.a : r.answer;
  var ansIdx = ansRaw;
  if(typeof ansRaw === "string"){
    var cleaned = bnDigitsToAscii(ansRaw.trim());
    var letters = {"ক":0,"খ":1,"গ":2,"ঘ":3,"a":0,"b":1,"c":2,"d":3,"A":0,"B":1,"C":2,"D":3};
    ansIdx = letters.hasOwnProperty(ansRaw.trim()) ? letters[ansRaw.trim()] : parseInt(cleaned,10);
  }
  return {
    s: String(r.s || r.subject || "অনলাইন প্রশ্ন").trim(),
    q: String(r.q || r.question || "").trim(),
    o: opts.map(function(x){ return x===undefined||x===null ? "" : String(x).trim(); }),
    a: Number(ansIdx),
    e: String(r.e || r.explanation || "").trim()
  };
}
function fetchRemoteQuestions(){
  var url = store.remoteUrl;
  if(!url) return Promise.resolve(false);
  return fetch(url).then(function(res){
    if(!res.ok) throw new Error("HTTP "+res.status);
    return res.json();
  }).then(function(data){
    var raw = data.questions || data || [];
    var qs = raw.map(normalizeRemoteRow).filter(function(q){
      return q.q && q.s && q.o.length===4 && q.o.every(function(x){return x!=="";}) && !isNaN(q.a) && q.a>=0 && q.a<=3;
    });
    mergeRemote(qs);
    store.remoteCache = qs;
    store.remoteUpdated = Date.now();
    saveStore(store);
    return true;
  });
}

/* Auto-sync: re-fetch quietly in the background so the person almost never
   has to tap "সিঙ্ক করুন" by hand. Throttled so it doesn't refetch on every
   single tab switch. */
var AUTO_SYNC_INTERVAL_MS = 3*60*1000;
function maybeAutoSync(onDone){
  if(!store.remoteUrl) return;
  var last = store.remoteUpdated || 0;
  if(Date.now() - last < AUTO_SYNC_INTERVAL_MS) return;
  fetchRemoteQuestions().then(function(){
    if(onDone) onDone();
  }).catch(function(){ /* stay on cached/local data silently */ });
}

/* ===================== STATE & STORAGE ===================== */
var LS_KEY = "asi_promo_prep_v1";
/* Pre-configured Google Sheet sync link so every installed copy of the app
   syncs questions automatically — end users never need to open Settings or
   paste any link themselves. If you redeploy the Apps Script and get a new
   /exec URL, update it here. */
var DEFAULT_REMOTE_URL = "https://script.google.com/macros/s/AKfycbyZuDD7kHpyOze9r7Ey3WB89zh1eAeQ_iML9TxGy43vt1Usfsc_5jUCX0wU5GNY67rz/exec";

function loadStore(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    var s = raw ? JSON.parse(raw) : {};
  }catch(e){ var s = {}; }
  if(!s.attempts) s.attempts = [];
  if(!s.wrongIds) s.wrongIds = {};
  if(!s.bookmarks) s.bookmarks = {};
  if(typeof s.darkMode !== "boolean") s.darkMode = false;
  if(!s.profile) s.profile = {name:"", rank:"", unit:"", photo:"", pin:""};
  if(s.profile && typeof s.profile.pin === "undefined") s.profile.pin = "";
  if(!s.remoteUrl || s.remoteUrl !== DEFAULT_REMOTE_URL) s.remoteUrl = DEFAULT_REMOTE_URL;
  return s;
}
function saveStore(store){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(store)); }catch(e){}
}
var store = loadStore();
applyDarkMode(store.darkMode);

function qKey(q){ return q.s + "||" + q.q; }
function applyDarkMode(on){
  document.documentElement.classList.toggle("dark", !!on);
}

var state = {
  tab: "home",
  quiz: null, // active quiz session
  profileEditing: false,
  tempPhoto: null,
  accountMode: null
};

function subjectQuestions(sid){
  return QUESTIONS.filter(function(q){ return q.s === sid; });
}
function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}
function fmtTime(sec){
  var m = Math.floor(sec/60), s = sec%60;
  return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}
function fmtDate(ts){
  var d = new Date(ts);
  var months=["জানু","ফেব্রু","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্ট","অক্টো","নভে","ডিসে"];
  return d.getDate()+" "+months[d.getMonth()]+", "+d.getFullYear();
}
function subjectStats(sid){
  var atts = store.attempts.filter(function(a){return a.subject===sid && a.mode==="practice";});
  if(!atts.length) return null;
  var last = atts[atts.length-1];
  return {pct: Math.round(100*last.correct/last.total)};
}
function subjectAggregateStats(sid){
  var atts = store.attempts.filter(function(a){return a.subject===sid;});
  if(!atts.length) return null;
  var total=0, correct=0;
  atts.forEach(function(a){ total+=a.total; correct+=a.correct; });
  return {pct: Math.round(100*correct/total), attempts: atts.length, total: total};
}
function overallStats(){
  var totalQ=0, totalC=0;
  store.attempts.forEach(function(a){ totalQ+=a.total; totalC+=a.correct; });
  var mockAttempts = store.attempts.filter(function(a){return a.mode==="mock";});
  var bestMock = mockAttempts.length ? Math.max.apply(null, mockAttempts.map(function(a){return Math.round(100*a.correct/a.total);})) : null;
  return {
    sessions: store.attempts.length,
    answered: totalQ,
    accuracy: totalQ ? Math.round(100*totalC/totalQ) : null,
    bestMock: bestMock
  };
}

/* ===================== CLOUD ACCOUNT (PIN-based, via Google Sheet) ===================== */
function generatePin(){
  return String(Math.floor(1000 + Math.random()*9000));
}
function cloudFetchUser(pin){
  if(!store.remoteUrl) return Promise.reject(new Error("no remote url"));
  var url = store.remoteUrl + (store.remoteUrl.indexOf("?")>-1?"&":"?") + "action=getUser&pin=" + encodeURIComponent(pin);
  return fetch(url).then(function(res){
    if(!res.ok) throw new Error("HTTP "+res.status);
    return res.json();
  });
}
function cloudSaveUser(){
  if(!store.remoteUrl || !store.profile.pin) return Promise.resolve(false);
  var stats = overallStats();
  var payload = {
    action: "saveUser",
    pin: store.profile.pin,
    name: store.profile.name, rank: store.profile.rank, unit: store.profile.unit,
    sessions: stats.sessions, answered: stats.answered,
    correct: store.attempts.reduce(function(sum,a){return sum+a.correct;},0),
    bestMock: stats.bestMock || 0,
    wrongIds: Object.keys(store.wrongIds),
    bookmarks: Object.keys(store.bookmarks),
    attempts: store.attempts.slice(-30).map(function(a){
      return {mode:a.mode, subject:a.subject, special:a.special||null, subjectName:a.subjectName, total:a.total, correct:a.correct, ts:a.ts};
    })
  };
  return fetch(store.remoteUrl, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify(payload)
  }).then(function(res){ return res.ok; }).catch(function(){ return false; });
}
function applyCloudUser(u){
  store.profile.name = u.name || store.profile.name;
  store.profile.rank = u.rank || store.profile.rank;
  store.profile.unit = u.unit || store.profile.unit;
  store.profile.pin = u.pin;
  store.wrongIds = {};
  (u.wrongIds||[]).forEach(function(k){ store.wrongIds[k] = true; });
  store.bookmarks = {};
  (u.bookmarks||[]).forEach(function(k){ store.bookmarks[k] = true; });
  store.attempts = (u.attempts||[]).map(function(a){
    return {mode:a.mode, subject:a.subject, special:a.special||null, subjectName:a.subjectName, total:a.total, correct:a.correct, ts:a.ts};
  });
  saveStore(store);
}

var main = document.getElementById("mainArea");
var headerTitle = document.getElementById("headerTitle");
var headerSub = document.getElementById("headerSub");

function setHeader(title, sub, showBack){
  headerTitle.textContent = title;
  headerSub.textContent = sub;
  document.getElementById("backBtn").classList.toggle("hidden", !showBack);
}

/* ===================== NAVIGATION (multi-page) ===================== */
function confirmLeaveQuiz(){
  if(state.quiz){
    return confirm("চলমান কুইজ বাতিল হয়ে যাবে। আপনি কি নিশ্চিত?");
  }
  return true;
}
var backBtnEl = document.getElementById("backBtn");
if(backBtnEl) backBtnEl.addEventListener("click", function(){
  if(!confirmLeaveQuiz()) return;
  history.back();
});

function goToQuiz(config){
  sessionStorage.setItem("quizConfig", JSON.stringify(config));
  location.href = "quiz.html";
}

/* ===================== QUIZ ENGINE ===================== */
function wrongQuestions(){
  return QUESTIONS.filter(function(q){ return !!store.wrongIds[qKey(q)]; });
}
function bookmarkedQuestions(){
  return QUESTIONS.filter(function(q){ return !!store.bookmarks[qKey(q)]; });
}
function beginQuiz(config){
  var qs, subjectName, subject=null, special=null;
  if(config.special){
    var list = config.special==="wrong" ? wrongQuestions() : bookmarkedQuestions();
    qs = shuffle(list);
    subjectName = config.special==="wrong" ? "ভুল প্রশ্ন অনুশীলন" : "বুকমার্ককৃত প্রশ্ন";
    special = config.special;
  } else if(config.mode==="mock"){
    qs = shuffle(QUESTIONS).slice(0, config.count);
    subjectName = "মিশ্রিত (মক টেস্ট)";
  } else {
    subject = config.subject;
    var sub = SUBJECTS.filter(function(s){return s.id===subject;})[0];
    qs = shuffle(subjectQuestions(subject));
    subjectName = sub?sub.name:"";
  }
  if(!qs || !qs.length){ location.href = "index.html"; return; }
  state.quiz = {
    mode: config.mode, subject: subject, special: special, subjectName: subjectName,
    questions: qs, idx:0, answers:[], startedAt: Date.now(),
    timerId:null, timeLeft: config.mode==="mock" ? Math.round(qs.length*45) : null
  };
  if(backBtnEl) backBtnEl.classList.remove("hidden");
  if(config.mode==="mock") startMockTimer();
  renderQuizQuestion();
}

/* ===================== RENDER: HOME ===================== */
function renderHome(){
  setHeader("কনস্টেবল/নায়েক → এএসআই (নিরস্ত্র)", "বিভাগীয় পদোন্নতি এমসিকিউ পরীক্ষার প্রস্তুতি", false);
  var totalAttempts = store.attempts.length;
  var mockAttempts = store.attempts.filter(function(a){return a.mode==="mock";});
  var bestMock = mockAttempts.length ? Math.max.apply(null, mockAttempts.map(function(a){return Math.round(100*a.correct/a.total);})) : null;

  var html = "";
  html += '<div class="stat-strip">'+
    '<div class="stat-cell"><div class="num">'+QUESTIONS.length+'</div><div class="lbl">মোট প্রশ্ন</div></div>'+
    '<div class="stat-cell"><div class="num">'+totalAttempts+'</div><div class="lbl">অনুশীলন সেশন</div></div>'+
    '<div class="stat-cell"><div class="num">'+(bestMock!==null?bestMock+"%":"—")+'</div><div class="lbl">সেরা মক স্কোর</div></div>'+
  '</div>';

  var wrongCount = wrongQuestions().length;
  var bookmarkCount = bookmarkedQuestions().length;
  html += '<div class="quick-lists">'+
    '<div class="quick-list-item'+(wrongCount?'':' disabled')+'" id="wrongListBtn">'+
      '<span class="qicon bad">✕</span>'+
      '<div class="body"><div class="name">ভুল প্রশ্ন অনুশীলন</div><div class="meta">'+wrongCount+'টি প্রশ্ন</div></div>'+
      '<div class="arrow">›</div>'+
    '</div>'+
    '<div class="quick-list-item'+(bookmarkCount?'':' disabled')+'" id="bookmarkListBtn">'+
      '<span class="qicon gold">★</span>'+
      '<div class="body"><div class="name">বুকমার্ককৃত প্রশ্ন</div><div class="meta">'+bookmarkCount+'টি প্রশ্ন</div></div>'+
      '<div class="arrow">›</div>'+
    '</div>'+
  '</div>';

  html += '<div class="cta-block">'+
    '<h3>আজই একটি মক টেস্ট দিন</h3>'+
    '<p>সময় বেঁধে দিয়ে সব বিষয় থেকে মিশ্রিত প্রশ্নে বাস্তব পরীক্ষার অভিজ্ঞতা নিন।</p>'+
    '<button class="btn" id="homeMockBtn">মক টেস্ট শুরু করুন</button>'+
  '</div>';

  html += '<h2 class="section-title">বিষয়ভিত্তিক অনুশীলন <span class="count">'+SUBJECTS.length+' টি বিষয়</span></h2>';
  if(!SUBJECTS.length){
    html += '<div class="empty-state">'+
      '<p>এখনো কোনো প্রশ্ন সিঙ্ক করা হয়নি।<br>উপরের ⚙ আইকনে গিয়ে আপনার Google Sheet সংযুক্ত করুন।</p>'+
    '</div>';
  } else {
    html += '<div class="subject-grid">';
    SUBJECTS.forEach(function(sub, idx){
      var qcount = subjectQuestions(sub.id).length;
      var stat = subjectStats(sub.id);
      var num = String(idx+1).padStart(2,"0");
      html += '<div class="subject-card" data-subject="'+sub.id+'">'+
        '<div class="idx">'+num+'</div>'+
        '<div class="body">'+
          '<div class="name">'+sub.name+'</div>'+
          '<div class="meta">'+sub.note+' · '+qcount+'টি প্রশ্ন'+(stat?(' · সর্বশেষ '+stat.pct+'%'):'')+'</div>'+
        '</div>'+
        '<div class="arrow">›</div>'+
      '</div>';
    });
    html += '</div>';
  }

  main.innerHTML = html;
  document.getElementById("homeMockBtn").addEventListener("click", function(){ location.href="mock.html"; });
  var wrongBtn = document.getElementById("wrongListBtn");
  if(wrongBtn) wrongBtn.addEventListener("click", function(){ goToQuiz({mode:"practice", special:"wrong"}); });
  var bmBtn = document.getElementById("bookmarkListBtn");
  if(bmBtn) bmBtn.addEventListener("click", function(){ goToQuiz({mode:"practice", special:"bookmark"}); });
  document.querySelectorAll(".subject-card").forEach(function(card){
    card.addEventListener("click", function(){
      goToQuiz({mode:"practice", subject:card.getAttribute("data-subject")});
    });
  });
}

/* ===================== RENDER: PRACTICE (subject list) ===================== */
function renderPracticeList(){
  setHeader("বিষয়ভিত্তিক অনুশীলন", "একটি বিষয় বেছে অনুশীলন শুরু করুন", false);
  var html;
  if(!SUBJECTS.length){
    html = '<div class="empty-state">'+
      '<p>এখনো কোনো প্রশ্ন সিঙ্ক করা হয়নি।<br>উপরের ⚙ আইকনে গিয়ে আপনার Google Sheet সংযুক্ত করুন।</p>'+
    '</div>';
  } else {
    html = '<div class="subject-grid">';
    SUBJECTS.forEach(function(sub, idx){
      var qcount = subjectQuestions(sub.id).length;
      var stat = subjectStats(sub.id);
      var num = String(idx+1).padStart(2,"0");
      html += '<div class="subject-card" data-subject="'+sub.id+'">'+
        '<div class="idx">'+num+'</div>'+
        '<div class="body">'+
          '<div class="name">'+sub.name+'</div>'+
          '<div class="meta">'+sub.note+' · '+qcount+'টি প্রশ্ন'+(stat?(' · সর্বশেষ '+stat.pct+'%'):'')+'</div>'+
        '</div>'+
        '<div class="arrow">›</div>'+
      '</div>';
    });
    html += '</div>';
  }
  main.innerHTML = html;
  document.querySelectorAll(".subject-card").forEach(function(card){
    card.addEventListener("click", function(){
      goToQuiz({mode:"practice", subject:card.getAttribute("data-subject")});
    });
  });
}

/* ===================== RENDER: MOCK SETUP ===================== */
function renderMockSetup(){
  setHeader("মক টেস্ট", "সময় বেঁধে সব বিষয় থেকে মিশ্রিত প্রশ্ন", false);
  var maxQ = QUESTIONS.length;
  var opts = [10,20,Math.min(30,maxQ)].filter(function(n,i,arr){return n<=maxQ && arr.indexOf(n)===i;});
  if(!opts.length) opts=[maxQ];
  var html = '<p style="font-size:13.5px;line-height:1.7;color:var(--ink-soft);margin-top:0;">'+
    'মক টেস্টে সকল বিষয় থেকে র‍্যান্ডমভাবে প্রশ্ন আসবে এবং একটি টাইমার চলবে — যাতে বাস্তব পরীক্ষার মতো অনুভূতি পান। প্রশ্নপ্রতি প্রায় ৪৫ সেকেন্ড ধরে সময় নির্ধারিত।'+
    '</p>';
  html += '<h2 class="section-title" style="margin-top:6px;">প্রশ্ন সংখ্যা নির্বাচন করুন</h2>';
  html += '<div class="option-list" id="mockCountOpts">';
  opts.forEach(function(n, i){
    html += '<div class="pill-option'+(i===opts.length-1?" selected":"")+'" data-count="'+n+'"><span>'+n+' টি প্রশ্ন</span><span>'+Math.round(n*0.75)+' মিনিট</span></div>';
  });
  html += '</div>';
  html += '<button class="btn block" id="startMockBtn">মক টেস্ট শুরু করুন</button>';
  main.innerHTML = html;

  var selectedCount = opts[opts.length-1];
  document.querySelectorAll("#mockCountOpts .pill-option").forEach(function(el){
    el.addEventListener("click", function(){
      document.querySelectorAll("#mockCountOpts .pill-option").forEach(function(x){x.classList.remove("selected");});
      el.classList.add("selected");
      selectedCount = parseInt(el.getAttribute("data-count"),10);
    });
  });
  document.getElementById("startMockBtn").addEventListener("click", function(){
    goToQuiz({mode:"mock", count:selectedCount});
  });
}

function startMockTimer(){
  clearInterval(state.quiz.timerId);
  state.quiz.timerId = setInterval(function(){
    if(!state.quiz) return clearInterval(state.quiz&&state.quiz.timerId);
    state.quiz.timeLeft--;
    var t = document.getElementById("quizTimer");
    if(t) t.textContent = fmtTime(Math.max(0,state.quiz.timeLeft));
    if(state.quiz.timeLeft<=0){
      clearInterval(state.quiz.timerId);
      finishQuiz(true);
    }
  },1000);
}

function renderQuizQuestion(){
  var quiz = state.quiz;
  var q = quiz.questions[quiz.idx];
  var already = quiz.answers[quiz.idx];
  setHeader(quiz.subjectName, "প্রশ্ন "+(quiz.idx+1)+" / "+quiz.questions.length, true);

  var subLabel = (SUBJECTS.filter(function(s){return s.id===q.s;})[0]||{}).name || "";

  var html = "";
  html += '<div class="quiz-meta">'+
    '<span>প্রশ্ন '+(quiz.idx+1)+' / '+quiz.questions.length+'</span>'+
    (quiz.mode==="mock" ? '<span class="timer" id="quizTimer">'+fmtTime(Math.max(0,quiz.timeLeft))+'</span>' : '<span></span>')+
  '</div>';
  html += '<div class="progress-track"><div class="progress-fill" style="width:'+Math.round(100*quiz.idx/quiz.questions.length)+'%"></div></div>';
  html += '<div class="q-top-row">';
  html += '<div class="q-tag">'+subLabel+'</div>';
  var isBookmarked = !!store.bookmarks[qKey(q)];
  html += '<button class="bookmark-btn'+(isBookmarked?' active':'')+'" id="bookmarkBtn" title="বুকমার্ক করুন">'+(isBookmarked?'★':'☆')+'</button>';
  html += '</div>';
  html += '<div class="q-text">'+q.q+'</div>';
  html += '<div id="choicesWrap">';
  q.o.forEach(function(opt, i){
    var cls = "choice";
    var disabled = quiz.mode==="practice" && already!==undefined;
    if(disabled){
      cls += " disabled";
      if(i===q.a) cls += " correct";
      else if(i===already) cls += " wrong";
    }
    html += '<div class="'+cls+'" data-idx="'+i+'"><div class="tag">'+["ক","খ","গ","ঘ"][i]+'</div><div>'+opt+'</div></div>';
  });
  html += '</div>';

  if(quiz.mode==="practice" && already!==undefined){
    html += '<div class="explain"><b>ব্যাখ্যা:</b> '+q.e+'</div>';
  }

  html += '<div class="quiz-actions">';
  if(quiz.mode==="practice"){
    if(already===undefined){
      html += '<button class="btn block" id="skipBtn" style="background:#fff;border:1px solid var(--line);color:var(--ink-soft);">এড়িয়ে যান</button>';
    } else {
      html += '<button class="btn block" id="nextBtn">'+(quiz.idx+1<quiz.questions.length ? "পরবর্তী প্রশ্ন" : "ফলাফল দেখুন")+'</button>';
    }
  } else {
    html += '<button class="btn block" id="nextBtn">'+(quiz.idx+1<quiz.questions.length ? "পরবর্তী প্রশ্ন" : "টেস্ট জমা দিন")+'</button>';
  }
  html += '</div>';

  main.innerHTML = html;

  if(!(quiz.mode==="practice" && already!==undefined)){
    document.querySelectorAll("#choicesWrap .choice").forEach(function(el){
      el.addEventListener("click", function(){
        var i = parseInt(el.getAttribute("data-idx"),10);
        selectAnswer(i);
      });
    });
  }
  var skipBtn = document.getElementById("skipBtn");
  if(skipBtn) skipBtn.addEventListener("click", function(){ advanceQuiz(); });
  var nextBtn = document.getElementById("nextBtn");
  if(nextBtn) nextBtn.addEventListener("click", function(){ advanceQuiz(); });
  document.getElementById("bookmarkBtn").addEventListener("click", function(){
    var key = qKey(q);
    if(store.bookmarks[key]) delete store.bookmarks[key];
    else store.bookmarks[key] = true;
    saveStore(store);
    renderQuizQuestion();
  });
}

function selectAnswer(i){
  var quiz = state.quiz;
  quiz.answers[quiz.idx] = i;
  if(quiz.mode==="practice"){
    renderQuizQuestion();
  } else {
    // mock: just visually mark selection, don't reveal correctness
    document.querySelectorAll("#choicesWrap .choice").forEach(function(el){
      el.classList.remove("selected");
      el.style.borderColor = "";
      el.style.background = "";
    });
    var chosen = document.querySelector('#choicesWrap .choice[data-idx="'+i+'"]');
    if(chosen){ chosen.style.borderColor = "var(--navy)"; chosen.style.background = "#EEF2F6"; }
  }
}

function advanceQuiz(){
  var quiz = state.quiz;
  if(quiz.idx+1 < quiz.questions.length){
    quiz.idx++;
    renderQuizQuestion();
    window.scrollTo(0,0);
  } else {
    finishQuiz(false);
  }
}

function finishQuiz(timedOut){
  var quiz = state.quiz;
  if(quiz.timerId) clearInterval(quiz.timerId);
  var correct = 0;
  quiz.questions.forEach(function(q,i){
    var key = qKey(q);
    if(quiz.answers[i]===q.a){
      correct++;
      delete store.wrongIds[key];
    } else if(quiz.answers[i]!==undefined){
      store.wrongIds[key] = true;
    }
  });
  var attempt = {
    mode: quiz.mode, subject: quiz.subject, special: quiz.special || null, subjectName: quiz.subjectName,
    total: quiz.questions.length, correct: correct, ts: Date.now(),
    questions: quiz.questions.map(function(q,i){ return {q:q.q, o:q.o, a:q.a, chosen: quiz.answers[i], e:q.e}; })
  };
  store.attempts.push(attempt);
  if(store.attempts.length>50) store.attempts = store.attempts.slice(-50);
  saveStore(store);
  state.quiz = null;
  if(store.profile.pin) cloudSaveUser();
  sessionStorage.setItem("lastAttempt", JSON.stringify({attempt:attempt, timedOut:timedOut}));
  location.replace("result.html");
}

/* ===================== RENDER: RESULT DETAIL ===================== */
function renderResultDetail(attempt, timedOut){
  setHeader(attempt.subjectName, "ফলাফল", true);
  var pct = Math.round(100*attempt.correct/attempt.total);
  var pass = pct>=60;
  var html = "";
  html += '<div class="result-hero">'+
    '<div class="score">'+attempt.correct+'/'+attempt.total+'</div>'+
    '<div class="of">সঠিক উত্তর ('+pct+'%)'+(timedOut?" · সময় শেষ":"")+'</div>'+
    '<div class="verdict '+(pass?"pass":"fail")+'">'+(pass?"ভালো প্রস্তুতি! এই ধারা বজায় রাখুন।":"আরও অনুশীলন প্রয়োজন — দুর্বল অংশ চিহ্নিত করে আবার চেষ্টা করুন।")+'</div>'+
  '</div>';
  html += '<button class="btn block" id="retryBtn" style="margin-bottom:10px;">আবার অনুশীলন করুন</button>';
  html += '<button class="btn block" id="homeFromResultBtn" style="background:#fff;border:1px solid var(--line);color:var(--ink);margin-bottom:22px;">হোমে ফিরুন</button>';

  html += '<h2 class="section-title">উত্তরপত্র পর্যালোচনা</h2>';
  if(!attempt.questions){
    html += '<div class="empty-state"><p>এই অ্যাটেম্পটের বিস্তারিত প্রশ্ন-উত্তর সংরক্ষিত নেই (অন্য ডিভাইস থেকে সিঙ্ক করা ফলাফল)।<br>শুধু স্কোরটাই দেখা যাচ্ছে।</p></div>';
  } else {
    attempt.questions.forEach(function(item, i){
    var wasRight = item.chosen===item.a;
    html += '<div class="review-item">'+
      '<div class="rq">'+(i+1)+'. '+item.q+'</div>';
    if(item.chosen!==undefined && !wasRight){
      html += '<div class="ra wrong">আপনার উত্তর: '+["ক","খ","গ","ঘ"][item.chosen]+'. '+item.o[item.chosen]+'</div>';
    } else if(item.chosen===undefined){
      html += '<div class="ra wrong">উত্তর দেওয়া হয়নি</div>';
    }
    html += '<div class="ra right">সঠিক উত্তর: '+["ক","খ","গ","ঘ"][item.a]+'. '+item.o[item.a]+'</div>';
    html += '<div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px;line-height:1.6;">'+item.e+'</div>';
    html += '</div>';
    });
  }

  main.innerHTML = html;
  document.getElementById("retryBtn").addEventListener("click", function(){
    if(attempt.special) goToQuiz({mode:"practice", special:attempt.special});
    else if(attempt.mode==="practice") goToQuiz({mode:"practice", subject:attempt.subject});
    else goToQuiz({mode:"mock", count:attempt.total});
  });
  document.getElementById("homeFromResultBtn").addEventListener("click", function(){ location.href="index.html"; });
}

/* ===================== RENDER: HISTORY ===================== */
function renderHistory(){
  setHeader("ফলাফল ইতিহাস", "আপনার পূর্ববর্তী অনুশীলন ও মক টেস্টের ফল", false);
  var atts = store.attempts.slice().reverse();
  if(!atts.length){
    main.innerHTML = '<div class="empty-state">'+
      '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#5B5A52" stroke-width="1.5"><path d="M4 19V5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M8 12h8M8 16h5"/></svg>'+
      '<p>এখনো কোনো অনুশীলন করা হয়নি।<br>বিষয়ভিত্তিক অনুশীলন বা মক টেস্ট দিয়ে শুরু করুন।</p>'+
      '</div>';
    return;
  }
  var html = '<div>';
  atts.forEach(function(a, i){
    var pct = Math.round(100*a.correct/a.total);
    var idx = atts.length-1-i;
    html += '<div class="history-item" data-idx="'+idx+'">'+
      '<div class="hleft"><div class="hsub">'+(a.mode==="mock"?"মক টেস্ট":a.subjectName)+'</div>'+
      '<div class="hdate">'+fmtDate(a.ts)+' · '+a.total+'টি প্রশ্ন</div></div>'+
      '<div class="hscore '+(pct>=60?"good":"bad")+'">'+pct+'%</div>'+
    '</div>';
  });
  html += '</div>';
  main.innerHTML = html;
  document.querySelectorAll(".history-item").forEach(function(el){
    el.addEventListener("click", function(){
      var idx = parseInt(el.getAttribute("data-idx"),10);
      location.href = "result.html?idx="+idx;
    });
  });
}

/* ===================== RENDER: SETTINGS (ONLINE SYNC) ===================== */
function escapeAttr(s){
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
}
function showSyncStatus(msg, isError){
  var el = document.getElementById("syncStatus");
  if(!el) return;
  el.textContent = msg;
  el.style.color = isError ? "var(--bad)" : "var(--good)";
}
function renderSettings(){
  setHeader("অনলাইন সিঙ্ক সেটিংস", "Google Sheet থেকে প্রশ্ন যুক্ত করুন", true);
  var connected = !!store.remoteUrl;

  var html = "";

  html += '<div class="dark-toggle-row">'+
    '<div><div class="name">ডার্ক মোড</div><div class="meta">রাতে পড়ার জন্য গাঢ় থিম</div></div>'+
    '<button class="switch'+(store.darkMode?' on':'')+'" id="darkModeSwitch"><span class="knob"></span></button>'+
  '</div>';

  if(connected){
    html += '<div class="sync-card">'+
      '<div class="sync-card-top">'+
        '<span class="dot"></span><span class="label">সংযুক্ত আছে</span>'+
      '</div>'+
      '<div class="sync-card-meta" id="syncMetaLine">'+
        (store.remoteUpdated ? 'সর্বশেষ সিঙ্ক '+fmtDate(store.remoteUpdated)+' · '+REMOTE_QUESTIONS.length+'টি প্রশ্ন' : REMOTE_QUESTIONS.length+'টি প্রশ্ন')+
      '</div>'+
    '</div>';
    html += '<button class="btn block" id="syncNowBtn" style="margin-top:14px;">এখনই সিঙ্ক করুন</button>';
    html += '<button class="btn block" id="changeLinkBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--ink);">লিংক পরিবর্তন করুন</button>';
    html += '<button class="btn block" id="disconnectBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--bad);">সংযোগ বিচ্ছিন্ন করুন</button>';
  } else {
    html += '<p style="font-size:13.5px;line-height:1.75;color:var(--ink-soft);margin-top:0;">'+
      'Google Sheet-কে Apps Script দিয়ে Web App হিসেবে পাবলিশ করে সেই লিংকটি নিচে বসান।'+
    '</p>';
  }

  html += '<div id="urlFieldWrap"'+(connected?' class="hidden"':'')+'>';
  html += '<label class="field-label" style="margin-top:14px;">Web App URL</label>';
  html += '<input type="url" id="remoteUrlInput" class="field-input" placeholder="https://script.google.com/macros/s/xxxx/exec" value="'+(store.remoteUrl?escapeAttr(store.remoteUrl):'')+'">';
  html += '<button class="btn block" id="saveUrlBtn" style="margin-top:12px;">সংযুক্ত করে সিঙ্ক করুন</button>';
  html += '</div>';

  html += '<div id="syncStatus" class="sync-status"></div>';

  html += '<details class="setup-help"'+(connected?'':' open')+'>'+
    '<summary>সেটআপ নির্দেশনা ও কোড দেখুন</summary>'+
    '<div class="explain" style="font-size:13px;margin-top:12px;">'+
      '১. একটি Google Sheet খুলুন এবং শিটের নাম দিন <b>Questions</b>।<br>'+
      '২. প্রথম সারিতে কলাম হেডার দিন: <b>subject, question, option_a, option_b, option_c, option_d, answer, explanation</b> (answer কলামে ০, ১, ২ বা ৩ — অথবা ক/খ/গ/ঘ লিখুন)।<br>'+
      '৩. Extensions → Apps Script খুলুন, নিচের কোডটি পেস্ট করুন, তারপর Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone) করুন।<br>'+
      '৪. যে .../exec লিংকটি পাবেন সেটি উপরে বসিয়ে সংযুক্ত করুন।'+
    '</div>'+
    '<label class="field-label" style="margin-top:14px;">Apps Script কোড (কপি করে পেস্ট করুন)</label>'+
    '<textarea readonly class="field-input" style="height:170px;resize:vertical;white-space:pre;overflow:auto;" onclick="this.select()">'+
      'function doGet(e) {\n'+
      '  var action = e.parameter.action;\n'+
      '  if(action === "getUser") return getUserByPin(e.parameter.pin);\n'+
      '  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Questions");\n'+
      '  var data = sheet.getDataRange().getValues();\n'+
      '  var headers = data[0];\n'+
      '  var rows = data.slice(1);\n'+
      '  var questions = rows.filter(function(r){ return r[0] !== ""; }).map(function(r){\n'+
      '    var obj = {};\n'+
      '    headers.forEach(function(h, i){ obj[h] = r[i]; });\n'+
      '    return {\n'+
      '      s: obj.subject, q: obj.question,\n'+
      '      o: [obj.option_a, obj.option_b, obj.option_c, obj.option_d],\n'+
      '      a: obj.answer, e: obj.explanation\n'+
      '    };\n'+
      '  });\n'+
      '  return ContentService.createTextOutput(JSON.stringify({questions: questions}))\n'+
      '    .setMimeType(ContentService.MimeType.JSON);\n'+
      '}\n'+
      '\n'+
      'function doPost(e) {\n'+
      '  var body = JSON.parse(e.postData.contents);\n'+
      '  if(body.action === "saveUser") return saveUser(body);\n'+
      '  return ContentService.createTextOutput(JSON.stringify({ok:false}))\n'+
      '    .setMimeType(ContentService.MimeType.JSON);\n'+
      '}\n'+
      '\n'+
      'function getUsersSheet(){\n'+
      '  var ss = SpreadsheetApp.getActiveSpreadsheet();\n'+
      '  var sh = ss.getSheetByName("Users");\n'+
      '  if(!sh){\n'+
      '    sh = ss.insertSheet("Users");\n'+
      '    sh.appendRow(["pin","name","rank","unit","sessions","answered","correct","bestMock","wrongIds","bookmarks","attempts","updated"]);\n'+
      '  }\n'+
      '  return sh;\n'+
      '}\n'+
      '\n'+
      'function safeParse(s){ try{ return JSON.parse(s); }catch(err){ return []; } }\n'+
      '\n'+
      'function getUserByPin(pin){\n'+
      '  var sh = getUsersSheet();\n'+
      '  var data = sh.getDataRange().getValues();\n'+
      '  for(var i=1;i<data.length;i++){\n'+
      '    if(String(data[i][0]) === String(pin)){\n'+
      '      return ContentService.createTextOutput(JSON.stringify({\n'+
      '        found:true, pin:data[i][0], name:data[i][1], rank:data[i][2], unit:data[i][3],\n'+
      '        sessions:data[i][4], answered:data[i][5], correct:data[i][6], bestMock:data[i][7],\n'+
      '        wrongIds:safeParse(data[i][8]), bookmarks:safeParse(data[i][9]), attempts:safeParse(data[i][10])\n'+
      '      })).setMimeType(ContentService.MimeType.JSON);\n'+
      '    }\n'+
      '  }\n'+
      '  return ContentService.createTextOutput(JSON.stringify({found:false}))\n'+
      '    .setMimeType(ContentService.MimeType.JSON);\n'+
      '}\n'+
      '\n'+
      'function saveUser(body){\n'+
      '  var sh = getUsersSheet();\n'+
      '  var data = sh.getDataRange().getValues();\n'+
      '  var rowIdx = -1;\n'+
      '  for(var i=1;i<data.length;i++){\n'+
      '    if(String(data[i][0]) === String(body.pin)){ rowIdx = i+1; break; }\n'+
      '  }\n'+
      '  var row = [\n'+
      '    body.pin, body.name||"", body.rank||"", body.unit||"",\n'+
      '    body.sessions||0, body.answered||0, body.correct||0, body.bestMock||0,\n'+
      '    JSON.stringify(body.wrongIds||[]), JSON.stringify(body.bookmarks||[]), JSON.stringify(body.attempts||[]),\n'+
      '    new Date().toISOString()\n'+
      '  ];\n'+
      '  if(rowIdx === -1) sh.appendRow(row);\n'+
      '  else sh.getRange(rowIdx,1,1,row.length).setValues([row]);\n'+
      '  return ContentService.createTextOutput(JSON.stringify({ok:true}))\n'+
      '    .setMimeType(ContentService.MimeType.JSON);\n'+
      '}'+
    '</textarea>'+
  '</details>';

  main.innerHTML = html;

  document.getElementById("darkModeSwitch").addEventListener("click", function(){
    store.darkMode = !store.darkMode;
    saveStore(store);
    applyDarkMode(store.darkMode);
    renderSettings();
  });

  var changeLinkBtn = document.getElementById("changeLinkBtn");
  if(changeLinkBtn) changeLinkBtn.addEventListener("click", function(){
    document.getElementById("urlFieldWrap").classList.remove("hidden");
    changeLinkBtn.classList.add("hidden");
  });

  document.getElementById("saveUrlBtn").addEventListener("click", function(){
    var val = document.getElementById("remoteUrlInput").value.trim();
    if(!val){ showSyncStatus("একটি সঠিক URL দিন।", true); return; }
    store.remoteUrl = val;
    saveStore(store);
    showSyncStatus("সিঙ্ক করা হচ্ছে...", false);
    fetchRemoteQuestions().then(function(){
      showSyncStatus("সফলভাবে সিঙ্ক হয়েছে — মোট "+REMOTE_QUESTIONS.length+"টি অনলাইন প্রশ্ন পাওয়া গেছে।", false);
      renderSettings();
    }).catch(function(err){
      showSyncStatus("সিঙ্ক ব্যর্থ হয়েছে। লিংক ও Deploy সেটিংস (Anyone has access) যাচাই করুন। ("+err.message+")", true);
    });
  });
  var syncNowBtn = document.getElementById("syncNowBtn");
  if(syncNowBtn) syncNowBtn.addEventListener("click", function(){
    showSyncStatus("সিঙ্ক করা হচ্ছে...", false);
    fetchRemoteQuestions().then(function(){
      showSyncStatus("সফলভাবে সিঙ্ক হয়েছে — মোট "+REMOTE_QUESTIONS.length+"টি অনলাইন প্রশ্ন পাওয়া গেছে।", false);
      renderSettings();
    }).catch(function(err){
      showSyncStatus("সিঙ্ক ব্যর্থ হয়েছে। ("+err.message+")", true);
    });
  });
  var disconnectBtn = document.getElementById("disconnectBtn");
  if(disconnectBtn) disconnectBtn.addEventListener("click", function(){
    if(!confirm("সংযোগ বিচ্ছিন্ন করলে অনলাইন প্রশ্নগুলো আর দেখা যাবে না। নিশ্চিত?")) return;
    delete store.remoteUrl;
    delete store.remoteCache;
    delete store.remoteUpdated;
    saveStore(store);
    REMOTE_QUESTIONS = [];
    QUESTIONS = LOCAL_QUESTIONS.slice();
    renderSettings();
  });
}

/* ===================== RENDER: PROFILE ===================== */
function renderProfile(){
  setHeader("প্রোফাইল", "আপনার তথ্য ও অগ্রগতি", false);
  var p = store.profile;
  if(!p.pin){ renderAccountGate(); return; }
  var initials = (p.name||"").trim().split(/\s+/).filter(Boolean).map(function(w){return w[0];}).slice(0,2).join("").toUpperCase() || "?";
  var html = "";

  if(state.profileEditing){
    var photoShown = state.tempPhoto || p.photo;
    html += '<div class="profile-card">';
    html += '<div class="avatar-wrap">'+(photoShown ? '<img class="avatar" src="'+photoShown+'">' : '<div class="avatar avatar-fallback">'+initials+'</div>')+'</div>';
    html += '<label class="btn" for="photoInput" style="margin-top:12px;display:inline-block;background:#fff;border:1px solid var(--line);color:var(--ink);font-size:12.5px;padding:8px 16px;">ছবি বদলান</label>';
    html += '<input type="file" accept="image/*" id="photoInput" class="hidden">';
    html += '</div>';
    html += '<label class="field-label" style="margin-top:18px;">নাম</label>';
    html += '<input type="text" id="nameInput" class="field-input" value="'+escapeAttr(p.name)+'" placeholder="আপনার নাম">';
    html += '<label class="field-label" style="margin-top:14px;">পদবী</label>';
    html += '<input type="text" id="rankInput" class="field-input" value="'+escapeAttr(p.rank)+'" placeholder="যেমনঃ কনস্টেবল">';
    html += '<label class="field-label" style="margin-top:14px;">থানা/ইউনিট</label>';
    html += '<input type="text" id="unitInput" class="field-input" value="'+escapeAttr(p.unit)+'" placeholder="যেমনঃ ঢাকা মেট্রোপলিটন">';
    html += '<button class="btn block" id="saveProfileBtn" style="margin-top:18px;">সংরক্ষণ করুন</button>';
    html += '<button class="btn block" id="cancelProfileBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--ink);">বাতিল</button>';

    main.innerHTML = html;
    document.getElementById("photoInput").addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(){ state.tempPhoto = reader.result; renderProfile(); };
      reader.readAsDataURL(file);
    });
    document.getElementById("saveProfileBtn").addEventListener("click", function(){
      store.profile.name = document.getElementById("nameInput").value.trim();
      store.profile.rank = document.getElementById("rankInput").value.trim();
      store.profile.unit = document.getElementById("unitInput").value.trim();
      if(state.tempPhoto) store.profile.photo = state.tempPhoto;
      saveStore(store);
      state.tempPhoto = null;
      state.profileEditing = false;
      if(store.profile.pin) cloudSaveUser();
      renderProfile();
    });
    document.getElementById("cancelProfileBtn").addEventListener("click", function(){
      state.tempPhoto = null;
      state.profileEditing = false;
      renderProfile();
    });
    return;
  }

  var stats = overallStats();
  html += '<div class="profile-card">';
  html += '<div class="avatar-wrap">'+(p.photo ? '<img class="avatar" src="'+p.photo+'">' : '<div class="avatar avatar-fallback">'+initials+'</div>')+'</div>';
  html += '<div class="pname">'+(p.name ? escapeAttr(p.name) : "নাম যোগ করুন")+'</div>';
  if(p.rank || p.unit){
    html += '<div class="prole">'+[p.rank,p.unit].filter(Boolean).map(escapeAttr).join(' · ')+'</div>';
  }
  html += '<button class="btn" id="editProfileBtn" style="margin-top:14px;">প্রোফাইল সম্পাদনা করুন</button>';
  html += '<div style="margin-top:14px;font-size:11.5px;color:var(--ink-soft);">আপনার PIN: <b style="color:var(--ink);font-family:\'JetBrains Mono\',monospace;">'+p.pin+'</b> — অন্য ডিভাইসে এই PIN দিয়ে প্রোফাইল ফিরে পাবেন</div>';
  html += '<button class="btn" id="logoutBtn" style="margin-top:10px;background:none;color:var(--bad);font-size:12px;padding:6px 10px;">লগ আউট (এই ডিভাইস থেকে)</button>';
  html += '</div>';

  html += '<div class="stat-strip" style="margin-top:20px;">'+
    '<div class="stat-cell"><div class="num">'+stats.sessions+'</div><div class="lbl">সেশন</div></div>'+
    '<div class="stat-cell"><div class="num">'+(stats.accuracy!==null?stats.accuracy+"%":"—")+'</div><div class="lbl">সঠিকতার হার</div></div>'+
    '<div class="stat-cell"><div class="num">'+(stats.bestMock!==null?stats.bestMock+"%":"—")+'</div><div class="lbl">সেরা মক</div></div>'+
  '</div>';

  html += '<h2 class="section-title">বিষয়ভিত্তিক অগ্রগতি</h2>';
  var subsWithAttempts = SUBJECTS.filter(function(s){ return subjectAggregateStats(s.id); });
  if(!subsWithAttempts.length){
    html += '<div class="empty-state"><p>এখনো কোনো অনুশীলন করা হয়নি। বিষয়ভিত্তিক অনুশীলন শুরু করলে এখানে অগ্রগতি দেখা যাবে।</p></div>';
  } else {
    html += '<div class="progress-list">';
    subsWithAttempts.forEach(function(s){
      var st = subjectAggregateStats(s.id);
      html += '<div class="progress-row">'+
        '<div class="progress-row-top"><span>'+s.name+'</span><span>'+st.pct+'%</span></div>'+
        '<div class="progress-track"><div class="progress-fill" style="width:'+st.pct+'%"></div></div>'+
      '</div>';
    });
    html += '</div>';
  }

  main.innerHTML = html;
  document.getElementById("editProfileBtn").addEventListener("click", function(){
    state.profileEditing = true;
    renderProfile();
  });
  document.getElementById("logoutBtn").addEventListener("click", function(){
    if(!confirm("এই ডিভাইস থেকে লগ আউট করবেন? আপনার PIN দিয়ে আবার লগইন করে ফিরে আসতে পারবেন।")) return;
    store.profile.pin = "";
    saveStore(store);
    state.accountMode = null;
    renderProfile();
  });
}

/* ===================== ACCOUNT (PIN login / register) ===================== */
function showAccountMsg(msg, isError){
  var el = document.getElementById("accountMsg");
  if(el){ el.textContent = msg; el.style.color = isError ? "var(--bad)" : "var(--good)"; }
}
function renderAccountGate(){
  var mode = state.accountMode;
  var html = "";
  if(!mode){
    html += '<div class="profile-card">'+
      '<div class="pname" style="margin-top:0;">স্বাগতম!</div>'+
      '<div class="prole">অগ্রগতি সংরক্ষণ করতে ও যেকোনো ডিভাইস থেকে ফিরে পেতে একটা প্রোফাইল তৈরি করুন</div>'+
      '<button class="btn block" id="gotoRegisterBtn" style="margin-top:18px;">নতুন প্রোফাইল শুরু করুন</button>'+
      '<button class="btn block" id="gotoLoginBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--ink);">আগের PIN দিয়ে ফিরে আসুন</button>'+
    '</div>';
    main.innerHTML = html;
    document.getElementById("gotoRegisterBtn").addEventListener("click", function(){ state.accountMode="register"; renderProfile(); });
    document.getElementById("gotoLoginBtn").addEventListener("click", function(){ state.accountMode="login"; renderProfile(); });
    return;
  }

  if(mode === "register"){
    var suggestedPin = generatePin();
    html += '<label class="field-label">নাম</label>';
    html += '<input type="text" id="regName" class="field-input" placeholder="আপনার নাম">';
    html += '<label class="field-label" style="margin-top:14px;">আপনার ৪-সংখ্যার PIN (এটা মনে রাখুন)</label>';
    html += '<input type="text" id="regPin" class="field-input" inputmode="numeric" maxlength="6" value="'+suggestedPin+'">';
    html += '<div id="accountMsg" class="sync-status"></div>';
    html += '<button class="btn block" id="regSubmitBtn" style="margin-top:14px;">শুরু করুন</button>';
    html += '<button class="btn block" id="accountBackBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--ink);">ফিরে যান</button>';
    main.innerHTML = html;
    document.getElementById("regSubmitBtn").addEventListener("click", function(){
      var name = document.getElementById("regName").value.trim();
      var pin = document.getElementById("regPin").value.trim();
      if(!name){ showAccountMsg("নাম লিখুন।", true); return; }
      if(!/^[0-9]{4,6}$/.test(pin)){ showAccountMsg("৪-৬ সংখ্যার PIN দিন।", true); return; }
      showAccountMsg("তৈরি করা হচ্ছে...", false);
      cloudFetchUser(pin).then(function(res){
        if(res.found){ showAccountMsg("এই PIN আগে থেকেই ব্যবহৃত হয়েছে, অন্য একটা দিন।", true); return; }
        store.profile.name = name;
        store.profile.pin = pin;
        saveStore(store);
        cloudSaveUser().then(function(){ state.accountMode=null; renderProfile(); });
      }).catch(function(){
        store.profile.name = name;
        store.profile.pin = pin;
        saveStore(store);
        state.accountMode = null;
        renderProfile();
      });
    });
    document.getElementById("accountBackBtn").addEventListener("click", function(){ state.accountMode=null; renderProfile(); });
    return;
  }

  if(mode === "login"){
    html += '<label class="field-label">আপনার PIN দিন</label>';
    html += '<input type="text" id="loginPin" class="field-input" inputmode="numeric" maxlength="6" placeholder="যেমনঃ 4821">';
    html += '<div id="accountMsg" class="sync-status"></div>';
    html += '<button class="btn block" id="loginSubmitBtn" style="margin-top:14px;">ফিরে আসুন</button>';
    html += '<button class="btn block" id="accountBackBtn" style="margin-top:10px;background:#fff;border:1px solid var(--line);color:var(--ink);">ফিরে যান</button>';
    main.innerHTML = html;
    document.getElementById("loginSubmitBtn").addEventListener("click", function(){
      var pin = document.getElementById("loginPin").value.trim();
      if(!/^[0-9]{4,6}$/.test(pin)){ showAccountMsg("সঠিক PIN দিন।", true); return; }
      showAccountMsg("খোঁজা হচ্ছে...", false);
      cloudFetchUser(pin).then(function(res){
        if(!res.found){ showAccountMsg("এই PIN দিয়ে কোনো প্রোফাইল পাওয়া যায়নি।", true); return; }
        applyCloudUser(res);
        state.accountMode = null;
        renderProfile();
      }).catch(function(){ showAccountMsg("সংযোগ ব্যর্থ। ইন্টারনেট সংযোগ যাচাই করুন।", true); });
    });
    document.getElementById("accountBackBtn").addEventListener("click", function(){ state.accountMode=null; renderProfile(); });
    return;
  }
}


/* ===================== SHARED BOOTSTRAP (called by every page) ===================== */
if(store.remoteCache && store.remoteCache.length){
  mergeRemote(store.remoteCache);
}
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible" && window.__pageRerender){
    maybeAutoSync(window.__pageRerender);
  }
});
