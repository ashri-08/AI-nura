(function(){
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const store=window.NuraStorage;if(!store)return;
  let decks=store.get("learningDecks",[]), xp=Number(store.get("learningXP",0))||0;
  let activeDeckId=store.get("activeLearningDeck","");
  let reviewIndex=0, showingBack=false, quizQuestions=[], quizIndex=0, quizCorrect=0, quizAnswered=false;
  const uid=()=>`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const activeDeck=()=>decks.find(d=>d.id===activeDeckId)||null;
  const cards=()=>activeDeck()?.cards||[];
  function save(){store.set("learningDecks",decks);store.set("activeLearningDeck",activeDeckId);store.set("learningXP",xp);render();}
  function addXP(amount){xp+=amount;store.set("learningXP",xp);$("#xpCount").innerHTML=`${xp} <small>XP</small>`;}
  function renderStats(){
    const all=decks.flatMap(d=>d.cards||[]);
    $("#deckCount").textContent=decks.length;
    $("#cardCount").textContent=all.length;
    $("#masteredCount").textContent=all.filter(c=>c.rating==="easy").length;
    $("#xpCount").innerHTML=`${xp} <small>XP</small>`;
  }
  function renderDecks(){
    const list=$("#deckList"),select=$("#activeDeck");
    if(!decks.length){list.innerHTML='<p class="empty-state">No decks yet. Create your first one to begin.</p>';select.innerHTML='<option value="">Create a deck first</option>';activeDeckId="";store.set("activeLearningDeck","");return;}
    if(!decks.some(d=>d.id===activeDeckId))activeDeckId=decks[0].id;
    list.innerHTML=decks.map(d=>`<div class="deck-item ${d.id===activeDeckId?"selected":""}" data-id="${esc(d.id)}"><button class="deck-select" type="button" data-select-deck="${esc(d.id)}"><span class="deck-symbol">▤</span><span class="deck-copy"><strong>${esc(d.name)}</strong><small>${esc(d.subject||"General")} · ${(d.cards||[]).length} cards</small></span></button><button type="button" class="deck-delete" data-delete-deck="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">×</button></div>`).join("");
    select.innerHTML=decks.map(d=>`<option value="${esc(d.id)}" ${d.id===activeDeckId?"selected":""}>${esc(d.name)}</option>`).join("");
  }
  function renderPractice(){
    const has=cards().length>0;
    $("#practiceEmpty").hidden=has;
    $("#reviewMode").hidden=!has||$("#reviewMode").dataset.active!=="true";
    $("#quizMode").hidden=!has||$("#quizMode").dataset.active!=="true";
    if(!has){$("#reviewMode").hidden=true;$("#quizMode").hidden=true;}
    if(has && $("#reviewMode").dataset.active!=="true" && $("#quizMode").dataset.active!=="true")$("#reviewMode").dataset.active="true";
    if($("#reviewMode").dataset.active==="true"&&has)renderReview();
    if($("#quizMode").dataset.active==="true"&&has&&quizQuestions.length)renderQuiz();
  }
  function render(){
    renderStats();renderDecks();renderPractice();
  }
  $("#deckForm").addEventListener("submit",e=>{
    e.preventDefault();const name=$("#deckName").value.trim();if(!name)return;
    const deck={id:uid(),name,subject:$("#deckSubject").value.trim(),createdAt:new Date().toISOString(),cards:[]};
    decks.unshift(deck);activeDeckId=deck.id;$("#deckName").value="";$("#deckSubject").value="";reviewIndex=0;save();addXP(5);
  });
  $("#deckList").addEventListener("click",e=>{
    const select=e.target.closest("[data-select-deck]"),del=e.target.closest("[data-delete-deck]");
    if(select){activeDeckId=select.dataset.selectDeck;reviewIndex=0;showingBack=false;$("#reviewMode").dataset.active="true";$("#quizMode").dataset.active="false";save();}
    if(del){const id=del.dataset.deleteDeck;const deck=decks.find(d=>d.id===id);if(!deck||!confirm(`Delete the "${deck.name}" deck and its cards?`))return;decks=decks.filter(d=>d.id!==id);if(activeDeckId===id)activeDeckId=decks[0]?.id||"";reviewIndex=0;save();}
  });
  $("#activeDeck").addEventListener("change",e=>{activeDeckId=e.target.value;reviewIndex=0;showingBack=false;$("#reviewMode").dataset.active="true";$("#quizMode").dataset.active="false";save();});
  $("#cardForm").addEventListener("submit",e=>{
    e.preventDefault();const deck=activeDeck();if(!deck){alert("Create or select a deck first.");return;}
    const front=$("#cardFront").value.trim(),back=$("#cardBack").value.trim();if(!front||!back)return;
    deck.cards.push({id:uid(),front,back,rating:"new",intervalDays:0,dueAt:new Date().toISOString(),createdAt:new Date().toISOString()});
    $("#cardForm").reset();reviewIndex=deck.cards.length-1;showingBack=false;$("#reviewMode").dataset.active="true";$("#quizMode").dataset.active="false";save();addXP(2);
  });
  // Simple local parser: one card per line, prompt and answer separated by :, ->, => or " - ".
  function parseNotes(text){
    const out=[];
    text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).forEach(line=>{
      const match=line.match(/^(.{2,180}?)\s*(?::|->|=>|\s-\s)\s*(.{2,1000})$/);
      if(match){out.push({front:match[1].trim(),back:match[2].trim()});}
    });
    return out;
  }
  $$(".create-tab").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".create-tab").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-selected",String(b===btn));});
    const manual=btn.dataset.tab==="manual";$("#manualPane").hidden=!manual;$("#notesPane").hidden=manual;
  }));
  $("#generateCards").addEventListener("click",()=>{
    const deck=activeDeck();if(!deck){$("#importMessage").textContent="Create or select a deck first.";return;}
    const parsed=parseNotes($("#notesInput").value);
    if(!parsed.length){$("#importMessage").textContent="No cards found. Use one line per card, formatted as Prompt: Answer or Prompt - Answer.";return;}
    parsed.forEach(c=>deck.cards.push({...c,id:uid(),rating:"new",intervalDays:0,dueAt:new Date().toISOString(),createdAt:new Date().toISOString()}));
    $("#notesInput").value="";$("#importMessage").textContent=`Added ${parsed.length} flashcard${parsed.length===1?"":"s"} to ${deck.name}.`;
    reviewIndex=0;showingBack=false;$("#reviewMode").dataset.active="true";$("#quizMode").dataset.active="false";save();addXP(parsed.length*2);
  });
  $$(".mode-tab").forEach(btn=>btn.addEventListener("click",()=>{
    const review=btn.dataset.mode==="review";
    $$(".mode-tab").forEach(b=>b.classList.toggle("active",b===btn));
    $("#reviewMode").dataset.active=String(review);$("#quizMode").dataset.active=String(!review);
    if(!review)buildQuiz();
    renderPractice();
  }));
  function renderReview(){
    const deck=activeDeck(),list=cards();if(!deck||!list.length)return;
    reviewIndex=Math.min(reviewIndex,list.length-1);const card=list[reviewIndex];
    $("#reviewDeckLabel").textContent=deck.name;$("#reviewCounter").textContent=`Card ${reviewIndex+1} of ${list.length}`;
    $("#flashcardKicker").textContent=showingBack?"ANSWER":"QUESTION";
    $("#flashcardText").textContent=showingBack?card.back:card.front;
    $("#flashcardHint").textContent=showingBack?"Rate how well you knew it below":"Select the card to reveal the answer";
    $("#flashcard").classList.toggle("is-back",showingBack);$("#reviewActions").hidden=!showingBack;
  }
  $("#flashcard").addEventListener("click",()=>{if(!cards().length)return;showingBack=!showingBack;renderReview();});
  function moveCard(step){const list=cards();if(!list.length)return;reviewIndex=(reviewIndex+step+list.length)%list.length;showingBack=false;renderReview();}
  $("#previousCard").addEventListener("click",()=>moveCard(-1));$("#nextCard").addEventListener("click",()=>moveCard(1));
  $("#reviewActions").addEventListener("click",e=>{
    const btn=e.target.closest("[data-rating]");if(!btn)return;
    const card=cards()[reviewIndex];if(!card)return;
    const rating=btn.dataset.rating,now=new Date();card.rating=rating;
    if(rating==="again"){card.intervalDays=0;card.dueAt=now.toISOString();addXP(1);}
    else if(rating==="good"){card.intervalDays=Math.max(1,(Number(card.intervalDays)||0)+1);card.dueAt=new Date(now.getTime()+card.intervalDays*86400000).toISOString();addXP(3);}
    else{card.intervalDays=Math.max(3,(Number(card.intervalDays)||0)*2||3);card.dueAt=new Date(now.getTime()+card.intervalDays*86400000).toISOString();addXP(5);}
    store.set("learningDecks",decks);renderStats();moveCard(1);
  });
  function buildQuiz(){
    const list=cards();quizQuestions=list.map((card,index)=>{
      const others=list.filter((_,i)=>i!==index).map(c=>c.back);
      const options=[card.back,...others.sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);
      return {question:card.front,answer:card.back,options};
    }).sort(()=>Math.random()-.5);
    quizIndex=0;quizCorrect=0;quizAnswered=false;renderQuiz();
  }
  function renderQuiz(){
    if(!quizQuestions.length)return;
    const q=quizQuestions[quizIndex];$("#quizProgress").textContent=`Question ${quizIndex+1} of ${quizQuestions.length}`;$("#quizScore").textContent=`${quizCorrect} correct`;
    $("#quizQuestion").textContent=q.question;$("#quizFeedback").textContent="";$("#nextQuestion").disabled=true;quizAnswered=false;
    $("#nextQuestion").textContent=quizIndex===quizQuestions.length-1?"See results":"Next question →";
    $("#quizOptions").innerHTML=q.options.map((o,i)=>`<button type="button" class="quiz-option" data-option="${i}">${esc(o)}</button>`).join("");
  }
  $("#quizOptions").addEventListener("click",e=>{
    const btn=e.target.closest("[data-option]");if(!btn||quizAnswered)return;quizAnswered=true;
    const q=quizQuestions[quizIndex],chosen=q.options[Number(btn.dataset.option)],correct=chosen===q.answer;
    if(correct){quizCorrect++;addXP(3);$("#quizFeedback").textContent="Correct! Nice work.";$("#quizFeedback").style.color="#4e8667";}
    else{$("#quizFeedback").textContent=`Not quite. The answer is: ${q.answer}`;$("#quizFeedback").style.color="#9b5962";}
    $$(".quiz-option").forEach(b=>{b.disabled=true;const val=q.options[Number(b.dataset.option)];if(val===q.answer)b.classList.add("correct");else if(b===btn)b.classList.add("incorrect");});
    $("#quizScore").textContent=`${quizCorrect} correct`;$("#nextQuestion").disabled=false;
  });
  $("#nextQuestion").addEventListener("click",()=>{
    if(!quizAnswered)return;
    if(quizIndex<quizQuestions.length-1){quizIndex++;renderQuiz();}
    else{$("#quizQuestion").textContent=`You scored ${quizCorrect} out of ${quizQuestions.length}`;$("#quizOptions").innerHTML="";$("#quizFeedback").textContent="Try another round or switch back to your flashcards.";$("#nextQuestion").disabled=true;$("#nextQuestion").textContent="Quiz complete";}
  });
  $("#restartQuiz").addEventListener("click",buildQuiz);
  // Mobile sidebar
  const menu=$("#menuButton"),sidebar=$("#sidebar");menu?.addEventListener("click",()=>{const open=sidebar.classList.toggle("sidebar-open");menu.setAttribute("aria-expanded",String(open));});
  // Initial state
  $("#manualPane").hidden=false;$("#notesPane").hidden=true;
  $("#reviewMode").dataset.active="true";$("#quizMode").dataset.active="false";
  render();
})();