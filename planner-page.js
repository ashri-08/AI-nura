(function(){
  const $=s=>document.querySelector(s), storage=window.NuraStorage;
  if(!storage) return;
  const today=new Date();
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
  const start=monday(today), dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;}), keys=dates.map(key);
  let plans=storage.get("weeklyPlans",[]);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  $("#planDay").innerHTML=dates.map((d,i)=>`<option value="${keys[i]}" ${keys[i]===key(today)?"selected":""}>${new Intl.DateTimeFormat("en-AU",{weekday:"long"}).format(d)}</option>`).join("");
  function render(){
    $("#weekStrip").innerHTML=dates.map((d,i)=>{
      const day=plans.filter(p=>p.date===keys[i]).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
      return `<section class="day-column ${keys[i]===key(today)?"today-column":""}"><div class="day-heading"><strong>${new Intl.DateTimeFormat("en-AU",{weekday:"short"}).format(d)}</strong><span>${d.getDate()}</span></div><div class="day-events">${day.length?day.map(p=>`<article class="plan-event ${p.done?"plan-done":""}" data-id="${esc(p.id)}"><label><input type="checkbox" class="plan-check" ${p.done?"checked":""} aria-label="Complete ${esc(p.title)}"><span><strong>${esc(p.title)}</strong><small>${esc(p.time)} · ${Number(p.duration)||25} min</small></span></label><button type="button" class="delete-plan" aria-label="Delete ${esc(p.title)}">×</button></article>`).join(""):`<p class="day-empty">No sessions planned</p>`}</div></section>`;
    }).join("");
  }
  $("#planForm").addEventListener("submit",e=>{e.preventDefault();const title=$("#planTitle").value.trim();if(!title)return;plans.push({id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,title,date:$("#planDay").value,time:$("#planTime").value,duration:Number($("#planDuration").value),done:false});storage.set("weeklyPlans",plans);$("#planTitle").value="";render();});
  $("#weekStrip").addEventListener("change",e=>{if(!e.target.matches(".plan-check"))return;const id=e.target.closest(".plan-event").dataset.id;plans=plans.map(p=>p.id===id?{...p,done:e.target.checked}:p);storage.set("weeklyPlans",plans);render();});
  $("#weekStrip").addEventListener("click",e=>{if(!e.target.matches(".delete-plan"))return;const id=e.target.closest(".plan-event").dataset.id;plans=plans.filter(p=>p.id!==id);storage.set("weeklyPlans",plans);render();});
  render();
  const menu=$("#menuButton"), sidebar=$("#sidebar");menu?.addEventListener("click",()=>{const open=sidebar.classList.toggle("sidebar-open");menu.setAttribute("aria-expanded",String(open));});
})();