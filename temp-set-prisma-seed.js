const fs=require('fs');
const p=require('/app/package.json');
p.prisma={seed:'node prisma/seed.js'};
fs.writeFileSync('/app/package.json', JSON.stringify(p, null, 2)+'\n');
