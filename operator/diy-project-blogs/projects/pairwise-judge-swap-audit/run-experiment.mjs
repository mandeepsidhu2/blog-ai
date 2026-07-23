import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
let state = cfg.seed >>> 0;
const rnd = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
const mean = xs => xs.reduce((a,b) => a + b, 0) / xs.length;
const quantile = (xs,p) => { const a=[...xs].sort((a,b)=>a-b); return a[Math.floor((a.length-1)*p)]; };
const scenarios = {
  focal_both_biases: {position: cfg.positionOverrideRate, style: cfg.styleFlipRate},
  position_only_control: {position: cfg.positionOverrideRate, style: 0},
  style_only_control: {position: 0, style: cfg.styleFlipRate},
  unbiased_negative_control: {position: 0, style: 0}
};
const policies = ['single_candidate_first','randomized_single','swap_drop_discordant','swap_tie_aware','swap_escalate_discordant','truth_reference'];
const rows=[];

function judge(contentWinner, candidateFirst, positionRate) {
  if (rnd() < positionRate) return candidateFirst ? 'candidate' : 'incumbent';
  return contentWinner;
}

for (const [scenario, bias] of Object.entries(scenarios)) {
  for (let repeat=0; repeat<cfg.repeats; repeat++) {
    const pairs=[];
    for (let i=0; i<cfg.pairsPerRepeat; i++) {
      const truth = rnd() < cfg.trueCandidateWinRate ? 'candidate' : 'incumbent';
      const hard = rnd() < cfg.hardPairRate;
      const accuracy = hard ? cfg.hardJudgeAccuracy : cfg.easyJudgeAccuracy;
      let contentWinner = rnd() < accuracy ? truth : (truth === 'candidate' ? 'incumbent' : 'candidate');
      const styleExposed = rnd() < cfg.styleExposureRate;
      if (styleExposed && contentWinner === 'incumbent' && rnd() < bias.style) contentWinner = 'candidate';
      const ab = judge(contentWinner, true, bias.position);
      const ba = judge(contentWinner, false, bias.position);
      const randomOne = rnd() < .5 ? ab : ba;
      pairs.push({truth, hard, styleExposed, ab, ba, randomOne});
    }
    const trueRate=mean(pairs.map(p=>p.truth==='candidate'?1:0));
    for (const policy of policies) {
      let scores=[]; let discordant=0; let escalated=0;
      for (const p of pairs) {
        if (policy === 'truth_reference') scores.push(p.truth==='candidate'?1:0);
        else if (policy === 'single_candidate_first') scores.push(p.ab==='candidate'?1:0);
        else if (policy === 'randomized_single') scores.push(p.randomOne==='candidate'?1:0);
        else if (p.ab === p.ba) scores.push(p.ab==='candidate'?1:0);
        else {
          discordant++;
          if (policy === 'swap_tie_aware') scores.push(.5);
          if (policy === 'swap_escalate_discordant') { scores.push(p.truth==='candidate'?1:0); escalated++; }
        }
      }
      const estimate=mean(scores);
      rows.push({scenario,repeat,policy,trueRate,estimate,biasPoints:100*(estimate-trueRate),promotion:Number(estimate>cfg.promotionThreshold),discordantRate:discordant/pairs.length,coverage:scores.length/pairs.length,escalationRate:escalated/pairs.length});
    }
  }
}

