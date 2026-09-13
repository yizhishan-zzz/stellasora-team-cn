(async () => {
  const B = 'https://raw.githubusercontent.com/AutumnVN/ss-data/refs/heads/main/';
  const r = await fetch(B + 'character.json');
  console.log('character.json: HTTP ' + r.status);
  const ch = await r.json();
  const ids = Object.keys(ch).map(Number).sort((a, b) => a - b);
  console.log('  ss-data 旅人数量: ' + ids.length + '   id 范围: ' + ids[0] + ' ~ ' + ids[ids.length - 1]);
  const fs = require('fs');
  const local = JSON.parse(fs.readFileSync('assets/data/characters.json', 'utf8')).characters;
  const localSids = local.map(c => c.sid).sort((a, b) => a - b);
  console.log('  本地网站旅人数量: ' + local.length);
  const onlyRemote = ids.filter(i => localSids.indexOf(i) < 0);
  const onlyLocal = localSids.filter(i => ids.indexOf(i) < 0);
  console.log('');
  console.log('  >>> ss-data 有、网站没有的旅人 sid: ' + (onlyRemote.length ? onlyRemote.join(',') : '无'));
  console.log('  >>> 网站有、ss-data 没有的旅人 sid: ' + (onlyLocal.length ? onlyLocal.join(',') : '无'));
  const d = await (await fetch(B + 'disc.json')).json();
  const dids = Object.keys(d).map(Number).sort((a, b) => a - b);
  const localP = JSON.parse(fs.readFileSync('assets/data/patterns.json', 'utf8')).patterns;
  const localPsid = localP.map(p => p.sid).sort((a, b) => a - b);
  console.log('');
  console.log('  ss-data 秘纹数量: ' + dids.length + '  id 范围: ' + dids[0] + ' ~ ' + dids[dids.length - 1]);
  console.log('  本地网站秘纹数量: ' + localP.length);
  const pRemote = dids.filter(i => localPsid.indexOf(i) < 0);
  console.log('  >>> ss-data 有、网站没有的秘纹 sid: ' + (pRemote.length ? pRemote.join(',') : '无'));
  if (pRemote.length) {
    console.log('     这些秘纹的名字:');
    pRemote.slice(0, 15).forEach(i => console.log('       ' + i + '  ' + (d[String(i)].nameCN || d[String(i)].name)));
  }
  const one = ch[String(ids[ids.length - 1])];
  console.log('');
  console.log('  最新旅人的字段结构: ' + Object.keys(one).join(', '));
})().catch(e => console.log('ERR', e.message));
