// Core Data
let dictionary = [];
let favorites = JSON.parse(localStorage.getItem('rhyme-favorites') || '[]');
let customWords = JSON.parse(localStorage.getItem('rhyme-custom') || '[]');
let anchors = [
  { word: '', locked: false, rhymes: [], allRhymes: [] },
  { word: '', locked: false, rhymes: [], allRhymes: [] },
  { word: '', locked: false, rhymes: [], allRhymes: [] },
  { word: '', locked: false, rhymes: [], allRhymes: [] },
  { word: '', locked: false, rhymes: [], allRhymes: [] }
];

let strictness = 'close'; // exact, close, slant, experimental
let cipherInterval = null;
let isCipherOn = false;

let historyStack = [];
function saveState() {
  if (historyStack.length >= 50) historyStack.shift();
  historyStack.push(JSON.parse(JSON.stringify(anchors)));
}
function undoRoll() {
  if (historyStack.length > 0) {
    anchors = historyStack.pop();
    renderBoard();
  }
}

// Init Dictionary
function initDictionary() {
  let allWords = new Set();
  
  if (typeof RHYME_FAMILIES !== 'undefined') {
    RHYME_FAMILIES.forEach(fam => {
      fam.words.forEach(w => {
        const clean = w.toLowerCase().trim();
        // Strictly allow only real words (3+ letters, optional hyphen/apostrophe)
        if (/^[a-z][a-z\-\']{2,}$/.test(clean)) {
          allWords.add(clean);
        }
      });
    });
  }
  
  customWords.forEach(w => allWords.add(w.toLowerCase()));
  dictionary = Array.from(allWords);
}

// UI Elements
const boardEl = document.getElementById('board');
const favListEl = document.getElementById('fav-list');
const dictGridEl = document.getElementById('dict-grid');
const strictnessEl = document.getElementById('strictness-slider');

function renderBoard(glitchInfo = null) {
  boardEl.innerHTML = '';
  anchors.forEach((anchor, index) => {
    const col = document.createElement('div');
    col.className = 'anchor-col';
    if (isBeatOn && index === activeBeatIndex) {
      col.classList.add('active-beat');
    }
    
    // Make the entire column a drop target
    col.ondragover = (e) => {
      e.preventDefault();
      col.style.boxShadow = '0 0 15px var(--accent)';
    };
    col.ondragleave = (e) => {
      col.style.boxShadow = '';
    };
    col.ondrop = (e) => {
      e.preventDefault();
      col.style.boxShadow = '';
      
      const sourceType = e.dataTransfer.getData('sourceType');
      if (sourceType === 'vault') {
        const word = e.dataTransfer.getData('text/plain');
        saveState();
        updateAnchor(index, word);
      } else if (sourceType === 'anchor') {
        const sourceIndex = parseInt(e.dataTransfer.getData('anchorIndex'));
        if (sourceIndex !== index) {
          saveState();
          // Swap logic
          const temp = anchors[sourceIndex];
          anchors[sourceIndex] = anchors[index];
          anchors[index] = temp;
          renderBoard();
        }
      }
    };
    
    // Header
    const header = document.createElement('div');
    header.className = 'anchor-header ' + (anchor.locked ? 'locked' : '');
    
    // Make the header the draggable handle for swapping anchors
    header.draggable = true;
    header.ondragstart = (e) => {
      e.dataTransfer.setData('sourceType', 'anchor');
      e.dataTransfer.setData('anchorIndex', index);
      setTimeout(() => header.style.opacity = '0.5', 0);
    };
    header.ondragend = (e) => {
      header.style.opacity = '1';
    };
    
    const lock = document.createElement('div');
    lock.className = 'anchor-lock';
    lock.innerHTML = anchor.locked ? '🔒' : '🔓';
    lock.onclick = () => {
      anchor.locked = !anchor.locked;
      renderBoard();
    };
    
    const input = document.createElement('input');
    input.className = 'anchor-input';
    input.type = 'text';
    input.value = anchor.word;
    input.placeholder = 'WORD';
    
    // Dynamically shrink long words so they remain visible
    if (anchor.word.length > 10) {
      input.style.fontSize = '1.1rem';
    } else if (anchor.word.length > 7) {
      input.style.fontSize = '1.4rem';
    }
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim().toLowerCase();
        if (val) {
          saveState();
          updateAnchor(index, val);
        }
      }
    };
    input.onblur = () => {
       input.value = anchor.word;
    };
    
    header.appendChild(lock);
    header.appendChild(input);
    col.appendChild(header);
    
    // Rhymes
    const rhymeList = document.createElement('div');
    rhymeList.className = 'rhyme-list';
    
    anchor.rhymes.forEach((r, slotIdx) => {
      const item = document.createElement('div');
      item.className = 'rhyme-item';
      if (glitchInfo && glitchInfo.anchorIndex === index && glitchInfo.slotIndex === slotIdx && isCipherOn) {
        item.classList.add('cipher-glitch');
      }
      item.innerText = r.word;
      
      const actions = document.createElement('div');
      actions.className = 'actions';
      
      const favBtn = document.createElement('button');
      favBtn.innerHTML = '⭐';
      favBtn.title = 'Add to Vault';
      favBtn.onclick = () => addFavorite(r.word);
      
      const useBtn = document.createElement('button');
      useBtn.innerHTML = '⬆️';
      useBtn.title = 'Make Anchor';
      useBtn.onclick = () => { saveState(); updateAnchor(index, r.word); };
      
      actions.appendChild(useBtn);
      actions.appendChild(favBtn);
      item.appendChild(actions);
      
      rhymeList.appendChild(item);
    });
    
    col.appendChild(rhymeList);
    boardEl.appendChild(col);
  });
}

