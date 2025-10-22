import dayjs from "dayjs";

/* Storage helpers */
const LS_KEY = "enroll_records";
const LOG_KEY = "enroll_logs";
const readJSON = (k, d=[]) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = (t)=>{ const el=document.getElementById("toast"); el.textContent=t; el.hidden=false; setTimeout(()=>el.hidden=true,2500); };

/* Elements */
const bodyEl = document.getElementById("resultsBody");
const tbl = document.getElementById("resultsTable");
const qNid = document.getElementById("qNid");
const qName = document.getElementById("qName");
const statusFilter = document.getElementById("statusFilter");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const btnSearch = document.getElementById("btnSearch");
const btnExport = document.getElementById("btnExport");

let state = { sortKey:"createdAt", sortDir:"desc", items:[] };

/* Load & Save */
function load(){ state.items = readJSON(LS_KEY); }
function save(items){ writeJSON(LS_KEY, items); }

function summarizeAddress(a){ return (a||"").slice(0,60) + ((a||"").length>60?"…":""); }

/* Search & render */
function search(){
  load();
  let res = [...state.items].filter(r=>{
    if(qNid.value && !(r.nid||"").includes(qNid.value.trim())) return false;
    if(qName.value){
      const q = qName.value.trim();
      if(!(`${r.firstName||""} ${r.lastName||""}`.includes(q) || (r.firstName||"").includes(q) || (r.lastName||"").includes(q))) return false;
    }
    if(statusFilter.value){
      if(statusFilter.value==="آرشیو"){ if(!r.archived) return false; }
      else { if(r.status!==statusFilter.value) return false; }
    }
    if(dateFrom.value && dayjs(r.createdAt).isBefore(dayjs(dateFrom.value))) return false;
    if(dateTo.value && dayjs(r.createdAt).isAfter(dayjs(dateTo.value).endOf("day"))) return false;
    return true;
  });

  res.sort((a,b)=>{
    const k = state.sortKey;
    let va = a[k], vb = b[k];
    if(k==="createdAt"){ va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
    if(va<vb) return state.sortDir==="asc"?-1:1;
    if(va>vb) return state.sortDir==="asc"?1:-1;
    return 0;
  });

  render(res);
}

function render(list){
  bodyEl.innerHTML = "";
  list.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${r.id}</td>
      <td>${dayjs(r.createdAt).format("YYYY-MM-DD HH:mm")}</td>
      <td>${r.firstName||""}</td>
      <td>${r.lastName||""}</td>
      <td>${r.fatherName||""}</td>
      <td>${r.nid||""}</td>
      <td>${r.mobile||""}</td>
      <td>${r.postal||""}</td>
      <td>${r.gender||""}</td>
      <td title="${r.address||""}">${summarizeAddress(r.address)}</td>
      <td>${r.archived?"آرشیو":(r.status||"")}</td>
      <td></td>
    `;
    const actions = document.getElementById("rowActionsTpl").content.cloneNode(true);
    actions.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=>handleRowAction(btn.dataset.act, r.id));
    });
    tr.lastElementChild.appendChild(actions);
    bodyEl.appendChild(tr);
  });
}

/* حذف جزئیات رکورد */
function handleRowAction(act, id){
  if(act==="delete"){ confirmDelete(id); }
  if(act==="pdf"){ exportPDF(id); }
  if(act==="view" || act==="edit"){
    toast("نمایش یا ویرایش جزئیات غیرفعال شده است.");
  }
}

/* Delete */
function confirmDelete(id){
  const yes = confirm("آیا از حذف این رکورد مطمئن هستید؟ این عملیات قابل بازگشت نیست.");
  const items = readJSON(LS_KEY);
  const idx = items.findIndex(x=>x.id===id);
  if(idx<0) return;
  if(yes){
    const removed = items.splice(idx,1)[0];
    writeJSON(LS_KEY, items);
    appendLog(`حذف دائمی ${removed.id}`);
  } else {
    items[idx].archived = true;
    writeJSON(LS_KEY, items);
    appendLog(`آرشیو رکورد ${items[idx].id}`);
  }
  search();
}

/* Export CSV */
btnExport.addEventListener("click", ()=>{
  const rows = [...document.querySelectorAll("#resultsBody tr")].map(tr=>[...tr.children].slice(0,11).map(td=>td.textContent.replace(/\n/g," ").trim()));
  const header = ["شناسه","تاریخ ثبت","نام","نام خانوادگی","نام پدر","کد ملی","شماره موبایل","کد پستی","جنسیت","نشانی خلاصه","وضعیت"];
  const csv = [header, ...rows].map(r=>r.map(s=>`"${s.replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "registrations.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* Export PDF */
function exportPDF(id){
  const items = readJSON(LS_KEY);
  const r = items.find(x=>x.id===id);
  if(!r){ toast("رکورد یافت نشد"); return; }
  const w = window.open("", "_blank");
  w.document.write(`<pre style="font-family:monospace;direction:rtl;white-space:pre-wrap">
شناسه: #${r.id}
تاریخ ثبت: ${dayjs(r.createdAt).format("YYYY-MM-DD HH:mm")}
نام: ${r.firstName}
نام خانوادگی: ${r.lastName}
نام پدر: ${r.fatherName}
کد ملی: ${r.nid}
کد پستی: ${r.postal}
جنسیت: ${r.gender}
موبایل: ${r.mobile}
ایمیل: ${r.email||"-"}
نشانی: ${r.address}
توضیحات: ${r.notes||"-"}
وضعیت: ${r.archived?"آرشیو":(r.status||"")}
</pre>`);
  w.document.close();
  w.focus();
  w.print();
}

/* Table sorting */
tbl.querySelectorAll("th[data-sort]").forEach(th=>{
  th.addEventListener("click", ()=>{
    const k = th.getAttribute("data-sort");
    state.sortDir = (state.sortKey===k && state.sortDir==="asc") ? "desc" : "asc";
    state.sortKey = k;
    search();
  });
});

/* Search button */
btnSearch.addEventListener("click", search);

/* Init */
search();

/* Logs */
function appendLog(msg){
  const logs = readJSON(LOG_KEY);
  logs.push({ts:new Date().toISOString(), msg, actor:"admin"});
  writeJSON(LOG_KEY, logs);
}
