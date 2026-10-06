const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
function Sheet(name,rows){this.name=name;this.rows=rows||[];}
Sheet.prototype={
  lastRow(){let r=this.rows.length;while(r>0&&this.rows[r-1].every(v=>v===''||v==null))r--;return r},
  getLastRow(){return this.lastRow()},
  getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length))},
  getRange(a,b,c,d){let r,col,nr,nc;
    if(typeof a==='string'){const m=a.match(/^([A-Z])(\d+)(?::([A-Z])(\d+))?$/);col=m[1].charCodeAt(0)-64;r=+m[2];nc=m[3]?m[3].charCodeAt(0)-64-col+1:1;nr=m[4]?+m[4]-r+1:1}
    else{r=a;col=b;nr=c||1;nc=d||1}
    const sh=this;
    const get=()=>{const out=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(sh.rows[r-1+i]||[])[col-1+j];row.push(v==null?'':v)}out.push(row)}return out};
    const R={getValues:get,getDisplayValues:()=>get().map(x=>x.map(String)),getValue:()=>get()[0][0],getDisplayValue:()=>String(get()[0][0]),
      setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{while(sh.rows.length<r+i)sh.rows.push([]);sh.rows[r-1+i][col-1+j]=x}));return R},
      setValue(x){return R.setValues([[x]])},setNumberFormat(){return R}};
    return R},
  getDataRange(){return this.getRange(1,1,Math.max(1,this.lastRow()),Math.max(1,this.getLastColumn()))},
  deleteRow(r){this.rows.splice(r-1,1)}
};
function makeBook(tabs){
  const sheets={};for(const k in tabs)sheets[k]=new Sheet(k,tabs[k]);
  return {sheets,getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=new Sheet(n,[])),getName:()=>'Omni Haven Stock Book',getUrl:()=>'https://docs.google.com/spreadsheets/d/x',getSpreadsheetTimeZone:()=>'Africa/Accra'};
}
const sent=[];function load(book){
  const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>book},Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:(d)=>d.toISOString().slice(0,10)},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},HtmlService:{},console,MailApp:{sendEmail:(to,sub,body)=>sent.push({to,sub,body})},ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/X/exec'})}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','src','Code.gs'),'utf8'),ctx);return ctx;
}
module.exports={makeBook,load,sent};
