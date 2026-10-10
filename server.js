const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.json({ok:true, service:"BREACH 5v5"}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 8080;
const rooms = new Map();
const MAP = {
  width: 28, height: 20,
  walls: [
    {x:0,z:0,w:28,d:1},{x:0,z:19,w:28,d:1},
    {x:0,z:0,w:1,d:20},{x:27,z:0,w:1,d:20},
    {x:6,z:4,w:1,d:6},{x:6,z:13,w:1,d:3},
    {x:10,z:4,w:5,d:1},{x:10,z:15,w:5,d:1},
    {x:15,z:4,w:1,d:4},{x:15,z:12,w:1,d:4},
    {x:20,z:4,w:1,d:5},{x:20,z:13,w:1,d:3},
    {x:10,z:8,w:3,d:1},{x:11,z:11,w:4,d:1},
    {x:3,z:9,w:2,d:1},{x:23,z:10,w:2,d:1}
  ]
};
const now = () => Date.now();
function makeRoom(code, hostId) {
  return {code, hostId, players:new Map(), round:1, score:{blue:0,red:0}, started:false, roundEnds:now()+105000, lastRoundEnd:0};
}
function cleanName(s) { return String(s||"Jogador").replace(/[<>]/g,"").slice(0,16) || "Jogador"; }
function randomCode(){ const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<4;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s; }
function getRoomFor(ws){return ws.roomCode ? rooms.get(ws.roomCode) : null}
function playerList(room){return [...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,z:p.z,yaw:p.yaw,hp:p.hp,alive:p.alive,kills:p.kills,ready:p.ready}));}
function send(ws, obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(room, obj){const s=JSON.stringify(obj);for(const p of room.players.values())if(p.ws.readyState===WebSocket.OPEN)p.ws.send(s);}
function state(room){return {type:"state",code:room.code,round:room.round,score:room.score,started:room.started,roundTime:Math.max(0,Math.ceil((room.roundEnds-now())/1000)),map:MAP,players:playerList(room)};}
function broadcastState(room){broadcast(room,state(room));}
function pointBlocked(x,z){
  if(x<1.35||x>26.65||z<1.35||z>18.65)return true;
  for(const w of MAP.walls){
    if(x>w.x-.42&&x<w.x+w.w+.42&&z>w.z-.42&&z<w.z+w.d+.42)return true;
  }
  return false;
}
function spawn(team, index){
  const spots = team==="blue"
    ? [{x:2.5,z:3},{x:3.5,z:5},{x:2.5,z:7},{x:4,z:3},{x:4,z:7}]
    : [{x:25,z:16},{x:24,z:14},{x:25,z:12},{x:23.5,z:17},{x:23,z:12}];
  return spots[index%spots.length];
}
function resetRound(room){
  room.round++; room.started=true; room.roundEnds=now()+105000;
  const indexes={blue:0,red:0};
  for(const p of room.players.values()){
    const pos=spawn(p.team,indexes[p.team]++);
    Object.assign(p,pos,{hp:100,alive:true,ready:false});
  }
  broadcast(room,{type:"notice",text:"RONDA "+room.round});
  broadcastState(room);
}
function checkRound(room){
  if(!room.started)return;
  const aliveBlue=[...room.players.values()].some(p=>p.team==="blue"&&p.alive);
  const aliveRed=[...room.players.values()].some(p=>p.team==="red"&&p.alive);
  if((!aliveBlue||!aliveRed||now()>=room.roundEnds) && now()-room.lastRoundEnd>2500){
    room.lastRoundEnd=now();
    if(aliveBlue&&!aliveRed)room.score.blue++;
    else if(aliveRed&&!aliveBlue)room.score.red++;
    room.started=false;
    broadcast(room,{type:"roundEnd",winner:aliveBlue&&!aliveRed?"blue":aliveRed&&!aliveBlue?"red":"draw",score:room.score});
    setTimeout(()=>{if(rooms.get(room.code)===room && room.players.size)resetRound(room)},3000);
  }
}
function removePlayer(ws){
  const room=getRoomFor(ws); if(!room)return;
  room.players.delete(ws.playerId); ws.roomCode=null;
  if(room.players.size===0){rooms.delete(room.code);return;}
  if(room.hostId===ws.playerId)room.hostId=room.players.keys().next().value;
  broadcast(room,{type:"notice",text:"Um jogador saiu da sala"});
  broadcastState(room);
}
wss.on("connection", ws=>{
  ws.playerId = Math.random().toString(36).slice(2,10);
  ws.roomCode=null;
  ws.on("message", raw=>{
    let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==="create"){
      if(ws.roomCode)removePlayer(ws);
      let code=randomCode();while(rooms.has(code))code=randomCode();
      const room=makeRoom(code,ws.playerId);rooms.set(code,room);
      const p={id:ws.playerId,ws,name:cleanName(m.name),team:"blue",...spawn("blue",0),yaw:0,hp:100,alive:true,kills:0,ready:false,lastShot:0};
      room.players.set(p.id,p);ws.roomCode=code;
      send(ws,{type:"joined",id:p.id,code,team:p.team,host:true});
      broadcastState(room);return;
    }
    if(m.type==="join"){
      const code=String(m.code||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4);
      const room=rooms.get(code);
      if(!room){send(ws,{type:"error",text:"Sala não encontrada. Confirma o código."});return;}
      if(room.players.size>=10){send(ws,{type:"error",text:"Sala cheia (máximo 10 jogadores)."});return;}
      if(ws.roomCode)removePlayer(ws);
      const blues=[...room.players.values()].filter(p=>p.team==="blue").length;
      const reds=[...room.players.values()].filter(p=>p.team==="red").length;
      const team=blues<=reds?"blue":"red";
      const index=[...room.players.values()].filter(p=>p.team===team).length;
      const p={id:ws.playerId,ws,name:cleanName(m.name),team,...spawn(team,index),yaw:team==="blue"?0:Math.PI,hp:100,alive:true,kills:0,ready:false,lastShot:0};
      room.players.set(p.id,p);ws.roomCode=code;
      send(ws,{type:"joined",id:p.id,code,team,host:room.hostId===p.id});
      broadcast(room,{type:"notice",text:p.name+" entrou na sala"});
      broadcastState(room);return;
    }
    const room=getRoomFor(ws);if(!room)return;
    const p=room.players.get(ws.playerId);if(!p)return;
    if(m.type==="start"){
      if(room.hostId!==p.id){send(ws,{type:"error",text:"Só o anfitrião pode iniciar."});return;}
      if(room.players.size<2){send(ws,{type:"error",text:"Precisas de pelo menos 2 jogadores."});return;}
      room.started=true;room.roundEnds=now()+105000;
      broadcast(room,{type:"notice",text:"COMEÇOU A RONDA!"});broadcastState(room);return;
    }
    if(m.type==="move"&&p.alive&&room.started){
      const x=Number(m.x),z=Number(m.z),yaw=Number(m.yaw);
      if(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-p.x,z-p.z)<1.4&&!pointBlocked(x,z)){p.x=x;p.z=z;}
      if(Number.isFinite(yaw))p.yaw=yaw;
      return;
    }
    if(m.type==="shoot"&&p.alive&&room.started&&now()-p.lastShot>180){
      p.lastShot=now();
      const yaw=Number.isFinite(m.yaw)?m.yaw:p.yaw;
      let target=null,best=.105;
      for(const q of room.players.values()){
        if(q.team===p.team||!q.alive)continue;
        const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);
        let a=Math.atan2(dx,dz)-yaw;while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;
        if(d<15&&Math.abs(a)<best){best=Math.abs(a);target=q;}
      }
      if(target){
        target.hp-=34;
        if(target.hp<=0){target.hp=0;target.alive=false;p.kills++;broadcast(room,{type:"kill",killer:p.name,victim:target.name});}
      }
      broadcastState(room);checkRound(room);return;
    }
    if(m.type==="reload"){p.ammo=30;broadcastState(room);return;}
  });
  ws.on("close",()=>removePlayer(ws));
});
setInterval(()=>{for(const room of rooms.values()){if(room.started){checkRound(room);broadcastState(room)}}},250);
server.listen(PORT,"0.0.0.0",()=>console.log("BREACH 5v5 a ouvir na porta "+PORT));
