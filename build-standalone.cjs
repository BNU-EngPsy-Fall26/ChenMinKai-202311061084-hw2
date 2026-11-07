/* 将本地源码打包成一个离线HTML。运行无需外部库。 */
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname,dist=path.join(root,'dist');
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dist,'css/style.css'),'utf8');
html=html.replace('  <link rel="stylesheet" href="css/style.css?v=2.1.1">','  <style>\n'+css+'\n  </style>');
html=html.replace(/^\s*<script defer src="[^"]+"><\/script>\s*$/gm,'');
const scripts=['collection-config.js','build-info.js','core.js','results-data.js','app.js'].map(file=>{
  const content=fs.readFileSync(path.join(dist,'js',file),'utf8').replace(/<\/script/gi,'<\\/script');
  return '<script>\n'+content+'\n</script>';
}).join('\n');
html=html.replace('</body>',scripts+'\n</body>');
const destination=path.join(root,'..','打开注意实验室.html');
fs.writeFileSync(destination,html);
console.log(JSON.stringify({file:destination,bytes:Buffer.byteLength(html),kind:'self-contained offline HTML'}));
