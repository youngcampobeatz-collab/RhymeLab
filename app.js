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
    const slang = ['tweezy', 'glizzy', 'blicky', 'opps', 'slatt', 'slime', 'draco', 'fasho', 'cap', 'drip', 'yeat', 'carti', 'perc', 'wock', 'zaza', 'choppa', 'finna', 'bet', 'no cap', 'ong'];
    slang.forEach(w => allWords.add(w));
  
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
    
          const favBtn = document.createElement('button');
      favBtn.className = 'anchor-fav-btn';
      favBtn.innerHTML = '&#9733;';
      favBtn.title = 'Add to Vault';
      favBtn.onclick = (e) => {
        e.stopPropagation();
        if (anchor.word && !favorites.includes(anchor.word)) {
          favorites.push(anchor.word);
          localStorage.setItem('rhymeLabFavorites', JSON.stringify(favorites));
          renderFavorites();
        }
      };
      
      header.appendChild(lock);
      header.appendChild(input);
      if (anchor.word) header.appendChild(favBtn);
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

let isSyllableLocked = false;
function toggleSyllableLock() {
  isSyllableLocked = document.getElementById('syllable-lock').checked;
}

async function updateAnchor(index, word) {
  anchors[index].word = word.toUpperCase();
  anchors[index].rhymes = ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."];
  renderBoard();
  
  let combinedRhymes = new Map();
  const cleanAnchor = word.trim().replace(/^[\s\-]+|[\s\-]+$/g, '');
  if (!cleanAnchor) return;
  const rawWords = cleanAnchor.split(/[\s\-]+/);
  const isMulti = rawWords.length > 1;
  const apiWord = rawWords[rawWords.length - 1].toLowerCase();
    
    let anchorSyllables = 0;
    let applySyllableLock = isSyllableLocked;
    
    // Calculate total syllables of the entire anchor phrase (so 'SHOULDER-BAG' = 3 syllables)
    for (let w of rawWords) {
      try {
        const res = await fetch(`https://api.datamuse.com/words?sp=${w.toLowerCase()}&md=s&max=1`);
        const data = await res.json();
        if (data && data.length > 0 && data[0].numSyllables) {
          anchorSyllables += data[0].numSyllables;
        }
      } catch(e) {}
    }

  async function fetchDatamuse(queryWord, param) {
    let url = `https://api.datamuse.com/words?${param}=${queryWord}&md=f,s&max=100`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        data.forEach(d => {
          const clean = d.word.toLowerCase();
          if (/^[a-z][a-z\-\'\s]{2,}$/.test(clean) && clean !== word.toLowerCase() && clean !== apiWord) {
            if (applySyllableLock && anchorSyllables > 0 && d.numSyllables !== anchorSyllables) return;
            
            let freq = 0;
            if (d.tags) {
              const fTag = d.tags.find(t => t.startsWith('f:'));
              if (fTag) freq = parseFloat(fTag.substring(2));
            }
            
            let minFreq = 0.5;
              if (strictness === 'slant') minFreq = 0.1;
              if (strictness === 'experimental') minFreq = 0.1;
              if (isMixedMode) minFreq = 0.1;
              
              let isExact = (d.score && d.score >= 250);
              let isTrapDict = dictionary.includes(clean) || clean.includes(' ');
              
              let requiredFreq = isTrapDict ? minFreq : 1.0;
              let isGoodSlant = (d.score && d.score >= 60 && freq >= requiredFreq);
              
              if (isExact || isGoodSlant) {
              if (!combinedRhymes.has(clean)) {
                combinedRhymes.set(clean, { word: clean, syllables: d.numSyllables || 0, score: d.score || 0, freq: freq, isTrap: isTrapDict });
              }
            }
          }
        });
      }
    } catch (err) {}
  }

  if (isMixedMode) {
    await fetchDatamuse(apiWord, 'rel_rhy');
    await fetchDatamuse(apiWord, 'rel_nry');
    await fetchDatamuse(apiWord, 'sl');
  } else if (strictness === 'exact') {
    await fetchDatamuse(apiWord, 'rel_rhy');
  } else if (strictness === 'close') {
    await fetchDatamuse(apiWord, 'rel_rhy');
    await fetchDatamuse(apiWord, 'rel_nry');
  } else if (strictness === 'slant') {
    await fetchDatamuse(apiWord, 'rel_nry');
  } else if (strictness === 'experimental') {
    await fetchDatamuse(apiWord, 'sl');
  }

  if (combinedRhymes.size < 10) {
      if (strictness !== 'exact') {
        if (combinedRhymes.size < 10) await fetchDatamuse(apiWord, 'rel_nry');
        if (combinedRhymes.size < 10 && (strictness === 'slant' || strictness === 'experimental')) await fetchDatamuse(apiWord, 'sl');
      }
    }

    // Intelligent Phonetic Bridge for Slang / Typos
    // If a word yields less than 10 rhymes, Datamuse is struggling.
    // So we ask Datamuse what it SOUNDS like, and steal the rhymes from its closest valid cousins until the board is full!
    if (combinedRhymes.size < 10) {
      try {
        const bridgeRes = await fetch(`https://api.datamuse.com/words?sl=${apiWord}&max=10`);
        const bridgeData = await bridgeRes.json();
        for (let b of bridgeData) {
          const cousin = b.word.toLowerCase();
          if (cousin !== apiWord) {
             if (isMixedMode) {
               await fetchDatamuse(cousin, 'rel_rhy');
               if (combinedRhymes.size < 10) await fetchDatamuse(cousin, 'rel_nry');
               if (combinedRhymes.size < 10) await fetchDatamuse(cousin, 'sl');
             } else if (strictness === 'exact') {
               await fetchDatamuse(cousin, 'rel_rhy');
             } else if (strictness === 'close') {
               await fetchDatamuse(cousin, 'rel_rhy');
               if (combinedRhymes.size < 10) await fetchDatamuse(cousin, 'rel_nry');
             } else if (strictness === 'slant') {
               await fetchDatamuse(cousin, 'rel_nry');
             } else if (strictness === 'experimental') {
               await fetchDatamuse(cousin, 'sl');
             }
             if (combinedRhymes.size >= 10) break;
          }
        }
      } catch(e) {}
    }
  
  let finalRhymes = Array.from(combinedRhymes.values());
  // Intelligent Syllable-Cadence Sorting!
  // Ranks words that perfectly match the anchor's syllable count to the top of the list
  finalRhymes.sort((a, b) => {
      if (anchorSyllables > 0 && a.syllables > 0 && b.syllables > 0) {
          let diffA = Math.abs(a.syllables - anchorSyllables);
          let diffB = Math.abs(b.syllables - anchorSyllables);
          if (diffA !== diffB) return diffA - diffB;
      }
      
            if (isMixedMode) {
            return 0.5 - Math.random();
        } else if (vocabMode === 'simple') {
          return (b.freq || 0) - (a.freq || 0);
      } else if (vocabMode === 'tuff') {
          if (a.isTrap && !b.isTrap) return -1;
          if (!a.isTrap && b.isTrap) return 1;
          
          // Remove length bonus so it favors shorter/punchier words, but penalize massive syllable differences
          let sylDiffA = (applySyllableLock && anchorSyllables > 0) ? 0 : Math.abs((a.numSyllables||0) - anchorSyllables);
          let sylDiffB = (applySyllableLock && anchorSyllables > 0) ? 0 : Math.abs((b.numSyllables||0) - anchorSyllables);
          
          let scoreA = (a.isTrap ? 100 : 0) + (a.freq || 0) - (sylDiffA * 10);
          let scoreB = (b.isTrap ? 100 : 0) + (b.freq || 0) - (sylDiffB * 10);

          return scoreB - scoreA;
      }
      
      return 0.5 - Math.random(); // shuffle within same-distance tier
  });
    if (finalRhymes.length === 0) {
      finalRhymes.push({word: "no-match", syllables: 0});
    }
    
    anchors[index].allRhymes = finalRhymes;
    anchors[index].offset = 0;
    
    let initialRhymes = [];
    for (let i = 0; i < 10; i++) {
      if (finalRhymes.length > 0) {
        initialRhymes.push(finalRhymes[i % finalRhymes.length]);
      }
    }
    anchors[index].rhymes = initialRhymes;
  
  renderBoard();
}

