(function(){
  const $=s=>document.querySelector(s), storage=window.NuraStorage;
  if(!storage) return;
  const today=new Date(), key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
  const start=monday(today), dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;}), keys=dates.map(key);
  let goal=Number(storage.get("weeklyGoalHours",5))||5;
  const tasks=storage.get("tasks",[]).map(t=>typeof t==="string"?{done:false}:t);
  const plans=storage.get("weeklyPlans",[]);
  const focusLog=storage.get("focusSessionLog",[]);
  const sessions=Number(storage.get("focusSessions",0))||0;
  function render(){
    const completed=plans.filter(p=>p.done&&keys.includes(p.date)).reduce((sum,p)=>sum+(Number(p.duration)||0),0);
    const percent=goal?Math.min(100,Math.round(completed/(goal*60)*100)):0;
    $("#goalHours").value=goal;
    $("#goalProgressLabel").textContent=`${(completed/60).toFixed(1)} / ${goal} hours`;
    $("#goalProgressFill").style.width=`${percent}%`;
    $("#goalMessage").textContent=percent>=100?"You reached your weekly goal. Well done!":completed?`${Math.max(0,Math.ceil((goal*60-completed)/60*10)/10)} hours to go. Keep it manageable.`:"Plan a session and mark it complete to build your progress.";
    const done=tasks.filter(t=>t.done).length, total=tasks.length;
    $("#analyticsTaskRate").textContent=`${total?Math.round(done/total*100):0}%`;
    $("#analyticsPlanCount").textContent=plans.filter(p=>p.done&&keys.includes(p.date)).length;
    $("#totalAssignments").textContent=total;$("#doneAssignments").textContent=done;$("#focusSessions").textContent=sessions;
    const minutes=focusLog.filter(s=>keys.includes(s.date)).reduce((sum,s)=>sum+(Number(s.minutes)||0),0);
    $("#focusTime").textContent=minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes}m`;
    const values=dates.map(d=>plans.filter(p=>p.done&&p.date===key(d)).reduce((sum,p)=>sum+(Number(p.duration)||0),0));
    const max=Math.max(60,...values);
    $("#weeklyChart").innerHTML=values.map((v,i)=>`<div class="chart-day" title="${v} completed minutes"><div class="chart-bar-wrap"><div class="chart-bar" style="height:${v?Math.max(5,v/max*100):0}%"></div></div><span>${new Intl.DateTimeFormat("en-AU",{weekday:"narrow"}).format(dates[i])}</span></div>`).join("");
  }
  $("#goalForm").addEventListener("submit",e=>{e.preventDefault();const value=Number($("#goalHours").value);if(!Number.isFinite(value)||value<1||value>40){$("#goalHours").value=goal;return;}goal=value;storage.set("weeklyGoalHours",goal);render();});
  const menu=$("#menuButton"), sidebar=$("#sidebar");menu?.addEventListener("click",()=>{const open=sidebar.classList.toggle("sidebar-open");menu.setAttribute("aria-expanded",String(open));});
  render();
})();