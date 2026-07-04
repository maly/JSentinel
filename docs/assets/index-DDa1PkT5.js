(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=32,t=12,n=4,r=6,i=2,a=2;function o(e){let t=e>>>0;return function(){t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var s=e=>e*e*(3-2*e);function c(e,t,n,r,i,a){let o=Array.from({length:n+1},()=>Array.from({length:n+1},()=>i()));for(let i=0;i<t;i++){let c=i/(t-1)*n,l=Math.min(Math.floor(c),n-1),u=s(c-l);for(let c=0;c<t;c++){let d=c/(t-1)*n,f=Math.min(Math.floor(d),n-1),p=s(d-f),m=o[l][f],h=o[l][f+1],g=o[l+1][f],_=o[l+1][f+1],v=m+(h-m)*p,y=v+(g+(_-g)*p-v)*u;a&&(y=1-Math.abs(2*y-1)),e[i][c]+=y*r}}}function l(e,t,n=0){let r=Array.from({length:e},()=>Array(e).fill(0)),i=1+.55*n,a=1+.75*n,o=1+1.1*n;return c(r,e,2,.55,t,!1),c(r,e,3,.7*i,t,!1),c(r,e,5,.55*i,t,!1),c(r,e,4,.55*a,t,!0),c(r,e,8,.15*o,t,!1),r}function u(e,t){let n=Array.from({length:t},()=>Array(t).fill(0));for(let r=0;r<t;r++)for(let i=0;i<t;i++){let a=0,o=0;for(let n=-1;n<=1;n++)for(let s=-1;s<=1;s++){let c=r+n,l=i+s;c<0||c>=t||l<0||l>=t||(a+=e[c][l],o++)}n[r][i]=a/o}return n}function d(e,t,n=0){let r=e.map(e=>e.slice());for(let i=0;i<t;i++)for(let a=0;a<t;a++){let o=new Map;for(let e=-1;e<=1;e++)for(let n=-1;n<=1;n++){let s=i+e,c=a+n;if(s<0||s>=t||c<0||c>=t)continue;let l=r[s][c];o.set(l,(o.get(l)||0)+1)}let s=r[i][a],c=-1;for(let[e,t]of o)(t>c||t===c&&Math.abs(e-r[i][a])<Math.abs(s-r[i][a]))&&(s=e,c=t);c>=n&&(e[i][a]=s)}}function f(e,t,n,r){let i=!0,a=0;for(;i&&a++<4096;){i=!1;for(let a=0;a<n-1;a++)for(let o=0;o<n-1;o++){let n=[[a,o],[a,o+1],[a+1,o+1],[a+1,o]],s=1/0;for(let[t,r]of n)e[t][r]<s&&(s=e[t][r]);let c=s+r;for(let[r,a]of n)e[r][a]>c&&!t[r][a]&&(e[r][a]=c,i=!0)}}}function p(e,t,n,r,i){let a=0;for(let o=r-1;o<=r;o++)for(let s=n-1;s<=n;s++){if(o<0||s<0||o>=t-1||s>=t-1)continue;let c=[o===r&&s===n?i:e[o][s],o===r&&s+1===n?i:e[o][s+1],o+1===r&&s+1===n?i:e[o+1][s+1],o+1===r&&s===n?i:e[o+1][s]];c[0]===c[1]&&c[1]===c[2]&&c[2]===c[3]&&a++}return a}function m(e,t,n,r,i){let a=!0,o=0;for(;a&&o++<32;){a=!1;for(let o=0;o<n;o++)for(let s=0;s<n;s++){if(t[o][s])continue;let c=1/0,l=-1/0;s>0&&(c=Math.min(c,e[o][s-1]),l=Math.max(l,e[o][s-1])),s+1<n&&(c=Math.min(c,e[o][s+1]),l=Math.max(l,e[o][s+1])),o>0&&(c=Math.min(c,e[o-1][s]),l=Math.max(l,e[o-1][s])),o+1<n&&(c=Math.min(c,e[o+1][s]),l=Math.max(l,e[o+1][s]));let u=Math.max(0,l-i),d=Math.min(r,c+i),f=e[o][s],m=f,h=p(e,n,s,o,f);for(let t=u;t<=d;t++){if(t===f)continue;let r=p(e,n,s,o,t);(r>h||r===h&&Math.abs(t-f)<Math.abs(m-f))&&(h=r,m=t)}m!==f&&(e[o][s]=m,a=!0)}}}function h(s=1,c=0){let p=o(s>>>0),h=e,g=Math.max(0,Math.min(1,c)),_=1.42-.18*g,v=Math.round(3-3*g),y=Math.max(1,Math.round(a-g)),b=Math.max(1,Math.round(2-g)),x=Math.max(2,Math.round(n-2*g)),S=g<.5?i:3,C=Math.round(5*g),w=t+2*Math.round(2*g),T=w/2,E=l(h,p,g);E=u(E,h);let D=1/0,ee=-1/0,te=0,O=0;for(let e=0;e<h;e++)for(let t=0;t<h;t++){let n=E[e][t];n<D&&(D=n),n>ee&&(ee=n,te=e,O=t)}let ne=ee-D||1,k=Array.from({length:h},()=>Array(h).fill(0));for(let e=0;e<h;e++)for(let t=0;t<h;t++){let n=((E[e][t]-D)/ne)**+_;k[e][t]=Math.round(n*T)}let A=Array.from({length:h},()=>Array(h).fill(!1));d(k,h,C),f(k,A,h,S);for(let e=0;e<v;e++)m(k,A,h,T,y),f(k,A,h,S);for(let e=0;e<h;e++)for(let t=0;t<h;t++)k[e][t]*=2;let re=Math.min(31,24+Math.floor(p()*8)),ie=e=>re-r*Math.ceil(e/2),j=1;for(;ie(j+1)>0;)j++;let ae=Math.max(0,Math.min(h-3,O-1)),oe=Math.max(0,Math.min(h-3,te-1)),se=ae+3-1,ce=oe+3-1,le=Array.from({length:h},()=>Array(h).fill(!1)),ue=()=>{for(let e=0;e<h;e++)for(let t=0;t<h;t++){let n=t<ae?ae-t:t>se?t-se:0,r=e<oe?oe-e:e>ce?e-ce:0,i=Math.max(n,r);if(i<=j){let n=Math.min(31,ie(i));n>k[e][t]&&(k[e][t]=n,le[e][t]=!0)}}};ue();for(let e=0;e<b;e++)m(k,le,h,w,x),ue(),f(k,le,h,r);let de=()=>{let e=0,t=0;for(let n=0;n<31;n++)for(let r=0;r<31;r++){let i=k[n][r],a=k[n][r+1],o=k[n+1][r+1],s=k[n+1][r];i===a&&a===o&&o===s&&(e++,i<=4&&t++)}return{flat:e,low:t}};for(let e=0;e<24;e++){let e=de();if(e.flat>=385&&e.low>=12)break;m(k,le,h,w,n),ue(),f(k,le,h,r)}let fe=[];for(let e=0;e<31;e++){let t=[];for(let n=0;n<31;n++){let r=k[e][n],i=k[e][n+1],a=k[e+1][n+1],o=k[e+1][n],s=r===i&&i===a&&a===o,c=s?r:Math.max(r,i,a,o);t.push({h:[r,i,a,o],flat:s,height:c})}fe.push(t)}return fe}var g=.05,_=.25;function v(e,t){return{x:e.x-t.x,y:e.y-t.y,z:e.z-t.z}}function y(e,t){return e.x*t.x+e.y*t.y+e.z*t.z}function b(e,t){return{x:e.y*t.z-e.z*t.y,y:e.z*t.x-e.x*t.z,z:e.x*t.y-e.y*t.x}}function x(e){return Math.hypot(e.x,e.y,e.z)}function S(e){let t=x(e)||1;return{x:e.x/t,y:e.y/t,z:e.z/t}}function C(e){let t=Math.cos(e.yaw),n=Math.sin(e.yaw),r=Math.cos(e.pitch),i=Math.sin(e.pitch),a=e.x,o=e.y,s=e.z;function c(e){let c=e.x-a,l=e.y-o,u=e.z-s,d=t*c-n*u,f=n*c+t*u,p=l;return{x:d,y:r*p-i*f,z:i*p+r*f}}let l={x:n*r,y:i,z:t*r};return{toView:c,pos:{x:a,y:o,z:s},forward:l}}function w(e){let t=1/e.z;return{x:256+430*e.x*t,y:192-430*e.y*t}}function T(e,t,n){let r=(t-256)/430,i=-(n-192)/430,a=Math.cos(e.yaw),o=Math.sin(e.yaw),s=Math.cos(e.pitch),c=Math.sin(e.pitch),l=s*i+c*1,u=-c*i+s*1,d=r,f=a*d+o*u,p=-o*d+a*u,m=l;return{origin:{x:e.x,y:e.y,z:e.z},dir:S({x:f,y:m,z:p})}}var E=Object.freeze({tree:1,boulder:2,robot:3,meanie:1,sentry:4,sentinel:4}),D=1e-6,ee=.34,te=Object.freeze({tree:3,boulder:1,robot:2.4,meanie:1.35,sentry:2,sentinel:2.2,pedestal:1}),O=Object.freeze({tree:.28,boulder:.38,robot:.32,meanie:.3,sentry:.36,sentinel:.42,pedestal:.45}),ne=new Set([`boulder`,`pedestal`]);function k(e){return e?typeof e.height==`number`?e.height:Array.isArray(e.h)&&e.h.length?e.h.reduce((e,t)=>e+t,0)/e.h.length:0:0}function A(e,t,n){return Math.min(n,Math.max(t,e))}function re(e){return Math.hypot(e.x,e.y,e.z)}function ie(e){let t=re(e);return t<=D?{x:0,y:0,z:0}:{x:e.x/t,y:e.y/t,z:e.z/t}}function j(e){return e.height??te[e.type]??1}function ae(e){return e.radius??O[e.type]??ee}function oe(e,t){if(e.type===`tree`){let e=.7;return t<e?.12:.5*Math.max(0,(3-t)/(3-e))}return ae(e)}function se(e){return{x:e.x+.5,z:e.z+.5}}var ce=class{constructor(e){if(!Array.isArray(e)||e.length===0||!Array.isArray(e[0]))throw Error(`World requires a non-empty 2D tile array`);this.tiles=e,this.depth=e.length,this.width=e[0].length,this.objects=[],this.effects=[],this.motes=[],this._nextObjectId=1}objectsAt(e,t){return this.objects.filter(n=>n.x===e&&n.z===t).sort((e,t)=>(e.y??0)-(t.y??0))}surfaceY(e,t){return k(this._tileAt(e,t))*_}terrainYAt(e,t){let n=A(Math.floor(e),0,this.width-1),r=A(Math.floor(t),0,this.depth-1),i=this.tiles[r][n],a=Array.isArray(i.h)&&i.h.length>=4?i.h:[k(i),k(i),k(i),k(i)],o=A(e-n,0,1),s=A(t-r,0,1),c;return c=o>=s?a[0]+(a[1]-a[0])*o+(a[2]-a[1])*s:a[0]+(a[2]-a[3])*o+(a[3]-a[0])*s,c*_}topAt(e,t){let n=this.objectsAt(e,t);if(n.length===0)return this.surfaceY(e,t);let r=n[n.length-1];return(r.y??this.surfaceY(e,t))+j(r)}addObject(e){if(!e||!e.type)return null;let t={...e};return this.canPlace(t.type,t.x,t.z)?(t.id??=this._nextObjectId++,t.energy??=E[t.type]??1,t.y=this.restingY(t.type,t.x,t.z),t.height??=j(t),t.radius??=ae(t),this.objects.push(t),t):null}removeObject(e){let t=this.objects.indexOf(e);return t===-1?!1:(this.objects.splice(t,1),!0)}canPlace(e,t,n){if(!this._inBounds(t,n))return!1;let r=this.objectsAt(t,n),i=r[r.length-1]??null;if(!i){let e=this._tileAt(t,n);return!!(e&&e.flat)}return e===`boulder`?i.type===`boulder`:e===`tree`||e===`robot`||e===`sentinel`||e===`sentry`||e===`meanie`?ne.has(i.type):!1}restingY(e,t,n){let r=this.objectsAt(t,n);if(r.length===0)return this.surfaceY(t,n);let i=r[r.length-1];return ne.has(i.type)?(i.y??0)+j(i):this.surfaceY(t,n)}isTopObject(e){let t=this.objectsAt(e.x,e.z);return t[t.length-1]===e}canSee(e,t){let n=this._point(e),r=this._point(t),i={x:r.x-n.x,y:r.y-n.y,z:r.z-n.z},a=re(i);if(a<=D)return!0;let o=Math.max(8,Math.ceil(a*18));for(let e=1;e<o;e+=1){let t=e/o,a={x:n.x+i.x*t,y:n.y+i.y*t,z:n.z+i.z*t};if(this.terrainYAt(a.x,a.z)>=a.y-.02)return!1;for(let e of this.objects)if(!(this._pointInsideObject(n,e)||this._pointInsideObject(r,e))&&this._pointInsideObject(a,e))return!1}return!0}pickTarget(e,t){let n=this._point(e),r=ie(t);if(re(r)<=D)return null;let i=.05,a=null;for(let e=i;e<=80;e+=i){let t={x:n.x+r.x*e,y:n.y+r.y*e,z:n.z+r.z*e};if(!a){for(let e of this.objects)if(!this._pointInsideObject(n,e)&&this._pointInsideObject(t,e)){a={object:e,point:t,face:this._objectFaceHit(n,r,e)};break}}if(!this._worldPointInBounds(t.x,t.z))continue;let i=this.terrainYAt(t.x,t.z);if(t.y<=i+.02){let e={x:A(Math.floor(t.x),0,this.width-1),z:A(Math.floor(t.z),0,this.depth-1)};return a?{tile:{x:a.object.x,z:a.object.z},object:a.object,point:a.point,face:a.face,groundTile:e}:{tile:e,object:null,point:{x:t.x,y:i,z:t.z},groundTile:e}}}return a?{tile:{x:a.object.x,z:a.object.z},object:a.object,point:a.point,face:a.face,groundTile:null}:null}_objectFaceHit(e,t,n){let r=se(n),i=n.y??this.surfaceY(n.x,n.z),a=i+j(n),o=(n,i)=>{let a=e.x+t.x*n,o=e.z+t.z*n,s=a-r.x,c=o-r.z;return s*s+c*c<=i*i};if(t.y<-1e-6){let r=(a-e.y)/t.y;if(r>0&&o(r,oe(n,j(n))))return`top`}else if(t.y>D){let r=(i-e.y)/t.y;if(r>0&&o(r,oe(n,0)))return`bottom`}return`side`}_tileAt(e,t){return this._inBounds(e,t)?this.tiles[t][e]:null}_inBounds(e,t){return Number.isInteger(e)&&Number.isInteger(t)&&e>=0&&t>=0&&e<this.width&&t<this.depth}_worldPointInBounds(e,t){return e>=0&&t>=0&&e<=this.width&&t<=this.depth}_point(e){return{x:e.x,y:e.y??e.eyeY??0,z:e.z}}_pointInsideObject(e,t){let n=se(t),r=t.y??this.surfaceY(t.x,t.z);if(e.y<r-.02||e.y>r+j(t)+.02)return!1;let i=oe(t,e.y-r),a=e.x-n.x,o=e.z-n.z;return a*a+o*o<=i*i}},le=.1,ue=10,de=7,fe=Math.PI/6,pe=8,me=5,he=1.2,ge=Object.freeze({robot:`boulder`,boulder:`tree`}),_e=Math.PI/3,ve=Math.PI/12,ye=10,M=Object.freeze({tree:1.15,robot:2.16,sentry:1.7,sentinel:1.9,meanie:1.15}),be=new Set([`sentinel`,`sentry`]);function xe(e){return{x:e.x+.5,z:e.z+.5}}function Se(e,t){let n=(t-e)%(Math.PI*2);return n>Math.PI&&(n-=Math.PI*2),n<-Math.PI&&(n+=Math.PI*2),n}function Ce(e,t){return Math.atan2(t.x-e.x,t.z-e.z)}function we(e,t,n){let r=(Math.imul(e|0,73856093)^Math.imul(t|0,19349663)^Math.imul(n|0,83492791))>>>0;return r^=r>>>13,r=Math.imul(r,1540483477)>>>0,r^=r>>>15,(r>>>0)/4294967296}function Te(e,t){let n=e.x-t.x,r=e.z-t.z;return n*n+r*r}var Ee=class{constructor(e,t={}){this.world=e,this.energy=t.energy??10,this.status=`playing`,this.messages=[],this.events=[],this.scannedBySentinel=!1,this.scanState=0,this.playerShellId=null,this.pendingFacing=null,this.camera={x:t.x??0,z:t.z??0,eyeY:t.eyeY??e.surfaceY(t.x??0,t.z??0)+M.robot},this.facing=t.facing??0,this._accumulator=0,this._sentinelRotateTimer=0,this._sentinelDrainTimer=0,this._sentinelAbsorbed=!1,this._sentinelPedestal=null;let n=e.addObject({type:t.shellType??`robot`,x:this.camera.x,z:this.camera.z,energy:E.robot,facing:this.facing,controlled:!0});n&&(this.playerShellId=n.id,this.camera.eyeY=n.y+(M[n.type]??M.robot))}tick(e){if(this.status===`playing`)for(this._accumulator+=e;this._accumulator>=le&&this.status===`playing`;)this._accumulator-=le,this._step(le)}doAction(e,t=null){if(this.status!==`playing`)return!1;switch(e){case`absorb`:return this._absorb(t);case`tree`:case`boulder`:case`robot`:return this._create(e,t?.tile??null,t);case`transfer`:return this._transfer(t);case`hyperspace`:return this._hyperspace();case`uturn`:return this.facing=(this.facing+Math.PI)%(Math.PI*2),this._message(`U-turn`),this._event(`uturn`),!0;default:return this._message(`Unknown action: ${e}`),!1}}_step(e){this.scannedBySentinel=!1,this._runSentinel(e),this._runMeanies(e),this._runDissolve(e)}_runDissolve(e){let t=e/he;for(let e of this.world.objects)typeof e.dissolve==`number`&&e.dissolve<1&&(e.dissolve=Math.min(1,e.dissolve+t));let n=this.world.effects;for(let e=n.length-1;e>=0;--e)n[e].dissolve-=t,n[e].dissolve<=0&&n.splice(e,1)}_absorb(e){if(!e)return!1;if(this._sentinelAbsorbed)return this._message(`The landscape yields no more energy`),!1;let t=null;if(e.object){let n=e.object,r=this.world.objectsAt(n.x,n.z),i=r[r.length-1]??null;if(n!==i)return this._message(`Remove what is on top first`),!1;if(r.length===1){let t=e.groundTile;if(!t||t.x!==n.x||t.z!==n.z)return this._message(`Aim at the square the object stands on`),!1}t=i}else{let n=e.tile;if(!n)return!1;let r=this.world.objectsAt(n.x,n.z),i=r[r.length-1]??null;if(!i)return!1;if(r.length>1)return this._message(`Aim at the top of the stack`),!1;t=i}return!t||t.id===this.playerShellId?!1:t.type===`pedestal`?(this._message(`The pedestal cannot be absorbed`),!1):e.point||this._canSeeRestingSquare(t)?(this.energy+=E[t.type]??t.energy??0,t.type===`sentinel`&&(this._sentinelAbsorbed=!0,this._sentinelPedestal={x:t.x,z:t.z,y:t.y},this._message(`Sentinel absorbed`)),this.world.removeObject(t),this.world.effects.push({type:t.type,x:t.x,z:t.z,y:t.y,facing:t.facing??0,dissolve:1}),this._emitMotes(t.x,t.z,t.y??this.world.surfaceY(t.x,t.z),`absorb`),this._event(`absorb`),!0):(this._message(`Target square is not visible`),!1)}_create(e,t,n=null){let r=E[e];if(this.energy<r)return this._message(`Insufficient energy`),!1;let i=null;if(n&&n.object){let e=n.object,t=this.world.objectsAt(e.x,e.z);if(e!==(t[t.length-1]??null))return this._message(`Aim at the top of the stack`),!1;if(n.face!==`top`)return this._message(`Aim at the top face of the stack`),!1;i={x:e.x,z:e.z}}else{if(i=t??n?.tile??null,!i)return!1;if(this.world.objectsAt(i.x,i.z).length>0)return this._message(`Aim at the top of the stack`),!1}if(!(n?.point||this._canSeeTileTop(i.x,i.z)))return this._message(`Target square is not visible`),!1;let a=this.world.addObject({type:e,x:i.x,z:i.z,energy:r,dissolve:0});return a?(this.energy-=r,this._emitMotes(a.x,a.z,a.y??this.world.surfaceY(a.x,a.z),`create`),this._message(`Created ${e}`),this._event(`create`),!0):(this._message(`Cannot create object there`),!1)}_transfer(e){if(!e)return!1;let t=e.object??null;if(!t&&e.tile){let n=this.world.objectsAt(e.tile.x,e.tile.z);t=n[n.length-1]??null}if(!t||t.type!==`robot`||t.id===this.playerShellId)return!1;if(!this.world.isTopObject(t)||!(e.point||this._canSeeRestingSquare(t)))return this._message(`Transfer target is not visible`),!1;let n=this._playerShell();return n&&(n.energy=E.robot,n.controlled=!1,this.pendingFacing=Math.atan2(n.x-t.x,n.z-t.z)),t.controlled=!0,t.energy=Math.max(t.energy??0,E[t.type]??1),this.playerShellId=t.id,this.camera={x:t.x,z:t.z,eyeY:t.y+(M[t.type]??M.robot)},this.facing=t.facing??this.facing,this._sentinelAbsorbed&&this._sentinelPedestal&&t.x===this._sentinelPedestal.x&&t.z===this._sentinelPedestal.z?(this.status=`won`,this._message(`Landscape absorbed`),this._event(`won`),!0):(this._message(`Transferred`),this._event(`transfer`),!0)}_hyperspace(){if(this.energy<E.robot)return this._die(`Insufficient energy for hyperspace`),!1;this.energy-=E.robot;let e=this._playerBasePoint().y,t=this._randomFlatTileAtOrBelow(e);return t&&this._movePlayerTo(t.x,t.z),this._revertMeanies(),this._message(`Hyperspace`),this._event(`hyperspace`),!0}_revertMeanies(){for(let e of this.world.objects)e.type===`meanie`&&(e.type=`tree`,e.energy=E.tree,e.height=void 0,e.radius=void 0)}_runSentinel(e){this._meanieCooldown=Math.max(0,(this._meanieCooldown??0)-e);let t=0,n=this.world.objects.filter(e=>be.has(e.type)).sort((e,t)=>(e.type===`sentinel`)-+(t.type===`sentinel`));for(let r of n){r._rotT=(r._rotT??0)+e,r._rotT>=ue&&(r._rotT=0,r.facing=((r.facing??0)+Math.PI/6)%(Math.PI*2),this._event(`watcherTurn`,{x:r.x,z:r.z}),this._scanAndDrainObjects(r));let n=this._sentinelSees(r,this._playerBasePoint()),i=this._sentinelSees(r,this._playerHeadPoint());t=Math.max(t,n?2:+!!i),r._drainT=(r._drainT??0)+e,r._drainT>=de&&(r._drainT=0,n&&(this._drainPlayer(r.type),this._spawnTreeInFov(r))),!n&&i?r._meanieT=(r._meanieT??0)+e:r._meanieT=0;let a=this.world.objects.some(e=>e.type===`meanie`);r._meanieT>=me&&!a&&this._meanieCooldown===0&&(this._convertNearestTreeToMeanie(),this._meanieCooldown=pe,r._meanieT=0)}this.scannedBySentinel=t>0,this.scanState=t}_runMeanies(e){let t=this._playerHeadPoint();for(let n of[...this.world.objects.filter(e=>e.type===`meanie`)]){let r=xe(n);if(Te(r,t)>ye*ye){n.type=`tree`,n.energy=E.tree,n.height=void 0,n.radius=void 0;continue}let i=Ce(r,t),a=n.facing??0,o=Se(a,i);n.facing=a+Math.sign(o)*Math.min(Math.abs(o),_e*e),Math.abs(Se(n.facing,i))<=ve&&this.world.canSee(this._objectEye(n),t)&&(n.type=`tree`,n.energy=E.tree,n.height=void 0,n.radius=void 0,this._message(`Meanie forced hyperspace`),this._hyperspace())}}_emitMotes(e,t,n,r){let i=this.world.motes;if(!i)return;let a=e+.5,o=t+.5,s=.8,c=12+Math.floor(we(e,t,7)*5);for(let l=0;l<c;l+=1){let c=we(e,t,l)*Math.PI*2,u=.12+we(t,e,l)*.26,d=we(e+5,t+9,l),f=Math.cos(c),p=Math.sin(c);if(r===`absorb`)i.push({x:a+f*u*.5,y:n+.2+d*.4,z:o+p*u*.5,vx:f*(.15+d*.25),vy:.9+d*.7,vz:p*(.15+d*.25),g:.5,size:.05,mode:r,age:0,life:s});else{let e=n+1+d*.8,t=u+.35;i.push({x:a+f*t,y:e,z:o+p*t,vx:-f*t/s,vy:-(e-(n+.3))/s,vz:-p*t/s,g:0,size:.05,mode:r,age:0,life:s})}}}_drainPlayer(e){--this.energy,this._message(e===`sentry`?`A sentry drained energy`:`Sentinel drained energy`),this._event(`drain`),this.energy<0&&this._die(`Energy depleted`)}_sentinelSees(e,t){let n=xe(e),r=Se(e.facing??0,Ce(n,t));return Math.abs(r)>fe?!1:this.world.canSee(this._objectEye(e),t)}_scanAndDrainObjects(e){for(let t of[`robot`,`boulder`])for(let n of this.world.objects){if(n.type!==t||n.id===this.playerShellId||!this.world.isTopObject(n)||!this._sentinelSees(e,this._restingPoint(n)))continue;let{x:r,z:i}=n;this.world.removeObject(n),this.world.addObject({type:ge[t],x:r,z:i,dissolve:0}),this._spawnTreeInFov(e);return}}_spawnTreeInFov(e){let t=(e,t)=>this.world.objectsAt(e,t).length===0,n=this._randomTile((n,r,i)=>i.flat&&t(n,r)&&this.world.canPlace(`tree`,n,r)&&this._sentinelSees(e,{x:n+.5,z:r+.5,y:this.world.surfaceY(n,r)+.05}))??this._randomTile((e,n,r)=>r.flat&&t(e,n)&&this.world.canPlace(`tree`,e,n));n&&this.world.addObject({type:`tree`,x:n.x,z:n.z,dissolve:0})}_convertNearestTreeToMeanie(){let e=this._playerHeadPoint(),t=this.world.objects.filter(e=>e.type===`tree`).sort((t,n)=>Te(xe(t),e)-Te(xe(n),e))[0];t&&(t.type=`meanie`,t.energy=E.meanie,t.facing=Ce(xe(t),e)+Math.PI,this._message(`Tree became a meanie`),this._event(`meanie`))}_randomFlatTileAtOrBelow(e){return this._randomTile((t,n,r)=>{let i=this._playerShell()?.type??`robot`;return r.flat&&this.world.surfaceY(t,n)<=e&&this._canMoveShellTo(i,t,n)})}_randomTile(e){let t=[];for(let n=0;n<this.world.depth;n+=1)for(let r=0;r<this.world.width;r+=1){let i=this.world.tiles[n][r];e(r,n,i)&&t.push({x:r,z:n})}return t.length===0?null:t[Math.floor(Math.random()*t.length)]}_movePlayerTo(e,t){let n=this._playerShell();return n?(this.world.removeObject(n),this.world.canPlace(n.type,e,t)?(n.x=e,n.z=t,n.y=this.world.restingY(n.type,e,t),this.world.objects.push(n),this.camera={x:e,z:t,eyeY:n.y+(M[n.type]??M.robot)},!0):(this.world.objects.push(n),!1)):(this.camera={x:e,z:t,eyeY:this.world.surfaceY(e,t)+M.robot},!0)}_canMoveShellTo(e,t,n){let r=this._playerShell();if(!r)return this.world.canPlace(e,t,n);this.world.removeObject(r);let i=this.world.canPlace(e,t,n);return this.world.objects.push(r),i}_canSeeRestingSquare(e){return this.world.canSee(this._playerHeadPoint(),this._restingPoint(e))}_canSeeTileTop(e,t){return this.world.canSee(this._playerHeadPoint(),{x:e+.5,z:t+.5,y:this.world.topAt(e,t)+.05})}_restingPoint(e){return{...xe(e),y:(e.y??this.world.surfaceY(e.x,e.z))+.05}}_playerBasePoint(){let e=this._playerShell();return e?this._restingPoint(e):{x:this.camera.x+.5,z:this.camera.z+.5,y:this.world.surfaceY(this.camera.x,this.camera.z)+.05}}_playerHeadPoint(){return{x:this.camera.x+.5,z:this.camera.z+.5,y:this.camera.eyeY}}_objectEye(e){return{...xe(e),y:(e.y??this.world.surfaceY(e.x,e.z))+(M[e.type]??1.2)}}_playerShell(){return this.world.objects.find(e=>e.id===this.playerShellId)??null}_die(e){this.status=`dead`,this._message(e),this._event(`dead`)}_message(e){this.messages.push(e)}_event(e,t){this.events.push(t?{type:e,...t}:e)}},De=[34,58,156],Oe=[110,146,230],ke=[85,187,85],Ae=[61,139,61],je=(e,t)=>[Math.round(e[0]*t),Math.round(e[1]*t),Math.round(e[2]*t)],Me=.8,Ne=[{name:`Verdant`,skyTop:De,skyHorizon:Oe,tileA:ke,tileB:Ae},{name:`Steel`,skyTop:[178,102,34],skyHorizon:[236,182,96],tileA:[92,122,168],tileB:[58,86,130]},{name:`Magenta`,skyTop:[22,12,40],skyHorizon:[74,42,92],tileA:[192,62,152],tileB:[138,36,108]},{name:`Sand`,skyTop:[20,92,110],skyHorizon:[92,182,190],tileA:[224,208,158],tileB:[190,166,112]},{name:`Teal`,skyTop:[58,30,110],skyHorizon:[150,110,200],tileA:[58,182,176],tileB:[36,128,124]},{name:`Crimson`,skyTop:[202,180,176],skyHorizon:[240,226,216],tileA:[202,56,56],tileB:[148,32,40]},{name:`Ice`,skyTop:[12,20,60],skyHorizon:[42,72,132],tileA:[184,206,236],tileB:[116,150,210]},{name:`Sunset`,skyTop:[190,88,38],skyHorizon:[242,172,92],tileA:[142,136,60],tileB:[100,94,42]}].map((e,t)=>t===0?e:{name:e.name,skyTop:je(e.skyTop,Me),skyHorizon:je(e.skyHorizon,Me),tileA:je(e.tileA,Me),tileB:je(e.tileB,Me)}),Pe=0;function Fe(e){let t=Ne.length;return Pe=((e|0)%t+t)%t,Pe}var Ie=()=>Ne[Pe],N={treeLeaf:[46,139,51],treeTrunk:[107,73,42],boulder:[154,154,158],robot:[200,168,64],sentinel:[230,230,240],sentinelHood:[191,191,207],meanie:[200,48,48],pedestal:[134,128,114]},Le=S({x:-.35,y:1,z:-.28}),Re=.45,ze=.55;function Be(e,t){let n=Math.max(0,Math.min(1.25,t));return[Math.min(255,e[0]*n)|0,Math.min(255,e[1]*n)|0,Math.min(255,e[2]*n)|0]}var Ve=e=>`rgb(${e[0]},${e[1]},${e[2]})`;function He(e,t,n){return[Math.round(e[0]+(t[0]-e[0])*n),Math.round(e[1]+(t[1]-e[1])*n),Math.round(e[2]+(t[2]-e[2])*n)]}var Ue=.02,We=.5;function Ge(e,t=!1){let n=S(b(v(e[1],e[0]),v(e[2],e[0])));return t&&n.y<0&&(n={x:-n.x,y:-n.y,z:-n.z}),Re+ze*Math.max(0,y(n,Le))}function Ke(e,t){let n=Ie(),r=e.createLinearGradient(0,0,0,384);r.addColorStop(0,Ve(n.skyTop)),r.addColorStop(1,Ve(n.skyHorizon)),e.fillStyle=r,e.fillRect(0,0,512,384);let i=t?t.pitch:0,a=192+430*Math.tan(i),o=n.skyHorizon,s=Math.atan2(Le.x,Le.z)-(t?t.yaw:0);if(s=Math.atan2(Math.sin(s),Math.cos(s)),Math.abs(s)<1.4){let t=256+430*Math.tan(s),n=a-30,r=He(o,[255,244,214],.7);e.save(),e.fillStyle=Ve(o),e.globalAlpha=.09,e.beginPath(),e.arc(t,n,50,0,Math.PI*2),e.fill(),e.globalAlpha=.14,e.beginPath(),e.arc(t,n,30,0,Math.PI*2),e.fill(),e.globalAlpha=.95,e.fillStyle=Ve(r),e.beginPath(),e.arc(t,n,14,0,Math.PI*2),e.fill(),e.restore()}let c=a-46;if(a>0&&c<384){let t=e.createLinearGradient(0,c,0,a);t.addColorStop(0,`rgba(${o[0]},${o[1]},${o[2]},0)`),t.addColorStop(1,`rgba(${o[0]},${o[1]},${o[2]},0.5)`),e.fillStyle=t,e.fillRect(0,c,512,46)}e.globalAlpha=.06,e.fillStyle=`#ffffff`;for(let t=0;t<384;t+=24)e.fillRect(0,t,512,1);e.globalAlpha=1}function qe(e){let t=[],n=e.length;for(let r=0;r<n;r++){let i=e[r],a=e[(r+1)%n],o=i.z>=g,s=a.z>=g;if(o&&t.push(i),o!==s){let e=(g-i.z)/(a.z-i.z);t.push({x:i.x+(a.x-i.x)*e,y:i.y+(a.y-i.y)*e,z:g})}}return t}function Je(e){let t=0;for(let n=0;n<e.length;n++){let r=e[n],i=e[(n+1)%e.length];t+=r.x*i.y-i.x*r.y}return t/2}function Ye(e,t,n,r,i,a=null,o=`avg`,s=1){let c=Array(n.length);for(let e=0;e<n.length;e++)c[e]=t.toView(n[e]);let l=qe(c);if(l.length<3)return;let u=Array(l.length),d=0,f=-1/0;for(let e=0;e<l.length;e++)u[e]=w(l[e]),d+=l[e].z,l[e].z>f&&(f=l[e].z);if(d/=l.length,o===`max`&&(d=f),i&&Je(u)>0)return;let p=Ie().skyHorizon,m=Math.min(We,1-Math.exp(-d*Ue)),h=He(r,p,m),g=He(a||Be(r,.62),p,m);e.push({pts:u,depth:d,fill:Ve(h),stroke:Ve(g),alpha:s})}function Xe(e,t,n){return[e[0]+(t-e[0])*n,e[1]+(t-e[1])*n,e[2]+(t-e[2])*n]}function Ze(e,t,n,r,i=.35){let a=n.tiles,o=a.length,s=Ie(),c=s.tileA,l=s.tileB,u=r?r.x:-1,d=r?r.z:-1;for(let n=0;n<o;n++)for(let r=0;r<o;r++){let o=a[n][r],[s,f,p,m]=o.h,h={x:r,y:s*_,z:n},g={x:r+1,y:f*_,z:n},v={x:r+1,y:p*_,z:n+1},y={x:r,y:m*_,z:n+1},b;b=o.flat?r+n&1?c:l:[c[0]+l[0]>>1,c[1]+l[1]>>1,c[2]+l[2]>>1];let x=r===u&&n===d;x&&(b=Xe(b,255,i));let S=x?1.15:.62;s+p===f+m?Qe(e,t,[h,g,v,y],b,S):(Qe(e,t,[h,g,v],b,S),Qe(e,t,[h,v,y],b,S))}}function Qe(e,t,n,r,i){let a=Be(r,Ge(n,!0));Ye(e,t,n,a,!1,Be(a,i),`max`)}function $e(e,t,n,r,i,a,o){let s=e-r,c=e+r,l=t-i,u=t+i,d=n-a,f=n+a,p=[[s,l,d],[c,l,d],[c,u,d],[s,u,d],[s,l,f],[c,l,f],[c,u,f],[s,u,f]],m=(e,t,n,r)=>({v:[p[e],p[t],p[n],p[r]],c:o});return[m(0,3,2,1),m(5,6,7,4),m(4,7,3,0),m(1,2,6,5),m(3,7,6,2),m(4,0,1,5)]}function et(e,t,n,r,i){let a=[],o=[0,t,0],s=Array.from({length:r},(t,i)=>{let a=i/r*Math.PI*2;return[Math.cos(a)*n,e,Math.sin(a)*n]});for(let e=0;e<r;e++){let t=(e+1)%r;a.push({v:[s[e],s[t],o],c:i})}return a.push({v:[...s].reverse(),c:i,depthMode:`max`}),a}function tt(){let e=$e(0,.35,0,.09,.35,.09,N.treeTrunk),t=et(.55,3,.5,8,N.treeLeaf);return e.concat(t)}function nt(e,t,n,r,i){let a=Math.PI/8,o=(e,t)=>Array.from({length:8},(n,r)=>{let i=a+r/8*Math.PI*2;return[Math.cos(i)*t,e,Math.sin(i)*t]}),s=o(e,n),c=o(t,r),l=[];for(let e=0;e<8;e++){let t=(e+1)%8;l.push({v:[s[e],s[t],c[t],c[e]],c:i})}return l.push({v:[...c],c:i}),l.push({v:[...s].reverse(),c:i}),l}function rt(){return nt(0,1,.44,.36,N.boulder)}function it(e,t,n,r,i){let a=Math.PI/4,o=n*Math.SQRT2,s=r*Math.SQRT2,c=(e,t)=>Array.from({length:4},(n,r)=>{let i=a+r/4*Math.PI*2;return[Math.cos(i)*t,e,Math.sin(i)*t]}),l=c(e,o),u=c(t,s),d=[];for(let e=0;e<4;e++){let t=(e+1)%4;d.push({v:[l[e],l[t],u[t],u[e]],c:i})}return d.push({v:[...u],c:i}),d.push({v:[...l].reverse(),c:i}),d}function at(e,t){let n=(t,n,r,i,a)=>({v:[e[t],e[n],e[r],e[i]],c:a});return[n(0,3,2,1,t.front),n(5,6,7,4,t.back),n(4,7,3,0,t.left),n(1,2,6,5,t.right),n(3,7,6,2,t.top),n(4,0,1,5,t.bottom)]}function ot(e){let t=[];return t.push(...it(0,.9,.2,.13,e)),t.push(...it(.9,1.5,.13,.28,e)),t.push(...$e(0,1.575,0,.3,.075,.16,e)),t.push(...it(1.72,2,.12,.2,e)),t}function st(){return dt(ot(N.robot),1,1.2,1)}function ct(){let e=ot(N.meanie),t=N.meanie;return e.push({v:[[.28,1.62,0],[.6,1.8,0],[.6,1.52,0],[.28,1.4,0]],c:t}),e.push({v:[[-.28,1.4,0],[-.6,1.52,0],[-.6,1.8,0],[-.28,1.62,0]],c:t}),e}function lt(){let e=[],t=[22,24,46],n=[6,7,18];return e.push(...it(0,1.75,.26,.16,N.sentinel)),e.push(...$e(0,1.66,0,.22,.06,.14,N.sentinelHood)),e.push(...$e(0,1.96,0,.15,.15,.15,N.sentinelHood)),e.push(...at([[-.1,1.92,.12],[.1,1.92,.12],[.1,2.18,.12],[-.1,2.18,.12],[-.05,1.84,.46],[.05,1.84,.46],[.05,2,.46],[-.05,2,.46]],{front:N.sentinel,back:n,left:N.sentinelHood,right:N.sentinelHood,top:N.sentinel,bottom:t})),e}function ut(){let e=it(0,.55,.48,.38,N.pedestal),t=it(.55,1,.34,.28,N.pedestal);return e.concat(t)}function dt(e,t,n,r){return e.map(e=>({...e,v:e.v.map(([e,i,a])=>[e*t,i*n,a*r])}))}function ft(){return dt(lt(),.85,2/2.18,.85)}var pt={tree:tt(),boulder:rt(),robot:st(),meanie:ct(),sentinel:lt(),sentry:ft(),pedestal:ut()},mt=16,ht=.5;function gt(e){return(e&1)<<3|(e&2)<<1|(e&4)>>1|(e&8)>>3}function _t(e,t){let n=t.dsTop,r=t.dsBot,i=t.diss,a=r-n;if(!(a>0))return;let o=a/mt;e.beginPath();for(let t=0;t<mt;t+=1){let r=(t+.5)/mt,a=(gt(t)+.5)/mt;(1-r)*(1-ht)+a*ht<i&&e.rect(0,n+t*o,512,o+1)}e.clip()}var vt=[6,8,12];function yt(e,t,n,r,i,a,o){let s=Math.PI/8,c=i+.02,l=Array(8);for(let e=0;e<8;e++){let t=s+e/8*Math.PI*2;l[e]={x:n+Math.cos(t)*a,y:c,z:r+Math.sin(t)*a}}Ye(e,t,l,vt,!1,vt,`max`,o)}function bt(e,t,n,r){let i=pt[r.type];if(!i)return;let a=r.dissolve,o=typeof a==`number`&&a>0&&a<1,s=o?a:1,c;if(typeof r.y==`number`)c=r.y;else if(typeof n.surfaceY==`function`)c=n.surfaceY(r.x,r.z);else{let e=n.tiles[r.z][r.x];c=(e.h[0]+e.h[1]+e.h[2]+e.h[3])/4*_+(r.stackIndex||0)*1}let l=r.x+.5,u=r.z+.5,d=(r.radius??.35)*1.05;yt(e,t,l,u,c,d,.25*s);let f=r._displayFacing??r.rotY??r.facing??0,p=Math.cos(f),m=Math.sin(f),h=o?[]:e;for(let e of i){let n=Array(e.v.length),r=Ct(e.v,f);for(let t=0;t<e.v.length;t++){let r=e.v[t],i=p*r[0]+m*r[2],a=-m*r[0]+p*r[2];n[t]={x:l+i,y:c+r[1],z:u+a}}Ye(h,t,n,Be(e.c,r),!0,null,e.depthMode??`avg`)}if(o){let t=1/0,n=-1/0;for(let e of h)for(let r of e.pts)r.y<t&&(t=r.y),r.y>n&&(n=r.y);for(let r of h)r.diss=a,r.dsTop=t,r.dsBot=n,e.push(r)}}function xt(e,t,n,r=null){let i=n.objects||[];for(let a of i)r!==null&&a.id===r||a.dissolve!==void 0&&a.dissolve<=0||bt(e,t,n,a);let a=n.effects||[];for(let r of a)r.dissolve!==void 0&&r.dissolve<=0||bt(e,t,n,r)}function St(e,t,n){if(!n||n.length===0)return;let r=Ve(He(Ie().skyHorizon,[255,244,214],.78));for(let i of n){let n=i.age/i.life;if(n>=1||n<0)continue;let a=i.x+i.vx*i.age,o=i.y+i.vy*i.age-.5*i.g*i.age*i.age,s=i.z+i.vz*i.age,c=t.toView({x:a,y:o,z:s});if(c.z<=.05)continue;let l=w(c),u=i.mode===`absorb`?1-.55*n:1,d=i.size*430/c.z*u;d=d<1?1:d>3?3:d;let f=i.mode===`absorb`?Math.max(0,1-n*n):Math.min(1,2.2*(1-n));e.push({mote:!0,x:l.x,y:l.y,size:d,fill:r,alpha:f,depth:c.z})}}function Ct(e,t){let n={x:e[0][0],y:e[0][1],z:e[0][2]},r={x:e[1][0],y:e[1][1],z:e[1][2]},i={x:e[2][0],y:e[2][1],z:e[2][2]},a=S(b(v(r,n),v(i,n))),o=Math.cos(t),s=Math.sin(t),c={x:o*a.x+s*a.z,y:a.y,z:-s*a.x+o*a.z};return Re+ze*Math.max(0,y(c,Le))}function wt(e){if(!e||!e.object)return`neutral`;let t=e.object.type;return t===`sentinel`||t===`sentry`?`danger`:t===`tree`||t===`boulder`||t===`robot`||t===`meanie`?`interactive`:`neutral`}function Tt(e,t=256,n=192,r=`neutral`,i=.3){let a=Math.round(t),o=Math.round(n),s=`rgba(255,255,255,0.85)`,c=2,l=7;r===`interactive`?(s=`rgba(130,255,180,0.95)`,c=3,l=8):r===`danger`&&(s=`rgba(255,70,55,0.96)`,c=3+Math.round(i*6),l=c+6),e.strokeStyle=s,e.lineWidth=1,e.beginPath(),e.moveTo(a-l,o+.5),e.lineTo(a-c,o+.5),e.moveTo(a+c,o+.5),e.lineTo(a+l,o+.5),e.moveTo(a+.5,o-l),e.lineTo(a+.5,o-c),e.moveTo(a+.5,o+c),e.lineTo(a+.5,o+l),e.stroke()}function Et(e,t,n,r={}){Ke(e,n);let i=C(n),a=r.time??0,o=.25+.12*Math.sin(a*4),s=[];Ze(s,i,t,r.pickTile||null,o),xt(s,i,t,r.skipObjectId??null),St(s,i,t.motes),s.sort((e,t)=>t.depth-e.depth),e.lineJoin=`round`,e.lineWidth=1;for(let t of s){if(t.mote){if(t.alpha<=0)continue;e.globalAlpha=t.alpha,e.fillStyle=t.fill,e.fillRect(t.x-t.size*.5,t.y-t.size*.5,t.size,t.size),e.globalAlpha=1;continue}let n=t.pts,r=t.diss!==void 0;r?(e.save(),_t(e,t)):t.alpha!==1&&(e.globalAlpha=t.alpha),e.beginPath(),e.moveTo(n[0].x,n[0].y);for(let t=1;t<n.length;t++)e.lineTo(n[t].x,n[t].y);e.closePath(),e.fillStyle=t.fill,e.fill(),e.strokeStyle=t.stroke,e.stroke(),r?e.restore():t.alpha!==1&&(e.globalAlpha=1)}r.crosshair&&Tt(e,r.cursor?.x??256,r.cursor?.y??192,wt(r.pick),o)}var Dt=new Set([`KeyA`,`ArrowLeft`]),Ot=new Set([`KeyD`,`ArrowRight`]),kt=new Set([`KeyW`,`ArrowUp`]),At=new Set([`KeyS`,`ArrowDown`]),jt=new Set([`ShiftLeft`,`ShiftRight`]),Mt={Space:`absorb`,KeyT:`tree`,KeyB:`boulder`,KeyR:`robot`,KeyQ:`transfer`,KeyH:`hyperspace`,KeyE:`uturn`,KeyM:`mute`,Enter:`start`},Nt=new Set([...Dt,...Ot,...kt,...At,...jt,...Object.keys(Mt)]);function Pt(e=null){let t={yawLeft:!1,yawRight:!1,pitchUp:!1,pitchDown:!1,fast:!1},n={x:256,y:192};function r(t){let r=e.getBoundingClientRect(),i=e.width,a=e.height;n.x=Math.max(0,Math.min(i-1,(t.clientX-r.left)*(i/r.width))),n.y=Math.max(0,Math.min(a-1,(t.clientY-r.top)*(a/r.height)))}e&&e.addEventListener(`mousemove`,r);function i(e){e.button===0&&(e.preventDefault(),o.push(`absorb`))}function a(e){e.preventDefault()}e&&(e.addEventListener(`mousedown`,i),e.addEventListener(`contextmenu`,a));let o=[],s=new Set;function c(e,n){Dt.has(e)&&(t.yawLeft=n),Ot.has(e)&&(t.yawRight=n),kt.has(e)&&(t.pitchUp=n),At.has(e)&&(t.pitchDown=n),jt.has(e)&&(t.fast=n)}function l(e){let t=e.code;Nt.has(t)&&e.preventDefault(),c(t,!0);let n=Mt[t];n&&(s.has(t)||(s.add(t),o.push(n)))}function u(e){let t=e.code;Nt.has(t)&&e.preventDefault(),c(t,!1),s.delete(t)}function d(){t.yawLeft=!1,t.yawRight=!1,t.pitchUp=!1,t.pitchDown=!1,t.fast=!1,s.clear()}window.addEventListener(`keydown`,l),window.addEventListener(`keyup`,u),window.addEventListener(`blur`,d);function f(){let e=o;return o=[],e}function p(){window.removeEventListener(`keydown`,l),window.removeEventListener(`keyup`,u),window.removeEventListener(`blur`,d),e&&(e.removeEventListener(`mousemove`,r),e.removeEventListener(`mousedown`,i),e.removeEventListener(`contextmenu`,a))}return{held:t,cursor:n,pollActions:f,destroy:p}}var Ft=`sentinel-hud-style`,It=`
#overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: "Courier New", Courier, monospace;
  color: #cfffd6;
}

/* ---------- energy icon row ---------- */
.hud-energy {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: 70%;
}

.hud-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 13px;
  line-height: 1;
  border-radius: 2px;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
}

.hud-icon.robot { color: #d9a441; }   /* ochre */
.hud-icon.boulder { color: #9aa0a6; } /* grey */
.hud-icon.tree { color: #4fbf5a; }    /* green */

.hud-energy-count {
  margin-left: 6px;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #9fffb0;
  text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

.hud-energy.low .hud-energy-count {
  color: #ff6b5c;
  animation: hud-low-pulse 0.9s infinite;
}

@keyframes hud-low-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ---------- watcher indicator row (top-right, mirrors energy row) ---------- */
.hud-watchers {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  max-width: 70%;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(140, 200, 255, 0.35);
}

.hud-watch-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cfe8ff;
  text-shadow: 0 0 4px rgba(120, 190, 255, 0.6), 0 0 3px rgba(0,0,0,0.8);
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
  line-height: 1;
}

.hud-watch-icon.sentinel {
  width: 22px;
  height: 22px;
  font-size: 19px;
}

.hud-watch-icon.sentry {
  width: 17px;
  height: 17px;
  font-size: 14px;
  opacity: 0.9;
}

.hud-watchers-clear {
  margin-right: 6px;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #4a6a55;
  text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

/* ---------- transient bottom-center message ---------- */
.hud-message {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  padding: 6px 14px;
  background: rgba(6, 16, 8, 0.75);
  border: 1px solid #3a6a42;
  color: #d7ffde;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.hud-message.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ---------- scan-state indicator (top-center) ---------- */
.hud-scan-indicator {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  background: rgba(6, 16, 8, 0.75);
  border: 1px solid #3a6a42;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #2f6b3a;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
}

.hud-scan-indicator.state-0 {
  color: #3f8f4d;
  border-color: #2f5a37;
}

.hud-scan-indicator.state-1 {
  color: #e6b93d;
  border-color: #8a6a1e;
  animation: hud-indicator-pulse-mild 1.6s ease-in-out infinite;
}

.hud-scan-indicator.state-2 {
  color: #ff4b3c;
  border-color: #8a1e1e;
  animation: hud-indicator-pulse-strong 0.5s ease-in-out infinite;
}

@keyframes hud-indicator-pulse-mild {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes hud-indicator-pulse-strong {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ---------- scanned-by-sentinel vignette ---------- */
.hud-scan-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  box-shadow: inset 0 0 0 0 rgba(255, 30, 30, 0);
  transition: opacity 0.2s ease;
}

.hud-scan-vignette.mild {
  opacity: 1;
  box-shadow: inset 0 0 30px 6px rgba(230, 185, 61, 0.18);
  animation: hud-scan-pulse-mild 1.6s ease-in-out infinite;
}

.hud-scan-vignette.active {
  opacity: 1;
  animation: hud-scan-pulse 1.1s ease-in-out infinite;
}

@keyframes hud-scan-pulse-mild {
  0%   { box-shadow: inset 0 0 24px 4px rgba(230, 185, 61, 0.12); }
  50%  { box-shadow: inset 0 0 44px 10px rgba(230, 185, 61, 0.28); }
  100% { box-shadow: inset 0 0 24px 4px rgba(230, 185, 61, 0.12); }
}

@keyframes hud-scan-pulse {
  0%   { box-shadow: inset 0 0 40px 8px rgba(255, 30, 30, 0.25), inset 0 0 0 4px rgba(255, 30, 30, 0.35); }
  50%  { box-shadow: inset 0 0 90px 24px rgba(255, 30, 30, 0.65), inset 0 0 0 6px rgba(255, 30, 30, 0.8); }
  100% { box-shadow: inset 0 0 40px 8px rgba(255, 30, 30, 0.25), inset 0 0 0 4px rgba(255, 30, 30, 0.35); }
}

/* ---------- hyperspace / transfer flash ---------- */
.hud-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center,
    rgba(233, 255, 238, 0.95) 0%,
    rgba(190, 255, 205, 0.85) 55%,
    rgba(150, 240, 175, 0.7) 100%);
  opacity: 0;
  will-change: opacity;
}

/* ---------- full-canvas screens (title / won / dead) ---------- */
.hud-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: rgba(2, 6, 3, 0.88);
  text-align: center;
}

.hud-screen-title {
  font-size: 34px;
  letter-spacing: 0.18em;
  color: #9fffb0;
  text-shadow: 0 0 12px rgba(120, 255, 140, 0.6);
}

.hud-screen-sub {
  font-size: 14px;
  letter-spacing: 0.12em;
  color: #d7ffde;
  animation: hud-blink 1.2s steps(1) infinite;
}

.hud-screen-info {
  font-size: 13px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
  margin: 2px 0;
}

.hud-screen.won .hud-screen-title { color: #9fffb0; }
.hud-screen.complete .hud-screen-title { color: #ffe08a; text-shadow: 0 0 14px rgba(255, 220, 120, 0.6); }
.hud-screen.dead .hud-screen-title { color: #ff6b5c; text-shadow: 0 0 12px rgba(255, 60, 40, 0.65); }

@keyframes hud-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.15; }
}

/* ---------- splash / menu / code screens ---------- */
/* These screens are interactive (menu clicks, splash "click anywhere"),
   so they opt back into pointer events that #overlay switches off. */
.hud-screen.splash,
.hud-screen.menu,
.hud-screen.code,
.hud-screen.settings {
  pointer-events: auto;
  cursor: default;
}

.hud-screen-title.big {
  font-size: 42px;
  letter-spacing: 0.22em;
}

.hud-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}

.hud-menu-option {
  font-size: 18px;
  letter-spacing: 0.16em;
  color: #4f8a5a;
  padding: 4px 22px;
  border: 1px solid transparent;
  cursor: pointer;
}

.hud-menu-option.selected {
  color: #cfffd6;
  border-color: #3a6a42;
  text-shadow: 0 0 10px rgba(120, 255, 140, 0.6);
}

.hud-menu-option.selected::before { content: "> "; }
.hud-menu-option.selected::after { content: " <"; }

.hud-code-value {
  font-size: 32px;
  letter-spacing: 0.3em;
  color: #9fffb0;
  text-shadow: 0 0 12px rgba(120, 255, 140, 0.5);
  margin: 4px 0;
}

.hud-code-hint {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
}

.hud-code-error {
  font-size: 13px;
  letter-spacing: 0.14em;
  color: #ff6b5c;
  text-shadow: 0 0 8px rgba(255, 60, 40, 0.5);
  min-height: 1.1em;
}

.hud-screen-footer {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  font-size: 11px;
  line-height: 1.7;
  letter-spacing: 0.12em;
  color: #4f8a5a;
}

/* ---------- settings (volumes) screen ---------- */
.hud-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 10px 0 4px;
  width: 300px;
  max-width: 78%;
}

.hud-setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 1px solid transparent;
  color: #4f8a5a;
}

.hud-setting-row.selected {
  color: #cfffd6;
  border-color: #3a6a42;
  text-shadow: 0 0 10px rgba(120, 255, 140, 0.5);
}

.hud-setting-label {
  flex: 0 0 84px;
  font-size: 14px;
  letter-spacing: 0.14em;
  text-align: left;
}

.hud-setting-track {
  position: relative;
  flex: 1 1 auto;
  height: 12px;
  border: 1px solid #3a6a42;
  background: #0c1a0e;
  cursor: pointer;
  pointer-events: auto;
}

.hud-setting-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: #2f6b3a;
}

.hud-setting-row.selected .hud-setting-fill {
  background: #4fbf5a;
  box-shadow: 0 0 8px rgba(120, 255, 140, 0.4);
}

.hud-setting-value {
  flex: 0 0 46px;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-align: right;
}

.hud-settings-hint {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
  margin-top: 6px;
}

/* ---------- screen-transition fader (black wipe) ---------- */
.hud-fader {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease;
}

/* ---------- level intro title ("LANDSCAPE NNNN") ---------- */
/* Big centred CRT title that rises in, holds, then drifts up and fades. Matches
   the green phosphor look of the end screens. Removed on animationend. */
.hud-intro-title {
  position: absolute;
  top: 30%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 40px;
  letter-spacing: 0.24em;
  color: #9fffb0;
  text-shadow: 0 0 16px rgba(120, 255, 140, 0.7), 0 0 4px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  opacity: 0;
  will-change: transform, opacity;
  animation: hud-intro 2.2s ease forwards;
}

@keyframes hud-intro {
  0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
  16%  { opacity: 1; transform: translateY(0) scale(1); }
  68%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-42px) scale(1.03); }
}

/* ---------- energy tick feedback (drain / gain) ---------- */
.hud-energy.drain { animation: hud-energy-drain 0.3s ease; }
.hud-energy.gain  { animation: hud-energy-gain 0.3s ease; }

@keyframes hud-energy-drain {
  0%   { filter: none; }
  25%  { filter: brightness(1.35) drop-shadow(0 0 6px rgba(255, 64, 48, 0.95)); }
  100% { filter: none; }
}

@keyframes hud-energy-gain {
  0%   { transform: scale(1); filter: none; }
  40%  { transform: scale(1.16); filter: drop-shadow(0 0 6px rgba(120, 255, 150, 0.9)); }
  100% { transform: scale(1); filter: none; }
}
`;function Lt(){if(document.getElementById(Ft))return;let e=document.createElement(`style`);e.id=Ft,e.textContent=It,document.head.appendChild(e)}var Rt={robot:`■`,boulder:`●`,tree:`▲`},zt={sentinel:`◉`,sentry:`◈`},Bt={0:`UNSEEN`,1:`SEEN`,2:`DRAINING`},Vt={title:{title:`THE SENTINEL`,sub:`PRESS ENTER`},won:{title:`LANDSCAPE ABSORBED`,sub:`PRESS ENTER`},dead:{title:`ABSORBED BY THE SENTINEL`,sub:`PRESS ENTER`},complete:{title:`ALL LANDSCAPES ABSORBED`,sub:`PRESS ENTER`}},Ht=[`BASED ON THE SENTINEL BY GEOFF CRAMMOND`,`EKLEKTIK LABS 2026`],Ut=[`START GAME`,`ENTER CODE`,`SETTINGS`],Wt=[{key:`master`,label:`MASTER`},{key:`music`,label:`MUSIC`},{key:`effects`,label:`EFFECTS`}];function Gt(e){Lt(),e.innerHTML=``;let t=document.createElement(`div`);t.className=`hud-energy`,e.appendChild(t);let n=document.createElement(`div`);n.className=`hud-watchers`,e.appendChild(n);let r=document.createElement(`div`);r.className=`hud-message`,e.appendChild(r);let i=document.createElement(`div`);i.className=`hud-scan-indicator state-0`,i.textContent=Bt[0],e.appendChild(i);let a=document.createElement(`div`);a.className=`hud-scan-vignette`,e.appendChild(a);let o=document.createElement(`div`);o.className=`hud-flash`,e.appendChild(o);let s=document.createElement(`div`);s.className=`hud-screen`,s.style.display=`none`,e.appendChild(s);let c=document.createElement(`div`);c.className=`hud-fader`,e.appendChild(c);let l=null,u=null,d=0,f=null,p=null,m=null,h=null;function g(e,n={}){if(t.innerHTML=``,t.classList.toggle(`low`,e<=3&&e>=0),!n.silent&&m!==null&&e!==m){let n=e<m?`drain`:`gain`;t.classList.remove(`drain`,`gain`),t.offsetWidth,t.classList.add(n),h&&clearTimeout(h),h=setTimeout(()=>t.classList.remove(`drain`,`gain`),320)}m=e;let r=Math.max(0,Math.floor(e)),i=Math.floor(r/3);r-=i*3;let a=Math.floor(r/2);r-=a*2;let o=r,s=document.createDocumentFragment();for(let e=0;e<i;e++)s.appendChild(_(`robot`));for(let e=0;e<a;e++)s.appendChild(_(`boulder`));for(let e=0;e<o;e++)s.appendChild(_(`tree`));t.appendChild(s);let c=document.createElement(`span`);c.className=`hud-energy-count`,c.textContent=String(e),t.appendChild(c)}function _(e){let t=document.createElement(`span`);return t.className=`hud-icon ${e}`,t.textContent=Rt[e],t}function v(e,t){let r=!!e,i=Math.max(0,Math.min(3,Math.floor(t)||0));if(r===f&&i===p)return;if(f=r,p=i,n.innerHTML=``,!r&&i===0){let e=document.createElement(`span`);e.className=`hud-watchers-clear`,e.textContent=`CLEAR`,n.appendChild(e);return}let a=document.createDocumentFragment();r&&a.appendChild(y(`sentinel`));for(let e=0;e<i;e++)a.appendChild(y(`sentry`));n.appendChild(a)}function y(e){let t=document.createElement(`span`);return t.className=`hud-watch-icon ${e}`,t.textContent=zt[e],t}function b(e,t=2e3){l&&=(clearTimeout(l),null),r.textContent=e,r.offsetWidth,r.classList.add(`visible`),l=setTimeout(()=>{r.classList.remove(`visible`),l=null},t)}function x(e){e!==d&&(d=e,i.className=`hud-scan-indicator state-${e}`,i.textContent=Bt[e]??Bt[0],a.classList.toggle(`mild`,e===1),a.classList.toggle(`active`,e===2))}function S(e){x(e?2:0)}function C(e=`hyperspace`){let t=e!==`transfer`,n=t?.85:.42,r=t?400:280;u&&=(clearTimeout(u),null),o.style.transition=`opacity 120ms ease-out`,o.style.opacity=String(n),u=setTimeout(()=>{o.style.transition=`opacity ${r}ms ease-out`,o.style.opacity=`0`,u=null},120)}function w(e,t=[]){if(!e){s.style.display=`none`,s.className=`hud-screen`,s.innerHTML=``;return}let n=Vt[e];if(!n){s.style.display=`none`;return}s.className=`hud-screen ${e}`,s.innerHTML=``;let r=document.createElement(`div`);r.className=`hud-screen-title`,r.textContent=n.title,s.appendChild(r);for(let e of t){let t=document.createElement(`div`);t.className=`hud-screen-info`,t.textContent=e,s.appendChild(t)}let i=document.createElement(`div`);i.className=`hud-screen-sub`,i.textContent=n.sub,s.appendChild(i),s.style.display=`flex`}function T(e,t){let n=document.createElement(`div`);return n.className=e,t!=null&&(n.textContent=t),n}function E(){let e=T(`hud-screen-footer`);for(let t of Ht)e.appendChild(T(null,t));s.appendChild(e)}function D(){s.className=`hud-screen splash`,s.innerHTML=``;let e=T(`hud-screen-title big`,`SENTINEL REMAKE`);s.appendChild(e),s.appendChild(T(`hud-screen-sub`,`PRESS ENTER`)),E(),s.style.display=`flex`}function ee(e=0){s.className=`hud-screen menu`,s.innerHTML=``,s.appendChild(T(`hud-screen-title big`,`SENTINEL REMAKE`));let t=T(`hud-menu`);Ut.forEach((n,r)=>{let i=T(`hud-menu-option${r===e?` selected`:``}`,n);i.dataset.index=String(r),t.appendChild(i)}),s.appendChild(t),E(),s.style.display=`flex`}function te(e,t=``){s.className=`hud-screen code`,s.innerHTML=``,s.appendChild(T(`hud-screen-title`,`ENTER CODE`)),s.appendChild(T(`hud-code-value`,e)),s.appendChild(T(`hud-code-hint`,`DIGITS TO TYPE · BACKSPACE · ENTER CONFIRM · ESC BACK`)),s.appendChild(T(`hud-code-error`,t)),E(),s.style.display=`flex`}let O=[];function ne(e,t=0){s.className=`hud-screen settings`,s.innerHTML=``,s.appendChild(T(`hud-screen-title`,`SETTINGS`));let n=T(`hud-settings`);O=[],Wt.forEach((r,i)=>{let a=T(`hud-setting-row${i===t?` selected`:``}`);a.dataset.key=r.key,a.dataset.index=String(i);let o=T(`hud-setting-label`,r.label),s=T(`hud-setting-track`);s.dataset.key=r.key,s.dataset.index=String(i);let c=T(`hud-setting-fill`);s.appendChild(c);let l=T(`hud-setting-value`);a.appendChild(o),a.appendChild(s),a.appendChild(l),n.appendChild(a),O[i]={row:a,fill:c,value:l},k(i,e[r.key]??0)}),s.appendChild(n),s.appendChild(T(`hud-settings-hint`,`↑↓ SELECT · ←→ ADJUST · DRAG · ESC BACK`)),s.style.display=`flex`}function k(e,t){let n=O[e];if(!n)return;let r=Math.max(0,Math.min(100,Math.round(t)));n.fill.style.width=`${r}%`,n.value.textContent=`${r}%`}function A(e){O.forEach((t,n)=>{t&&t.row.classList.toggle(`selected`,n===e)})}function re(e=300,t){c.style.transition=`opacity ${e}ms ease`,c.offsetWidth,c.style.opacity=`1`,t&&setTimeout(t,e)}function ie(e=300,t){c.style.transition=`opacity ${e}ms ease`,c.offsetWidth,c.style.opacity=`0`,t&&setTimeout(t,e)}function j(t){let n=document.createElement(`div`);n.className=`hud-intro-title`,n.textContent=t,e.appendChild(n);let r=()=>{n.parentNode&&n.parentNode.removeChild(n)};n.addEventListener(`animationend`,r),setTimeout(r,2600)}return{setEnergy:g,showMessage:b,setScanState:x,setScanned:S,setWatchers:v,flash:C,showScreen:w,showSplash:D,showMenu:ee,showCode:te,showSettings:ne,setSettingValue:k,setSettingSelection:A,fadeOut:re,fadeIn:ie,showIntroTitle:j,menuOptionCount:Ut.length}}var Kt=1;function qt(){let e=null,t=null,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null,u=null,d=!1,f={active:!1,scan:0},p={master:100,music:100,effects:100},m=!1;function h(e){return e=Number(e),Number.isFinite(e)?Math.max(0,Math.min(100,e)):100}function g(){t&&(t.gain.value=m?0:Kt*p.master/100),n&&(n.gain.value=p.effects/100),i&&(i.gain.value=p.music/100)}function _(){try{if(!e){let o=window.AudioContext||window.webkitAudioContext;if(!o)return;e=new o,a=e.createDynamicsCompressor(),a.threshold.value=-6,a.knee.value=6,a.ratio.value=12,a.attack.value=.003,a.release.value=.25,a.connect(e.destination),t=e.createGain(),t.connect(a),n=e.createGain(),n.connect(t),r=e.createGain(),r.connect(t),i=e.createGain(),i.connect(t);let s=e.createConvolver();s.buffer=Zt(e,2);let c=e.createGain();c.gain.value=.15,n.connect(s),s.connect(c),c.connect(t),g()}e.state===`suspended`&&e.resume().catch(()=>{})}catch{}}function v(t,i){if(!e||!n)return;let a=_n[t];if(!a)return;let o=vn.has(t)?r:n;if(!o)return;let s=o,c=i&&i.gain;if(c!=null){if(c<=0)return;if(c!==1){let t=e.createGain();t.gain.value=c,t.connect(o),s=t}}try{a(e,s)}catch{}}function y(){if(d||!e||!t)return;o=e.createGain(),o.gain.value=1,o.connect(t);let n=e.createBufferSource();n.buffer=Xt(e,4),n.loop=!0;let r=e.createBiquadFilter();r.type=`lowpass`,r.frequency.value=400,r.Q.value=.7;let i=e.createGain();i.gain.value=1e-4;let a=e.createOscillator();a.type=`sine`,a.frequency.value=.08;let f=e.createGain();f.gain.value=120,a.connect(f),f.connect(r.frequency),n.connect(r),r.connect(i),i.connect(o),n.start(),a.start(),s=r,c=i,l=a,u=f,d=!0}function b(t,n=0){if(!e||(t=!!t,n=t?n|0:0,f.active===t&&f.scan===n)||(f={active:t,scan:n},y(),!c))return;let r=e.currentTime,i,a,o,d;t?n>=2?(i=.11,a=900,o=.18,d=260):n===1?(i=.075,a=600,o=.12,d=180):(i=.05,a=400,o=.08,d=120):(i=0,a=300,o=.06,d=80),c.gain.setTargetAtTime(i,r,.8),s.frequency.setTargetAtTime(a,r,.8),l.frequency.setTargetAtTime(o,r,1.5),u.gain.setTargetAtTime(d,r,1.5)}function x(){return{unlocked:!!e,ctxState:e?e.state:`none`,muted:m,ambientBuilt:d,ambientActive:f.active,ambientScan:f.scan,ambientGain:c?c.gain.value:0}}function S(e){e&&(e.master!==void 0&&(p.master=h(e.master)),e.music!==void 0&&(p.music=h(e.music)),e.effects!==void 0&&(p.effects=h(e.effects)),g())}function C(e){return m=!!e,g(),m}function w(){return C(!m)}function T(){return m}function E(){return e}function D(){return i}return{unlock:_,play:v,setAmbient:b,debug:x,context:E,musicBus:D,setVolumes:S,setMuted:C,toggleMuted:w,isMuted:T}}function P(e){return e.currentTime}var Jt=new WeakMap;function Yt(e,t=.1){let n=Jt.get(e);if(n||(n=new Map,Jt.set(e,n)),!n.has(t)){let r=new Float32Array(32),i=new Float32Array(32);for(let e=1;e<32;e++)i[e]=2/(e*Math.PI)*Math.sin(e*Math.PI*t);n.set(t,e.createPeriodicWave(r,i))}return n.get(t)}function F(e,t,{type:n=`sine`,freq:r=440,start:i=0,dur:a=.2,duty:o=.1}){let s=e.createOscillator();n===`pulse`?s.setPeriodicWave(Yt(e,o)):s.type=n;let c=P(e)+i;s.frequency.setValueAtTime(r,c);let l=e.createGain();return l.gain.setValueAtTime(1e-4,c),s.connect(l),l.connect(t),s.start(c),s.stop(c+a+.05),{osc:s,gain:l,t0:c}}function I(e,t,{peak:n=1,attack:r=.01,dur:i=.2}){let a=e.gain;a.cancelScheduledValues(t),a.setValueAtTime(1e-4,t),a.exponentialRampToValueAtTime(n,t+r),a.exponentialRampToValueAtTime(1e-4,t+i)}function L(e,t,n,r,i){e.frequency.setValueAtTime(n,t),e.frequency.exponentialRampToValueAtTime(Math.max(1,r),t+i)}function Xt(e,t){let n=e.sampleRate,r=Math.max(1,Math.floor(n*t)),i=e.createBuffer(1,r,n),a=i.getChannelData(0);for(let e=0;e<r;e++)a[e]=Math.random()*2-1;return i}function Zt(e,t){let n=e.sampleRate,r=Math.max(1,Math.floor(n*t)),i=e.createBuffer(2,r,n);for(let e=0;e<2;e++){let t=i.getChannelData(e);for(let e=0;e<r;e++){let n=(1-e/r)**3;t[e]=(Math.random()*2-1)*n}}return i}function Qt(e,t,n,{filterType:r=`lowpass`,filterFreq:i=2e3}={}){let a=e.createBufferSource();a.buffer=Xt(e,n);let o=e.createBiquadFilter();o.type=r,o.frequency.value=i;let s=e.createGain();return s.gain.setValueAtTime(1e-4,P(e)),a.connect(o),o.connect(s),s.connect(t),{src:a,filter:o,gain:s}}function $t(e,t,{dur:n=1.2,base:r=70,peak:i=.25}={}){let a=P(e),{gain:o}=F(e,t,{type:`pulse`,duty:.15,freq:r,dur:n});I(o,a,{peak:i,attack:.08,dur:n});let{gain:s}=F(e,t,{type:`pulse`,duty:.1,freq:r*1.02,dur:n});I(s,a,{peak:i*.7,attack:.08,dur:n});let c=e.createOscillator();c.type=`square`,c.frequency.value=26;let l=e.createGain();l.gain.value=i*.5,c.connect(l),l.connect(o.gain),c.start(a),c.stop(a+n+.05)}function en(e,t){let n=.6,r=P(e),{osc:i,gain:a}=F(e,t,{type:`pulse`,freq:380,dur:n});L(i,r,380,110,n),I(a,r,{peak:.7,attack:.08,dur:n});let{osc:o,gain:s}=F(e,t,{type:`pulse`,freq:190,dur:n});L(o,r,190,70,n),I(s,r,{peak:.45,attack:.08,dur:n}),$t(e,t,{base:62})}function tn(e,t){let n=.5,r=P(e),{osc:i,gain:a}=F(e,t,{type:`pulse`,freq:110,dur:n});L(i,r,110,380,n),I(a,r,{peak:.7,attack:.08,dur:n});let{osc:o,gain:s}=F(e,t,{type:`pulse`,freq:70,dur:n});L(o,r,70,190,n),I(s,r,{peak:.45,attack:.08,dur:n}),$t(e,t,{base:78})}function nn(e,t){let n=P(e);[330,415,494,660].forEach((r,i)=>{let a=i*.09,{osc:o,gain:s}=F(e,t,{type:`triangle`,freq:r,start:a,dur:.12});I(s,n+a,{peak:.7,attack:.005,dur:.12})})}function rn(e,t){let n=.9,r=P(e),{src:i,gain:a}=Qt(e,t,n,{filterType:`bandpass`,filterFreq:2200});i.playbackRate.value=1,a.gain.setValueAtTime(1e-4,r),a.gain.exponentialRampToValueAtTime(.8,r+.05),a.gain.exponentialRampToValueAtTime(1e-4,r+n),i.start(r),i.stop(r+n+.05);let{osc:o,gain:s}=F(e,t,{type:`sawtooth`,freq:1200,dur:n});L(o,r,1200,60,n),I(s,r,{peak:.4,attack:.02,dur:n})}function an(e,t){let n=P(e),r=.4/3;for(let i=0;i<3;i++){let a=i*r,{gain:o}=F(e,t,{type:`square`,freq:70,start:a,dur:r*.8});I(o,n+a,{peak:.8,attack:.005,dur:r*.8})}}function on(e,t){let n=.2,r=P(e),{osc:i,gain:a}=F(e,t,{type:`square`,freq:880,dur:n});L(i,r,880,1100,n),I(a,r,{peak:.5,attack:.005,dur:n})}function sn(e,t){let n=P(e),{gain:r}=F(e,t,{type:`square`,freq:1e3,dur:.15});I(r,n,{peak:.7,attack:.003,dur:.15});let{gain:i}=F(e,t,{type:`square`,freq:600,start:.15,dur:.2});I(i,n+.15,{peak:.7,attack:.003,dur:.2})}function cn(e,t){let n=.4,r=P(e),{gain:i}=F(e,t,{type:`sawtooth`,freq:220,dur:n});I(i,r,{peak:.7,attack:.005,dur:n});let{gain:a}=F(e,t,{type:`square`,freq:233,dur:n});I(a,r,{peak:.6,attack:.005,dur:n})}function ln(e,t){let n=.1,r=P(e),{osc:i,gain:a}=F(e,t,{type:`square`,freq:1400,dur:n});L(i,r,1400,900,n),I(a,r,{peak:.4,attack:.002,dur:n})}function un(e,t){let n=P(e),r=[523,659,784,1047];r.forEach((i,a)=>{let o=a*.22,s=a===r.length-1?.5:.24,{gain:c}=F(e,t,{type:`triangle`,freq:i,start:o,dur:s});I(c,n+o,{peak:.8,attack:.01,dur:s})})}function dn(e,t){let n=1.2,r=P(e),{osc:i,gain:a}=F(e,t,{type:`sawtooth`,freq:500,dur:n});L(i,r,500,40,n),I(a,r,{peak:.8,attack:.02,dur:n});let{osc:o,gain:s}=F(e,t,{type:`square`,freq:250,dur:n});L(o,r,250,30,n),I(s,r,{peak:.5,attack:.02,dur:n})}function fn(e,t){let n=.03,r=P(e),{gain:i}=F(e,t,{type:`triangle`,freq:1200,dur:n});I(i,r,{peak:.09,attack:.003,dur:n})}function pn(e,t){let n=P(e),{gain:r}=F(e,t,{type:`triangle`,freq:880,dur:.06});I(r,n,{peak:.11,attack:.003,dur:.06});let{gain:i}=F(e,t,{type:`triangle`,freq:1320,start:.05,dur:.09});I(i,n+.05,{peak:.12,attack:.003,dur:.09})}function mn(e,t){let n=.022,r=P(e),{gain:i}=F(e,t,{type:`triangle`,freq:700,dur:n});I(i,r,{peak:.07,attack:.002,dur:n})}function hn(e,t){let n=.18,r=P(e),{osc:i,gain:a}=F(e,t,{type:`sawtooth`,freq:150,dur:n});L(i,r,150,90,n),I(a,r,{peak:.16,attack:.004,dur:n})}function gn(e,t){let n=.09,r=P(e),{src:i,gain:a}=Qt(e,t,n,{filterType:`bandpass`,filterFreq:480});a.gain.setValueAtTime(1e-4,r),a.gain.exponentialRampToValueAtTime(.5,r+.006),a.gain.exponentialRampToValueAtTime(1e-4,r+n),i.start(r),i.stop(r+n+.05);let{gain:o}=F(e,t,{type:`square`,freq:95,dur:.07});I(o,r,{peak:.35,attack:.004,dur:.07})}var _n={absorb:en,create:tn,transfer:nn,hyperspace:rn,drain:an,seen:on,draining:sn,meanie:cn,uturn:ln,won:un,dead:dn,watcherTurn:gn,menuMove:fn,menuSelect:pn,keyBlip:mn,uiError:hn},vn=new Set([`menuMove`,`menuSelect`,`keyBlip`,`uiError`]),yn=.35,bn=.35,xn=100,R=[`theme1`,`theme2`,`theme3`,`theme4`,`theme5`];function Sn(e,t){let n=null,r=null,i=!1,a=!1,o=null,s=new Map,c=new Map,l=`menu`,u=!1,d=null,f=null,p=0,m=null,h=null,g=0,_=null;function v(e){return new Promise((t,r)=>{let i;try{i=n.decodeAudioData(e,t,r)}catch(e){r(e);return}i&&typeof i.then==`function`&&i.then(t,r)})}async function y(e,t){let n=await fetch(`music/${e}.${t}`);if(!n.ok)throw Error(`http ${n.status}`);return v(await n.arrayBuffer())}function b(e){if(s.has(e))return Promise.resolve(s.get(e));if(c.has(e))return c.get(e);let t=(async()=>{try{if(o===null)try{let t=await y(e,`opus`);return o=`opus`,t}catch{return o=`mp3`,await y(e,`mp3`)}return await y(e,o)}catch{return null}})();return c.set(e,t),t.then(t=>(c.delete(e),t&&s.set(e,t),t))}function x(e){let t=new Set([`title`]),n=R.indexOf(e);n>=0?(t.add(R[n]),t.add(R[(n+1)%R.length])):t.add(`theme1`);for(let e of t)b(e)}function S(e){if(l===`menu`)return`title`;let t=R.indexOf(e);return t<0?`theme1`:u?R[(t+1)%R.length]:R[t]}function C(e){let t=n.createBufferSource();return t.buffer=e,t.connect(r),t.onended=()=>E(t),t}function w(e,t,n){let r=C(t);try{r.start(n)}catch{D();return}d=r,f=e,p=n+t.duration,m=null,h=null,u=!1,x(e)}function T(){if(a||!n||!d)return;let e=n.currentTime;if(!m&&e>=p-bn){let e=S(f),t=s.get(e);if(t){let n=C(t);try{n.start(p),m=n,h=e,g=p+t.duration}catch{D();return}}else b(e)}m&&e>=p&&(d=m,f=h,p=g,m=null,h=null,u=!1,x(f))}function E(e){if(a||e!==d||m)return;let t=S(f);b(t).then(r=>{if(!a&&!(e!==d||m)){if(!r){D();return}w(t,r,Math.max(n.currentTime,p)+.02)}})}function D(){a=!0,_&&=(clearInterval(_),null);try{d&&d.stop()}catch{}d=null,m=null}function ee(){if(i||a)return;n=e();let o=t();!n||!o||(i=!0,r=n.createGain(),r.gain.value=yn,r.connect(o),b(`title`).then(e=>{if(!a){if(!e){D();return}w(`title`,e,n.currentTime+.05),_||=setInterval(T,xn)}}))}function te(e){(e===`menu`||e===`game`)&&(l=e)}function O(){u=!0}return{start:ee,setMode:te,onLevelWon:O,get current(){return f},get planned(){return f?S(f):null},get next(){return h},get mode(){return l},get won(){return u},get format(){return o},get running(){return i&&!a&&!!d},get ctxState(){return n?n.state:`none`}}}var Cn=`sentinel.volume`,wn=5,Tn=[{key:`master`,label:`MASTER`},{key:`music`,label:`MUSIC`},{key:`effects`,label:`EFFECTS`}],En={master:100,music:100,effects:100};function Dn(e){return e=Math.round(Number(e)),Number.isFinite(e)?Math.max(0,Math.min(100,e)):100}function On(){let e={...En};try{let t=localStorage.getItem(Cn);if(t){let n=JSON.parse(t);for(let{key:t}of Tn)n&&n[t]!==void 0&&(e[t]=Dn(n[t]))}}catch{}return e}function kn(e){let t=On();function n(){try{localStorage.setItem(Cn,JSON.stringify(t))}catch{}}function r(){e&&e.setVolumes&&e.setVolumes(t)}function i(e,i){if(e in t)return t[e]=Dn(i),r(),n(),t[e]}function a(e,n){if(e in t)return i(e,t[e]+n)}return r(),{items:Tn,step:wn,get(e){return t[e]},all(){return{...t}},setValue:i,nudge:a}}var z=1e4,An=[3808413,8342305,1928757,5884071,2855155,7161833];function jn(e,t){let n=Math.imul(e+1,2654435761)+t>>>0;return n=(n^n>>>13)>>>0,n=Math.imul(n,1103515245)+12345>>>0,n=(n^n>>>16)>>>0,n%z}function Mn(e){let t=Math.floor(e/z)%z,n=e%z;for(let e of An){let r=(t+jn(n,e))%z;t=n,n=r}return t*z+n}function Nn(e){if(!Number.isInteger(e)||e<0||e>=z*z)return null;let t=Math.floor(e/z),n=e%z;for(let e=An.length-1;e>=0;--e){let r=t,i=(n-jn(t,An[e])+z)%z;n=r,t=i}let r=t*z+n;return r<z?r:null}function Pn(e){return String(e).padStart(4,`0`)}function Fn(e){let t=String(e).padStart(8,`0`);return`${t.slice(0,4)}-${t.slice(4)}`}function In(e){if(typeof e!=`string`)return null;let t=e.replace(/[\s-]/g,``);return/^\d{1,8}$/.test(t)?Number.parseInt(t,10):null}var Ln=10,Rn=1.2,zn=3,Bn=Math.PI/3,Vn=10,Hn=5,Un=3,Wn=5,Gn=6;function Kn(e,t){let n=(t-e)%(Math.PI*2);return n>Math.PI&&(n-=Math.PI*2),n<-Math.PI&&(n+=Math.PI*2),n}var qn=2,Jn=10,Yn=15;function Xn(e){let t=Math.min(Math.floor(e/200),10),n=t/10;return{tier:t,ruggedness:n,treeDensity:.25-.15*n,minSentries:t>=6?3:t>=3?2:1}}function Zn(e){let t=e>>>0;return function(){t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Qn(){let e=In(new URLSearchParams(location.search).get(`seed`)??``),t=e===null?null:Nn(e);return t===null?{present:!1,level:0}:{present:!0,level:t}}var $n=document.getElementById(`screen`),er=$n.getContext(`2d`),B=Pt($n),V=Gt(document.getElementById(`overlay`)),H=qt(),tr=Sn(H.context,H.musicBus),U=kn(H),nr=document.getElementById(`overlay`);function rr(){H.unlock(),tr.start()}window.addEventListener(`keydown`,rr,{once:!0}),window.addEventListener(`mousedown`,rr,{once:!0});var ir=Qn(),W=`splash`,G=null,K=null,q={x:0,y:0,z:0,yaw:0,pitch:0,targetYaw:0,targetPitch:0},J=!1,ar=!1,or=0,sr=!1,Y=null,X=ir.level,cr=null,Z=0,Q=``,$=0,lr=`menu`;function ur(e){let t=[];for(let n=0;n<e.length;n++)for(let r=0;r<e[n].length;r++)e[n][r].flat&&t.push({x:r,z:n,height:e[n][r].height});return t}function dr(e,t){return e[Math.floor(t()*e.length)]}function fr(e,t,n){let r=ur(e.tiles),i=Math.max(...r.map(e=>e.height)),a=dr(r.filter(e=>e.height===i),t);e.addObject({type:`pedestal`,x:a.x,z:a.z});let o=e.addObject({type:`sentinel`,x:a.x,z:a.z,facing:t()*Math.PI*2}),s=Math.min(...r.map(e=>e.height)),c=e.tiles.length,l=(t,n)=>{let r=e.tiles[n][t];return r.flat?r.height:Math.max(...r.h)},u=r.filter(t=>{if(t.height>=i||e.objectsAt(t.x,t.z).length>0)return!1;for(let e=-1;e<=1;e++)for(let n=-1;n<=1;n++){if(!n&&!e)continue;let r=t.x+n,i=t.z+e;if(!(r<0||i<0||r>=c||i>=c)&&l(r,i)>t.height)return!1}return!0}),d=u.slice().sort((e,t)=>t.height-e.height),f=n.minSentries,p=Math.min(3,f+Math.floor(t()*(4-f))),m=d.slice(0,Math.max(p*3,Math.ceil(d.length/3))),h=m.length>=p?m:u,g=[{x:a.x,z:a.z}],_=[];for(let n=0;n<p&&h.length;n++){let n=null,r=-1;for(let e of h){let t=Math.min(...g.map(t=>(t.x-e.x)**2+(t.z-e.z)**2));t>r&&(r=t,n=e)}g.push(n),h=h.filter(e=>e!==n),_.push(e.addObject({type:`sentry`,x:n.x,z:n.z,facing:t()*Math.PI*2,_rotT:t()*10}))}let v=[{x:a.x+.5,y:o.y+1.9,z:a.z+.5},..._.filter(Boolean).map(e=>({x:e.x+.5,y:e.y+1.7,z:e.z+.5}))],y=r.filter(t=>t.height<=s+1&&e.objectsAt(t.x,t.z).length===0),b=t=>({x:t.x+.5,y:e.surfaceY(t.x,t.z)+.05,z:t.z+.5}),x=y.filter(t=>v.every(n=>!e.canSee(n,b(t)))),S=y.filter(t=>!e.canSee(v[0],b(t))),C=x.length?x:S.length?S:y,w=e=>(e.x-a.x)**2+(e.z-a.z)**2;C.sort((e,t)=>w(t)-w(e));let T=dr(C.slice(0,Math.max(1,Math.floor(C.length/10))),t),E=()=>r.filter(t=>e.objectsAt(t.x,t.z).length===0&&!(t.x===T.x&&t.z===T.z)),D=Math.floor(E().length*n.treeDensity);for(let n=0;n<D;n++){let n=E();if(!n.length)break;let r=dr(n,t);e.addObject({type:`tree`,x:r.x,z:r.z})}for(let n=0;n<qn;n++){let n=E();if(!n.length)break;let r=dr(n,t);e.addObject({type:`boulder`,x:r.x,z:r.z})}return{start:T,sentinel:o}}function pr(){let e=Mn(X),t=Xn(X);Fe(X===0?0:e%Ne.length),G=new ce(h(e,t.ruggedness));let n=Zn((e^2654435769)>>>0),{start:r,sentinel:i}=fr(G,n,t);K=new Ee(G,{x:r.x,z:r.z,energy:Jn}),q.yaw=Math.atan2(i.x-r.x,i.z-r.z),q.targetYaw=q.yaw,J=!1,or=0,q.pitch=0,mr(),W=`playing`,tr.setMode(`game`),Lr=0,cr=null,Y=null,V.showScreen(null),V.setEnergy(K.energy,{silent:!0}),V.showIntroTitle(`LANDSCAPE ${Pn(X)}`)}function mr(){q.x=K.camera.x+.5,q.z=K.camera.z+.5,q.y=K.camera.eyeY}function hr(e,t={}){let n=t.out??300,r=t.hold??0,i=t.in??300;sr=!0,V.fadeOut(n,()=>{e&&e(),setTimeout(()=>{V.fadeIn(i,()=>{sr=!1})},r)})}function gr(e){W=`won`,V.showScreen(null);let t=.55,n=K.camera.x+.5,r=K.camera.z+.5,i=1;for(let e of G.objects){let t=e.x+.5-n,a=e.z+.5-r;e._wonDist=Math.hypot(t,a),e._wonDist>i&&(i=e._wonDist)}let a=0,o=0,s=0;for(let e of G.objects)a+=e.x+.5,o+=e.z+.5,s+=1;let c,l;s>0?(c=a/s,l=o/s):(c=n,l=r);let u=c-n,d=l-r;if(Math.hypot(u,d)<Un&&(u=G.width/2-n,d=G.depth/2-r),Math.hypot(u,d)>=.001){let e=Math.atan2(u,d);Math.abs(Kn(q.yaw,e))>.05&&(q.targetYaw=e,J=!0),Math.abs(q.pitch- -.1)>.02&&(q.targetPitch=-.1,ar=!0)}for(let e of G.objects)e._wonDelay=.3+e._wonDist/i*(1.8-t),e.dissolve===void 0&&(e.dissolve=1);Y={t:0,dur:2.1,fade:t,onDone:e}}function _r(e){if(W!==`playing`){if(J){let t=Kn(q.yaw,q.targetYaw);Math.abs(t)<.001?(q.yaw=q.targetYaw,J=!1):q.yaw+=t*(1-Math.exp(-e*Hn))}if(ar){let t=q.targetPitch-q.pitch;Math.abs(t)<.001?(q.pitch=q.targetPitch,ar=!1):q.pitch+=t*(1-Math.exp(-e*Hn))}}if(!Y||!G)return;Y.t+=e;let{t,fade:n}=Y;for(let e of G.objects){if(e._wonDelay===void 0)continue;let r=1-(t-e._wonDelay)/n;r=r>1?1:r<0?0:r,e.dissolve=r}if(Y.t>=Y.dur){let e=Y.onDone;Y=null,e&&e()}}function vr(e){if(!G)return;let t=1-Math.exp(-e*Gn);for(let e of G.objects)if(!(e.type!==`sentinel`&&e.type!==`sentry`)){if(e._displayFacing===void 0){e._displayFacing=e.facing??0;continue}e._displayFacing+=Kn(e._displayFacing,e.facing??0)*t}}function yr(e){let t=G&&G.motes;if(!(!t||!t.length))for(let n=t.length-1;n>=0;--n)t[n].age+=e,t[n].age>=t[n].life&&t.splice(n,1)}var br=V.menuOptionCount;function xr(e){let t=e.padEnd(8,`_`);return`${t.slice(0,4)}-${t.slice(4)}`}function Sr(){W=`menu`,Z=0,tr.setMode(`menu`),V.showMenu(Z)}function Cr(){W=`code`,Q=``,V.showCode(xr(Q),``)}function wr(){if(rr(),ir.present){X=ir.level,pr();return}Sr()}function Tr(e){H.play(`menuSelect`),e===0?hr(()=>{X=0,pr()}):e===1?Cr():Er(`menu`)}function Er(e){lr=e,$=0,W=`settings`,V.showSettings(U.all(),$)}function Dr(){lr===`playing`?(W=`playing`,V.showScreen(null),Fr=performance.now()):(W=`menu`,V.showMenu(Z))}function Or(){let e=In(Q),t=e===null?null:Nn(e);if(Q.length!==8||t===null){H.play(`uiError`),V.showCode(xr(Q),`INVALID CODE`);return}X=t,hr(()=>pr())}function kr(e){let t=e.code,n=t===`Enter`||t===`NumpadEnter`;if(sr||Y){e.preventDefault();return}if(W===`splash`){rr(),n&&(e.preventDefault(),wr());return}if(W===`menu`){t===`ArrowUp`||t===`KeyW`?(e.preventDefault(),Z=(Z+br-1)%br,H.play(`menuMove`),V.showMenu(Z)):t===`ArrowDown`||t===`KeyS`?(e.preventDefault(),Z=(Z+1)%br,H.play(`menuMove`),V.showMenu(Z)):n&&(e.preventDefault(),Tr(Z));return}if(W===`code`){t===`Escape`?(e.preventDefault(),H.play(`menuMove`),Sr()):n?(e.preventDefault(),Or()):t===`Backspace`?(e.preventDefault(),Q.length&&(Q=Q.slice(0,-1),H.play(`keyBlip`),V.showCode(xr(Q),``))):/^(Digit|Numpad)\d$/.test(t)&&(e.preventDefault(),Q.length<8&&(Q+=t.slice(-1),H.play(`keyBlip`),V.showCode(xr(Q),``)));return}if(W===`settings`){let n=U.items[$];if(t===`ArrowUp`||t===`KeyW`)e.preventDefault(),$=($+U.items.length-1)%U.items.length,H.play(`menuMove`),V.setSettingSelection($);else if(t===`ArrowDown`||t===`KeyS`)e.preventDefault(),$=($+1)%U.items.length,H.play(`menuMove`),V.setSettingSelection($);else if(t===`ArrowLeft`||t===`KeyA`){e.preventDefault();let t=U.nudge(n.key,-U.step);H.play(`keyBlip`),V.setSettingValue($,t)}else if(t===`ArrowRight`||t===`KeyD`){e.preventDefault();let t=U.nudge(n.key,U.step);H.play(`keyBlip`),V.setSettingValue($,t)}else t===`Escape`&&(e.preventDefault(),H.play(`menuMove`),Dr());return}if(W===`playing`){t===`Escape`&&(e.preventDefault(),Er(`playing`));return}(W===`won`||W===`dead`||W===`complete`)&&t===`Escape`&&(e.preventDefault(),hr(()=>Sr()))}window.addEventListener(`keydown`,kr);function Ar(e){if(W!==`code`||!e)return;let t=e.replace(/\D/g,``).slice(0,8);t&&(Q=t,V.showCode(xr(Q),``))}window.addEventListener(`paste`,e=>{W===`code`&&(e.preventDefault(),Ar(e.clipboardData?e.clipboardData.getData(`text`):``))}),window.addEventListener(`keydown`,e=>{W===`code`&&(e.ctrlKey||e.metaKey)&&e.code===`KeyV`&&(!navigator.clipboard||!navigator.clipboard.readText||navigator.clipboard.readText().then(e=>{Ar(e)}).catch(()=>{}))}),nr.addEventListener(`click`,e=>{if(rr(),!(sr||Y)){if(W===`splash`){wr();return}if(W===`menu`){let t=e.target.closest(`.hud-menu-option`);t&&(Z=Number(t.dataset.index),Tr(Z))}}}),nr.addEventListener(`mousemove`,e=>{if(W!==`menu`)return;let t=e.target.closest(`.hud-menu-option`);if(t){let e=Number(t.dataset.index);e!==Z&&(Z=e,H.play(`menuMove`),V.showMenu(Z))}});var jr=null,Mr=0;function Nr(){let e=performance.now();e-Mr>=50&&(Mr=e,H.play(`keyBlip`))}function Pr(e,t){let n=e.getBoundingClientRect();return n.width<=0?0:Math.max(0,Math.min(100,(t-n.left)/n.width*100))}nr.addEventListener(`mousedown`,e=>{if(W!==`settings`)return;let t=e.target.closest(`.hud-setting-row`);t&&($=Number(t.dataset.index),V.setSettingSelection($));let n=e.target.closest(`.hud-setting-track`);if(n){e.preventDefault();let t=Number(n.dataset.index),r=n.dataset.key;jr={index:t,key:r,track:n};let i=U.setValue(r,Pr(n,e.clientX));Nr(),V.setSettingValue(t,i)}}),window.addEventListener(`mousemove`,e=>{if(!jr)return;let t=U.setValue(jr.key,Pr(jr.track,e.clientX));Nr(),V.setSettingValue(jr.index,t)}),window.addEventListener(`mouseup`,()=>{jr=null});var Fr=performance.now(),Ir=0,Lr=0;function Rr(e){let t=Math.min((e-Fr)/1e3,.1);Fr=e;let n=W===`playing`||W===`won`||W===`dead`||W===`complete`;if(document.body.classList.toggle(`show-footer`,n),H.setAmbient(n,W===`playing`&&K?K.scanState??0:0),W===`playing`){let e=B.held.fast?zn:Rn;if((B.held.yawLeft||B.held.yawRight)&&(B.held.yawLeft&&(q.yaw-=e*t),B.held.yawRight&&(q.yaw+=e*t),q.targetYaw=q.yaw,J=!1),B.held.pitchUp&&(q.pitch=Math.min(Bn,q.pitch+e*t)),B.held.pitchDown&&(q.pitch=Math.max(-Bn,q.pitch-e*t)),J){let e=Kn(q.yaw,q.targetYaw);Math.abs(e)<.001?(q.yaw=q.targetYaw,J=!1):q.yaw+=e*(1-Math.exp(-t*Vn))}}let r=null;if(W===`playing`){let e=T(q,B.cursor.x,B.cursor.y);r=G.pickTarget(e.origin,e.dir)}let i=B.pollActions();if(!(W===`splash`||W===`menu`||W===`code`||W===`settings`))for(let e of i){if(e===`start`){W!==`playing`&&!sr&&!Y&&hr(()=>{W===`won`&&cr!==null?X=cr:W===`complete`&&(X=0),pr()});continue}if(e===`mute`){let e=H.toggleMuted();V.showMessage(e?`Sound off`:`Sound on`,1500);continue}if(W===`playing`){if(e===`uturn`){J||=(q.targetYaw=q.yaw+Math.PI,!0);continue}K.doAction(e,r),K.pendingFacing!==null&&(q.targetYaw=K.pendingFacing,J=!0,K.pendingFacing=null),mr()}}if(W===`playing`){Ir+=t;let e=1/Ln;for(;Ir>=e;)Ir-=e,K.tick(e);mr(),V.setEnergy(K.energy),V.setScanState(K.scanState??0),V.setWatchers(G.objects.some(e=>e.type===`sentinel`),G.objects.filter(e=>e.type===`sentry`).length);for(let e of K.messages.splice(0))V.showMessage(e,2500);for(let e of K.events.splice(0)){let t=typeof e==`string`?e:e.type;if(t===`watcherTurn`){let t=e.x-K.camera.x,n=e.z-K.camera.z,r=Math.max(0,1-Math.hypot(t,n)/Yn);r>0&&H.play(`watcherTurn`,{gain:r});continue}H.play(t),t===`hyperspace`?V.flash(`hyperspace`):t===`transfer`?V.flash(`transfer`):t===`drain`&&(or=Math.max(or,.6))}if(K.scanState!==Lr&&(K.scanState===1?H.play(`seen`):K.scanState===2&&H.play(`draining`),Lr=K.scanState),K.status===`won`){tr.onLevelWon();let e=Mn(X),t=K.energy,n=X+t;gr(()=>{n>9999?(W=`complete`,hr(()=>V.showScreen(`complete`,[`LANDSCAPE ${Pn(X)} — REPLAY CODE ${Fn(e)}`,`FINAL ENERGY ${t}`]))):(W=`won`,cr=n,hr(()=>V.showScreen(`won`,[`REPLAY CODE ${Fn(e)}`,`NEXT LANDSCAPE ${Pn(n)}`])))})}else K.status===`dead`&&(W=`dead`,hr(()=>V.showScreen(`dead`,[`REPLAY CODE ${Fn(Mn(X))}`]),{hold:500}))}vr(t),yr(t),_r(t);let a=q;or>.001?(or*=Math.exp(-t*Wn),a={...q,yaw:q.yaw+(Math.random()-.5)*.01*or,pitch:q.pitch+(Math.random()-.5)*.01*or}):or=0,G?Et(er,G,a,{crosshair:W===`playing`,cursor:B.cursor,pickTile:r?r.tile:null,pick:r,time:e/1e3,skipObjectId:K?K.playerShellId:null}):(er.fillStyle=`#000`,er.fillRect(0,0,$n.width,$n.height)),requestAnimationFrame(Rr)}V.showSplash(),requestAnimationFrame(Rr),window.__dbg={camera:q,get world(){return G},get game(){return K},get state(){return W},get settings(){return U.all()}},window.__music=tr,window.__audio=H;