function randomizeBoard() {
  saveState();
  fillQueue();
  anchors.forEach((anchor, index) => {
    if (!anchor.locked) {
      const nextWord = anchorQueue.shift();
      if (nextWord) updateAnchor(index, nextWord);
    }
  });
  fillQueue();
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

let vocabMode = 'normal';
let isMixedMode = false;

window.toggleMixedMode = function() {
  isMixedMode = !isMixedMode;
  
  const mixedBtn = document.getElementById('mode-mixed');
  const vocabContainer = document.getElementById('vocab-container');
  const strictSlider = document.getElementById('strictness-slider');
  const strictLabels = strictSlider.nextElementSibling;
  
  if (isMixedMode) {
    mixedBtn.className = 'btn-primary';
    vocabContainer.style.opacity = '0.3';
    vocabContainer.style.pointerEvents = 'none';
    strictSlider.style.opacity = '0.3';
    strictSlider.disabled = true;
    strictLabels.style.opacity = '0.3';
  } else {
    mixedBtn.className = 'btn-secondary';
    vocabContainer.style.opacity = '1';
    vocabContainer.style.pointerEvents = 'auto';
    strictSlider.style.opacity = '1';
    strictSlider.disabled = false;
    strictLabels.style.opacity = '1';
  }
  
  // Re-run the board to apply the new mixed mode immediately
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].word && !anchors[i].locked) {
      updateAnchor(i, anchors[i].word);
    }
  }
};

