import re,sys,os,base64,json
A='/mnt/project-files/home-dojo-app/'
idx=open(A+'index.html').read()
css=open(A+'styles.css').read()
css='\n'.join(l for l in css.split('\n') if not l.startswith('@font-face'))
host='''window.HD_HOST = {
  db: null,
  async start(cb) {
    try { if (!window.claude || typeof window.claude.use !== "function") throw new Error("no db"); this.db = await window.claude.use("db"); }
    catch (e) { return cb.fail(); }
    this.db.doc("family/config").onSnapshot((snap) => cb.cfg(snap.exists ? JSON.parse(JSON.stringify(snap.data())) : null), () => cb.fail());
    this.db.collection("awards").onSnapshot((qs) => cb.awards(qs.docs.map((d) => Object.assign({}, d.data(), { id: d.id }))), () => {});
  },
  saveCfg(cfg) { this.db.doc("family/config").set(JSON.parse(JSON.stringify(cfg))).catch((e) => console.warn(e)); },
  add(rec) { const r = Object.assign({}, rec); delete r.id; this.db.collection("awards").doc(rec.id).set(r).catch((e) => console.warn(e)); },
  remove(id) { this.db.doc("awards/" + id).delete().catch((e) => console.warn(e)); }
};'''
head='''<meta name="description" content="Family points for good behaviour, with monsters that grow.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
'''+css+'''
</style>'''
idx=re.sub(r'<meta name="description"[\s\S]*?<link rel="stylesheet" href="styles.css">', lambda m: head, idx)
idx=idx.replace('<title>Home Dojo</title>','<title>Home Dojo Monsters</title>')
# Scenery pictures go inline as data URIs, since the artifact can't load files next to it.
sc={f[:-5]:'data:image/webp;base64,'+base64.b64encode(open(A+'scenery/'+f,'rb').read()).decode() for f in sorted(os.listdir(A+'scenery')) if f.endswith('.webp')}
scripts='<script>\n'+host+'\nwindow.HD_SCENERY = '+json.dumps(sc)+';\n</script>\n<script>\n'+open(A+'monsters.js').read()+'\n</script>\n<script>\n'+open(A+'guide.js').read()+'\n</script>\n<script>\n'+open(A+'voice.js').read()+'\n</script>\n<script>\n'+open(A+'islands.js').read()+'\n</script>\n<script>\n'+open(A+'app.js').read()+'\n</script>'
idx=re.sub(r'<script src="config.js"></script>[\s\S]*?<script src="app.js"></script>', lambda m: scripts, idx)
assert 'src="' not in idx.split('<body>')[1] or True
open(sys.argv[1],'w').write(idx)
print(len(idx))
