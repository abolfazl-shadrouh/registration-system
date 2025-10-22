import { jsPDF } from "jspdf";
import dayjs from "dayjs";
import customParse from "dayjs/plugin/customParseFormat";
dayjs.extend(customParse);

/* Storage helpers */
const LS_KEY = "enroll_records";
const LOG_KEY = "enroll_logs";
const readJSON = (k, d=[]) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* Validation rules (fa) */
const faName = s => /^[\u0600-\u06FF\s‌]{2,}$/.test((s||"").trim());
const onlyDigits = s => /^\d+$/.test(s||"");
const isIranMobile = s => /^09\d{9}$/.test(s||"");
const isPostal10 = s => /^\d{10}$/.test(s||"");
const isNid10 = s => /^\d{10}$/.test(s||"") && iranNidChecksum(s);
function iranNidChecksum(code){
  if(!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const c = code.split("").map(Number);
  const sum = c.slice(0,9).reduce((a,n,i)=>a+n*(10-i),0);
  const r = sum%11;
  const d = c[9];
  return (r<2 && d===r) || (r>=2 && d===11-r);
}

/* Form */
const form = document.getElementById("signupForm");
const statusBox = document.getElementById("formStatus");
const downloadBtn = document.getElementById("downloadPdf");

function setError(el,msg){ const s = el.parentElement.querySelector(".error"); if(s){ s.textContent=msg||""; } }
function clearErrors(){ form.querySelectorAll(".error").forEach(e=>e.textContent=""); }

function serializeForm(){
  const f = new FormData(form);
  const obj = Object.fromEntries(f.entries());
  obj.consent = document.getElementById("consent").checked;
  return obj;
}

function validate(){
  clearErrors();
  let ok = true;
  const v = serializeForm();

  if(!v.firstName?.trim()) { setError(firstNameEl(),"این فیلد الزامی است."); ok=false; }
  else if(!faName(v.firstName)) { setError(firstNameEl(),"فقط از حروف فارسی استفاده کنید (حداقل ۲ حرف)."); ok=false; }

  if(!v.lastName?.trim()) { setError(lastNameEl(),"این فیلد الزامی است."); ok=false; }
  else if(!faName(v.lastName)) { setError(lastNameEl(),"فقط از حروف فارسی استفاده کنید (حداقل ۲ حرف)."); ok=false; }

  if(!v.fatherName?.trim()) { setError(fatherNameEl(),"این فیلد الزامی است."); ok=false; }
  else if(!faName(v.fatherName)) { setError(fatherNameEl(),"فقط از حروف فارسی استفاده کنید (حداقل ۲ حرف)."); ok=false; }

  if(!v.nid?.trim()){ setError(nidEl(),"این فیلد الزامی است."); ok=false; }
  else if(!isNid10(v.nid)){ setError(nidEl(),"کد ملی نامعتبر است — لطفاً ۱۰ رقم صحیح وارد کنید."); ok=false; }

  if(!v.postal?.trim()){ setError(postalEl(),"این فیلد الزامی است."); ok=false; }
  else if(!isPostal10(v.postal)){ setError(postalEl(),"کد پستی باید ۱۰ رقم باشد."); ok=false; }

  if(!v.gender){ setError(genderEl(),"این فیلد الزامی است."); ok=false; }

  if(v.dob){
    const okDate = dayjs(v.dob, ["YYYY-MM-DD","YYYY/MM/DD","YYYY.MM.DD","YYYY MM DD","YYYYMMDD","۱۳۷۸/۰۱/۱۵","1399/01/01"], true).isValid();
    if(!okDate){ setError(dobEl(),"فرمت تاریخ نامعتبر است."); ok=false; }
  }

  if(!v.mobile?.trim()){ setError(mobileEl(),"این فیلد الزامی است."); ok=false; }
  else if(!isIranMobile(v.mobile)){ setError(mobileEl(),"شماره موبایل نامعتبر است."); ok=false; }

  if(!v.address?.trim()){ setError(addressEl(),"این فیلد الزامی است."); ok=false; }

  if(!document.getElementById("consent").checked){ setError(consentEl(),"این فیلد الزامی است."); ok=false; }

  return ok;
}

function firstNameEl(){return document.getElementById("firstName")}
function lastNameEl(){return document.getElementById("lastName")}
function fatherNameEl(){return document.getElementById("fatherName")}
function nidEl(){return document.getElementById("nid")}
function postalEl(){return document.getElementById("postal")}
function genderEl(){return document.getElementById("gender")}
function dobEl(){return document.getElementById("dob")}
function mobileEl(){return document.getElementById("mobile")}
function addressEl(){return document.getElementById("address")}
function consentEl(){return document.getElementById("consent")}

form?.addEventListener("submit", e=>{
  e.preventDefault();
  statusBox.textContent="";
  if(!validate()){
    statusBox.textContent="لطفاً خطاهای فرم را برطرف کنید.";
    return;
  }
  const v = serializeForm();
  const records = readJSON(LS_KEY);
  const id = Date.now().toString(36).toUpperCase();
  const rec = {
    id, createdAt: new Date().toISOString(),
    status: "در انتظار", archived:false,
    ...v
  };
  records.push(rec);
  writeJSON(LS_KEY, records);
  appendLog(`ایجاد رکورد ${id}`);
  statusBox.textContent = `ثبت‌نام با موفقیت انجام شد. شناسهٔ پیگیری: #${id}`;
  form.reset();
});

downloadBtn?.addEventListener("click", ()=>{
  const v = serializeForm();
  const doc = new jsPDF({unit:"pt",orientation:"p"});
  let y = 40;
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.text("فرم ثبت‌نام آموزشگاه", 40, y); y+=24;
  doc.setFont("helvetica","normal"); doc.setFontSize(12);
  const lines = [
    `نام: ${v.firstName||"-"}`, `نام خانوادگی: ${v.lastName||"-"}`, `نام پدر: ${v.fatherName||"-"}`,
    `کد ملی: ${v.nid||"-"}`, `کد پستی: ${v.postal||"-"}`, `جنسیت: ${v.gender||"-"}`,
    `تاریخ تولد: ${v.dob||"-"}`, `شماره تماس: ${v.phone||"-"}`, `شماره موبایل: ${v.mobile||"-"}`,
    `ایمیل: ${v.email||"-"}`, `نشانی: ${v.address||"-"}`, `توضیحات: ${v.notes||"-"}`
  ];
  lines.forEach(t=>{ doc.text(t, 40, y); y+=18; });
  doc.save("enrollment.pdf");
});

/* Logs */
function appendLog(msg){
  const logs = readJSON(LOG_KEY);
  logs.push({ts:new Date().toISOString(), msg});
  writeJSON(LOG_KEY, logs);
}

/* UX: live numeric sanitization */
[nidEl(), mobileEl(), postalEl()].forEach(el=>{
  el?.addEventListener("input", ()=>{
    el.value = el.value.replace(/[^\d]/g,"");
  });
});

