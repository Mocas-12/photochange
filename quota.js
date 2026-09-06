try{if(!localStorage.getItem('is_pro_fixed')){localStorage.removeItem('is_pro');localStorage.setItem('is_pro_fixed','1')}}catch(_){}
const QUOTA=5;
const Store=(()=>{let mem={download_count:"0",is_pro:"false",unlimited_box_pro_status:"inactive"};return{get:(k)=>{try{return localStorage.getItem(k)}catch(e){return mem[k]}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}}})();
function getCount(){const v=parseInt(Store.get("download_count")||"0",10);return isNaN(v)?0:v}
function setCount(n){Store.set("download_count",String(n))}
function isPro(){
  if(Store.get("PhotoChange_VIP_Status")==="Active")return true;
  if(Store.get("unlimited_box_pro_status")==="active")return true;
  const raw=Store.get("is_pro");const norm=(raw==null? "false" : String(raw).toLowerCase().trim());return norm==="true";
}
function remaining(){const used=getCount();const r=Math.max(0,QUOTA-used);return r}
function updateQuotaBar(){try{const inner=document.getElementById("quotaBarInner");if(!inner)return;const r=remaining();const pct=(r/QUOTA)*100;inner.style.width=pct+"%";inner.classList.remove("warn","danger");if(r<=1){inner.classList.add("danger")}else if(r<=2){inner.classList.add("warn")}}catch(e){}}
function updateQuotaText(){try{const el=document.getElementById("quotaText");const hint=document.getElementById("quotaHint");if(!el)return;const r=remaining();if(isPro()){el.textContent="专业版已激活：无限下载";el.classList.remove("exhausted");hint&&hint.classList.add("hidden");return}el.classList.toggle("exhausted",r===0);el.textContent=r===0? "免费额度已用尽" : `剩余免费额度：${r} / ${QUOTA}`;if(hint){if(r===1){hint.classList.remove("hidden")}else{hint.classList.add("hidden")}}updateQuotaBar()}catch(e){}}

/* ---------- 弹窗显隐：统一走 .open 类（style.css 中 #proModal.open{display:flex}） ---------- */
function proModalEl(){return document.getElementById("proModal")}
function modalIsOpen(){const m=proModalEl();return !!(m&&m.classList.contains("open"))}
function showModal(){try{
  if(isPro())return;
  if(getCount()<QUOTA)return;
  const m=proModalEl();
  if(m){m.style.removeProperty("display");m.classList.add("open")}
}catch(e){}}
function hideModal(){try{const m=proModalEl();if(m)m.classList.remove("open")}catch(e){}}

function verifyCode(input){
  const code=(input||"").trim().toUpperCase();
  const rule=/^CY[A-Z0-9]{3}S1X$/;
  if(rule.test(code)){
    try{localStorage.setItem("PhotoChange_VIP_Status","Active")}catch(_){Store.set("PhotoChange_VIP_Status","Active")}
    alert("激活成功！无限下载已开启。");
    location.reload();
  }else{
    alert("激活码无效，请检查是否输入正确。");
  }
}
function initQuota(){
  try{
    const dcRaw=Store.get("download_count");
    const dc=parseInt(dcRaw||"0",10);
    if(dcRaw==null || isNaN(dc)) Store.set("download_count","0");
    const proRaw=Store.get("is_pro");
    const proNorm=(proRaw==null? "false" : String(proRaw).toLowerCase().trim());
    if(proRaw==null || (proNorm!=="true" && proNorm!=="false")) Store.set("is_pro","false");
    hideModal(); // 初始化时确保弹窗关闭
    updateQuotaText()
  }catch(e){}
}
function setupQuotaListener(){
  try{
    function hasImage(){
      try{
        const c=window.__pc_lastSrcCanvas;
        return !!(c&&c.width>0&&c.height>0);
      }catch(e){return false}
    }
    function isDownloadClick(e){
      try{
        if(e.target&&e.target.id==="downloadBtn")return true;
        const path=e.composedPath? e.composedPath() : [];
        for(let i=0;i<path.length;i++){const el=path[i];if(el&&el.id==="downloadBtn")return true}
      }catch(_){}
      return false
    }
    window.addEventListener("click",e=>{
      try{
        if(!isDownloadClick(e))return;
        const pro=isPro();
        const r=remaining();
        if(pro){
          if(!hasImage()){
            alert("请先上传并转换一张图片");
            e.stopImmediatePropagation();e.preventDefault();
            return
          }
          return
        }
        if(r<=0){
          e.stopImmediatePropagation();e.preventDefault();
          showModal();
          return
        }
        if(!hasImage()){
          alert("请先上传并转换一张图片");
          e.stopImmediatePropagation();e.preventDefault();
          return
        }
        const next=getCount()+1;
        setCount(next);
        updateQuotaText()
      }catch(err){}
    },true)
  }catch(e){}
}
if(document.readyState==="loading"){
  window.addEventListener("DOMContentLoaded",()=>{setupQuotaListener();initQuota()})
}else{
  setupQuotaListener();initQuota()
}
window.closeProModal=()=>{hideModal()};
document.addEventListener("keydown",e=>{try{if(e.key==="Escape"){if(modalIsOpen()){hideModal()}}}catch(err){}});
document.addEventListener("click",e=>{try{const id=e.target&&e.target.id;if(id==="closeX"){hideModal()}}catch(err){}});
document.addEventListener("click",e=>{try{if(e.target&&e.target.id==="activateBtn"){e.stopImmediatePropagation();e.preventDefault();const input=document.getElementById("activateInput");const code=(input&&input.value||"").trim();verifyCode(code)}}catch(err){}},true);