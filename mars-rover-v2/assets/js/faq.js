/*
 * Mars Rover V2 – Client-side FAQ Assistant
 * This assistant uses a simple keyword scoring model to generate helpful,
 * educational responses. It runs entirely in the browser and stores past Q&A
 * in localStorage for convenience.
 *
 * Written and debugged with the help of AI (GitHub Copilot).
 */
(function(){
  const STORAGE_KEY = 'mars_faq_qas_v2';

  const el = {
    form: document.getElementById('ask-form'),
    input: document.getElementById('question-input'),
    feed: document.getElementById('qa-feed'),
    clear: document.getElementById('clear-qa'),
    status: document.getElementById('faq-status')
  };

  function setStatus(text){ if(el.status) el.status.textContent = text; }

  function escapeHtml(str){
    return String(str).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
  }

  function renderItem(q, a){
    const item = document.createElement('div');
    item.className = 'qa-item';
    const question = document.createElement('div');
    question.className = 'question';
    question.textContent = q;
    const answer = document.createElement('div');
    answer.className = 'answer';
    answer.innerHTML = a;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const dt = new Date();
    meta.textContent = dt.toLocaleString();
    item.appendChild(question);
    item.appendChild(answer);
    item.appendChild(meta);
    if(el.feed){
      el.feed.prepend(item);
    }
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.forEach(({q,a}) => renderItem(q,a));
    }catch(e){ /* ignore */ }
  }

  function save(q,a){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({q,a});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }catch(e){ /* ignore */ }
  }

  // Knowledge base with weighted keywords and synonyms
  const KB = {
    nasa: {
      weight: 2,
      keywords: ['nasa','national aeronautics and space administration','agency','space program','us space','space agency'],
      text: '<p><strong>NASA</strong> is the United States federal agency responsible for the civil space program and aeronautics research. It leads missions across Earth science, planetary exploration (including the Mars rovers), heliophysics, astrophysics (like the Hubble and James Webb Space Telescopes), and human spaceflight.</p><p>Learn more at <a href="https://www.nasa.gov/" target="_blank" rel="noopener noreferrer">nasa.gov</a> and the Mars portal <a href="https://mars.nasa.gov/" target="_blank" rel="noopener noreferrer">mars.nasa.gov</a>.</p>'
    },
    rover_def: {
      weight: 2,
      keywords: ['rover','mars rover','robot','vehicle','wheels','robotic vehicle'],
      text: '<p>A <strong>Mars rover</strong> is a robotic vehicle that drives on the Martian surface, carrying instruments to study rocks, soil, atmosphere, and signs of past habitability. Notable rovers include Sojourner, Spirit & Opportunity, Curiosity, and Perseverance.</p>'
    },
    perseverance: {
      weight: 3,
      keywords: ['perseverance','sample','jezero','ingenuity','2020','biosignature','sample return'],
      text: '<p><strong>Perseverance</strong> (landed in Jezero Crater, 2021) searches for ancient biosignatures and collects samples for future return to Earth. It also carried <em>Ingenuity</em>, the technology-demonstration helicopter for powered flight on Mars.</p>'
    },
    curiosity: {
      weight: 3,
      keywords: ['curiosity','gale','chemistry','2011','msl','habitability'],
      text: '<p><strong>Curiosity</strong> (Mars Science Laboratory, landed 2012 in Gale Crater) studies climate and geology, analyzing rock chemistry to assess whether Mars was once habitable.</p>'
    },
    spirit_opp: {
      weight: 2,
      keywords: ['spirit','opportunity','meridiani','gusev','2003','twin','mer'],
      text: '<p><strong>Spirit & Opportunity</strong> (twin rovers, landed 2004) vastly exceeded their 90-sol plans and found extensive evidence of past water-related processes.</p>'
    },
    sojourner: {
      weight: 1,
      keywords: ['sojourner','pathfinder','1997','first rover'],
      text: '<p><strong>Sojourner</strong> (1997) was the first successful Mars rover, proving the concept of mobile surface exploration.</p>'
    },
    report_problem: {
      weight: 1,
      keywords: ['report','problem','bug','issue','contact','feedback'],
      text: '<p>To report a problem or share feedback, please use the <a href="contact.html">Contact page</a> in v2.</p>'
    },
    who_built: {
      weight: 1,
      keywords: ['who built','who made','who develops','built by','developed by'],
      text: '<p>Mars rovers are developed by NASA centers and industry partners. For example, <strong>JPL</strong> (Jet Propulsion Laboratory) leads the Mars rover missions, with contributions from other NASA centers and universities.</p>'
    }
  };

  function tokenize(str){
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g,' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function score(query){
    const q = query.toLowerCase();
    const results = [];
    for(const key in KB){
      const entry = KB[key];
      let s = 0;
      for(const kw of entry.keywords){
        if(q.includes(kw)) s += entry.weight;
      }
      if(s > 0){ results.push({ key, score: s, entry }); }
    }
    // Sort by score desc, then by weight to prefer more specific topics
    results.sort((a,b)=> b.score - a.score || b.entry.weight - a.entry.weight);
    return results;
  }

  function combineAnswers(matches){
    if(matches.length === 0) return null;
    const topTwo = matches.slice(0,2);
    if(topTwo.length === 1){ return topTwo[0].entry.text; }
    return topTwo.map(m=> m.entry.text).join('<hr aria-hidden="true">');
  }

  function intentHint(q){
    const t = tokenize(q);
    const has = (w)=> t.includes(w);
    if(has('who')) return 'who';
    if(has('what')) return 'what';
    if(has('when')) return 'when';
    if(has('where')) return 'where';
    if(has('how')) return 'how';
    return 'general';
  }

  function generateResponse(q){
    // Quick rule-based facts for simple logical questions
    const qLower = q.toLowerCase().trim();
    const simpleFacts = [
      {
        test: /\b(mars)\b.*\b(from the sun|planet from the sun|distance from the sun)\b|\bwhich\s+planet\s+is\s+mars\b/,
        answer: '<p>Mars is the <strong>fourth</strong> planet from the Sun.</p>'
      },
      {
        test: /\b(how far|distance)\b.*\b(mars)\b.*\b(sun)\b|\bmars\b.*\b(au|astronomical unit|million miles|million km)\b/,
        answer: '<p>Mars orbits at an average distance of about <strong>1.52 AU</strong> from the Sun (~<strong>228 million km</strong> / <strong>142 million miles</strong>).</p>'
      },
      {
        test: /\b(orbital period|year)\b.*\b(mars)\b|\bhow long\b.*\bmars\b.*\byear\b/,
        answer: '<p>A Martian year is about <strong>687 Earth days</strong>.</p>'
      },
      {
        test: /\b(day|sol)\b.*\b(mars)\b|\bhow long\b.*\bmars\b.*\bday\b/,
        answer: '<p>One Martian day (<em>sol</em>) is about <strong>24 hours 39 minutes</strong>.</p>'
      },
      {
        test: /\bmoons?\b.*\b(mars)\b|\bmars\b.*\bmoons?\b/,
        answer: '<p>Mars has two small moons: <strong>Phobos</strong> and <strong>Deimos</strong>.</p>'
      },
      {
        test: /\batmosphere\b.*\bmars\b|\bwhat\b.*\bis\b.*\bmars\b.*\batmosphere\b/,
        answer: '<p>Mars has a thin atmosphere, mostly <strong>carbon dioxide (CO₂)</strong>, with nitrogen and argon.</p>'
      },
      {
        test: /\bgravity\b.*\bmars\b|\bmars\b.*\bgravity\b/,
        answer: '<p>Surface gravity on Mars is about <strong>38%</strong> of Earth’s (~<strong>3.71 m/s²</strong>).</p>'
      },
      {
        test: /\bradius\b.*\bmars\b|\bsize\b.*\bmars\b|\bmars\b.*\bradius\b/,
        answer: '<p>Mars’ mean radius is ~<strong>3,390 km</strong> (about <strong>half</strong> Earth’s diameter).</p>'
      },
      {
        test: /\btemperature\b.*\bmars\b|\bmars\b.*\btemperature\b|\bcold\b.*\bmars\b/,
        answer: '<p>Typical Mars surface temperatures range roughly from <strong>-125°C</strong> to <strong>20°C</strong> depending on season, time of day, and latitude.</p>'
      },
      {
        test: /\bis\b.*\bmars\b.*\bbigger\b.*\bthan\b.*\bearth\b|\bcompare\b.*\bmars\b.*\bearth\b/,
        answer: '<p>Mars is <strong>smaller</strong> than Earth: about <strong>half</strong> Earth’s diameter and ~<strong>10.7%</strong> of Earth’s mass.</p>'
      }
    ];
    for(const rule of simpleFacts){
      if(rule.test && typeof rule.test.test === 'function' && rule.test.test(qLower)) {
        return rule.answer;
      }
    }

    // Keyword-scored topics
    const matches = score(q);
    const combined = combineAnswers(matches);
    if(combined) return combined;
    const hint = intentHint(q);
    const suggest = '<p>Try asking about <em>Perseverance</em>, <em>Curiosity</em>, <em>Spirit &amp; Opportunity</em>, <em>Sojourner</em>, or <em>NASA</em>.</p>';
    switch(hint){
      case 'who': return '<p>Are you asking who built the rovers or who runs NASA? '+suggest+'</p>';
      case 'what': return '<p>Are you asking what a rover does or what NASA is? '+suggest+'</p>';
      case 'when': return '<p>Looking for mission dates? Ask about Curiosity (2012) or Perseverance (2021). '+suggest+'</p>';
      case 'where': return '<p>Try locations like Gale Crater (Curiosity) or Jezero Crater (Perseverance). '+suggest+'</p>';
      case 'how': return '<p>Interested in how rovers move or collect samples? Mention wheels, autonomy, or sampling. '+suggest+'</p>';
      default: return '<p>Great question! I don\'t have a specific answer yet. '+suggest+'</p>';
    }
  }

  function onSubmit(evt){
    evt.preventDefault();
    const q = (el.input.value || '').trim();
    if(!q){ setStatus('Please enter a question.'); return; }
    setStatus('Thinking...');
    const askBtn = el.form.querySelector('button[type="submit"]');
    if(askBtn) askBtn.disabled = true;
    try{
      // Compute synchronously and render immediately for snappy UX
      const a = generateResponse(q);
      renderItem(q, a);
      save(q, a);
      el.input.value = '';
    } catch(e){
      console.error('FAQ error:', e);
      setStatus('Something went wrong. Try again.');
    } finally {
      setStatus('Status: ready');
      if(askBtn){
        askBtn.disabled = false;
      }
    }
  }

  function onClear(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    el.feed.innerHTML = '';
    setStatus('Cleared previous Q&A.');
  }

  function init(){
    if(!el.form || !el.input || !el.feed){
      console.warn('MarsFaq: missing elements', el);
      setStatus('Assistant not initialized: missing elements.');
      return;
    }
    el.form.addEventListener('submit', onSubmit);
    // Enter key support inside textarea
    el.input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
        el.form.requestSubmit();
      }
    });
    if(el.clear) el.clear.addEventListener('click', onClear);
    load();
    setStatus('Status: ready');
    window.MarsFaq = { test(q){ return generateResponse(q || 'what does nasa do?'); }, ready: true };
    console.log('MarsFaq: initialized');
  }

  // Initialize after DOM is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
