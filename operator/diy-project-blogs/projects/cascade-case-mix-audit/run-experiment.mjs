import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
let state = cfg.seed >>> 0;
const rnd = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
const groups = Object.keys(cfg.population);
const scenarios = {
  shifted: {
    strong: {routine:.965, important:.935, critical:.900},
    small: {routine:.955, important:.895, critical:.700},
    scoreShift: {routine:0, important:.04, critical:.22}
  },
  calibrated_control: {
    strong: {routine:.965, important:.935, critical:.900},
    small: {routine:.955, important:.895, critical:.700},
    scoreShift: {routine:0, important:0, critical:0}
  },
  equal_skill_control: {
    strong: {routine:.965, important:.935, critical:.900},
    small: {routine:.965, important:.935, critical:.900},
    scoreShift: {routine:0, important:.04, critical:.22}
  }
};
const chooseGroup = u => u < .70 ? 'routine' : u < .95 ? 'important' : 'critical';
const clamp = x => Math.max(0.01, Math.min(.99, x));
const rows = [];

for (const [scenarioName, spec] of Object.entries(scenarios)) {
  for (let repeat=0; repeat<cfg.repeats; repeat++) {
    const outcomes = [];
    for (let i=0; i<cfg.requestsPerRepeat; i++) {
      const group = chooseGroup(rnd());
      const strongCorrect = rnd() < spec.strong[group];
      const smallCorrect = rnd() < spec.small[group];
      const baseScore = smallCorrect ? .74 + .22*rnd() : .30 + .48*rnd();
      const score = clamp(baseScore + spec.scoreShift[group]);
      outcomes.push({group,strongCorrect,smallCorrect,score});
    }
    for (const [policy, thresholds] of Object.entries(cfg.policies)) {
      const sums = Object.fromEntries(groups.map(g => [g,{n:0,correct:0,strong:0}]));
      let correct=0,strong=0;
      for (const o of outcomes) {
        let useStrong;
        if (policy === 'oracle') useStrong = !o.smallCorrect && o.strongCorrect;
        else useStrong = o.score < thresholds[o.group];
        const ok = useStrong ? o.strongCorrect : o.smallCorrect;
        correct += ok; strong += useStrong;
        const s=sums[o.group]; s.n++; s.correct += ok; s.strong += useStrong;
      }
      const globalAccuracy=correct/outcomes.length;
      const cost=(strong*cfg.strongCostPerRequest+(outcomes.length-strong)*cfg.smallCostPerRequest)/outcomes.length;
      rows.push({scenario:scenarioName,repeat,policy,globalAccuracy,cost,strongRouteRate:strong/outcomes.length,
        ...Object.fromEntries(groups.flatMap(g => [[`${g}Accuracy`,sums[g].correct/sums[g].n],[`${g}StrongRate`,sums[g].strong/sums[g].n]]))});
    }
  }
}