function bootstrap(values, samples=cfg.bootstrapSamples) {
  const means=[];
  for(let b=0;b<samples;b++){let s=0;for(let i=0;i<values.length;i++)s+=values[Math.floor(rnd()*values.length)];means.push(s/values.length);}
  return [quantile(means,.025),quantile(means,.975)];
}
const aggregates=[];
for (const scenario of Object.keys(scenarios)) for (const policy of policies) {
  const cell=rows.filter(r=>r.scenario===scenario&&r.policy===policy);
  const metrics={};
  for (const key of ['trueRate','estimate','biasPoints','promotion','discordantRate','coverage','escalationRate']) {
    const values=cell.map(r=>r[key]); metrics[key]={mean:mean(values),ci95:bootstrap(values)};
  }
  aggregates.push({scenario,policy,repeats:cell.length,metrics});
}
fs.writeFileSync(path.join(dir,'repeat-results.csv'),Object.keys(rows[0]).join(',')+'\n'+rows.map(r=>Object.values(r).join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(dir,'aggregate-results.json'),JSON.stringify({config:cfg,scenarios,aggregates},null,2)+'\n');
const focal=Object.fromEntries(aggregates.filter(x=>x.scenario==='focal_both_biases').map(x=>[x.policy,x]));
const controls=aggregates.filter(x=>x.scenario!=='focal_both_biases');
fs.writeFileSync(path.join(dir,'statistical-analysis.json'),JSON.stringify({definition:`False promotion is estimate > ${cfg.promotionThreshold} when the generator's candidate win probability is ${cfg.trueCandidateWinRate}.`,focal,controls},null,2)+'\n');
const pct=x=>(100*x).toFixed(2)+'%';
const lines=[`repeats=${cfg.repeats}`,`pairs_per_repeat=${cfg.pairsPerRepeat}`,`true_candidate_probability=${pct(cfg.trueCandidateWinRate)}`];
for(const p of policies){const m=focal[p].metrics;lines.push(`${p} estimate=${pct(m.estimate.mean)} bias=${m.biasPoints.mean.toFixed(2)}pp false_promotion=${pct(m.promotion.mean)} discordant=${pct(m.discordantRate.mean)} coverage=${pct(m.coverage.mean)}`);}
fs.writeFileSync(path.join(dir,'output.txt'),lines.join('\n')+'\n');

const chartPolicies=['single_candidate_first','randomized_single','swap_drop_discordant','swap_tie_aware','swap_escalate_discordant'];
const colors=['#fb7185','#f59e0b','#a78bfa','#38bdf8','#2dd4bf'];
const bars=chartPolicies.map((p,i)=>{const v=focal[p].metrics.estimate.mean;const h=(v-.40)*1100;const x=82+i*170;return `<rect x="${x}" y="405" width="108" height="${-h}" rx="6" fill="${colors[i]}"/><text x="${x+54}" y="${393-h}" text-anchor="middle" class="value">${pct(v)}</text><text x="${x+54}" y="438" text-anchor="middle" class="label">${p.replace('single_candidate_first','candidate first').replace('randomized_single','random one').replace('swap_drop_discordant','swap + drop').replace('swap_tie_aware','swap + tie').replace('swap_escalate_discordant','swap + review')}</text>`}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><title>Pairwise judge estimates under position and style bias</title><desc>Candidate win-rate estimates across five evaluation policies in 800 repeated samples of 500 pairs, compared with the 48 percent latent truth.</desc><style>.title{font:700 28px system-ui;fill:#f8fafc}.sub{font:16px system-ui;fill:#a9b6c8}.label{font:600 13px system-ui;fill:#e5e7eb}.value{font:700 17px system-ui;fill:#f8fafc}.note{font:14px system-ui;fill:#a9b6c8}</style><rect width="960" height="540" fill="#09111f"/><text x="52" y="58" class="title">Order swapping fixes only the bias it can see</text><text x="52" y="88" class="sub">800 repeats × 500 pairs · 48% true candidate win probability</text><line x1="54" y1="405" x2="910" y2="405" stroke="#42516a"/><line x1="54" y1="317" x2="910" y2="317" stroke="#f8fafc" stroke-dasharray="7 7"/><text x="60" y="307" class="note">48% latent truth</text>${bars}<text x="52" y="500" class="note">Discordant swaps expose position instability; consistent style-correlated errors survive every swap.</text></svg>`;
fs.writeFileSync(path.join(dir,'pairwise-judge-swap-results.svg'),svg+'\n');
console.log(lines.join('\n'));
