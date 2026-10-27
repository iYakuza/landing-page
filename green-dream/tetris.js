(() => {
  function initFallingTetris(){
    const canvas=document.getElementById("falling-tetris-bg");
    const controls=document.getElementById("tetris-arena-controls");
    if(!canvas||!canvas.getContext)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const modeSelect=document.getElementById("tetris-mode");
    const startButton=document.getElementById("tetris-start");
    const resetButton=document.getElementById("tetris-reset");
    const status=document.getElementById("tetris-status");
    const SUPABASE_URL="https://oeyxsqocldlovhsmzcjw.supabase.co";
    const SUPABASE_KEY="sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h";
    let online=false,isHost=false,roomCode="",roomChannel=null,lastSync=0,lastInputAt=0,stateSendPending=false;
    let onlineNotice=null,roomInput=null,inviteButton=null;

    const SHAPES=[
      [[1,1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],
      [[1,1],[1,1]],[[0,1,1],[1,1,0]],[[0,1,0],[1,1,1]],[[1,1,0],[0,1,1]]
    ];
    const COLORS=["#b6e833","#a98bff","#54d7ef","#f2f4e8","#76e6a6","#ff70c8","#f2c85b"];
    const MODES={
      time:{label:"TIME ATTACK",seconds:120,goal:0,description:"2 MINUTES · HIGHEST SCORE WINS"},
      points:{label:"POINTS RACE",seconds:0,goal:1500,description:"FIRST TO 1,500 POINTS WINS"},
      sprint:{label:"SPRINT / 40 LINES",seconds:0,goal:40,description:"CLEAR 40 LINES FIRST"},
      ranked:{label:"RANKED LOCAL",seconds:180,goal:0,description:"3 MINUTES · SCORES SAVED ON THIS DEVICE"}
    };
    let width=0,height=0,dpr=1,cell=22,cols=0,rows=0,last=0,raf=0,dropClock=0;
    let mode="time",running=false,finished=false,remaining=120,matchStart=0;
    let players=[];
    const makePlayer=(name,color,keys)=>({name,color,keys,board:[],active:null,score:0,lines:0,over:false,won:false,dropClock:0});
    function blankBoard(){return Array.from({length:rows},()=>Array(cols).fill(null));}
    function clone(m){return m.map(row=>row.slice());}
    function collide(p,m,x,y){
      for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]){
        const bx=x+c,by=y+r;
        if(bx<0||bx>=cols||by>=rows||(by>=0&&p.board[by]?.[bx]))return true;
      }return false;
    }
    function spawn(p){
      const m=clone(SHAPES[Math.floor(Math.random()*SHAPES.length)]);
      p.active={m,x:Math.max(0,Math.floor((cols-m[0].length)/2)),y:0,color:COLORS[Math.floor(Math.random()*COLORS.length)]};
      if(collide(p,p.active.m,p.active.x,p.active.y))p.over=true;
    }
    function newPlayer(p){p.board=blankBoard();p.active=null;p.score=0;p.lines=0;p.over=false;p.won=false;p.dropClock=0;spawn(p);}
    function restart(){
      const w=Math.max(5,Math.floor((width-24)/(cell*2))-1);
      cols=w;rows=Math.max(10,Math.floor((height-230)/cell));
      players=[makePlayer("PLAYER 1","#b6e833",{left:"a",right:"d",rotate:"w",down:"s",drop:" "}),makePlayer("PLAYER 2","#54d7ef",{left:"arrowleft",right:"arrowright",rotate:"arrowup",down:"arrowdown",drop:"enter"})];
      players.forEach(newPlayer);
      mode=modeSelect?.value||"time";remaining=MODES[mode].seconds;running=false;finished=false;last=performance.now();matchStart=last;
      stopLoop();
      if(status)status.textContent=MODES[mode].description+" — PRESS START WHEN READY";
      if(startButton)startButton.textContent="▶";
    }
    function resize(){
      dpr=Math.min(window.devicePixelRatio||1,1.5);width=canvas.parentElement.clientWidth;height=canvas.parentElement.clientHeight;
      cell=Math.max(13,Math.min(25,Math.floor(Math.min((width/2-36)/10,(height-88)/20))));
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+"px";canvas.style.height=height+"px";ctx.setTransform(dpr,0,0,dpr,0,0);
      const newCols=Math.max(5,Math.floor((width-24)/(cell*2))-1),newRows=Math.max(10,Math.floor((height-230)/cell));
      if(!players.length){cols=newCols;rows=newRows;players=[makePlayer("PLAYER 1","#b6e833",{left:"a",right:"d",rotate:"w",down:"s",drop:" "}),makePlayer("PLAYER 2","#54d7ef",{left:"arrowleft",right:"arrowright",rotate:"arrowup",down:"arrowdown",drop:"enter"})];players.forEach(newPlayer);return;}
      if(newCols!==cols||newRows!==rows){
        cols=newCols;rows=newRows;
        players.forEach(p=>{
          const old=p.board||[],next=blankBoard(),copyRows=Math.min(rows,old.length),copyCols=Math.min(cols,old[0]?.length||0);
          for(let r=0;r<copyRows;r++)for(let x=0;x<copyCols;x++)next[rows-copyRows+r][x]=old[old.length-copyRows+r]?.[x]||null;
          p.board=next;if(p.active){p.active.x=Math.max(0,Math.min(cols-p.active.m[0].length,p.active.x));p.active.y=Math.max(0,Math.min(rows-p.active.m.length,p.active.y));}
        });
      }
    }
    function lock(p){
      if(!p.active)return;
      p.active.m.forEach((row,r)=>row.forEach((v,c)=>{if(v&&p.active.y+r>=0&&p.active.x+c>=0&&p.active.x+c<cols)p.board[p.active.y+r][p.active.x+c]=p.active.color;}));
      let cleared=0;p.board=p.board.filter(row=>{if(row.every(Boolean)){cleared++;return false;}return true;});
      while(p.board.length<rows)p.board.unshift(Array(cols).fill(null));
      if(cleared){p.lines+=cleared;p.score+=([0,100,300,500,800][cleared]||cleared*250);}
      spawn(p);
      if(mode==="sprint"&&p.lines>=40){p.won=true;finish(p.name+" WINS — 40 LINES CLEARED");}
      if(mode==="points"&&p.score>=1500){p.won=true;finish(p.name+" WINS — POINTS TARGET REACHED");}
    }
    function move(p,dx,dy=0){
      if(!running||finished||p.over||!p.active)return;
      if(!collide(p,p.active.m,p.active.x+dx,p.active.y+dy)){p.active.x+=dx;p.active.y+=dy;if(dy)p.score++;return;}
      if(dy>0)lock(p);
    }
    function rotate(p){
      if(!running||finished||p.over||!p.active)return;
      const m=p.active.m[0].map((_,i)=>p.active.m.map(row=>row[i]).reverse());
      for(const kick of [0,-1,1,-2,2])if(!collide(p,m,p.active.x+kick,p.active.y)){p.active.m=m;p.active.x+=kick;return;}
    }
    function hardDrop(p){if(!running||finished||p.over||!p.active)return;while(!collide(p,p.active.m,p.active.x,p.active.y+1)){p.active.y++;p.score+=2;}lock(p);}
    function finish(message){
      if(finished)return;finished=true;running=false;
      if(status)status.textContent=message;
      if(startButton)startButton.textContent="↻";
      if(mode==="ranked"){
        try{
          const old=JSON.parse(localStorage.getItem("vha-tetris-ranked")||"[]");
          const row={date:new Date().toISOString(),p1:players[0].score,p2:players[1].score,winner:players[0].score===players[1].score?"DRAW":players[0].score>players[1].score?"PLAYER 1":"PLAYER 2"};
          localStorage.setItem("vha-tetris-ranked",JSON.stringify([row,...old].slice(0,10)));
          if(status)status.textContent+=" · LOCAL RANK #"+(1+JSON.parse(localStorage.getItem("vha-tetris-ranked")).filter(x=>Math.max(x.p1,x.p2)>Math.max(row.p1,row.p2)).length);
        }catch{}
      }
    }
    function keydown(e){
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const t=e.target;if(t&&(t.isContentEditable||/INPUT|TEXTAREA|SELECT|BUTTON/.test(t.tagName)))return;
      const k=e.key.toLowerCase();
      const used=["a","d","w","s"," ","arrowleft","arrowright","arrowup","arrowdown","enter"].includes(k);
      if(used)e.preventDefault();
      if(k==="escape"||k==="p"){running=!running&&!finished;if(startButton)startButton.textContent=running?"Ⅱ":"▶";if(running)startLoop();else stopLoop();draw();return;}
      if(k==="r"){restart();return;}
      if(k==="1"||k==="2"||k==="3"||k==="4"){const map={"1":"time","2":"points","3":"sprint","4":"ranked"};if(modeSelect)modeSelect.value=map[k];restart();return;}
      if(online){
        if(isHost){if(k==="arrowleft")hostAction("left");else if(k==="arrowright")hostAction("right");else if(k==="arrowup")hostAction("rotate");else if(k==="arrowdown")hostAction("down");else if(k==="enter")hostAction("drop");}
        else{const actionMap={arrowleft:"left",arrowright:"right",arrowup:"rotate",arrowdown:"down",enter:"drop"};if(actionMap[k]&&roomChannel){
            const now=performance.now();
            if(now-lastInputAt>=70){lastInputAt=now;roomChannel.send({type:"broadcast",event:"input",payload:{action:actionMap[k]}}).catch?.(()=>{});}
          }}
        return;
      }
      for(const p of players){
        if(k===p.keys.left)move(p,-1);
        else if(k===p.keys.right)move(p,1);
        else if(k===p.keys.rotate)rotate(p);
        else if(k===p.keys.down)move(p,0,1);
        else if(k===p.keys.drop)hardDrop(p);
      }
    }

    function onlineStatus(message){if(onlineNotice)onlineNotice.textContent=message;if(status)status.textContent=message;}
    function serializeState(){return {type:"state",mode,remaining,running,finished,cols,rows,players:players.map(p=>({name:p.name,color:p.color,board:p.board,active:p.active,score:p.score,lines:p.lines,over:p.over,won:p.won,dropClock:p.dropClock}))};}
    function applyState(s){if(!s||s.type!=="state"||!Array.isArray(s.players))return;mode=s.mode||mode;remaining=Number(s.remaining)||0;running=!!s.running;finished=!!s.finished;cols=Number(s.cols)||cols;rows=Number(s.rows)||rows;players=s.players.map((p,i)=>({...makePlayer(p.name||("PLAYER "+(i+1)),p.color||COLORS[i],{}),...p,board:Array.isArray(p.board)?p.board:blankBoard()}));if(modeSelect)modeSelect.value=mode;if(startButton)startButton.textContent=finished?"↻":running?"Ⅱ":"▶";if(status)status.textContent=finished?"MATCH COMPLETE":running?MODES[mode].description:"MATCH PAUSED";if(running)startLoop();else stopLoop();draw();}
    function sendState(){
      if(!online||!isHost||!roomChannel||stateSendPending)return;
      stateSendPending=true;
      Promise.resolve(roomChannel.send({type:"broadcast",event:"state",payload:serializeState()}))
        .catch(()=>{})
        .finally(()=>{stateSendPending=false;});
    }
    function hostAction(action){if(!isHost||!players[1])return;const p=players[1];if(action==="left")move(p,-1);else if(action==="right")move(p,1);else if(action==="rotate")rotate(p);else if(action==="down")move(p,0,1);else if(action==="drop")hardDrop(p);}
    async function enterRoom(code,host){
      const client=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);if(!client){onlineStatus("ONLINE PLAY UNAVAILABLE — CONNECTION LIBRARY FAILED");return;}
      if(roomChannel){try{await roomChannel.unsubscribe();}catch{}}
      roomCode=code;online=true;isHost=host;
      roomChannel=client.channel("after-hours-tetris-"+code,{config:{broadcast:{self:false}}});
      roomChannel.on("broadcast",{event:"input"},({payload})=>{if(isHost&&payload?.action)hostAction(payload.action);});
      roomChannel.on("broadcast",{event:"state"},({payload})=>{if(!isHost)applyState(payload);});
      roomChannel.on("broadcast",{event:"presence"},({payload})=>{if(isHost&&payload?.kind==="join"){sendState();onlineStatus("FRIEND CONNECTED // ROOM "+roomCode);}});
      await roomChannel.subscribe(state=>{if(state==="SUBSCRIBED"){if(host){restart();sendState();onlineStatus("ROOM "+roomCode+" READY // SHARE INVITE LINK");}else{roomChannel.send({type:"broadcast",event:"presence",payload:{kind:"join"}});onlineStatus("JOINED ROOM "+roomCode+" // SYNCING MATCH");}}else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT")onlineStatus("CONNECTION ISSUE — TRY REJOINING");});
      if(roomInput)roomInput.value=code;if(inviteButton){inviteButton.hidden=!host;inviteButton.dataset.url=location.href;}
    }
    function setupOnlineControls(){
      const intro=document.querySelector(".tetris-room-intro");if(!intro)return;
      const bar=document.createElement("div");bar.className="tetris-online-bar";
      bar.innerHTML='<button type="button" id="tetris-create-room">CREATE ONLINE ROOM</button><input id="tetris-room-code" maxlength="6" placeholder="ROOM CODE" aria-label="Room code" autocomplete="off"><button type="button" id="tetris-join-room">JOIN FRIEND</button><button type="button" id="tetris-invite" hidden>COPY INVITE LINK</button><span id="tetris-online-status" role="status">LOCAL DUEL // SAME DEVICE</span>';
      intro.appendChild(bar);onlineNotice=bar.querySelector("#tetris-online-status");roomInput=bar.querySelector("#tetris-room-code");inviteButton=bar.querySelector("#tetris-invite");
      bar.querySelector("#tetris-create-room").addEventListener("click",()=>{const code=Math.random().toString(36).slice(2,8).toUpperCase();const url=new URL(location.href);url.searchParams.set("room",code);history.replaceState(null,"",url);enterRoom(code,true);});
      bar.querySelector("#tetris-join-room").addEventListener("click",()=>{const code=(roomInput.value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(code.length<4){onlineStatus("ENTER A VALID ROOM CODE");return;}const url=new URL(location.href);url.searchParams.set("room",code);history.replaceState(null,"",url);enterRoom(code,false);});
      inviteButton.addEventListener("click",async()=>{const url=inviteButton.dataset.url||location.href;try{await navigator.clipboard.writeText(url);onlineStatus("INVITE LINK COPIED — SEND IT TO YOUR FRIEND");}catch{window.prompt("Copy this invite link:",url);}});
      const query=new URLSearchParams(location.search).get("room");if(query){roomInput.value=query.toUpperCase();onlineStatus("INVITE FOUND // JOIN TO CONNECT");}
    }
    function drawBlock(x,y,color,alpha=1){
      const px=x*cell,py=y*cell,g=1;
      ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(px+g,py+g,cell-2*g,cell-2*g);
      ctx.globalAlpha=alpha*.6;ctx.fillStyle="#fff";ctx.fillRect(px+g+1,py+g+1,Math.max(1,cell*.35),Math.max(1,cell*.07));
      ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.strokeRect(px+g+.5,py+g+.5,cell-3,cell-3);
    }
    function drawPlayer(p,index){
      const areaW=width/2,boardW=cols*cell,boardH=rows*cell;
      const ox=index*areaW+(areaW-boardW)/2,oy=190;
      ctx.save();ctx.translate(ox,oy);
      ctx.fillStyle="rgba(3,8,5,.48)";ctx.fillRect(-8,-8,boardW+16,boardH+16);
      ctx.strokeStyle=p.color;ctx.globalAlpha=.28;ctx.lineWidth=1;
      for(let x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,boardH);ctx.stroke();}
      for(let y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(boardW,y*cell);ctx.stroke();}
      p.board.forEach((row,y)=>row.forEach((color,x)=>{if(color)drawBlock(x,y,color,.78);}));
      if(p.active)p.active.m.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawBlock(p.active.x+c,p.active.y+r,p.active.color,.96);}));
      ctx.restore();
      ctx.save();ctx.fillStyle=p.color;ctx.font="bold 12px monospace";ctx.textAlign="center";ctx.fillText(p.name,ox+boardW/2,174);
      ctx.font="11px monospace";ctx.fillText("SCORE "+String(p.score).padStart(5,"0")+"  /  LINES "+String(p.lines).padStart(2,"0"),ox+boardW/2,oy+boardH+18);
      ctx.restore();
    }
    function draw(now){
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle="rgba(3,8,5,.12)";ctx.fillRect(0,0,width,height);
      ctx.strokeStyle="rgba(182,232,51,.18)";ctx.beginPath();ctx.moveTo(width/2,0);ctx.lineTo(width/2,height);ctx.stroke();
      players.forEach(drawPlayer);
      ctx.fillStyle="rgba(3,8,5,.85)";ctx.fillRect(0,0,width,154);
      ctx.fillStyle="#d8f6b6";ctx.font="11px monospace";ctx.textAlign="center";
      const timer=MODES[mode].seconds?Math.max(0,remaining):null;
      ctx.fillText("VERSE AFTER HOURS // 1V1 TETRIS",width/2,132);
      if(timer!==null){ctx.fillStyle="#b6e833";ctx.fillText("TIME "+Math.ceil(timer)+"s",width/2,148);}
      if(!running&&!finished){ctx.fillStyle="rgba(2,5,3,.65)";ctx.fillRect(0,0,width,height);ctx.fillStyle="#d8f6b6";ctx.font="bold 18px monospace";ctx.fillText("PRESS START TO DUEL",width/2,height/2);}
      if(!running&&finished){ctx.fillStyle="rgba(2,5,3,.72)";ctx.fillRect(0,0,width,height);ctx.fillStyle="#b6e833";ctx.font="bold 18px monospace";ctx.fillText("MATCH COMPLETE",width/2,height/2);}
      if(!running&&!finished){ctx.fillStyle="#c9f68b";ctx.font="11px monospace";ctx.fillText("P1 WASD + SPACE  //  P2 ARROWS + ENTER",width/2,height/2+24);}
      ctx.globalAlpha=1;
    }
    function frame(now){
      raf=0;if(document.hidden)return;
      const dt=Math.min((now-last)/1000||0,.05);last=now;
      if(running&&!finished&&(!online||isHost)){
        if(MODES[mode].seconds){remaining-=dt;if(remaining<=0){remaining=0;finish(players[0].score===players[1].score?"DRAW — MATCH TIED":players[0].score>players[1].score?"PLAYER 1 WINS":"PLAYER 2 WINS");}}
        players.forEach(p=>{if(!p.over){p.dropClock+=dt;if(p.dropClock>.68){p.dropClock=0;move(p,0,1);}}});
        if(players.every(p=>p.over))finish(players[0].score===players[1].score?"DRAW — BOTH FIELDS SATURATED":players[0].score>players[1].score?"PLAYER 1 WINS":"PLAYER 2 WINS");
      }
      if(online&&isHost&&now-lastSync>400){lastSync=now;sendState();}
      draw(now);
      // Keep the expensive canvas renderer idle while the duel is paused.
      if(running)raf=requestAnimationFrame(frame);else raf=0;
    }
    function startLoop(){if(!raf&&!document.hidden){last=performance.now();raf=requestAnimationFrame(frame);}}
    function stopLoop(){if(raf){cancelAnimationFrame(raf);raf=0;}}

    const dragHandle=document.getElementById("tetris-drag-handle");
    const arena=document.getElementById("tetris-arena");
    if(dragHandle&&controls&&arena){
      // Keep the draggable menu inside the AFTER HOURS DUEL arena.
      if(controls.parentElement!==arena)arena.appendChild(controls);
      controls.classList.add("tetris-floating-controls");
      controls.style.setProperty("position","absolute","important");
      controls.style.setProperty("right","auto","important");
      controls.style.setProperty("bottom","auto","important");
      let dragging=false,offsetX=0,offsetY=0;
      dragHandle.style.touchAction="none";
      dragHandle.addEventListener("pointerdown",e=>{
        if(e.button!==0&&e.pointerType!=="touch")return;
        dragging=true;
        const r=controls.getBoundingClientRect();
        offsetX=e.clientX-r.left;offsetY=e.clientY-r.top;
        controls.style.setProperty("left",(r.left-arena.getBoundingClientRect().left+arena.scrollLeft)+"px","important");
        controls.style.setProperty("top",(r.top-arena.getBoundingClientRect().top+arena.scrollTop)+"px","important");
        dragHandle.setPointerCapture?.(e.pointerId);e.preventDefault();
      });
      dragHandle.addEventListener("pointermove",e=>{
        if(!dragging)return;
        const ar=arena.getBoundingClientRect(),r=controls.getBoundingClientRect();
        const left=Math.max(0,Math.min(ar.width-r.width,e.clientX-ar.left-offsetX));
        const top=Math.max(0,Math.min(Math.max(0,112-r.height),e.clientY-ar.top-offsetY));
        controls.style.setProperty("left",left+"px","important");controls.style.setProperty("top",top+"px","important");
      });
      const endDrag=()=>{dragging=false;};
      dragHandle.addEventListener("pointerup",endDrag);dragHandle.addEventListener("pointercancel",endDrag);
      window.addEventListener("resize",()=>{
        const ar=arena.getBoundingClientRect(),r=controls.getBoundingClientRect();
        controls.style.setProperty("left",Math.max(0,Math.min(ar.width-r.width,parseFloat(controls.style.left)||12))+"px","important");
        controls.style.setProperty("top",Math.max(0,Math.min(Math.max(0,112-r.height),parseFloat(controls.style.top)||12))+"px","important");
      });
    }
    startButton?.addEventListener("click",()=>{if(finished){restart();draw();return;}if(!players.length){restart();draw();return;}running=!running;if(status)status.textContent=running?MODES[mode].description:"MATCH PAUSED";startButton.textContent=running?"Ⅱ":"▶";if(running)startLoop();else stopLoop();draw();});
    resetButton?.addEventListener("click",restart);
    modeSelect?.addEventListener("change",()=>{mode=modeSelect.value;remaining=MODES[mode].seconds;if(status)status.textContent=MODES[mode].description;});
    window.addEventListener("keydown",keydown,{passive:false});
    window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stopLoop();else startLoop();});
    setupOnlineControls();resize();restart();draw();
  }
  initFallingTetris();
})();