function setVocabMode(mode) {
  const isDiff = vocabMode !== mode;
  vocabMode = mode;
  document.getElementById('mode-simple').className = mode === 'simple' ? 'btn-primary' : 'btn-secondary';
  document.getElementById('mode-normal').className = mode === 'normal' ? 'btn-primary' : 'btn-secondary';
  document.getElementById('mode-tuff').className = mode === 'tuff' ? 'btn-primary' : 'btn-secondary';
  
  if (isDiff) {
    randomizeBoard();
  }
}

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
  const bars = parseFloat(document.getElementById('bar-speed-input').value) || 2;
  
  // 1 beat = 60000 / bpm ms. 1 bar = 4 beats. 
  const beatsPerSwitch = bars * 4;
  const msPerSwitch = (60000 / bpm) * beatsPerSwitch;
  
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
  }, msPerSwitch);
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
function updateStrictnessLabel(val) {
  document.getElementById('strictness-label').innerText = strictValues[val].toUpperCase();
}
async function onStrictnessChange(val) {
  strictness = strictValues[val];
  document.getElementById('strictness-label').innerText = strictness.toUpperCase();
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].word && !anchors[i].locked) {
      await updateAnchor(i, anchors[i].word);
    }
  }
}


let anchorQueue = [];

function fillQueue() {
  const validDict = dictionary.filter(w => w.length >= 3);
  if (validDict.length === 0) return;
  while (anchorQueue.length < 7) {
    let pick = validDict[Math.floor(Math.random() * validDict.length)];
    if (vocabMode === 'simple') {
      let attempts = 0;
      while (pick.length > 5 && attempts < 10) {
        pick = validDict[Math.floor(Math.random() * validDict.length)];
        attempts++;
      }
    }
    anchorQueue.push(pick);
  }
  renderQueue();
}

function renderQueue() {
  const list = document.getElementById('anchor-queue-list');
  if (!list) return;
  list.innerHTML = '';
  anchorQueue.forEach((word, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `${word.toUpperCase()} <span class="remove-btn" onclick="removeFromQueue(${index})">&times;</span>`;
    list.appendChild(item);
  });
}

function removeFromQueue(index) {
  anchorQueue.splice(index, 1);
  fillQueue();
}

function addCustomQueue() {
  const input = document.getElementById('custom-queue-input');
  const val = input.value.trim();
  if (val) {
    anchorQueue.unshift(val);
    input.value = '';
    renderQueue();
  }
}

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
      anchor.offset = (anchor.offset || 0) + 10;
      
      let newRhymes = [];
      for (let i = 0; i < 10; i++) {
        newRhymes.push(anchor.allRhymes[(anchor.offset + i) % anchor.allRhymes.length]);
      }
      anchor.rhymes = newRhymes;
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
