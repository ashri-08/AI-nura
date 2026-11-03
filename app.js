(function () {
  const $ = (selector) => document.querySelector(selector);
  const storage = window.NuraStorage;
  if (!storage) return;

  // Mobile navigation
  const sidebar = $("#sidebar");
  const menuButton = $("#menuButton");
  if (sidebar && menuButton) menuButton.addEventListener("click", () => {
    const open = sidebar.classList.toggle("sidebar-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  // The overview page shares this script only for its mobile navigation.
  if (!$("#taskForm")) return;

  const today = new Date();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const parseDate = (key) => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); };
  const mondayOf = (date) => { const d = new Date(date.getFullYear(),date.getMonth(),date.getDate()); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; };
  const weekStart = mondayOf(today);
  const weekDates = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
  const weekKeys = weekDates.map(dateKey);
  const todayLabel = $("#todayLabel");
  if (todayLabel) todayLabel.textContent = new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"long"}).format(today).toUpperCase();

  // Keep existing task data from the first Nura 2.0 version compatible.
  let tasks = storage.get("tasks", []).map((task) => typeof task === "string" ? {id:`legacy-${Math.random()}`,text:task,subject:"",due:"",priority:"medium",done:false} : ({priority:"medium",subject:"",due:"",...task}));
  let plans = storage.get("weeklyPlans", []);
  let goalHours = Number(storage.get("weeklyGoalHours",5)) || 5;
  let sessions = Number(storage.get("focusSessions",0)) || 0;
  let focusLog = storage.get("focusSessionLog", []);
  let selectedMinutes = 25, remainingSeconds = selectedMinutes*60, timerInterval = null, isRunning = false;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const saveTasks = () => { storage.set("tasks",tasks); renderTasks(); renderStats(); };
  const formatDue = (key) => {
    if (!key) return "No due date";
    const d=parseDate(key); const diff=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/86400000);
    if(diff===0)return "Due today"; if(diff===1)return "Due tomorrow"; if(diff<0)return `${Math.abs(diff)} day${diff===-1?"":"s"} overdue`;
    return `Due ${new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(d)}`;
  };

  function renderTasks() {
    const list=$("#taskList"); if(!list)return;
    const filter=$("#taskFilter")?.value || "all";
    const visible=tasks.filter(t=>filter==="all"||(filter==="open"&&!t.done)||(filter==="done"&&t.done));
    $("#taskCountLabel").textContent=`${tasks.length} ASSIGNMENT${tasks.length===1?"":"S"}`;
    if(!visible.length){list.innerHTML=`<p class="empty-state">${tasks.length?"No assignments in this filter.":"No assignments yet. Add one above to get started."}</p>`;return;}
    list.innerHTML=visible.map(task=>{
      const overdue=!task.done&&task.due&&task.due<dateKey(today);
      return `<article class="task-item ${task.done?"task-done":""}" data-id="${escapeHTML(task.id)}">
        <label class="task-label"><input class="task-check" type="checkbox" ${task.done?"checked":""} aria-label="Mark ${escapeHTML(task.text)} complete"><span class="task-main"><strong>${escapeHTML(task.text)}</strong><small>${escapeHTML(task.subject||"General")}</small></span></label>
        <div class="task-meta"><span class="priority-tag priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority||"medium")}</span><span class="due-label ${overdue?"overdue":""}">${escapeHTML(formatDue(task.due))}</span></div>
        <button class="delete-task" type="button" aria-label="Delete ${escapeHTML(task.text)}">×</button>
      </article>`;
    }).join("");
  }

  function renderStats(){
    const completed=tasks.filter(t=>t.done).length, open=tasks.length-completed;
    const weeklyTimerMinutes=focusLog.filter(s=>weekKeys.includes(s.date)).reduce((sum,s)=>sum+(Number(s.minutes)||0),0);
    if ($("#remainingCount")) $("#remainingCount").textContent=open;
    if ($("#completedCount")) $("#completedCount").textContent=completed;
    if ($("#sessionCount")) $("#sessionCount").textContent=sessions;
    if ($("#weeklyMinutes")) $("#weeklyMinutes").textContent=weeklyTimerMinutes>=60?`${Math.floor(weeklyTimerMinutes/60)}h ${weeklyTimerMinutes%60}m`:`${weeklyTimerMinutes}m`;
    const rate=tasks.length?Math.round(completed/tasks.length*100):0;
    if ($("#analyticsTaskRate")) $("#analyticsTaskRate").textContent=`${rate}%`;
    if ($("#analyticsPlanCount")) $("#analyticsPlanCount").textContent=plans.filter(p=>p.done&&weekKeys.includes(p.date)).length;
  }

  const taskForm=$("#taskForm");
  if(taskForm) taskForm.addEventListener("submit",event=>{
    event.preventDefault(); const text=$("#taskInput").value.trim(); if(!text)return;
    tasks.unshift({id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,text,subject:$("#taskSubject").value.trim(),due:$("#taskDue").value,priority:$("#taskPriority").value,done:false});
    storage.set("tasks",tasks); taskForm.reset(); renderTasks();renderStats();$("#taskInput").focus();
  });
  $("#taskList")?.addEventListener("change",event=>{if(!event.target.matches(".task-check"))return;const id=event.target.closest(".task-item").dataset.id;tasks=tasks.map(t=>t.id===id?{...t,done:event.target.checked}:t);saveTasks();renderAnalytics();});
  $("#taskList")?.addEventListener("click",event=>{if(!event.target.matches(".delete-task"))return;const id=event.target.closest(".task-item").dataset.id;tasks=tasks.filter(t=>t.id!==id);saveTasks();renderAnalytics();});
  $("#taskFilter")?.addEventListener("change",renderTasks);

  // Weekly planner: dates always refer to the current Monday-Sunday week.
  const daySelect=$("#planDay");
  if(daySelect){daySelect.innerHTML=weekDates.map((d,i)=>`<option value="${weekKeys[i]}" ${weekKeys[i]===dateKey(today)?"selected":""}>${new Intl.DateTimeFormat("en-AU",{weekday:"long"}).format(d)}</option>`).join("");}
  function renderPlanner(){
    const strip=$("#weekStrip");if(!strip)return;
    strip.innerHTML=weekDates.map((d,i)=>{
      const key=weekKeys[i], dayPlans=plans.filter(p=>p.date===key).sort((a,b)=>a.time.localeCompare(b.time));
      return `<section class="day-column ${key===dateKey(today)?"today-column":""}"><div class="day-heading"><strong>${new Intl.DateTimeFormat("en-AU",{weekday:"short"}).format(d)}</strong><span>${d.getDate()}</span></div><div class="day-events">${dayPlans.length?dayPlans.map(p=>`<article class="plan-event ${p.done?"plan-done":""}" data-id="${escapeHTML(p.id)}"><label><input type="checkbox" class="plan-check" ${p.done?"checked":""} aria-label="Complete ${escapeHTML(p.title)}"><span><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.time)} · ${p.duration} min</small></span></label><button type="button" class="delete-plan" aria-label="Delete ${escapeHTML(p.title)}">×</button></article>`).join(""):`<p class="day-empty">No sessions</p>`}</div></section>`;
    }).join("");
    renderGoals();renderStats();renderAnalytics();
  }
  $("#planForm")?.addEventListener("submit",event=>{event.preventDefault();const title=$("#planTitle").value.trim();if(!title)return;plans.push({id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,title,date:$("#planDay").value,time:$("#planTime").value,duration:Number($("#planDuration").value),done:false});storage.set("weeklyPlans",plans);$("#planTitle").value="";renderPlanner();});
  $("#weekStrip")?.addEventListener("change",event=>{if(!event.target.matches(".plan-check"))return;const id=event.target.closest(".plan-event").dataset.id;plans=plans.map(p=>p.id===id?{...p,done:event.target.checked}:p);storage.set("weeklyPlans",plans);renderPlanner();});
  $("#weekStrip")?.addEventListener("click",event=>{if(!event.target.matches(".delete-plan"))return;const id=event.target.closest(".plan-event").dataset.id;plans=plans.filter(p=>p.id!==id);storage.set("weeklyPlans",plans);renderPlanner();});

  // Weekly goal is measured using completed planned sessions (not merely scheduled time).
  function renderGoals(){
    const completedMinutes=plans.filter(p=>p.done&&weekKeys.includes(p.date)).reduce((sum,p)=>sum+(Number(p.duration)||0),0);
    const target=goalHours*60,percent=target?Math.min(100,Math.round(completedMinutes/target*100)):0;
    $("#goalProgressLabel").textContent=`${(completedMinutes/60).toFixed(1)} / ${goalHours} hours`;
    $("#goalProgressFill").style.width=`${percent}%`;
    $("#goalMessage").textContent=percent>=100?"You reached your weekly goal. Well done!":completedMinutes?`${Math.max(0,Math.ceil((target-completedMinutes)/60*10)/10)} hours to go. Keep it manageable.`:"Plan a session and mark it complete to build your progress.";
    $("#goalHours").value=goalHours;
  }
  $("#goalForm")?.addEventListener("submit",event=>{event.preventDefault();const value=Number($("#goalHours").value);if(!Number.isFinite(value)||value<1||value>40){$("#goalHours").value=goalHours;return;}goalHours=value;storage.set("weeklyGoalHours",goalHours);renderGoals();});

  function renderAnalytics(){
    const chart=$("#weeklyChart");if(!chart)return;
    const values=weekKeys.map(key=>plans.filter(p=>p.done&&p.date===key).reduce((sum,p)=>sum+(Number(p.duration)||0),0));
    const max=Math.max(60,...values);
    chart.innerHTML=values.map((minutes,i)=>`<div class="chart-day" title="${minutes} completed minutes"><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(minutes?5:0,minutes/max*100)}%"></div></div><span>${new Intl.DateTimeFormat("en-AU",{weekday:"narrow"}).format(weekDates[i])}</span></div>`).join("");
  }

  // Focus timer. Completed sessions are recorded locally with their date and duration.
  const display=$("#timerDisplay"),startButton=$("#startTimer"),resetButton=$("#resetTimer"),timerMessage=$("#timerMessage");
  function renderTimer(){if(display)display.textContent=`${String(Math.floor(remainingSeconds/60)).padStart(2,"0")}:${String(remainingSeconds%60).padStart(2,"0")}`;}
  function stopTimer(){if(timerInterval)clearInterval(timerInterval);timerInterval=null;isRunning=false;if(startButton)startButton.textContent="Start focus";}
  function resetTimer(){stopTimer();remainingSeconds=selectedMinutes*60;renderTimer();if(timerMessage)timerMessage.textContent="Ready when you are.";}
  document.querySelectorAll(".preset").forEach(button=>button.addEventListener("click",()=>{if(isRunning)return;document.querySelectorAll(".preset").forEach(p=>p.classList.remove("active"));button.classList.add("active");selectedMinutes=Number(button.dataset.minutes);resetTimer();}));
  startButton?.addEventListener("click",()=>{
    if(isRunning){stopTimer();timerMessage.textContent="Paused. Take your time.";return;}
    if(remainingSeconds<=0)resetTimer();isRunning=true;startButton.textContent="Pause";timerMessage.textContent="You're doing great. Stay with one task.";
    timerInterval=setInterval(()=>{remainingSeconds--;renderTimer();if(remainingSeconds<=0){stopTimer();sessions++;focusLog.push({date:dateKey(new Date()),minutes:selectedMinutes,completedAt:new Date().toISOString()});storage.set("focusSessions",sessions);storage.set("focusSessionLog",focusLog);renderStats();timerMessage.textContent="Focus session complete. Time for a break.";startButton.textContent="Start again";}},1000);
  });
  resetButton?.addEventListener("click",resetTimer);

  renderTasks();renderStats();renderPlanner();renderTimer();
})();
