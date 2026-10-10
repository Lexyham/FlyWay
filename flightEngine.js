
const KEY="flights_db_v2";

export function loadFlights(){return JSON.parse(localStorage.getItem(KEY)||"[]")}
export function saveFlights(f){localStorage.setItem(KEY,JSON.stringify(f))}

export function createFlight({from,to,duration=3600000}){
  const flight={id:crypto.randomUUID(),code:"FL"+Math.random().toString(36).substring(2,8).toUpperCase(),from,to,startTime:Date.now(),duration,speedMultiplier:1}
  const all=loadFlights(); all.push(flight); saveFlights(all); return flight;
}

export function getFlight(code){return loadFlights().find(f=>f.code===code)}

export function computeProgress(f){return Math.min(1,((Date.now()-f.startTime)/f.duration)*f.speedMultiplier)}

export function route(p){return {x:p*1000-500,y:Math.sin(p*Math.PI)*-300}}

export function computeState(f){
  const p=computeProgress(f); const pos=route(p);
  return {...f,progress:p,position:pos,altitude:2000+Math.sin(p*Math.PI)*12000,speed:250+200*p,heading:p*Math.PI,eta:Math.max(0,f.duration-(Date.now()-f.startTime))}
}

let ai=[];
export function initAI(n=10){
  ai=[];
  for(let i=0;i<n;i++){ai.push({t:Date.now()-Math.random()*1000000,d:3000000,o:Math.random()})}
}
export function getAI(){
  return ai.map(a=>{
    const p=((Date.now()-a.t)/a.d)%1;
    return {position:route(p+a.o)}
  })
}
