function drawSelection(){if(!selection)return;const r=normRect(selection);ctx.save();ctx.fillStyle="rgba(0,0,0,0.35)";ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);ctx.rect(r.x,r.y,r.w,r.h);ctx.fill("evenodd");ctx.strokeStyle="#93c5fd";ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.restore()}