const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
const quantile = (xs,p) => {const a=[...xs].sort((a,b)=>a-b); return a[Math.floor((a.length-1)*p)];};
function bootstrap(values, samples=cfg.bootstrapSamples){
  const means=[]; for(let b=0;b<samples;b++){let s=0;for(let i=0;i<values.length;i++)s+=values[Math.floor(rnd()*values.length)];means.push(s/values.length)}
  return [quantile(means,.025),quantile(means,.975)];
}
const aggregates=[];
for(const scenario of Object.keys(scenarios)) for(const policy of Object.keys(cfg.policies)){
  const cell=rows.filter(r=>r.scenario===scenario&&r.policy===policy);
  const strongRows=rows.filter(r=>r.scenario===scenario&&r.policy==='strong_only');
  const falseApprovals=cell.map((r,i)=>{
    const globalPass=(strongRows[i].globalAccuracy-r.globalAccuracy)*100<=cfg.globalAccuracyTolerancePoints;
    const criticalFail=(strongRows[i].criticalAccuracy-r.criticalAccuracy)*100>cfg.stratumAccuracyTolerancePoints;
    return globalPass&&criticalFail?1:0;
  });
  const metrics={};
  for(const k of ['globalAccuracy','criticalAccuracy','cost','strongRouteRate','criticalStrongRate']){
    const vals=cell.map(r=>r[k]); metrics[k]={mean:mean(vals),ci95:bootstrap(vals)};
  }
  metrics.falseApprovalRate={mean:mean(falseApprovals),ci95:bootstrap(falseApprovals)};
  aggregates.push({scenario,policy,repeats:cell.length,metrics});
}
fs.writeFileSync(path.join(dir,'repeat-results.csv'), Object.keys(rows[0]).join(',')+'\n'+rows.map(r=>Object.values(r).join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(dir,'aggregate-results.json'),JSON.stringify({config:cfg,aggregates},null,2)+'\n');
const focal=Object.fromEntries(aggregates.filter(x=>x.scenario==='shifted').map(x=>[x.policy,x]));
const stats={definition:'False approval means global accuracy is within 0.5 points of strong-only while critical accuracy is more than 1.0 point worse.',focal,negativeControls:aggregates.filter(x=>x.scenario!=='shifted')};
fs.writeFileSync(path.join(dir,'statistical-analysis.json'),JSON.stringify(stats,null,2)+'\n');
const pct=x=>(100*x).toFixed(2)+'%'; const money=x=>'$'+x.toFixed(4);
const lines=['scenario=shifted',`repeats=${cfg.repeats}`,`requests_per_repeat=${cfg.requestsPerRepeat}`];
for(const p of Object.keys(cfg.policies)){const m=focal[p].metrics;lines.push(`${p} global=${pct(m.globalAccuracy.mean)} critical=${pct(m.criticalAccuracy.mean)} cost=${money(m.cost.mean)} strong_route=${pct(m.strongRouteRate.mean)} false_approval=${pct(m.falseApprovalRate.mean)}`)}
fs.writeFileSync(path.join(dir,'output.txt'),lines.join('\n')+'\n');

const policies=['strong_only','global_threshold','stratum_threshold','oracle'];
const colors=['#8ea1b8','#f59e0b','#2dd4bf','#a78bfa'];
const bars=policies.map((p,i)=>{const m=focal[p].metrics;const h=m.criticalAccuracy.mean*250;const x=105+i*190;return `<rect x="${x}" y="${400-h}" width="104" height="${h}" rx="6" fill="${colors[i]}"/><text x="${x+52}" y="${388-h}" text-anchor="middle" class="value">${pct(m.criticalAccuracy.mean)}</text><text x="${x+52}" y="438" text-anchor="middle" class="label">${p.replaceAll('_',' ')}</text><text x="${x+52}" y="462" text-anchor="middle" class="small">${money(m.cost.mean)} / request</text>`}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><title>Critical-workload accuracy under four cascade policies</title><desc>Measured critical accuracy and per-request cost across strong-only, global threshold, stratum threshold, and oracle routing in 600 repeats.</desc><style>.title{font:700 28px system-ui;fill:#f8fafc}.sub{font:16px system-ui;fill:#a9b6c8}.label{font:600 14px system-ui;fill:#e5e7eb}.small{font:13px system-ui;fill:#a9b6c8}.value{font:700 17px system-ui;fill:#f8fafc}</style><rect width="960" height="540" fill="#09111f"/><text x="56" y="58" class="title">One global threshold hides critical-workload harm</text><text x="56" y="88" class="sub">12,000 paired requests × 600 repeats · shifted-confidence scenario</text><line x1="72" y1="400" x2="890" y2="400" stroke="#42516a"/><line x1="72" y1="175" x2="890" y2="175" stroke="#42516a" stroke-dasharray="6 6"/><text x="76" y="166" class="small">90% strong-only reference</text>${bars}<text x="56" y="512" class="sub">Global-threshold false approval: ${pct(focal.global_threshold.metrics.falseApprovalRate.mean)} · stratum-aware: ${pct(focal.stratum_threshold.metrics.falseApprovalRate.mean)}</text></svg>`;
fs.writeFileSync(path.join(dir,'cascade-case-mix-results.svg'),svg+'\n');
console.log(lines.join('\n'));