function getVowelSuffix(word) {
  const match = word.match(/[aeiouy][^aeiouy]*$/i);
  if (match) {
    let suffix = match[0];
    if (suffix.endsWith('e') && word.length > suffix.length) {
      const match2 = word.match(/[aeiouy][^aeiouy]*[aeiouy][^aeiouy]*$/i);
      if (match2) suffix = match2[0];
    }
    return suffix.toLowerCase();
  }
  return word.length >= 3 ? word.slice(-3).toLowerCase() : word.toLowerCase();
}

async function updateAnchor(index, word) {
  anchors[index].word = word.toUpperCase();
  anchors[index].rhymes = ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."];
  renderBoard();
  
  let combinedRhymes = new Set();
  const apiWord = word.split(/[\s-]+/).pop().toLowerCase();
  
  async function fetchDatamuse(queryWord, param) {
    let url = `https://api.datamuse.com/words?${param}=${queryWord}&max=40`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        data.forEach(d => {
          const clean = d.word.toLowerCase();
          // Must start with a letter, be 3+ chars, and not match the anchor word
          if (/^[a-z][a-z\-\']{2,}$/.test(clean) && clean !== word.toLowerCase() && clean !== apiWord) {
            // Bumped to 250 to kill "lep", "dep", "moone", "sterne"
            if ((d.score && d.score >= 250) || dictionary.includes(clean)) {
              combinedRhymes.add(clean);
            }
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  // RAP-OPTIMIZED STRICTNESS WATERFALL
  if (strictness === 'exact') {
    await fetchDatamuse(apiWord, 'rel_rhy'); // Perfect rhymes
  } else if (strictness === 'close') {
    await fetchDatamuse(apiWord, 'rel_rhy');
    if (combinedRhymes.size < 15) await fetchDatamuse(apiWord, 'rel_nry'); // Blend in slant rhymes
  } else if (strictness === 'slant') {
    await fetchDatamuse(apiWord, 'rel_nry'); // Pure slant rhymes (assonance)
    if (combinedRhymes.size < 15) await fetchDatamuse(apiWord, 'sl'); // Sounds like
  } else if (strictness === 'experimental') {
    await fetchDatamuse(apiWord, 'rel_nry'); // Approximate rhymes
    await fetchDatamuse(apiWord, 'sl');      // Sounds like
  }

  // GUARANTEED FALLBACK: If we still don't have enough, progressively widen the net
  if (combinedRhymes.size < 10) {
    await fetchDatamuse(apiWord, 'rel_rhy'); 
    if (combinedRhymes.size < 10) await fetchDatamuse(apiWord, 'rel_nry');
    if (combinedRhymes.size < 10) await fetchDatamuse(apiWord, 'sl');
  }
  
  let finalRhymes = Array.from(combinedRhymes);
  const vowelSuffix = getVowelSuffix(apiWord);
  
  // 1. LOCAL DICTIONARY VOWEL FALLBACK (Assonance)
  if (finalRhymes.length < 10) {
    dictionary.forEach(w => {
      if (w !== apiWord && w !== word.toLowerCase() && w.endsWith(vowelSuffix) && !finalRhymes.includes(w)) {
        finalRhymes.push(w);
      }
    });
  }
  
  // 2. DATAMUSE VOWEL SUFFIX FALLBACK (The Ultimate Safety Net)
  if (finalRhymes.length < 10) {
    let url = `https://api.datamuse.com/words?sp=*${vowelSuffix}&md=f&max=50`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        data.forEach(d => {
          const clean = d.word.toLowerCase();
          if (/^[a-z][a-z\-\']{2,}$/.test(clean) && clean !== word.toLowerCase() && clean !== apiWord) {
            
            // Extract frequency to filter out obscure foreign loanwords
            let freq = 0;
            if (d.tags) {
              const fTag = d.tags.find(t => t.startsWith('f:'));
              if (fTag) freq = parseFloat(fTag.substring(2));
            }
            
            // Require score >= 250 AND freq >= 0.5 (unless it's in our trap dict)
            if ((d.score && d.score >= 250 && freq >= 0.5) || dictionary.includes(clean)) {
              if (!finalRhymes.includes(clean)) {
                finalRhymes.push(clean);
              }
            }
          }
        });
      }
    } catch (err) {}
  }
  
  // If we truly have nothing, push a placeholder so the UI doesn't crash.
  if (finalRhymes.length === 0) {
    finalRhymes.push("no-match");
  }
  
  // We no longer inject duplicates! Displaying 6 flawless rhymes is better than 10 where 4 are fake duplicates.
  
  finalRhymes.sort(() => 0.5 - Math.random());
  anchors[index].allRhymes = finalRhymes.map(w => ({word: w}));
  anchors[index].rhymes = anchors[index].allRhymes.slice(0, 10);
  
  renderBoard();
}

function randomizeBoard() {
  saveState();
  anchors.forEach((anchor, index) => {
    if (!anchor.locked) {
      const validDict = dictionary.filter(w => w.length >= 3);
      if (validDict.length > 0) {
        const r = Math.floor(Math.random() * validDict.length);
        updateAnchor(index, validDict[r]);
      }
    }
  });
}

function setAnchorCount(count) {
  const newCount = parseInt(count);
  if (newCount > anchors.length) {
    for (let i = anchors.length; i < newCount; i++) {
      anchors.push({ word: '', locked: false, rhymes: [], allRhymes: [] });
    }
  } else if (newCount < anchors.length) {
    anchors = anchors.slice(0, newCount);
  }
  renderBoard();
  if (dictionary.length > 0) randomizeBoard();
}

let beatInterval = null;
let currentAnchorBeat = 0;
let activeBeatIndex = -1;
let isBeatOn = false;
let isAutoRollOn = false;

function toggleAutoRoll() {
  isAutoRollOn = !isAutoRollOn;
  const btn = document.getElementById('auto-roll-btn');
  if (isAutoRollOn) {
    btn.style.backgroundColor = 'var(--text-main)';
    btn.style.color = '#000';
  } else {
    btn.style.backgroundColor = 'var(--accent)';
    btn.style.color = '#fff';
  }
}

function toggleBeat() {
  isBeatOn = !isBeatOn;
  const btn = document.getElementById('beat-btn');
  if (isBeatOn) {
    btn.style.backgroundColor = 'var(--text-main)';
    btn.style.color = '#000';
    startBeat();
  } else {
    btn.style.backgroundColor = 'var(--accent)';
    btn.style.color = '#fff';
    stopBeat();
  }
}

function startBeat() {
  stopBeat();
  const bpm = parseInt(document.getElementById('bpm-input').value) || 142;
  const msPerBeat = (120 / bpm) * 1000;
  
  currentAnchorBeat = 0;
  activeBeatIndex = -1;
  let hasCompletedCycle = false;
  
  beatInterval = setInterval(() => {
    // If we've completed a full cycle across all anchors, trigger the roll now (at index 0)
    if (currentAnchorBeat === 0 && hasCompletedCycle && isAutoRollOn) {
      setTimeout(() => randomizeBoard(), 10);
    }
    
    activeBeatIndex = currentAnchorBeat;
    
    document.querySelectorAll('.anchor-col').forEach(col => col.classList.remove('active-beat'));
    
    const cols = document.querySelectorAll('.anchor-col');
    if (cols[activeBeatIndex]) {
      cols[activeBeatIndex].classList.add('active-beat');
    }
    
    currentAnchorBeat++;
    if (currentAnchorBeat >= anchors.length) {
      currentAnchorBeat = 0;
      hasCompletedCycle = true;
    }
  }, msPerBeat);
}

function stopBeat() {
  if (beatInterval) clearInterval(beatInterval);
  beatInterval = null;
  activeBeatIndex = -1;
  document.querySelectorAll('.anchor-col').forEach(col => col.classList.remove('active-beat'));
}

// Cipher Protocol
function toggleCipher() {
  isCipherOn = !isCipherOn;
  const btn = document.getElementById('cipher-toggle');
  btn.innerText = isCipherOn ? 'ON' : 'OFF';
  
  if (isCipherOn) {
    btn.classList.add('active');
    startCipher();
  } else {
    btn.classList.remove('active');
    stopCipher();
  }
}

function startCipher() {
  stopCipher();
  cipherInterval = setInterval(() => {
    // include locked anchors too!
    const validIndices = anchors.map((a, i) => a.allRhymes.length > 10 ? i : -1).filter(i => i !== -1);
    if (validIndices.length === 0) return;
    
    const targetIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
    const anchor = anchors[targetIndex];
    
    const slotToReplace = Math.floor(Math.random() * Math.min(anchor.rhymes.length, 10));
    
    const displayedWords = anchor.rhymes.map(r => r.word);
    const available = anchor.allRhymes.filter(r => !displayedWords.includes(r.word));
    
    if (available.length > 0) {
      const newRhyme = available[Math.floor(Math.random() * available.length)];
      anchor.rhymes[slotToReplace] = newRhyme;
      
      // Targeted DOM update
      const cols = document.querySelectorAll('.anchor-col');
      if (cols[targetIndex]) {
        const rhymeItems = cols[targetIndex].querySelectorAll('.rhyme-item');
        if (rhymeItems[slotToReplace]) {
          // text node is the first child
          rhymeItems[slotToReplace].childNodes[0].nodeValue = newRhyme.word;
          rhymeItems[slotToReplace].classList.add('cipher-glitch');
          
          setTimeout(() => {
            if (rhymeItems[slotToReplace]) rhymeItems[slotToReplace].classList.remove('cipher-glitch');
          }, 150);
        }
      }
    }
  }, 150); // Speed it way up to 150ms!
}

function stopCipher() {
  if (cipherInterval) {
    clearInterval(cipherInterval);
    cipherInterval = null;
  }
}

// Favorites & Custom
function addFavorite(word) {
  word = word.toLowerCase();
  if (!favorites.includes(word)) {
    favorites.push(word);
    localStorage.setItem('rhyme-favorites', JSON.stringify(favorites));
    renderFavorites();
  }
}

function removeFavorite(word) {
  favorites = favorites.filter(w => w !== word);
  localStorage.setItem('rhyme-favorites', JSON.stringify(favorites));
  renderFavorites();
}

function renderFavorites() {
  favListEl.innerHTML = '';
  favorites.forEach(w => {
    const pill = document.createElement('div');
    pill.className = 'word-pill';
    pill.draggable = true;
    pill.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', w);
      e.dataTransfer.setData('sourceType', 'vault');
    };
    
    const text = document.createElement('span');
    text.innerText = w;
    text.onclick = () => placeWordInUnlockedAnchor(w);
    
    const rem = document.createElement('span');
    rem.className = 'remove';
    rem.innerHTML = '✖';
    rem.onclick = (e) => { e.stopPropagation(); removeFavorite(w); };
    
    pill.appendChild(text);
    pill.appendChild(rem);
    favListEl.appendChild(pill);
  });
}

function addCustomWord() {
  const input = document.getElementById('custom-word-input');
  const w = input.value.trim().toLowerCase();
  if (w) {
    if (!dictionary.includes(w)) {
      customWords.push(w);
      localStorage.setItem('rhyme-custom', JSON.stringify(customWords));
      dictionary.push(w);
    }
    addFavorite(w);
    input.value = '';
  }
}

// Dictionary Modal
function openDictionary() {
  document.getElementById('dict-modal').classList.add('active');
  renderDictionary();
}
function closeDictionary() {
  document.getElementById('dict-modal').classList.remove('active');
}
function renderDictionary(filter = '') {
  dictGridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  
  if (filter) {
    const term = filter.toLowerCase();
    const filtered = dictionary.filter(w => w.includes(term));
    filtered.slice(0, 500).forEach(w => {
      const div = document.createElement('div');
      div.className = 'dict-word ' + (customWords.includes(w) ? 'custom' : '');
      div.innerText = w;
      div.onclick = () => {
        placeWordInUnlockedAnchor(w);
        closeDictionary();
      };
      frag.appendChild(div);
    });
  } else {
    if (typeof RHYME_FAMILIES !== 'undefined') {
      RHYME_FAMILIES.forEach(fam => {
        const header = document.createElement('div');
        header.className = 'dict-family-header';
        header.innerText = fam.heading + (fam.theme ? ' - ' + fam.theme : '');
        header.style.gridColumn = '1 / -1'; 
        header.style.marginTop = '20px';
        header.style.color = 'var(--text-muted)';
        header.style.fontSize = '1.2rem';
        frag.appendChild(header);
        
        fam.words.forEach(w => {
          const div = document.createElement('div');
          div.className = 'dict-word ' + (customWords.includes(w) ? 'custom' : '');
          div.innerText = w;
          div.onclick = () => {
            placeWordInUnlockedAnchor(w);
            closeDictionary();
          };
          frag.appendChild(div);
        });
      });
    }
    
    if (customWords.length > 0) {
      const header = document.createElement('div');
      header.className = 'dict-family-header';
      header.innerText = 'CUSTOM WORDS INJECTED';
      header.style.gridColumn = '1 / -1';
      header.style.marginTop = '20px';
      header.style.color = 'var(--accent)';
      header.style.fontSize = '1.2rem';
      frag.appendChild(header);
      
      customWords.forEach(w => {
        const div = document.createElement('div');
        div.className = 'dict-word custom';
        div.innerText = w;
        div.onclick = () => {
          placeWordInUnlockedAnchor(w);
          closeDictionary();
        };
        frag.appendChild(div);
      });
    }
  }
  
  dictGridEl.appendChild(frag);
}

function placeWordInUnlockedAnchor(word) {
  for (let i = 0; i < anchors.length; i++) {
    if (!anchors[i].locked) {
      saveState();
      updateAnchor(i, word);
      return;
    }
  }
  alert("ALL ANCHORS SECURED. UNLOCK TO PROCEED.");
}

// Strictness logic
const strictValues = ['exact', 'close', 'slant', 'experimental'];
document.getElementById('strictness-slider').addEventListener('input', (e) => {
  strictness = strictValues[e.target.value];
  document.getElementById('strictness-label').innerText = strictness.toUpperCase();
});

// Initial Boot
initDictionary();
renderFavorites();
renderBoard();

if (dictionary.length > 0) {
  randomizeBoard();
}

function refreshRhymes() {
  saveState();
  anchors.forEach((anchor, index) => {
    if (!anchor.locked && anchor.allRhymes.length > 0) {
      let shuffled = [...anchor.allRhymes].sort(() => 0.5 - Math.random());
      anchor.rhymes = shuffled.slice(0, 10);
    }
  });
  renderBoard();
}

function changeThemeColor(hex) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  
  document.documentElement.style.setProperty('--accent-rgb', r + ", " + g + ", " + b);
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-hover', hex);
}
