module.exports=[21324,e=>{"use strict";var t=e.i(66680),i=e.i(43793);let r=()=>(0,t.randomUUID)();async function a(e,t){let a=await (0,i.p)(`SELECT e.id, e.name, e.project_id, p.name AS project_name, e.overhead_pct, e.profit_pct, e.vat_pct,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date, e.hours_per_day
       FROM estimates e JOIN projects p ON p.id = e.project_id
      WHERE e.id = ? AND e.company_id = ?`,[e,t]);if(!a)return null;let d=await (0,i.z)("SELECT id, name, team_size, start_day FROM estimate_chapters WHERE estimate_id = ? ORDER BY position, id",[e]),m=await (0,i.z)(`SELECT i.id, i.chapter_id, i.code, i.name, i.unit, i.quantity, i.review_note
       FROM estimate_items i JOIN estimate_chapters c ON c.id = i.chapter_id
      WHERE c.estimate_id = ? ORDER BY i.position, i.id`,[e]),c=await (0,i.z)(`SELECT r.item_id, r.resource_id, r.type, r.code, r.name, r.unit, r.norm, r.price
       FROM estimate_item_resources r
       JOIN estimate_items i ON i.id = r.item_id
       JOIN estimate_chapters c ON c.id = i.chapter_id
      WHERE c.estimate_id = ? ORDER BY r.position, r.id`,[e]),s=new Map;for(let e of c){let t=s.get(e.item_id)??[];t.push({key:r(),resourceId:e.resource_id,type:e.type,code:e.code??"",name:e.name,unit:e.unit,norm:Number(e.norm),price:Number(e.price)}),s.set(e.item_id,t)}return{id:a.id,name:a.name,projectId:a.project_id,projectName:a.project_name,overheadPct:Number(a.overhead_pct),profitPct:Number(a.profit_pct),vatPct:Number(a.vat_pct),startDate:a.start_date?String(a.start_date):null,hoursPerDay:Number(a.hours_per_day),chapters:d.map(e=>({key:r(),name:e.name,teamSize:e.team_size,startDay:e.start_day,items:m.filter(t=>t.chapter_id===e.id).map(e=>({key:r(),code:e.code??"",name:e.name,unit:e.unit,quantity:Number(e.quantity),reviewNote:e.review_note,resources:s.get(e.id)??[]}))}))}}e.s(["f",0,a])}];

//# sourceMappingURL=src_lib_estimate_repo_ts_0tzzqh9cwe856._.js.map